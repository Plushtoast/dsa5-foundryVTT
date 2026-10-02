import DSA5_Utility from '../../system/helpers/utility-dsa5.js';

/**
 * Per-owner Loyalty skills on a companion actor.
 * Identity is `flags.dsa5.loyaltyOwner`. Stored name stays LocalizedIDs.loyalty;
 * sheets show SkillData.detail_name ("Loyalität (Owner)").
 */
export default class CompanionLoyalty {
  static FLAG_KEY = 'loyaltyOwner';
  static MIGRATED_FLAG = 'loyaltyOwnersMigrated';
  static #ownersMigrator;

  static loyaltyName() {
    return _loc('LocalizedIDs.loyalty');
  }

  static isLoyaltySkill(item) {
    if (item?.type !== 'skill') return false;
    if (this.ownerUuid(item)) return true;
    const name = String(item.name || '');
    const base = this.loyaltyName();
    return name === base || name.startsWith(`${base} (`);
  }

  static ownerUuid(item) {
    return item?.getFlag?.('dsa5', this.FLAG_KEY) || item?.flags?.dsa5?.[this.FLAG_KEY] || '';
  }

  static list(companion) {
    if (!companion) return [];
    return companion.items.filter((item) => this.isLoyaltySkill(item));
  }

  /**
   * @param {Actor} companion
   * @param {string} [ownerUuid]
   * @param {{ fallbackUnscoped?: boolean }} [options]
   * @returns {Item|null}
   */
  static findForOwner(companion, ownerUuid, { fallbackUnscoped = true } = {}) {
    if (!companion) return null;
    const skills = this.list(companion);
    if (ownerUuid) {
      const flagged = skills.find((item) => this.ownerUuid(item) === ownerUuid);
      if (flagged) return flagged;
    }
    if (!fallbackUnscoped) return null;
    const unscoped = skills.filter((item) => !this.ownerUuid(item));
    if (unscoped.length === 1) return unscoped[0];
    if (!ownerUuid && skills.length) return skills[0];
    return unscoped[0] ?? null;
  }

  static initialValue(companion) {
    const familiarName = _loc('LocalizedIDs.familiar');
    const zoologyDom = _loc('LocalizedIDs.zoologyDomesticated');
    let isFamiliar = false;
    let isDomesticated = false;
    for (const item of companion?.items ?? []) {
      if (item.type === 'trait' && item.name === familiarName) isFamiliar = true;
      if (item.type === 'information' && item.name === zoologyDom) isDomesticated = true;
    }
    return isFamiliar || isDomesticated ? 4 : 0;
  }

  /**
   * Create or return this owner's Loyalty skill. Does not copy another owner's FW.
   * @param {Actor} companion
   * @param {Actor} owner
   * @param {{ initialValue?: number }} [options]
   * @returns {Promise<Item|null>}
   */
  static async ensureForOwner(companion, owner, { initialValue } = {}) {
    if (!companion || !owner) return null;

    const existing = this.findForOwner(companion, owner.uuid, { fallbackUnscoped: false });
    if (existing) return existing;

    const unscoped = this.list(companion).filter((skill) => !this.ownerUuid(skill));
    if (unscoped.length === 1) {
      await this.setOwner(unscoped[0], owner.uuid);
      return unscoped[0];
    }

    const data = await this.#loyaltyItemData();
    if (!data) return null;

    data.system.talentValue.value = initialValue ?? this.initialValue(companion);
    foundry.utils.setProperty(data, `flags.dsa5.${this.FLAG_KEY}`, owner.uuid);

    const [created] = await companion.createEmbeddedDocuments('Item', [data]);
    return created ?? null;
  }

  static async removeForOwner(companion, ownerUuid) {
    if (!companion || !ownerUuid) return;
    const skill = this.findForOwner(companion, ownerUuid, { fallbackUnscoped: false });
    if (skill) await companion.deleteEmbeddedDocuments('Item', [skill.id], { render: false });
  }

  /**
   * Assign or clear the owner flag. Does not rewrite the stored skill name.
   * @param {Item} item
   * @param {string} ownerUuid Empty string clears the assignment.
   * @returns {Promise<boolean>}
   */
  static async setOwner(item, ownerUuid) {
    if (!item || !this.isLoyaltySkill(item)) return false;

    const nextUuid = String(ownerUuid || '');
    if (this.ownerUuid(item) === nextUuid) return true;

    const companion = item.parent;
    if (nextUuid) {
      if (companion) {
        const existing = this.findForOwner(companion, nextUuid, { fallbackUnscoped: false });
        if (existing && existing.id !== item.id) {
          ui.notifications.warn(_loc('COMPANIONS.Loyalty.ownerTaken', { name: existing.system.detail_name }));
          return false;
        }
      }
      const owner = await fromUuid(nextUuid);
      if (!owner) return false;
      await item.update({ [`flags.dsa5.${this.FLAG_KEY}`]: nextUuid });
      return true;
    }

    await item.unsetFlag('dsa5', this.FLAG_KEY);
    return true;
  }

  static async ownerChoices(companion) {
    const owners = companion?.system?.companionData?.owners || [];
    const choices = [{ uuid: '', name: _loc('COMPANIONS.Loyalty.ownerUnscoped') }];
    for (const uuid of owners) {
      const actor = await fromUuid(uuid);
      if (actor) choices.push({ uuid, name: actor.name });
    }
    return choices;
  }

  static registerHooks() {
    Hooks.on('createItem', (item) => {
      if (!this.isLoyaltySkill(item) || this.ownerUuid(item)) return;
      const owners = item.parent?.system?.companionData?.owners || [];
      if (owners.length !== 1) return;
      this.setOwner(item, owners[0]).catch(() => {});
    });
  }

  static mightNeedMigration(companion) {
    const owners = companion?.system?.companionData?.owners || [];
    if (!owners.length) return false;
    const skills = this.list(companion);
    if (!skills.length) return false;
    const loyaltyName = this.loyaltyName();
    const covered = new Set();
    for (const skill of skills) {
      if (skill.name !== loyaltyName) return true;
      const uuid = this.ownerUuid(skill);
      if (uuid && !owners.includes(uuid)) return true;
      if (uuid) covered.add(uuid);
    }
    return owners.some((uuid) => !covered.has(uuid));
  }

  static async migrateIfNeeded(companion) {
    const owners = companion?.system?.companionData?.owners || [];
    if (!owners.length) return false;
    if (companion.getFlag('dsa5', this.MIGRATED_FLAG)) return false;

    if (this.mightNeedMigration(companion)) {
      if (!this.#ownersMigrator) {
        const url = foundry.utils.getRoute('systems/dsa5/modules/system/maintenance/migrations/companion-loyalty-owners.js');
        this.#ownersMigrator = (await import(url)).default;
      }
      await this.#ownersMigrator.migrateActor(companion);
    }

    if (!companion.getFlag('dsa5', this.MIGRATED_FLAG)) {
      await companion.setFlag('dsa5', this.MIGRATED_FLAG, true);
    }
    return true;
  }

  static async #loyaltyItemData() {
    const fromPack = await DSA5_Utility.skillByName(this.loyaltyName());
    if (!fromPack) return null;
    const data = fromPack.toObject();
    delete data._id;
    return data;
  }
}
