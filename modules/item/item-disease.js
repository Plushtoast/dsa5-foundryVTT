import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import { ManualRollDialog } from '../system/rolls/manual-roll-dialog.js';

const { getProperty, mergeObject } = foundry.utils;

/**
 * Domain helper for disease coatings on weapons, ammunition, and attack traits
 * stored in flags.dsa5.disease.
 */
export default class ItemDisease {
  static FLAG = 'disease';
  static ALWAYS_THRESHOLD = 20;

  static get(item) {
    return item?.getFlag?.('dsa5', this.FLAG) || getProperty(item, 'flags.dsa5.disease') || null;
  }

  static normalizeThreshold(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return this.ALWAYS_THRESHOLD;
    return Math.clamp(Math.round(n), 1, this.ALWAYS_THRESHOLD);
  }

  static alwaysInfects(threshold) {
    return this.normalizeThreshold(threshold) >= this.ALWAYS_THRESHOLD;
  }

  static infects(rollTotal, threshold) {
    return Number(rollTotal) <= this.normalizeThreshold(threshold);
  }

  static fromItem(item, extras = {}) {
    return {
      name: item.name,
      pack: item.pack || '',
      itemId: item.id || item._id || '',
      uuid: item.uuid || extras.uuid || '',
      threshold: this.normalizeThreshold(extras.threshold ?? this.ALWAYS_THRESHOLD),
    };
  }

  static async attach(targetItem, diseaseItem, extras = {}) {
    const disease = this.fromItem(diseaseItem, extras);
    await targetItem.update({ flags: { dsa5: { disease } } });
    return disease;
  }

  static async remove(targetItem) {
    await targetItem.update({ 'flags.dsa5.disease': _del });
  }

  static async setThreshold(targetItem, threshold) {
    const disease = this.get(targetItem);
    if (!disease) return;
    await targetItem.update({
      flags: {
        dsa5: {
          disease: { ...disease, threshold: this.normalizeThreshold(threshold) },
        },
      },
    });
  }

  /**
   * Copy ammo disease onto the attack source in memory (same pattern as poison).
   * @param {object} ammoData
   * @param {object} weaponSource Live item or plain object with flags
   */
  static applyFromAmmo(ammoData, weaponSource) {
    const disease = getProperty(ammoData, 'flags.dsa5.disease');
    if (!disease || !weaponSource) return;
    if (!weaponSource.flags) weaponSource.flags = {};
    mergeObject(weaponSource.flags, { dsa5: { disease } });
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
      const found = await itemLibrary.findCompendiumItem(ref.name, 'disease');
      item = found?.find((x) => x.name == ref.name && x.type == 'disease' && x.system) || null;
    }

    if (!item && notify) {
      ui.notifications.error('DSAError.diseaseNotFound', { localize: true });
    }
    return item || null;
  }

  static chatLabel(disease) {
    const threshold = this.normalizeThreshold(disease.threshold);
    const type = _loc('TYPES.Item.disease');
    const name = disease.name;
    if (this.alwaysInfects(threshold)) return `${type}: ${name}`;
    return `${type} (1-${threshold}): ${name}`;
  }

  static chatButton(disease) {
    if (!disease?.name) return '';
    const threshold = this.normalizeThreshold(disease.threshold);
    const esc = foundry.utils.escapeHTML;
    return `<a class="roll-button roll-item" data-name="${esc(disease.name)}" data-type="disease" data-threshold="${threshold}" data-pack="${esc(disease.pack || '')}" data-itemid="${esc(disease.itemId || '')}" data-uuid="${esc(disease.uuid || '')}"><i class="fas fa-dice"></i>${esc(this.chatLabel(disease))}</a>`;
  }

  /**
   * @returns {Promise<{ infected: boolean, skipped: boolean, total: number|null, roll: Roll|null }>}
   */
  static async rollInfection(threshold, options = {}) {
    if (this.alwaysInfects(threshold)) {
      return { infected: true, skipped: true, total: null, roll: null };
    }

    const normalized = this.normalizeThreshold(threshold);
    let roll = await new Roll('1d20').evaluate();
    roll = await ManualRollDialog.apply(roll, 'TYPES.Item.disease', options);
    const total = roll.total;
    return { infected: this.infects(total, normalized), skipped: false, total, roll };
  }

  static async handleChatRoll({ speaker, dataset }) {
    const threshold = this.normalizeThreshold(dataset.threshold);
    const infection = await this.rollInfection(threshold);

    if (!infection.skipped) {
      const key = infection.infected ? 'CHATNOTIFICATION.diseaseInfected' : 'CHATNOTIFICATION.diseaseNotInfected';
      await ChatMessage.create(
        DSA5_Utility.chatDataSetup(
          _loc(key, {
            name: dataset.name,
            roll: infection.total,
            threshold,
          }),
        ),
      );
    }

    if (!infection.infected) return;

    const resolved = await this.resolveDocument(
      {
        name: dataset.name,
        pack: dataset.pack,
        itemId: dataset.itemid,
        uuid: dataset.uuid,
      },
      { notify: true },
    );
    if (!resolved) return;

    const ItemClass = CONFIG.Item.documentClass;
    const item = new ItemClass(resolved.toObject());
    const setupData = await item.setupEffect(undefined, {}, speaker?.token);
    if (setupData) await item.itemTest(setupData);
  }
}
