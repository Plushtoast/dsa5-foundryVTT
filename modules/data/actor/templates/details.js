import { DSADataModel } from '../../abstract.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class DetailsTemplate extends DSADataModel {
  static defineSchema() {
    return {
      details: new SchemaField({
        species: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        gender: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        culture: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        career: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        socialstate: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        experience: new SchemaField({
          total: new NumberField({ initial: 0 }),
          spent: new NumberField({ initial: 0 }),
        }),
        Home: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        family: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        age: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        haircolor: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        eyecolor: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        height: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        weight: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        distinguishingmark: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        biography: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        notes: new SchemaField({
          value: new StringField({ initial: '' }),
          gmdescription: new StringField({ initial: '' }),
          ownerdescription: new StringField({ initial: '' }),
        }),
      }),
    };
  }
}
