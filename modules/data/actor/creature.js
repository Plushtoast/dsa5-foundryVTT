import { DSADataModel } from '../abstract.js';
import CharacteristicsTemplate from './templates/characteristics.js';
import MagicTemplate from './templates/magic.js';
import MerchantTemplate from './templates/merchant.js';
import StatusTemplate from './templates/status.js';

const { SchemaField, BooleanField, StringField, NumberField } = foundry.data.fields;

export default class CreatureData extends DSADataModel.mixin(CharacteristicsTemplate, MerchantTemplate, StatusTemplate, MagicTemplate) {

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
        config: new SchemaField({
            autoBar: new BooleanField({ initial: true }),
            autoSize: new BooleanField({ initial: true }),
            defense: new BooleanField({ initial: false }),
        }),
        details: new SchemaField({
            experience: new SchemaField({
                total: new NumberField({ initial: 0 }),
                spent: new NumberField({ initial: 0 }),
            }),
        }),
        actionCount: new SchemaField({
            value: new NumberField({ initial: 1 }),
        }),
        count: new SchemaField({
            value: new StringField({ initial: '1' }),
        }),
        creatureClass: new SchemaField({
            value: new StringField({ initial: '' }),
        }),
        behaviour: new SchemaField({
            value: new StringField({ initial: '' }),
        }),
        flight: new SchemaField({
            value: new StringField({ initial: '' }),
        }),
        specialRules: new SchemaField({
            value: new StringField({ initial: '' }),
        }),
        conjuringDifficulty: new SchemaField({
            value: new NumberField({ initial: 0 }),
        }),
        description: new SchemaField({
            value: new StringField({ initial: '' }),
        }),
    });
  }
}
