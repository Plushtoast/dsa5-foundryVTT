const { getProperty } = foundry.utils;

/**
 * Domain helper for poison coatings on weapons, ammunition, and traps
 * stored in flags.dsa5.poison.
 */
export default class ItemPoison {
  static FLAG = 'poison';

  static get(item) {
    return item?.getFlag?.('dsa5', this.FLAG) || getProperty(item, 'flags.dsa5.poison') || null;
  }

  static fromItem(item, extras = {}) {
    return {
      name: item.name,
      pack: item.pack || extras.pack || '',
      itemId: item.id || item._id || '',
      uuid: item.uuid || extras.uuid || '',
      permanent: Boolean(extras.permanent),
      actorId: extras.actorId || '',
    };
  }

  static async attach(targetItem, poisonItem, extras = {}) {
    const poison = this.fromItem(poisonItem, {
      ...extras,
      permanent: extras.permanent ?? targetItem.type === 'trap',
    });
    if (targetItem.actor) {
      if (targetItem.actor.uuid !== poisonItem.actor?.uuid) {
        const proceed = await foundry.applications.api.DialogV2.confirm({
          window: {
            title: _loc('WIZARD.addItem', { item: poisonItem.name }),
          },
          content: `<p>${_loc('DSAError.poisonNeedsToBeInActor')}</p><p>${_loc('POISON.addNow')}</p>`,
          rejectClose: false,
          modal: true,
        });
        if (proceed) {
          await targetItem.actor.createEmbeddedDocuments('Item', [poisonItem.toObject()]);
        }
      }
    } else if (targetItem.type !== 'trap') {
      ui.notifications.info('DSAError.poisonNeedsToBeInActor', { localize: true });
    }
    await targetItem.update({ flags: { dsa5: { poison } } });
    return poison;
  }

  static async remove(targetItem) {
    await targetItem.update({ 'flags.dsa5.poison': _del });
  }

  static async resolveDocument(ref, { notify = false } = {}) {
    if (!ref) return null;

    let item = null;
    if (ref.uuid) {
      try {
        item = await fromUuid(ref.uuid);
      } catch {
        item = null;
      }
    }

    if (!item && ref.pack) {
      const pack = game.packs.get(ref.pack);
      if (pack) {
        if (ref.itemId) item = await pack.getDocument(ref.itemId);
        if (!item && ref.name) {
          const idx = pack.index.getName(ref.name);
          if (idx) item = await pack.getDocument(idx._id);
        }
      }
    }

    if (!item && ref.name) {
      const itemLibrary = game.dsa5.itemLibrary;
      await itemLibrary.buildEquipmentIndex();
      const found = await itemLibrary.findCompendiumItem(ref.name, 'poison');
      item = found?.find((x) => x.name == ref.name && x.type == 'poison' && x.system) || null;
    }

    if (!item && notify) {
      ui.notifications.error('DSAError.notFound', {
        format: {
          category: _loc('TYPES.Item.poison'),
          name: ref.name || '',
        },
        localize: true,
      });
    }
    return item || null;
  }

  static chatButton(poison) {
    if (!poison?.name) return '';
    const esc = foundry.utils.escapeHTML;
    return `<a class="roll-button roll-item" data-removecharge="${!poison.permanent}" data-name="${esc(poison.name)}" data-type="poison" data-pack="${esc(poison.pack || '')}" data-itemid="${esc(poison.itemId || '')}" data-uuid="${esc(poison.uuid || '')}"><i class="fas fa-dice"></i>${esc(_loc('TYPES.Item.poison'))}: ${esc(poison.name)}</a>`;
  }

  static async handleChatRoll({ actor, speaker, dataset = {}, message } = {}) {
    const owned = actor?.items.find((entry) => entry.name == dataset.name && entry.type == 'poison');
    if (owned && dataset.removecharge == 'true' && owned.system.quantity.value < 1) {
      ui.notifications.error('DSAError.NotEnoughCharges', { localize: true });
      return;
    }

    const resolved = owned || await this.resolveDocument({
      name: dataset.name,
      pack: dataset.pack,
      itemId: dataset.itemid,
      uuid: dataset.uuid,
    }, { notify: Boolean(actor || dataset.name) });
    if (!resolved) return;

    await this.#ensureVictimTarget({ speaker, dataset, message });

    const ItemClass = CONFIG.Item.documentClass;
    const item = new ItemClass(resolved.toObject ? resolved.toObject() : resolved);
    const setupData = await item.setupEffect(undefined, {}, speaker?.token);
    if (setupData) await item.itemTest(setupData);

    if (owned && dataset.removecharge == 'true') {
      await owned.update({ 'system.quantity.value': owned.system.quantity.value - 1 });
    }
  }

  static async #ensureVictimTarget({ speaker, dataset, message } = {}) {
    if (game.user.targets?.size) return;

    const uuid = dataset.tokenUuid || dataset.tokenuuid || message?.flags?.dsa5?.zoneAttack?.targetTokenUuid;
    let token = null;
    if (uuid) {
      try {
        token = await fromUuid(uuid);
      } catch {
        token = null;
      }
    } else if (speaker?.token) {
      token = canvas.tokens.get(speaker.token)?.document ?? null;
    }
    if (!token) return;

    const object = token.object ?? token;
    const id = object.id || token.id;
    if (id && game.user._onUpdateTokenTargets) game.user._onUpdateTokenTargets([id]);
  }
}
