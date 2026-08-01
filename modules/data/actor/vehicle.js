import { ActorDataModel } from '../baseactor.js';
import MerchantTemplate from './templates/merchant.js';
import VehicleStatusTemplate from './templates/vehicle-status.js';
import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import VehicleRamWeapon from './vehicle-ram-weapon.js';

const { SchemaField, StringField, NumberField, BooleanField, HTMLField, ArrayField, TypedObjectField } = foundry.data.fields;
const { getProperty, mergeObject } = foundry.utils;

export default class VehicleData extends ActorDataModel.mixin(MerchantTemplate, VehicleStatusTemplate) {
  /** LocalizedIDs keys for vehicle Fortbewegungstalente (Boote & Schiffe / Fahrzeuge). */
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
    const [combatSkills, money, locomotionSkills] = await Promise.all([
      DSA5_Utility.allCombatSkills(),
      DSA5_Utility.allMoneyItems(),
      this.locomotionSkillItemsFromCompendium(),
    ]);
    const crossbows = combatSkills.find((skill) => skill.name === _loc('LocalizedIDs.Crossbows'));
    const impactName = game.i18n.lang === 'de' ? 'Hiebwaffen' : 'Impact Weapons';
    const impact = combatSkills.find((skill) => skill.name === impactName);
    const items = [...money, ...locomotionSkills];
    if (crossbows) {
      crossbows.system.attack.value = 12;
      items.push(crossbows);
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
    if (impact) items.push(impact);
    items.push(VehicleRamWeapon.buildItemData());
    return items;
  }

  /** Fortbewegungstalente from the default skill pack (Boote & Schiffe / Fahrzeuge). */
  static async locomotionSkillItemsFromCompendium() {
    const skills = await DSA5_Utility.allSkills();
    return this.LOCOMOTION_SKILL_KEYS.flatMap((key) => {
      const name = _loc(`LocalizedIDs.${key}`);
      const found = skills.find((skill) => skill.name === name);
      return found ? [found] : [];
    });
  }

  /** Add missing Fortbewegungstalente on older vehicles (e.g. created before this shipped). */
  async ensureLocomotionSkills() {
    const missingKeys = this.constructor.LOCOMOTION_SKILL_KEYS.filter((key) => {
      const name = _loc(`LocalizedIDs.${key}`);
      return !this.parent.items.some((i) => i.type === 'skill' && i.name === name);
    });
    if (!missingKeys.length) return;

    const all = await this.constructor.locomotionSkillItemsFromCompendium();
    const names = new Set(missingKeys.map((key) => _loc(`LocalizedIDs.${key}`)));
    const toCreate = all.filter((item) => names.has(item.name));
    if (toCreate.length) await this.parent.createEmbeddedDocuments('Item', toCreate);
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
      skillModifiers: {},
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

    const crewValue = Math.max(0, Number(data.status.crew.value ?? 0));
    const wounded = Math.max(0, Number(data.combatState?.woundedCrew ?? 0));
    data.availableCrew = Math.max(0, crewValue - wounded);

    data.isImmobile = data.status.structurePoints.value <= 10;
    data.isSinking = data.status.structurePoints.value <= 0;
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
    speed.max = Math.max(0, (speed.initial || 0) + (speed.modifier || 0));
    speed.value = speed.max;
    speed.waterMax = Math.max(0, Number(speed.water || 0) + (speed.modifier || 0));
    speed.airMax = Math.max(0, Number(speed.air || 0) + (speed.modifier || 0));
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
