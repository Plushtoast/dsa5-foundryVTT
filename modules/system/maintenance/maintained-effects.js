import DSA5_Utility from '../helpers/utility-dsa5.js';

const { getProperty } = foundry.utils;

export default class MaintainedEffects {
  static isMaintained(effect) {
    return effect?.system?.maintenance?.cost != null;
  }

  static getMetadata(effect) {
    const m = effect?.system?.maintenance;
    return { cost: m?.cost, payType: m?.payType };
  }

  static getParentUuid(message) {
    return getProperty(message, 'flags.data.maintenanceParentEffectUuid') || '';
  }

  static collectTargetUuids(macroResults, existing = []) {
    return DSA5_Utility.dedup([...existing, ...macroResults.flatMap((r) => r?.maintainedTargets || [])]);
  }

  // -- Creation --

  static async createForMessage(messageId, actor, maintain, name, payType) {
    const cost = maintain.match(/^\d{1,3}/)?.[0];
    if (!cost) return;

    let durationNum = maintain.replace(/^\d{1,3}/, '').match(/\d{1,3}/);
    durationNum = durationNum ? Number(durationNum[0]) || 1 : 1;

    const effectData = {
      name: `${name} (${_loc('maintainCost')})`,
      img: 'icons/svg/daze.svg',
      description: maintain,
      system: { maintenance: { cost: Number(cost), payType, links: [] } },
      duration: {},
    };

    const seconds = this.#parseDurationSeconds(maintain, durationNum);
    if (seconds) {
      effectData.duration.value = seconds;
      effectData.duration.units = 'seconds';
    }

    try {
      const created = await actor.addCondition(effectData);
      const effect = Array.isArray(created) ? created[0] : created;
      if (effect?.uuid && messageId) {
        await this.registerOnMessage(messageId, { parentUuid: effect.uuid });
      }
      return effect;
    } catch (error) {
      console.error(`Could not parse duration '${maintain}' of '${name}'`, error);
    }
  }

  // -- Message link registration --

  static async registerOnMessage(messageId, { parentUuid, targetUuids } = {}) {
    if (!messageId) return;
    const message = game.messages.get(messageId);
    if (!message) return;

    const update = {};
    const existingParent = this.getParentUuid(message);
    const finalParent = parentUuid || existingParent;
    if (parentUuid && parentUuid !== existingParent) {
      update['flags.data.maintenanceParentEffectUuid'] = parentUuid;
    }

    const existingTargets = DSA5_Utility.dedup(getProperty(message, 'flags.data.maintenanceTargetUuids') || []);
    const finalTargets = targetUuids ? DSA5_Utility.dedup([...existingTargets, ...targetUuids]) : existingTargets;
    if (targetUuids && finalTargets.length !== existingTargets.length) {
      update['flags.data.maintenanceTargetUuids'] = finalTargets;
    }

    if (Object.keys(update).length) {
      await this.#updateMessage(messageId, update);
    }

    if (finalParent && finalTargets.length) {
      const parentEffect = await fromUuid(finalParent);
      if (parentEffect) {
        const existingLinks = DSA5_Utility.dedup(parentEffect.system?.maintenance?.links || []);
        const mergedLinks = DSA5_Utility.dedup([...existingLinks, ...finalTargets]);
        if (mergedLinks.length !== existingLinks.length) {
          await parentEffect.update({ 'system.maintenance.links': mergedLinks });
        }
      }
    }
  }

  // -- Deletion --

  static async deleteByUuid(uuids) {
    const directDeletes = new Map();
    const socketDeletes = [];

    for (const uuid of DSA5_Utility.dedup(uuids)) {
      const effect = await fromUuid(uuid);
      if (!effect || effect.documentName !== 'ActiveEffect') continue;

      const parent = effect.parent;
      if (parent?.documentName !== 'Actor') continue;

      if (game.user.isGM || parent.isOwner) {
        const ids = directDeletes.get(parent) || [];
        ids.push(effect.id);
        directDeletes.set(parent, ids);
      } else {
        socketDeletes.push(uuid);
      }
    }

    for (const [parent, ids] of directDeletes) {
      await parent.deleteEmbeddedDocuments('ActiveEffect', ids, { noHook: true, butOnRemove: true });
    }

    if (socketDeletes.length) {
      game.socket.emit('system.dsa5', {
        type: 'deleteEffectsByUuid',
        payload: { uuids: socketDeletes },
      });
    }
  }

