import DSAActiveEffect from '../../status/dsa_active_effects.js';

const { deepClone, getProperty, setProperty } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

const POST_ROLL_KEYS = {
  FP: 'system.skillModifiers.postRoll.FP',
  QL: 'system.skillModifiers.postRoll.QL',
  REROLL: 'system.skillModifiers.postRoll.reroll',
};

const ALLOWED_ANY_TYPES = new Set(['skill', 'spell', 'liturgy', 'ritual', 'ceremony']);

export default class PostRollBuffs {
  static POST_ROLL_KEYS = POST_ROLL_KEYS;

  static _norm(value) {
    return `${value ?? ''}`
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  static _splitEntries(value) {
    return `${value ?? ''}`
      .split(/[,;]/)
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }

  static _parseEntry(entry) {
    const parts = `${entry}`.trim().split(/\s+/);
    if (parts.length < 2) return null;

    // Allow multi-word scope names by treating the last token as the numeric amount.
    const amountRaw = parts[parts.length - 1];
    const scope = parts.slice(0, -1).join(' ');
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount === 0) return null;
    return { scope, amount };
  }

  static _parseEntryWithDefaultAmount(entry, defaultAmount = 1) {
    const parsed = this._parseEntry(entry);
    if (parsed) return parsed;

    const scope = `${entry ?? ''}`.trim();
    if (!scope) return null;
    return { scope, amount: defaultAmount };
  }

  static _matchesScope(scope, source) {
    const scopeNorm = this._norm(scope);
    if (!scopeNorm) return false;

    // Built-in wildcard.
    if (scopeNorm === 'any') return ALLOWED_ANY_TYPES.has(source?.type);

    // Match against roll source type (skill/spell/liturgy/...).
    const typeNorm = this._norm(source?.type);
    if (typeNorm && scopeNorm === typeNorm) return true;

    // Match against roll source group (primarily for skills).
    const groupNorm = this._norm(source?.system?.group?.value ?? source?.system?.group);
    if (groupNorm && scopeNorm === groupNorm) return true;

    // Match against the displayed name (case-insensitive, diacritics-insensitive).
    const nameNorm = this._norm(source?.name);
    if (nameNorm && nameNorm.includes(scopeNorm)) return true;

    return false;
  }

  static _getUsedEffectUuids(message) {
    const used = getProperty(message, 'flags.dsa5.postRoll.usedEffectUuids');
    return Array.isArray(used) ? used : [];
  }

  static _formatMatchLabel(match) {
    const fpLabel = game.i18n.localize('CHARAbbrev.FP');
    const qsLabel = game.i18n.localize('CHARAbbrev.QS');
    const parts = [];
    if (match.fp) parts.push(`${fpLabel} ${match.fp > 0 ? '+' : ''}${match.fp}`);
    if (match.qs) parts.push(`${qsLabel} ${match.qs > 0 ? '+' : ''}${match.qs}`);
    if (match.rerollDice) {
      parts.push(game.i18n.format('DIALOG.postRollRerollDice', { count: match.rerollDice }));
    }

    const charges = match.charges?.max ? ` [${match.charges.value ?? 0}/${match.charges.max}]` : '';
    return `${match.effectName} (${parts.join(', ')})${charges}`;
  }

  static async _tryUpdateMessage(message, updateData) {
    try {
      return await message.update(updateData);
    } catch (_e) {
      game.socket.emit('system.dsa5', {
        type: 'updateMsg',
        payload: {
          id: message.id,
          updateData,
        },
      });
      return message;
    }
  }

  static async _rerenderRollMessage(message, flagsData) {
    const template = flagsData?.template;
    if (!template) return;

    const preData = flagsData.preData;
    const postData = flagsData.postData;

    const renderData = {
      testData: postData,
      preData,
      hideData: flagsData.hideData,
      hideDamage: flagsData.hideDamage,
      modifierList: (preData?.situationalModifiers || []).filter((x) => x?.value != 0),
    };

    const html = await renderTemplate(template, renderData);

    const actor = ChatMessage.getSpeakerActor(message.speaker) || game.users.get(message.author)?.character;
    const rollData = actor ? actor.getRollData() : {};
    const enriched = await TextEditor.enrichHTML(html, { rollData });

    await this._tryUpdateMessage(message, {
      content: enriched,
      flags: {
        data: flagsData,
      },
    });
  }

