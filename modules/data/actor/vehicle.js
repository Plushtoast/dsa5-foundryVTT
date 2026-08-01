import { ActorDataModel } from '../baseactor.js';
import MerchantTemplate from './templates/merchant.js';
import VehicleStatusTemplate from './templates/vehicle-status.js';
import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import NavalHouseRules from '../../combat/mkr/naval-house-rules.js';

const { SchemaField, StringField, NumberField, BooleanField, HTMLField, ArrayField, TypedObjectField } = foundry.data.fields;
const { getProperty, mergeObject } = foundry.utils;

export default class VehicleData extends ActorDataModel.mixin(MerchantTemplate, VehicleStatusTemplate) {
  /** Default TaW for vehicle crew / hero-action skills. */
  static DEFAULT_SKILL_TALENT_VALUE = 8;

  /**
   * LocalizedIDs keys for skills every vehicle should carry:
   * locomotion (Boote & Schiffe / Fahrzeuge) + hero-action talents.
   */
  static DEFAULT_SKILL_KEYS = [
    'boatsAndShips',
    'driving',
    'woodworking',
    'clothworking',
    'warfare',
    'treatWounds',
  ];

  /** @deprecated Use DEFAULT_SKILL_KEYS */
  static LOCOMOTION_SKILL_KEYS = ['boatsAndShips', 'driving'];

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      config: new SchemaField({
        autoBar: new BooleanField({ initial: true }),
        autoSize: new BooleanField({ initial: true }),
        defense: new BooleanField({ initial: true }),
        lockRotation: new BooleanField({ initial: false }),
        ignoreWeaponHandLimits: new BooleanField({ initial: true }),
      }),
      details: new SchemaField({
        vehicleType: new StringField({ initial: '', label: 'VEHICLE.vehicleType' }),
        propulsion: new StringField({ initial: 'sail', label: 'VEHICLE.propulsionLabel', choices: DSA5.vehiclePropulsion }),
        travelModes: new ArrayField(new StringField({ choices: DSA5.vehicleTravelModes }), { initial: ['sea'] }),
        armament: new StringField({ initial: 'none', label: 'VEHICLE.armamentLabel', choices: DSA5.vehicleArmament }),
        cargoCapacity: new NumberField({ initial: 0, min: 0, label: 'VEHICLE.cargoCapacity' }),
        price: new NumberField({ initial: 0, min: 0, label: 'VEHICLE.price' }),
        notes: new SchemaField({
          value: new HTMLField({ initial: '', label: 'Notes' }),
          ownerdescription: new HTMLField({ initial: '', label: 'ownerNotes' }),
        }),
      }),
      actionCount: new SchemaField({
        value: new NumberField({ initial: 1, label: 'actionCount' }),
      }),
      description: new SchemaField({
        value: new HTMLField({ initial: '', label: 'Description' }),
      }),
      weaponOperators: new TypedObjectField(new StringField(), { initial: {} }),
      crewMembers: new TypedObjectField(new SchemaField({
        uuid: new StringField({ required: true }),
        sort: new NumberField({ initial: 0, integer: true }),
      }), { initial: {} }),
    });
  }

  static async prepareCreateData(data) {
    data.items = await this.getDefaultItems();

    const structureInitial = getProperty(data, 'system.status.structurePoints.initial');
    const crewInitial = getProperty(data, 'system.status.crew.initial');

    mergeObject(data, {
      system: {
        merchant: { merchantType: getProperty(data, 'system.merchant.merchantType') ?? 'loot' },
        status: {
          structurePoints: {
            value: getProperty(data, 'system.status.structurePoints.value') ?? structureInitial ?? 800,
          },
          crew: {
            value: getProperty(data, 'system.status.crew.value') ?? crewInitial ?? 50,
          },
        },
      },
    }, { inplace: true });

    return data;
  }

  static async getDefaultItems() {
    const [combatSkills, money, defaultSkills] = await Promise.all([
      DSA5_Utility.allCombatSkills(),
      DSA5_Utility.allMoneyItems(),
      this.defaultSkillItemsFromCompendium(),
    ]);
    const crossbows = combatSkills.find((skill) => skill.name === _loc('LocalizedIDs.Crossbows'));
    const impactName = game.i18n.lang === 'de' ? 'Hiebwaffen' : 'Impact Weapons';
    const impact = combatSkills.find((skill) => skill.name === impactName);
    const items = [...money, ...defaultSkills];
    if (crossbows) {
      const crossbowsData = foundry.utils.duplicate(crossbows);
      crossbowsData.system.attack.value = 12;
      items.push(crossbowsData);
    } else {
      items.push({
        name: _loc('LocalizedIDs.Crossbows'),
        type: 'combatskill',
        system: {
          attack: { value: 12 },
          parry: { value: 0 },
          guidevalue: { value: 'ff' },
          talentValue: { value: 6 },
          weapontype: { value: 1 },
        },
      });
    }
    if (impact) items.push(foundry.utils.duplicate(impact));
    return items;
  }

  /** Clone skill pack entries with vehicle default TaW. */
  static async defaultSkillItemsFromCompendium(keys = this.DEFAULT_SKILL_KEYS) {
    const skills = await DSA5_Utility.allSkills();
    const taw = this.DEFAULT_SKILL_TALENT_VALUE;
    return keys.flatMap((key) => {
      const name = _loc(`LocalizedIDs.${key}`);
      const found = skills.find((skill) => skill.name === name);
      if (!found) return [];
      const item = foundry.utils.duplicate(found);
      foundry.utils.setProperty(item, 'system.talentValue.value', taw);
      return [item];
    });
  }

  /** @deprecated Use defaultSkillItemsFromCompendium */
  static async locomotionSkillItemsFromCompendium() {
    return this.defaultSkillItemsFromCompendium(this.LOCOMOTION_SKILL_KEYS);
  }

  /** Add missing default vehicle skills (locomotion + hero actions) on older vehicles. */
  async ensureDefaultSkills() {
    const missingKeys = this.constructor.DEFAULT_SKILL_KEYS.filter((key) => {
      const name = _loc(`LocalizedIDs.${key}`);
      return !this.parent.items.some((i) => i.type === 'skill' && i.name === name);
    });
    if (!missingKeys.length) return;

    const toCreate = await this.constructor.defaultSkillItemsFromCompendium(missingKeys);
    if (toCreate.length) await this.parent.createEmbeddedDocuments('Item', toCreate);
  }

  /** @deprecated Use ensureDefaultSkills */
  async ensureLocomotionSkills() {
    return this.ensureDefaultSkills();
  }

  /** Embedded default skills in DEFAULT_SKILL_KEYS order. */
  defaultSkills() {
    return this.constructor.DEFAULT_SKILL_KEYS.flatMap((key) => {
      const name = _loc(`LocalizedIDs.${key}`);
      const item = this.parent.items.find((i) => i.type === 'skill' && i.name === name);
      return item ? [item] : [];
    });
  }

  /** Embedded locomotion skills in LocalizedIDs key order. */
  locomotionSkills() {
    return this.constructor.LOCOMOTION_SKILL_KEYS.flatMap((key) => {
      const name = _loc(`LocalizedIDs.${key}`);
      const item = this.parent.items.find((i) => i.type === 'skill' && i.name === name);
      return item ? [item] : [];
    });
  }

  prepareBaseData() {
    this.parent.auras = [];
    this._initializeVehicleStructure();
  }

  _initializeVehicleStructure() {
    mergeObject(this, {
      itemModifiers: {},
      condition: {},
      skillModifiers: this._createSkillModifiersStructure(),
      totalArmor: 0,
      carryModifier: 0,
      totalWeight: 0,
      isImmobile: false,
      isSinking: false,
      crewActors: new Set(),
      crewMemberCount: 0,
    });
  }

  prepareDerivedData() {
    try {
      this._resolveCrewMembers();
      this._calculateResourcePools(this);
      this._calculateWeight(this);
      this._calculateSpeed(this);
      this._calculateArmor(this);
      this._calculateInitiative(this);
    } catch (error) {
      console.error(`Error preparing vehicle data for ${this.parent.name}:`, error);
      ui.notifications.error(_loc('DSAError.PreparationError', { name: this.parent.name }) + error.message);
    }
  }

  _resolveCrewMembers() {
    this.crewActors = new Set();
    this.crewMemberCount = 0;
    const sorted = Object.entries(this.crewMembers ?? {})
      .sort(([, a], [, b]) => a.sort - b.sort);

    for (const [, member] of sorted) {
      const actor = fromUuidSync(member.uuid);
      if (actor) {
        this.crewActors.add(actor);
        this.crewMemberCount++;
      }
    }
  }

  hasCrewMember(actor) {
    if (!actor) return false;
    for (const member of Object.values(this.crewMembers ?? {})) {
      if (member.uuid === actor.uuid) return true;
      const resolved = fromUuidSync(member.uuid);
      if (resolved?.id === actor.id) return true;
    }
    return false;
  }

  /** True if any assigned crew actor is owned by a non-GM player. */
  hasPlayerCrew() {
    for (const member of Object.values(this.crewMembers ?? {})) {
      const actor = fromUuidSync(member.uuid);
      if (actor?.hasPlayerOwner) return true;
    }
    return false;
  }

  /** NPC/GM-only ships do not track ammunition for board guns. */
  requiresAmmunition() {
    return this.hasPlayerCrew();
  }

  async addCrewMember(actor) {
    if (!actor || actor.type === 'vehicle' || actor.type === 'group') {
      ui.notifications.warn('VEHICLE.crewInvalidActor', { localize: true });
      return;
    }
    if (actor.uuid === this.parent.uuid) return;

    for (const member of Object.values(this.crewMembers ?? {})) {
      if (member.uuid === actor.uuid) {
        ui.notifications.info('VEHICLE.alreadyCrew', { localize: true });
        return;
      }
    }

    const id = foundry.utils.randomID();
    const maxSort = Math.max(0, ...Object.values(this.crewMembers ?? {}).map((m) => m.sort));
    await this.parent.update({
      [`system.crewMembers.${id}`]: { uuid: actor.uuid, sort: maxSort + 1 },
    });
  }

  async removeCrewMember(key) {
    await this.parent.update({ [`system.crewMembers.${key}`]: _del });
  }

  /** Find a vehicle actor that lists this actor as crew. */
  static findVehicleForActor(actor) {
    if (!actor) return null;
    return game.actors.find((candidate) => (
      candidate.type === 'vehicle' && candidate.system.hasCrewMember?.(actor)
    )) ?? null;
  }

  _calculateResourcePools(data) {
    for (const pool of ['structurePoints', 'crew']) {
      const res = data.status[pool];
      res.max = Math.round(res.initial || 0);
      if (res.value === undefined || res.value === null) res.value = res.max;
    }

    // Crew value is reduced when casualties are applied; woundedCrew tracks healable losses.
    const crewValue = Math.max(0, Number(data.status.crew.value ?? 0));
    data.availableCrew = crewValue;

    const stpValue = Number(data.status.structurePoints.value ?? 0);
    const stpMax = Number(data.status.structurePoints.max ?? 0);
    data.isImmobile = NavalHouseRules.isImmobile(stpValue, stpMax);
    data.isSinking = stpValue <= 0;
  }

  _calculateWeight(data) {
    data.totalWeight = 0;
    const containers = new Map();
    const wornArmor = [];

    for (const item of this.parent.items) {
      if (!DSA5.equipmentCategories.has(item.type)) continue;

      const parentId = item.system.parent_id;
      if (parentId && parentId !== item._id && containers.has(parentId)) {
        containers.get(parentId).push(item);
        continue;
      }

      item.system.preparedWeight = parseFloat(
        (item.system.weight.value * item.system.quantity.value).toFixed(3)
      );

      if (item.type === 'armor' && item.system.worn.value) {
        wornArmor.push(item);
        data.totalWeight += parseFloat(
          (item.system.weight.value * Math.max(0, item.system.quantity.value - 1)).toFixed(3)
        );
      } else {
        data.totalWeight += Number(item.system.preparedWeight);
      }
    }

    data.carrycapacity = data.details.cargoCapacity || 0;
  }

  _calculateSpeed(data) {
    const speed = data.status.speed;
    const shipCondition = NavalHouseRules.enabled('shipCondition')
      ? Number(data.condition?.[NavalHouseRules.CONDITION_SHIP] || 0)
      : 0;
    const base = Math.max(0, (speed.initial || 0) + (speed.modifier || 0));
    const waterBase = Math.max(0, Number(speed.water || 0) + (speed.modifier || 0));
    const airBase = Math.max(0, Number(speed.air || 0) + (speed.modifier || 0));
    speed.max = NavalHouseRules.applySpeedMalus(base, shipCondition);
    speed.value = speed.max;
    speed.waterMax = NavalHouseRules.applySpeedMalus(waterBase, shipCondition);
    speed.airMax = NavalHouseRules.applySpeedMalus(airBase, shipCondition);
  }

  /** Used when a rider lazily needs mount speed during prepare. */
  calcSpeed(data) {
    this._calculateSpeed(data);
  }

  _calculateArmor(data) {
    let armor = Number(data.status.hullArmor.value || 0) + Number(data.status.hullArmor.modifier || 0);

    for (const item of this.parent.items) {
      if (item.type === 'armor' && item.system.worn.value) {
        armor += Number(item.system.protection?.value || 0);
      }
    }

    data.totalArmor = armor;
  }

  _calculateInitiative(data) {
    data.status.initiative.value =
      Number(data.status.initiative.value || 0) + Number(data.status.initiative.modifier || 0);
  }

  baseInitiative(data) {
    // Vehicles use explicit initiative values, not characteristic-derived formulas.
  }
}
