import DSA5 from '../../../config/config-dsa5.js';
import { DSADataModel } from '../../abstract.js';
import DSANumberField from '../../fields/dsa_number_field.js';

const { SchemaField, NumberField, StringField, BooleanField } = foundry.data.fields;

const energyZoneField = () => new SchemaField({
  value: new DSANumberField({ initial: 0 }),
  max: new NumberField({ initial: 0 }),
  failed: new BooleanField({ initial: false }),
  resistPenalty: new NumberField({ initial: 0 }),
});

export default class StatusTemplate extends DSADataModel {
  static defineSchema() {
    return {
      swarm: new SchemaField({
        count: new NumberField({ initial: 1 }),
        gg: new NumberField({ initial: 1 }),
      }),
      hitbox: new NumberField({ initial: 0, choices:  DSA5.hitboxes }),
      status: new SchemaField({
        wounds: new SchemaField({
          initial: new NumberField({ initial: 0 }),
          value: new DSANumberField({ initial: 0 }),
          advances: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
          current: new NumberField({ initial: 8 }),
          max: new NumberField({ initial: 0 }),
        }),
        temporaryLeP: new SchemaField({
          max: new NumberField({ initial: 0 }),
          value: new DSANumberField({ initial: 0 }),
        }),
        astralenergy: new SchemaField({
          initial: new NumberField({ initial: 0 }),
          value: new DSANumberField({ initial: 0 }),
          advances: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
          current: new NumberField({ initial: 0 }),
          permanentLoss: new DSANumberField({ initial: 0 }),
          rebuy: new DSANumberField({ initial: 0 }),
          max: new NumberField({ initial: 0 }),
        }),
        karmaenergy: new SchemaField({
          initial: new NumberField({ initial: 0 }),
          value: new DSANumberField({ initial: 0 }),
          advances: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
          current: new NumberField({ initial: 0 }),
          permanentLoss: new DSANumberField({ initial: 0 }),
          rebuy: new DSANumberField({ initial: 0 }),
          max: new NumberField({ initial: 0 }),
        }),
        soulpower: new SchemaField({
          initial: new NumberField({ initial: 0 }),
          value: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
        }),
        toughness: new SchemaField({
          initial: new NumberField({ initial: 0 }),
          value: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
        }),
        dodge: new SchemaField({
          value: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
        }),
        fatePoints: new SchemaField({
          value: new NumberField({ initial: 3 }),
          modifier: new NumberField({ initial: 0 }),
          current: new NumberField({ initial: 3 }),
        }),
        speed: new SchemaField({
          air: new NumberField({ initial: 0, label: 'SPEEDSELECTOR.air' }),
          water: new NumberField({ initial: 0, label: 'SPEEDSELECTOR.water' }),
          initial: new NumberField({ initial: 0, label: 'SPEEDSELECTOR.land' }),
          modifier: new NumberField({ initial: 0 }),
          value: new NumberField({ initial: 0 }),
        }),
        initiative: new SchemaField({
          value: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
          current: new NumberField({ initial: 0 }),
          die: new StringField({ initial: '1d6', choices: DSA5.initDies }),
          diemodifier: new StringField({ choices: DSA5.initDies }),
        }),
        size: new SchemaField({
          value: new StringField({ initial: 'average', choices: DSA5.sizeCategories, required: true }),
        }),
        regeneration: new SchemaField({
          LePTemp: new DSANumberField({ initial: 0 }),
          AsPTemp: new DSANumberField({ initial: 0 }),
          KaPTemp: new DSANumberField({ initial: 0 }),
          LePMod: new DSANumberField({ initial: 0 }),
          AsPMod: new DSANumberField({ initial: 0 }),
          KaPMod: new DSANumberField({ initial: 0 }),
        }),
        energyZones: new SchemaField({
          head: energyZoneField(),
          leftarm: energyZoneField(),
          rightarm: energyZoneField(),
          leftleg: energyZoneField(),
          rightleg: energyZoneField(),
          value: energyZoneField(),
        }),
      }),
    };
  }

  static _migrateData(source) {
    super._migrateData(source);

    const nanFields = ['hitbox'];
    for (const field of nanFields) {
      const prop = foundry.utils.getProperty(source, field)
      if (prop && isNaN(prop)) {
        foundry.utils.setProperty(source, field, 0);
      }
    }
  }
}
