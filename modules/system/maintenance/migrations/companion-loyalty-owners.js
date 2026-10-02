/**
 * Stamp/clone shared companion Loyalty onto each current owner,
 * drop orphan flags, and restore stored skill names to LocalizedIDs.loyalty.
 * Sheets print SkillData.detail_name; this must not rewrite names going forward.
 */
export default class CompanionLoyaltyOwnersMigrator {
  static KEY = 'companionLoyaltyPerOwner';

  static #loyalty() {
    return game.dsa5.apps.CompanionLoyalty;
  }

  static needsMigrate(actor) {
    const Loyalty = this.#loyalty();
    if (!actor || !Loyalty) return false;
    const owners = actor.system?.companionData?.owners || [];
    const skills = Loyalty.list(actor);
    if (!skills.length) return false;

    const loyaltyName = Loyalty.loyaltyName();
    const covered = new Set();
    for (const skill of skills) {
      if (skill.name !== loyaltyName) return true;
      const uuid = Loyalty.ownerUuid(skill);
      if (!uuid) continue;
      if (!owners.includes(uuid)) return true;
      covered.add(uuid);
    }
    return owners.some((uuid) => !covered.has(uuid));
  }

  static async migrate() {
    const Loyalty = this.#loyalty();
    for (const actor of game.actors) {
      if (this.needsMigrate(actor)) await this.migrateActor(actor);
      else if ((actor.system?.companionData?.owners || []).length) await this.#markMigrated(actor);
    }
  }

  static async #markMigrated(companion) {
    const Loyalty = this.#loyalty();
    if (!companion || !Loyalty) return;
    if (companion.getFlag('dsa5', Loyalty.MIGRATED_FLAG)) return;
    await companion.setFlag('dsa5', Loyalty.MIGRATED_FLAG, true);
  }

  static async migrateActor(companion) {
    const Loyalty = this.#loyalty();
    if (!companion || !Loyalty) return;

    const owners = [...(companion.system.companionData?.owners || [])];
    const loyaltyName = Loyalty.loyaltyName();
    const skills = Loyalty.list(companion);
    const flagged = [];
    for (const skill of skills) {
      if (Loyalty.ownerUuid(skill)) flagged.push(skill);
    }

    const orphanIds = flagged.filter((skill) => !owners.includes(Loyalty.ownerUuid(skill))).map((skill) => skill.id);
    if (orphanIds.length) await companion.deleteEmbeddedDocuments('Item', orphanIds, { render: false });

    const covered = new Set(
      Loyalty.list(companion)
        .map((skill) => Loyalty.ownerUuid(skill))
        .filter(Boolean),
    );
    const unscoped = Loyalty.list(companion).filter((skill) => !Loyalty.ownerUuid(skill));
    const missing = owners.filter((uuid) => !covered.has(uuid));

    const updates = [];
    for (const ownerUuid of missing) {
      const source = unscoped.shift();
      if (!source) break;
      const owner = await fromUuid(ownerUuid);
      if (!owner) continue;
      updates.push({
        _id: source.id,
        name: loyaltyName,
        [`flags.dsa5.${Loyalty.FLAG_KEY}`]: ownerUuid,
      });
      covered.add(ownerUuid);
    }
    if (updates.length) await companion.updateEmbeddedDocuments('Item', updates, { render: false });

    const stillMissing = owners.filter((uuid) => !covered.has(uuid));
    const source = Loyalty.list(companion)[0];
    if (source && stillMissing.length) {
      const toCreate = [];
      for (const ownerUuid of stillMissing) {
        const owner = await fromUuid(ownerUuid);
        if (!owner) continue;
        const data = source.toObject();
        delete data._id;
        data.name = loyaltyName;
        foundry.utils.setProperty(data, `flags.dsa5.${Loyalty.FLAG_KEY}`, ownerUuid);
        toCreate.push(data);
        covered.add(ownerUuid);
      }
      if (toCreate.length) await companion.createEmbeddedDocuments('Item', toCreate, { render: false });
    }

    const nameFixes = Loyalty.list(companion)
      .filter((skill) => skill.name !== loyaltyName)
      .map((skill) => ({ _id: skill.id, name: loyaltyName }));
    if (nameFixes.length) await companion.updateEmbeddedDocuments('Item', nameFixes, { render: false });
    await this.#markMigrated(companion);
  }
}