  static _formatPostRollImprovement(match) {
    if (!match) return '';
    const parts = [];
    const fp = Number(match.fp) || 0;
    const qs = Number(match.qs) || 0;

    if (fp) {
      const fpLabel = game.i18n.localize('CHARAbbrev.FP');
      parts.push(`${fpLabel} ${fp > 0 ? '+' : ''}${fp}`);
    }
    if (qs) {
      const qsLabel = game.i18n.localize('CHARAbbrev.QS');
      parts.push(`${qsLabel} ${qs > 0 ? '+' : ''}${qs}`);
    }

    if (parts.length === 0) return '';

    return game.i18n.format('ActiveEffects.chargesChatPostRollImproved', {
      details: parts.join(', '),
    });
  }

  static async _consumeEffectCharges(effectUuid, { message, match } = {}) {
    try {
      const effect = await fromUuid(effectUuid);
      if (!effect) return { consumed: false, reason: 'notFound' };

      // If we can update it directly, do so.
      if (effect.isOwner || effect.parent?.isOwner || game.user.isGM) {
        if (typeof effect.consumeCharges === 'function') {
          const improvement = this._formatPostRollImprovement(match);
          const chatExtraHtml = improvement ? `<p>${improvement}</p>` : '';
          await effect.consumeCharges(1, {
            createChatMessage: true,
            speaker: message?.speaker,
            chatExtraHtml,
          });
          return { consumed: true };
        }
        return { consumed: false, reason: 'noConsumeCharges' };
      }

      // Post-roll buff application is restricted to owner/GM; if we reach this, permissions are insufficient.
      return { consumed: false, reason: 'noPermission' };
    } catch (e) {
      console.warn('postRoll buff consume failed', e);
      return { consumed: false, reason: 'error' };
    }
  }

  static _ensureSuccessOnly(message) {
    const successLevel = Number(getProperty(message, 'flags.data.postData.successLevel'));
    const success = !!getProperty(message, 'flags.data.postData.success');

    // SuccessLevel is the main signal in this system; success is a helpful fallback.
    return successLevel > 0 || success;
  }

  static _ensureRollData(message) {
    if (!message?.flags?.data) return false;
    const source = getProperty(message, 'flags.data.preData.source');
    return !!source;
  }

  static _addSituationalModifier(flagsData, match) {
    const preData = flagsData.preData;
    preData.situationalModifiers ??= [];

    if (match.fp) {
      preData.situationalModifiers.push({
        name: this._formatMatchLabel({ ...match, qs: 0 }),
        value: match.fp,
        type: 'postRoll',
        source: match.effectName,
        effectUuid: match.effectUuid,
        effectId: match.effectId,
      });
    }

    if (match.qs) {
      preData.situationalModifiers.push({
        name: this._formatMatchLabel({ ...match, fp: 0 }),
        value: match.qs,
        type: 'postRoll',
        source: match.effectName,
        effectUuid: match.effectUuid,
        effectId: match.effectId,
      });
    }
  }

  static _applyFP(flagsData, amount) {
    const cap = game.settings.get('dsa5', 'capQSat') || 6;

    const postData = flagsData.postData;
    const current = Number(postData.result);
    if (!Number.isFinite(current)) return;

    const next = current + Number(amount);
    postData.result = next;

    // Recalculate QS from FP.
    const qs = Math.min(cap, Math.max(1, Math.ceil(next / 3)));
    postData.qualityStep = qs;
  }

  static _applyQL(flagsData, amount) {
    const cap = game.settings.get('dsa5', 'capQSat') || 6;
    const postData = flagsData.postData;

    const current = Number(postData.qualityStep);
    const base = Number.isFinite(current) ? current : Math.max(1, Math.ceil(Number(postData.result) / 3));
    const next = Math.min(cap, base + Number(amount));
    postData.qualityStep = next;
  }