  static async promptDelete(effect) {
    const actor = effect.parent;
    if (actor?.documentName !== 'Actor' || !this.isMaintained(effect)) return;

    const effectsToRemove = [effect._id];
    const linkedEffectUuids = [];

    const searchName = effect.name.replace('(' + _loc('maintainCost') + ')', '').trim();
    const sameActorDeps = actor.effects.filter((x) => x.name.startsWith(searchName) && !x.origin && x.id != effect._id);

    const linkedEffects = [];
    for (const uuid of DSA5_Utility.dedup(effect.system?.maintenance?.links || [])) {
      try {
        const linked = await fromUuid(uuid);
        if (linked?.documentName === 'ActiveEffect') linkedEffects.push(linked);
      } catch (e) {
        console.warn('Failed to resolve maintained linked effect', uuid, e);
      }
    }

    const dependentEffects = [
      ...sameActorDeps.map((x) => ({ id: x.id, label: x.name, isUuid: false })),
      ...linkedEffects
        .filter((x) => x.parent?.documentName === 'Actor' && x.parent?.id !== actor.id)
        .map((x) => ({ id: x.uuid, label: `${x.parent?.name || _loc('Actor')} - ${x.name}`, isUuid: true })),
    ];

    let content = `<p>${_loc('DIALOG.updateMaintainSpell', { actor: actor.name })}</p>`;
    if (dependentEffects.length) {
      content += `<p>${_loc('DIALOG.dependentMaintainEffects')}</p>`;
      content += dependentEffects
        .map(
          (x, i) =>
            `<div class="form-group"><label for="rel${i}">${x.label}</label><div class="form-fields"><input class="effectRemoveSelector" data-uuid="${x.isUuid}" checked type="checkbox" value="${x.id}" id="rel${i}" name="rel${i}"/></div></div>`,
        )
        .join('');
    }

    const { cost, payType } = this.getMetadata(effect);

    new foundry.applications.api.DialogV2({
      window: { title: effect.name },
      content,
      buttons: [
        {
          action: 'yes',
          icon: 'fa fa-check',
          label: 'HELP.pay',
          default: true,
          callback: async () => {
            const paid = await actor.applyMana(Number(cost), payType);
            if (paid) {
              const start = { time: game.time.worldTime };
              if (game.combat) {
                start.round = game.combat.round;
                start.turn = game.combat.turn;
              }
              await actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: effect._id, start }]);
            }
          },
        },
        {
          action: 'delete',
          icon: 'fas fa-trash',
          label: 'delete',
          callback: async (event, button) => {
            for (const el of button.form.elements) {
              if (!el.classList.contains('effectRemoveSelector') || !el.checked) continue;
              if (el.dataset.uuid === 'true') linkedEffectUuids.push(el.value);
              else effectsToRemove.push(el.value);
            }
            if (linkedEffectUuids.length) await this.deleteByUuid(linkedEffectUuids);
            await actor.deleteEmbeddedDocuments('ActiveEffect', effectsToRemove, { noHook: true, butOnRemove: true });
          },
        },
      ],
    }).render(true);
  }

  // -- Private --

  static #parseDurationSeconds(maintain, duration) {
    const timeUnits = [
      { key: 'DSAREGEXmaintain.seconds', seconds: 1 },
      { key: 'DSAREGEXmaintain.combatRounds', seconds: 5 },
      { key: 'DSAREGEXmaintain.minutes', seconds: 60 },
      { key: 'DSAREGEXmaintain.hours', seconds: 3600 },
      { key: 'DSAREGEXmaintain.days', seconds: 3600 * 24 },
      { key: 'DSAREGEXmaintain.weeks', seconds: 3600 * 24 * 7 },
      { key: 'DSAREGEXmaintain.months', seconds: 3600 * 24 * 30 },
      { key: 'DSAREGEXmaintain.years', seconds: 3600 * 24 * 350 },
    ];

    for (const unit of timeUnits) {
      if (new RegExp(_loc(unit.key), 'gi').test(maintain)) return duration * unit.seconds;
    }
    return null;
  }

  static async #updateMessage(messageId, updateData) {
    const message = game.messages.get(messageId);
    if (!message) return;

    if (game.user.isGM) {
      await message.update(updateData);
    } else {
      game.socket.emit('system.dsa5', {
        type: 'updateMsg',
        payload: { id: messageId, updateData },
      });
    }
  }
}