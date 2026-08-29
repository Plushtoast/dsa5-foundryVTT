import DSA5_Utility from '../helpers/utility-dsa5.js';
import QueryOrchestrator from '../queries/query-orchestrator.js';

export default class RegenerationHelper {
  static STAT_TYPES = ['LeP', 'AsP', 'KaP'];
  static ROLL_REQUEST_FLAG = 'rollRequest';
  static ROLL_REQUEST_QUERY_TYPE = 'dsa5.rollRequest';
  static #POOL_BY_STAT = {
    LeP: 'wounds',
    AsP: 'astralenergy',
    KaP: 'karmaenergy',
  };

  static normalizeAmounts({ LeP, AsP, KaP } = {}) {
    return {
      LeP: Number(LeP) || 0,
      AsP: Number(AsP) || 0,
      KaP: Number(KaP) || 0,
    };
  }

  static hasNegative(amounts) {
    const source = this.normalizeAmounts(amounts);
    return this.STAT_TYPES.some((stat) => source[stat] < 0);
  }

  static currentPoolValue(actor, stat) {
    const pool = this.#POOL_BY_STAT[stat];
    return Math.max(0, Number(actor?.system?.status?.[pool]?.value) || 0);
  }

  static resolveOverflow(actor, amounts) {
    const result = this.normalizeAmounts(amounts);
    for (const stat of ['AsP', 'KaP']) {
      if (result[stat] >= 0) continue;
      const applied = Math.max(result[stat], -this.currentPoolValue(actor, stat));
      result.LeP += result[stat] - applied;
      result[stat] = applied;
    }
    return result;
  }

  static async confirmNegative(actor, source, resolved) {
    const overflowed = this.STAT_TYPES.some((stat) => source[stat] !== resolved[stat]);
    const rows = this.STAT_TYPES
      .filter((stat) => source[stat] !== 0 || resolved[stat] !== 0)
      .map((stat) => {
        const label = _loc(`CHARAbbrev.${stat}`);
        if (source[stat] === resolved[stat]) return `<li>${label}: ${source[stat]}</li>`;
        return `<li>${label}: ${source[stat]} → ${resolved[stat]}</li>`;
      })
      .join('');

    return foundry.applications.api.DialogV2.confirm({
      id: actor?.id ? `dsa-negative-regeneration-${actor.id}` : 'dsa-negative-regeneration',
      window: { title: 'DIALOG.negativeRegeneration' },
      content: `<p>${_loc('DIALOG.negativeRegenerationHint')}</p>${overflowed ? `<p>${_loc('DIALOG.negativeRegenerationOverflow')}</p>` : ''}<ul>${rows}</ul>`,
      rejectClose: false,
    });
  }

  static async applyToActor(actor, amounts, { skipConfirm = false } = {}) {
    if (!actor) return false;

    const source = this.normalizeAmounts(amounts);
    const resolved = this.resolveOverflow(actor, source);
    if (!skipConfirm && this.hasNegative(source) && !amounts.negativeRegenerationConfirmed) {
      const confirmed = await this.confirmNegative(actor, source, resolved);
      if (!confirmed) return false;
    }

    const wounds = actor.system.status.wounds;
    const karma = actor.system.status.karmaenergy;
    const astral = actor.system.status.astralenergy;
    const hookOptions = {
      heal: true,
      lepAmount: resolved.LeP,
      updateData: {
        'system.status.wounds.value': Math.clamp((Number(wounds.value) || 0) + resolved.LeP, 0, wounds.max),
        'system.status.karmaenergy.value': Math.clamp((Number(karma.value) || 0) + resolved.KaP, 0, karma.max),
        'system.status.astralenergy.value': Math.clamp((Number(astral.value) || 0) + resolved.AsP, 0, astral.max),
        'system.status.temporaryLeP.value': 0,
        'system.status.temporaryLeP.max': 0,
      },
    };
    await DSA5_Utility.callAsyncHooks('preApplyDamage', [actor, hookOptions]);
    await actor.update(hookOptions.updateData);
    return true;
  }

  static formatResultRows(data) {
    return this.STAT_TYPES
      .filter((stat) => data?.[stat] != null)
      .map((stat) => ({
        stat,
        label: _loc(`CHARAbbrev.${stat}`),
        value: data[stat],
      }));
  }

  static formatTooltip(data) {
    const rows = this.formatResultRows(data);
    if (!rows.length) return _loc('success');
    return rows.map((row) => `${row.label}: ${row.value}`).join(', ');
  }

  static hasRegenStats(source) {
    return this.STAT_TYPES.some((stat) => source?.[stat] !== undefined);
  }

  static isApplied(message) {
    return !!message?.flags?.data?.healApplied;
  }

  static getPostData(message) {
    return message?.flags?.data?.postData;
  }

  static getActorFromMessage(message) {
    return DSA5_Utility.getSpeaker(message.speaker) ||
      (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null);
  }

  static canApplyActor(actor, { allowGM = false } = {}) {
    return !!actor && (actor.isOwner || (allowGM && game.user.isGM));
  }

  static canApplyMessage(message, { allowGM = false } = {}) {
    if (!message?.flags?.data || this.isApplied(message)) return false;

    const actor = this.getActorFromMessage(message);
    if (!this.canApplyActor(actor, { allowGM })) return false;

    return this.hasRegenStats(this.getPostData(message));
  }

  static async markApplied(message) {
    const update = {
      'flags.data.healApplied': true,
      content: message.content.replace(/<\/div>$/, '<i class="fas fa-check" style="float:right"></i></div>'),
    };

    if (game.user.isGM) {
      await message.update(update);
    } else {
      game.socket.emit('system.dsa5', {
        type: 'updateMsg',
        payload: {
          id: message.id,
          updateData: update,
        },
      });
    }
  }

  static async applyFromMessage(message, { allowGM = false, notifyOnDenied = true } = {}) {
    const actor = this.getActorFromMessage(message);

    if (!this.canApplyActor(actor, { allowGM })) {
      if (notifyOnDenied) {
        ui.notifications.error('DSAError.DamagePermission', { localize: true });
      }
      return false;
    }

    if (!message?.flags?.data || this.isApplied(message)) return false;

    const postData = this.getPostData(message);
    if (!this.hasRegenStats(postData)) return false;

    const applied = await this.applyToActor(actor, postData);
    if (!applied) return false;

    await this.markApplied(message);
    return true;
  }

  static getRollRequestPostData(entry) {
    const rollMessageId = entry.resultDetails?.messageId;
    const rollMessage = rollMessageId ? game.messages.get(rollMessageId) : null;
    return rollMessage ? this.getPostData(rollMessage) : entry.resultDetails;
  }

  static isRollRequestEntryApplied(entry) {
    const rollMessageId = entry.resultDetails?.messageId;
    if (!rollMessageId) return false;

    const rollMessage = game.messages.get(rollMessageId);
    return rollMessage ? this.isApplied(rollMessage) : false;
  }

  static canApplyRollRequestEntry(entry) {
    if (entry.status !== 'success') return false;
    if (this.isRollRequestEntryApplied(entry)) return false;

    const actor = game.actors.get(entry.actorId);
    if (!this.canApplyActor(actor, { allowGM: true })) return false;

    return this.hasRegenStats(this.getRollRequestPostData(entry));
  }

  static async applyRollRequestEntry(entry) {
    const rollMessageId = entry.resultDetails?.messageId;
    const rollMessage = rollMessageId ? game.messages.get(rollMessageId) : null;

    if (rollMessage) {
      return this.applyFromMessage(rollMessage, { allowGM: true, notifyOnDenied: false });
    }

    if (!this.canApplyRollRequestEntry(entry)) return false;

    const actor = game.actors.get(entry.actorId);
    const postData = entry.resultDetails;
    return this.applyToActor(actor, postData);
  }

  static canApplyAllFromRollRequest(message) {
    const state = message?.getFlag('dsa5', this.ROLL_REQUEST_FLAG);
    if (state?.category !== 'regeneration') return false;

    return state.recipients?.some((entry) => this.canApplyRollRequestEntry(entry));
  }

  static async applyAllFromRollRequest(messageId) {
    const message = game.messages.get(messageId);
    const state = message?.getFlag('dsa5', this.ROLL_REQUEST_FLAG);
    if (state?.category !== 'regeneration') return;

    let applied = 0;
    for (const entry of state.recipients) {
      if (await this.applyRollRequestEntry(entry)) applied++;
    }

    if (applied > 0) {
      await QueryOrchestrator.enqueueMessageUpdate(messageId, async (currentState) => currentState);
    }
  }

  static async refreshLinkedRequestCards(rollMessageId) {
    if (!game.user.isGM) return;

    for (const message of game.messages) {
      if (message.getFlag('dsa5', 'queryRequest')?.type !== this.ROLL_REQUEST_QUERY_TYPE) continue;

      const state = message.getFlag('dsa5', this.ROLL_REQUEST_FLAG);
      if (state?.category !== 'regeneration') continue;

      const linked = state.recipients?.some((entry) => entry.resultDetails?.messageId === rollMessageId);
      if (linked) {
        await QueryOrchestrator.enqueueMessageUpdate(message.id, async (currentState) => currentState);
      }
    }
  }
}
