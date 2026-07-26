import { ActorDataModel } from '../baseactor.js';
import AdvantageRulesDSA5 from '../../system/rules/advantage-rules-dsa5.js';

const { SchemaField, StringField, NumberField, BooleanField, HTMLField, TypedObjectField } = foundry.data.fields;

const DEFAULT_SPEEDS = {
  foot: 7,
  vehicle: 10,
  river: 8,
  sea: 14,
};

export default class GroupData extends ActorDataModel {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      members: new TypedObjectField(new SchemaField({
        uuid: new StringField({ required: true }),
        sort: new NumberField({ initial: 0, integer: true }),
      })),
      locations: new TypedObjectField(new SchemaField({
        type: new StringField({ initial: '' }),
        actorUuid: new StringField({ required: true }),
        locked: new BooleanField({ initial: false }),
        sort: new NumberField({ initial: 0, integer: true }),
      })),
      travel: new SchemaField({
        forcedMarchPercent: new NumberField({ initial: 0, min: 0, integer: true }),
        speed: new SchemaField({
          foot: new SchemaField({
            initial: new NumberField({ initial: DEFAULT_SPEEDS.foot, min: 0 }),
            modifier: new NumberField({ initial: 0 }),
          }),
          vehicle: new SchemaField({
            initial: new NumberField({ initial: DEFAULT_SPEEDS.vehicle, min: 0 }),
            modifier: new NumberField({ initial: 0 }),
          }),
          river: new SchemaField({
            initial: new NumberField({ initial: DEFAULT_SPEEDS.river, min: 0 }),
            modifier: new NumberField({ initial: 0 }),
          }),
          sea: new SchemaField({
            initial: new NumberField({ initial: DEFAULT_SPEEDS.sea, min: 0 }),
            modifier: new NumberField({ initial: 0 }),
          }),
        }),
      }),
      details: new SchemaField({
        biography: new HTMLField({ initial: '' }),
        notes: new HTMLField({ initial: '' }),
      }),
      config: new SchemaField({
        autoBar: new BooleanField({ initial: true }),
        autoSize: new BooleanField({ initial: true }),
        lockRotation: new BooleanField({ initial: false }),
      }),
    });
  }

  prepareBaseData() {
    this.parent.auras = [];
    this.merchant = { merchantType: "none" };
    this.status = {
      speed: { max: 0, airMax: 0, waterMax: 0 },
    };
  }

  prepareDerivedData() {
    this._resolveMembers();
    this._resolveLocations();
    this._computeAggregateStats();
    this._computeTravelSpeed();
    this._computeGroupSkills();
  }

  _resolveMembers() {
    this.actors = new Set();
    this.memberCount = 0;
    const sorted = Object.entries(this.members)
      .sort(([, a], [, b]) => a.sort - b.sort);

    for (const [, member] of sorted) {
      const actor = fromUuidSync(member.uuid);
      if (actor) {
        this.actors.add(actor);
        this.memberCount++;
      }
    }
  }

  _resolveLocations() {
    this.locationActors = new Map();
    this.resolvedLocations = [];
    const sorted = Object.entries(this.locations)
      .sort(([, a], [, b]) => a.sort - b.sort);

    for (const [key, loc] of sorted) {
      const actor = fromUuidSync(loc.actorUuid);
      if (actor) {
        this.locationActors.set(key, actor);
        this.resolvedLocations.push({
          key,
          name: actor.name,
          img: actor.img,
          type: loc.type,
          locked: loc.locked,
          speed: actor.system.status?.speed?.max ?? 0,
          sort: loc.sort,
          actor,
        });
      }
    }
  }

  _computeAggregateStats() {
    let totalWounds = 0, maxWounds = 0;
    let totalAE = 0, maxAE = 0;
    let totalKP = 0, maxKP = 0;
    let totalFP = 0;
    let totalAP = 0;
    let count = 0;

    for (const actor of this.actors) {
      const s = actor.system;
      if (s.status?.wounds) {
        totalWounds += s.status.wounds.value;
        maxWounds += s.status.wounds.max;
      }
      if (s.status?.astralenergy) {
        totalAE += s.status.astralenergy.value;
        maxAE += s.status.astralenergy.max;
      }
      if (s.status?.karmaenergy) {
        totalKP += s.status.karmaenergy.value;
        maxKP += s.status.karmaenergy.max;
      }
      if (s.status?.fatePoints) {
        totalFP += s.status.fatePoints.value;
      }
      if (s.details?.experience) {
        totalAP += s.details.experience.total;
      }
      count++;
    }

    this.aggregateStats = {
      wounds: { value: totalWounds, max: maxWounds },
      astralenergy: { value: totalAE, max: maxAE },
      karmaenergy: { value: totalKP, max: maxKP },
      fatePoints: totalFP,
      averageAP: count > 0 ? Math.round(totalAP / count) : 0,
    };
  }

  _computeTravelSpeed() {
    const modes = {};
    const roundTime = CONFIG.time.roundTime || 5;
    const forcedPct = this.travel.forcedMarchPercent || 0;

    // Foot speed defaults to slowest member's GS if members exist
    let minActorSpeed = Infinity;
    for (const actor of this.actors) {
      const gs = actor.system.status?.speed?.max;
      if (typeof gs === 'number') minActorSpeed = Math.min(minActorSpeed, gs);
    }
    const footBase = isFinite(minActorSpeed) ? minActorSpeed : this.travel.speed.foot.initial;

    // Build a map of mode → assigned location (actor speed)
    const locationByMode = {};
    for (const loc of this.resolvedLocations) {
      if (loc.type && loc.type !== 'foot') {
        locationByMode[loc.type] = loc;
      }
    }

    for (const mode of Object.keys(DEFAULT_SPEEDS)) {
      const schema = this.travel.speed[mode];
      const assignedLoc = locationByMode[mode];
      const base = mode === 'foot' ? footBase : (assignedLoc ? assignedLoc.speed : schema.initial);

      let max = base + (schema.modifier || 0);
      if (forcedPct > 0) max = Math.floor(max * (1 + forcedPct / 100));
      max = Math.max(0, max);

      modes[mode] = {
        initial: mode === 'foot' ? footBase : schema.initial,
        locationName: assignedLoc?.name ?? null,
        locationSpeed: assignedLoc?.speed ?? null,
        base,
        modifier: schema.modifier || 0,
        max,
        meilen: max * (3600 / roundTime) / 1000,
      };
    }

    this.travelSpeeds = modes;

    const activeMode = Object.keys(locationByMode)[0];
    this.status.speed.max = modes[activeMode]?.max ?? modes.foot.max;
  }

  _computeGroupSkills() {
    this.groupSkills = {};

    for (const actor of this.actors) {
      for (const item of actor.items) {
        if (item.type !== 'skill') continue;

        const name = item.name;
        const fw = item.system.talentValue?.value ?? 0;
        const entry = { actor, value: fw, item };

        if (!this.groupSkills[name]) {
          this.groupSkills[name] = {
            name,
            icon: item.img,
            category: item.system.group?.value ?? '',
            best: entry,
            min: fw,
            others: [],
          };
        } else {
          const existing = this.groupSkills[name];
          if (fw < existing.min) existing.min = fw;
          if (fw > existing.best.value) {
            existing.others.push(existing.best);
            existing.best = entry;
          } else {
            existing.others.push(entry);
          }
        }
      }
    }

    for (const skill of Object.values(this.groupSkills)) {
      skill.others.sort((a, b) => b.value - a.value);
    }
  }

  getDungeonSight() {
    let maxSight = 0;
    for (const actor of this.actors) {
      const range = actor.prototypeToken?.sight?.range ?? 0;
      if (range > maxSight) maxSight = range;
    }
    return maxSight;
  }

  async addMember(actor) {
    if (actor.type === 'group') {
      ui.notifications.warn('GROUP.noGroupInGroup', { localize: true });
      return;
    }
    for (const member of Object.values(this.members)) {
      if (member.uuid === actor.uuid) {
        ui.notifications.info('GROUP.alreadyMember', { localize: true });
        return;
      }
    }
    const id = foundry.utils.randomID();
    const maxSort = Math.max(0, ...Object.values(this.members).map((m) => m.sort));
    await this.parent.update({
      [`system.members.${id}`]: { uuid: actor.uuid, sort: maxSort + 1 },
    });
  }

  async removeMember(key) {
    await this.parent.update({ [`system.members.${key}`]: _del });
  }

  async addLocation(actor, type = '') {
    if (!this.constructor.isValidLocation(actor)) {
      ui.notifications.warn('GROUP.locationOnly', { localize: true });
      return;
    }
    const id = foundry.utils.randomID();
    const maxSort = Math.max(0, ...Object.values(this.locations).map((l) => l.sort));
    await this.parent.update({
      [`system.locations.${id}`]: {
        type,
        actorUuid: actor.uuid,
        sort: maxSort + 1,
      },
    });
  }

  static isLootDepotActor(actor) {
    return actor?.system?.merchant?.merchantType === 'loot';
  }

  static getUnlockedLootDepots(party) {
    return party.system.resolvedLocations.filter(
      (loc) => !loc.locked && this.isLootDepotActor(loc.actor)
    );
  }

  static getDepotPermissionPlayers(depotActor) {
    return game.users
      .filter((user) => !user.isGM)
      .map((user) => ({
        id: user.id,
        name: user.name,
        allowedMerchant: depotActor.testUserPermission(user, 'LIMITED', false),
        buyingFactor: foundry.utils.getProperty(depotActor.system, `merchant.factors.buyingFactor.${user.id}`),
        sellingFactor: foundry.utils.getProperty(depotActor.system, `merchant.factors.sellingFactor.${user.id}`),
      }));
  }

  static playersMissingDepotPermission(depotActor) {
    return game.users
      .filter((user) => !user.isGM)
      .some((user) => !depotActor.testUserPermission(user, 'LIMITED', false));
  }

  static async setDepotUserPermission(depotActor, userIds, allow) {
    const curPermissions = foundry.utils.duplicate(depotActor.ownership);
    const newPerm = allow ? CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED : CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
    for (const id of userIds) {
      curPermissions[id] = newPerm;
    }
    await depotActor.update({ ownership: curPermissions }, { diff: false, recursive: false, noHook: true });
  }

  async removeLocation(key) {
    await this.parent.update({ [`system.locations.${key}`]: _del });
  }

  async setLocationType(key, type) {
    const updates = { [`system.locations.${key}.type`]: type };
    if (type) {
      for (const [otherKey, loc] of Object.entries(this.locations)) {
        if (otherKey !== key && loc.type === type) {
          updates[`system.locations.${otherKey}.type`] = '';
        }
      }
    }
    await this.parent.update(updates);
  }

  static isValidLocation(actor) {
    if (actor.type === 'group') return false;
    const merchantType = actor.system?.merchant?.merchantType;
    return merchantType && merchantType !== 'none';
  }

  async getOrCreateLocationFolder() {
    const folderName = `${this.parent.name} Locations`;
    let folder = game.folders.find(
      (f) => f.type === 'Actor' && f.name === folderName
    );
    if (!folder) {
      folder = await Folder.create({ name: folderName, type: 'Actor' });
    }
    return folder;
  }

  async createLocationActor(name, { merchantType = 'loot', asVehicle = false, travelMode = '' } = {}) {
    const folder = await this.getOrCreateLocationFolder();

    if (asVehicle) {
      return await Actor.create({
        name,
        type: 'vehicle',
        folder: folder.id,
        flags: { core: { sheetClass: 'dsa5.VehicleMerchantSheetDSA5' } },
        system: {
          merchant: { merchantType },
          details: {
            travelModes: travelMode ? [travelMode] : ['sea', 'river', 'vehicle'],
          },
        },
      });
    }

    return await Actor.create({
      name,
      type: 'npc',
      folder: folder.id,
      flags: { core: { sheetClass: 'dsa5.MerchantSheetDSA5' } },
      system: {
        merchant: { merchantType },
      },
    });
  }

  async createAndLinkLocation(name, type = '', { merchantType = 'loot', asVehicle = false } = {}) {
    const actor = await this.createLocationActor(name, { merchantType, asVehicle, travelMode: type });
    await this.addLocation(actor, type);
    return actor;
  }

  static async pickRandomMember(actors, { withMisfortune = false } = {}) {
    if (actors.length === 0) {
      ui.notifications.warn('DIALOG.noTarget', { localize: true });
      return null;
    }
    const probabilities = {};
    let counter = 1;
    for (const actor of actors) {
      probabilities[counter] = actor.id;
      counter++;
      if (withMisfortune && AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.misfortune')) {
        probabilities[counter] = actor.id;
        counter++;
      }
      if (withMisfortune && actor.hasCondition('badluck')) {
        probabilities[counter] = actor.id;
        counter++;
      }
    }
    const roll = (await new Roll(`1d${counter - 1}`).evaluate()).total;
    return probabilities[roll];
  }
}
