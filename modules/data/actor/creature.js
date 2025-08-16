import { ActorDataModel } from '../baseactor.js';
import CharacteristicsTemplate from './templates/characteristics.js';
import MagicTemplate from './templates/magic.js';
import MerchantTemplate from './templates/merchant.js';
import RidingTemplate from './templates/riding.js';
import StatusTemplate from './templates/status.js';

const { SchemaField, BooleanField, StringField, NumberField, HTMLField } = foundry.data.fields;

export default class CreatureData extends ActorDataModel.mixin(RidingTemplate, CharacteristicsTemplate, MerchantTemplate, StatusTemplate, MagicTemplate) {

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
        config: new SchemaField({
            autoBar: new BooleanField({ initial: true }),
            autoSize: new BooleanField({ initial: true }),
            defense: new BooleanField({ initial: false }),
            lockRotation: new BooleanField({ initial: false }),
        }),
        details: new SchemaField({
            experience: new SchemaField({
                total: new NumberField({ initial: 0 }),
                spent: new NumberField({ initial: 0 }),
            }),
            notes: new SchemaField({
                ownerdescription: new HTMLField({ initial: '' }),
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
            value: new HTMLField({ initial: '' }),
        }),
        flight: new SchemaField({
            value: new HTMLField({ initial: '' }),
        }),
        specialRules: new SchemaField({
            value: new HTMLField({ initial: '' }),
        }),
        conjuringDifficulty: new SchemaField({
            value: new NumberField({ initial: 0 }),
        }),
        description: new SchemaField({
            value: new HTMLField({ initial: '' }),
        }),
    });
  }

  baseInitiative(data) {
    data.status.initiative.value = data.status.initiative.current + (data.status.initiative.modifier || 0);
  }
  
}
