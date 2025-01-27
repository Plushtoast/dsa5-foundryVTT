import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import APValueTemplate from './templates/apvalue.js';
import RequirementsTemplate from './templates/requirements.js';
import DSAStringField from "../fields/dsa_string_field.js";

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class SpeciesData extends DSADataModel.mixin(DescriptionTemplate, APValueTemplate, RequirementsTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      recommendedAdvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'recommendedAdvantages' }),
      }),
      recommendedDisadvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'recommendedDisadvantages' }),
      }),
      notsuitableAdvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'notsuitableAdvantages' }),
      }),
      notsuitableDisadvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'notsuitableDisadvantages'}),
      }),
      recommendedCultures: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'recommendedCultures' }),
      }),
      attributeChange: new SchemaField({
        value: new StringField({ initial: '', label: 'attributeChange' }),
      }),
      baseValues: new SchemaField({
        wounds: new SchemaField({
          value: new NumberField({ initial: 0, label: 'wounds' }),
        }),
        soulpower: new SchemaField({
          value: new NumberField({ initial: 0, label: 'soulpower' }),
        }),
        toughness: new SchemaField({
          value: new NumberField({ initial: 0, label: 'toughness' }),
        }),
        speed: new SchemaField({
          value: new NumberField({ initial: 0, label: 'speed' }),
        }),
      }),
    });
  }
}