  static getMatches(message, actor) {
    if (!message?.flags?.data || !actor) return [];
    if (!this._ensureRollData(message)) return [];

    const source = getProperty(message, 'flags.data.preData.source');
    if (!source) return [];

    const successOnly = this._ensureSuccessOnly(message);

    const usedEffectUuids = new Set(this._getUsedEffectUuids(message));

    const matches = [];

    for (const effect of actor.effects) {
      if (!DSAActiveEffect.realyRealyEnabled(effect)) continue;
      if (usedEffectUuids.has(effect.uuid)) continue;

      const effectName = effect.name || effect.label || 'Effect';

      const chargeData = typeof effect.getChargeData === 'function' ? effect.getChargeData() : null;

      let fp = 0;
      let qs = 0;
      let rerollDice = 0;

      for (const change of effect.changes || []) {
        const isRerollKey = change?.key === POST_ROLL_KEYS.REROLL;
        if (change?.key !== POST_ROLL_KEYS.FP && change?.key !== POST_ROLL_KEYS.QL && !isRerollKey) continue;

        // FP/QS apply only on successful rolls; rerolls are allowed on failed rolls too.
        if (!successOnly && (change.key === POST_ROLL_KEYS.FP || change.key === POST_ROLL_KEYS.QL)) continue;

        for (const entry of this._splitEntries(change.value)) {
          const parsed = isRerollKey ? this._parseEntryWithDefaultAmount(entry, 1) : this._parseEntry(entry);
          if (!parsed) continue;
          if (!this._matchesScope(parsed.scope, source)) continue;

          if (change.key === POST_ROLL_KEYS.FP) fp += parsed.amount;
          else if (change.key === POST_ROLL_KEYS.QL) qs += parsed.amount;
          else if (isRerollKey) {
            const dice = Math.max(1, Number(parsed.amount) || 1);
            // Take the strongest matching entry per effect.
            rerollDice = Math.max(rerollDice, dice);
          }
        }
      }

      if (fp === 0 && qs === 0 && rerollDice === 0) continue;

      matches.push({
        effectUuid: effect.uuid,
        effectId: effect.id,
        effectName,
        fp,
        qs,
        rerollDice,
        charges: chargeData,
      });
    }

    return matches;
  }

  static sortMatchesForApply(matches) {
    // Keep selection order stable; apply logic handles FP first then QS per effect.
    return [...matches];
  }

  static async applyMatches(message, matches) {
    if (!message?.flags?.data || !Array.isArray(matches) || matches.length === 0) return;

    // Defense-in-depth: chat context is owner/GM only, but also enforce it here.
    const speakerActor = ChatMessage.getSpeakerActor(message.speaker) || game.actors.get(message.speaker?.actor);
    if (!(game.user.isGM || speakerActor?.isOwner)) return;

    const flagsData = deepClone(message.flags.data);
    const usedEffectUuids = new Set(this._getUsedEffectUuids(message));

    const ordered = this.sortMatchesForApply(matches);

    const consumptionWarnings = [];

    const hasReroll = ordered.some((m) => (Number(m?.rerollDice) || 0) > 0);
    if (hasReroll) {
      // Reroll is exclusive: exactly one reroll match can be applied, with no FP/QS.
      if (ordered.length !== 1) {
        ui.notifications.warn('DIALOG.postRollRerollExclusive', { localize: true });
        return;
      }
      const match = ordered[0];
      const dice = Math.max(1, Number(match?.rerollDice) || 1);
      if (!match?.effectUuid || usedEffectUuids.has(match.effectUuid) || match.fp || match.qs) {
        ui.notifications.warn('DIALOG.postRollRerollExclusive', { localize: true });
        return;
      }

      const actor = speakerActor;
      if (!actor) return;

      // Defer charge consumption + used marking until the Begabung reroll dialog is confirmed.
      await this._tryUpdateMessage(message, {
        'flags.dsa5.postRoll.pendingReroll': {
          effectUuid: match.effectUuid,
          dice,
        },
      });

      actor.useFateOnRoll(message, 'isTalented');
      return;
    }

    // FP/QS post-roll buffs apply only on successful rolls.
    if (!this._ensureSuccessOnly(message)) return;

    for (const match of ordered) {
      if (!match?.effectUuid || usedEffectUuids.has(match.effectUuid)) continue;

      // Apply effect (FP first, then QS).
      if (match.fp) this._applyFP(flagsData, match.fp);
      if (match.qs) this._applyQL(flagsData, match.qs);

      this._addSituationalModifier(flagsData, match);

      // Mark used on this message (regardless of whether charges are successfully consumed).
      usedEffectUuids.add(match.effectUuid);

      // Consume charges (best-effort).
      const { consumed, reason } = await this._consumeEffectCharges(match.effectUuid, { message, match });
      if (!consumed) {
        consumptionWarnings.push({ match, reason });
      }
    }

    // Persist used effects.
    const usedList = Array.from(usedEffectUuids);

    await this._tryUpdateMessage(message, {
      'flags.dsa5.postRoll.usedEffectUuids': usedList,
    });

    await this._rerenderRollMessage(message, flagsData);

    if (consumptionWarnings.length > 0) {
      ui.notifications.warn('DSAError.requiresGM', { localize: true });
    }
  }
}
