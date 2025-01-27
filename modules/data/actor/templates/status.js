import { DSADataModel } from '../../abstract.js';

const { SchemaField, NumberField, StringField } = foundry.data.fields;

export default class StatusTemplate extends DSADataModel {
  static defineSchema() {
    return {
      swarm: new SchemaField({
        count: new NumberField({ initial: 1 }),
        gg: new NumberField({ initial: 1 }),
      }),
      hitbox: new NumberField({ initial: 0 }),
      status: new SchemaField({
        wounds: new SchemaField({
          initial: new NumberField({ initial: 0 }),
          value: new NumberField({ initial: 0 }),
          advances: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
          current: new NumberField({ initial: 8 }),
          max: new NumberField({ initial: 0 }),
        }),
        temporaryLeP: new SchemaField({
          max: new NumberField({ initial: 0 }),
          value: new NumberField({ initial: 0 }),
        }),
        astralenergy: new SchemaField({
          initial: new NumberField({ initial: 0 }),
          value: new NumberField({ initial: 0 }),
          advances: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
          current: new NumberField({ initial: 0 }),
          max: new NumberField({ initial: 0 }),
        }),
        karmaenergy: new SchemaField({
          initial: new NumberField({ initial: 0 }),
          value: new NumberField({ initial: 0 }),
          advances: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
          current: new NumberField({ initial: 0 }),
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
          initial: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
          value: new NumberField({ initial: 0 }),
        }),
        initiative: new SchemaField({
          value: new NumberField({ initial: 0 }),
          modifier: new NumberField({ initial: 0 }),
          current: new NumberField({ initial: 0 }),
          die: new StringField({ initial: '1d6' }),
          diemodifier: new StringField({ initial: '' }),
        }),
        size: new SchemaField({
          value: new StringField({ initial: 'average' }),
        }),
        regeneration: new SchemaField({
          LePTemp: new NumberField({ initial: 0 }),
          AsPTemp: new NumberField({ initial: 0 }),
          KaPTemp: new NumberField({ initial: 0 }),
          LePMod: new NumberField({ initial: 0 }),
          AsPMod: new NumberField({ initial: 0 }),
          KaPMod: new NumberField({ initial: 0 }),
        }),
      }),
    };
  }
}
