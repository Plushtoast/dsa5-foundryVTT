import { DSADataModel } from '../../abstract.js';
import DSANumberField from '../../fields/dsa_number_field.js';

const { SchemaField, NumberField } = foundry.data.fields;

export default class VehicleStatusTemplate extends DSADataModel {
  static defineSchema() {
    return {
      status: new SchemaField({
        structurePoints: new SchemaField({
          initial: new NumberField({ initial: 800, label: 'VEHICLE.structurePointsMax' }),
          value: new DSANumberField({ initial: 800 }),
          max: new NumberField({ initial: 0 }),
        }),
        crew: new SchemaField({
          initial: new NumberField({ initial: 50, label: 'VEHICLE.crewMax' }),
          value: new DSANumberField({ initial: 50 }),
          max: new NumberField({ initial: 0 }),
        }),
        hullArmor: new SchemaField({
          value: new NumberField({ initial: 0, label: 'VEHICLE.hullArmor' }),
          modifier: new NumberField({ initial: 0 }),
        }),
        gunnery: new SchemaField({
          value: new NumberField({ initial: 12, min: 0, label: 'VEHICLE.gunnery' }),
        }),
        speed: new SchemaField({
          air: new NumberField({ initial: 0, label: 'SPEEDSELECTOR.air' }),
          water: new NumberField({ initial: 14, label: 'SPEEDSELECTOR.water' }),
          initial: new NumberField({ initial: 14, label: 'VEHICLE.baseSpeed' }),
          ram: new NumberField({ initial: 0, label: 'VEHICLE.ramSpeed' }),
          modifier: new NumberField({ initial: 0 }),
          value: new NumberField({ initial: 0 }),
          max: new NumberField({ initial: 0 }),
        }),
        initiative: new SchemaField({
          value: new NumberField({ initial: 0, label: 'initiative' }),
          modifier: new NumberField({ initial: 0 }),
        }),
      }),
      combatState: new SchemaField({
        distanceRE: new NumberField({ initial: 0, min: 0, label: 'VEHICLE.distanceRE' }),
        ramCooldownMKR: new NumberField({ initial: 0, min: 0 }),
      }),
    };
  }
}
