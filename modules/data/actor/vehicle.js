import { ActorDataModel } from '../baseactor.js';
import MerchantTemplate from './templates/merchant.js';
import VehicleStatusTemplate from './templates/vehicle-status.js';
import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';

const { SchemaField, StringField, NumberField, BooleanField, HTMLField, ArrayField, TypedObjectField } = foundry.data.fields;
const { getProperty, mergeObject } = foundry.utils;

export default class VehicleData extends ActorDataModel.mixin(MerchantTemplate, VehicleStatusTemplate) {

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
    const [combatSkills, money] = await Promise.all([
      DSA5_Utility.allCombatSkills(),
      DSA5_Utility.allMoneyItems(),
    ]);
    const crossbows = combatSkills.find((skill) => skill.name === _loc('LocalizedIDs.Crossbows'));
    const impactName = game.i18n.lang === 'de' ? 'Hiebwaffen' : 'Impact Weapons';
    const impact = combatSkills.find((skill) => skill.name === impactName);
    const items = [...money];
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
    return items;
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
    });
  }

  prepareDerivedData() {
    try {
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

  _calculateResourcePools(data) {
    for (const pool of ['structurePoints', 'crew']) {
      const res = data.status[pool];
      res.max = Math.round(res.initial || 0);
      if (res.value === undefined || res.value === null) res.value = res.max;
    }

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
