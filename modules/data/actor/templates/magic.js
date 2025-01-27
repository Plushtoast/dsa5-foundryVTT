import { DSADataModel } from '../../abstract.js';

const { SchemaField, NumberField, StringField } = foundry.data.fields;

export default class MagicTemplate extends DSADataModel {
  static defineSchema() {
    return {
      guidevalue: new SchemaField({
        magical: new StringField({ initial: '-' }),
        clerical: new StringField({ initial: '-' }),
      }),
      energyfactor: new SchemaField({
        magical: new NumberField({ initial: 1 }),
        clerical: new NumberField({ initial: 1 }),
      }),
      tradition: new SchemaField({
        magical: new StringField({ initial: '' }),
        clerical: new StringField({ initial: '' }),
      }),
      feature: new SchemaField({
        magical: new StringField({ initial: '' }),
        clerical: new StringField({ initial: '' }),
      }),
      happyTalents: new SchemaField({
        value: new StringField({ initial: '' }),
      }),
    };
  }
}
