import DSA5_Utility from '../system/helpers/utility-dsa5.js';

const { duplicate } = foundry.utils;

/**
 * Domain helper for item enchantments / talismans stored in flags.dsa5.enchantments.
 */
export default class ItemEnchantment {
  static list(item) {
    return item?.getFlag?.('dsa5', 'enchantments') || [];
  }

  static get(item, id) {
    return this.list(item).find((e) => e.id == id);
  }

  static async resolveDocument(enchantment, { notify = false } = {}) {
    if (!enchantment) return null;

    const pack = game.packs.get(enchantment.pack);
    let item;
    if (pack) {
      item = await pack.getDocument(enchantment.itemId);
      if (!item) {
        const idx = pack.index.getName(enchantment.name);
        if (idx) item = await pack.getDocument(idx._id);
      }
    }

    if (!item) {
      const itemLibrary = game.dsa5.itemLibrary;
      await itemLibrary.buildEquipmentIndex();
      const cats = enchantment.talisman ? ['liturgy', 'ceremony'] : ['spell', 'ritual'];
      for (const cat of cats) {
        const found = await itemLibrary.findCompendiumItem(enchantment.name, cat);
        item = found?.find((x) => x.name == enchantment.name && x.type == cat && x.system);
        if (item) break;
      }
    }

    if (!item && notify) {
      ui.notifications.error('DSAError.enchantmentNotFound', { localize: true });
    }
    return item || null;
  }

  static async resolveExtensions(extensions) {
    const resolved = [];
    for (const ext of extensions || []) {
      const pack = game.packs.get(ext.pack);
      if (!pack) continue;
      let item = await pack.getDocument(ext.itemId);
      if (!item) {
        const idx = pack.index.getName(ext.name);
        if (idx) item = await pack.getDocument(idx._id);
      }
      if (item) {
        const mapped = item;
        mapped.shortName = item.name.split(' - ').length > 1 ? item.name.split(' - ')[1] : item.name;
        mapped.descr = $(item.system.description.value).text() || '';
        resolved.push(mapped);
      }
    }
    return resolved;
  }

  static async toggleCharge(item, id) {
    const enchantments = duplicate(this.list(item));
    const enchantment = enchantments.find((e) => e.id == id);
    if (!enchantment) return;

    enchantment.charged = enchantment.talisman && enchantment.permanent ? true : !enchantment.charged;
    await item.update({ flags: { dsa5: { enchantments } } });
  }

  static async delete(item, id) {
    const enchantments = duplicate(this.list(item));
    const idx = enchantments.findIndex((e) => e.id == id);
    if (idx < 0) return;
    enchantments.splice(idx, 1);
    await item.update({ flags: { dsa5: { enchantments } } });
  }

  /** After a completed roll: permanent toggles charge, otherwise removes the enchantment. */
  static async consume(item, id) {
    const enchantment = this.get(item, id);
    if (!enchantment) return;
    if (enchantment.permanent) await this.toggleCharge(item, id);
    else await this.delete(item, id);
  }

  /**
   * Roll an enchantment via emptyActor (item FW, optional extensions).
   * @returns {Promise<object|null>} basicTest result, or null if cancelled / not rolled
   */
  static async roll(sourceItem, enchantmentId, { options = {}, postChat = true, consume = true } = {}) {
    const enchantment = this.get(sourceItem, enchantmentId);
    if (!enchantment?.charged) {
      ui.notifications.error('DSAError.NotEnoughCharges', { localize: true });
      return null;
    }

    let spell = await this.resolveDocument(enchantment, { notify: true });
    if (!spell) return null;

    spell = spell.toObject();
    spell.system.talentValue.value = enchantment.fw;

    const emptyActor = DSA5_Utility.emptyActor(14, sourceItem.name, {
      parent_source_uuid: sourceItem.actor?.uuid,
    });
    const rollOptions = { ...options };
    if (enchantment.extensions?.length) {
      rollOptions.enchantmentExtensions = await this.resolveExtensions(enchantment.extensions);
    }

    const setupData = await emptyActor.setupSpell(spell, rollOptions, 'emptyActor');
    const result = await emptyActor.basicTest(setupData);
    if (!result) return null;

    if (postChat) {
      const infoMsg = _loc('CHATNOTIFICATION.enchantmentUsed', {
        item: sourceItem.name,
        spell: spell.name,
      });
      await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
    }

    if (consume) await this.consume(sourceItem, enchantmentId);
    return result;
  }
}
