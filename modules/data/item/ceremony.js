import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import SpellTemplate from './templates/spell.js';
import BasicSpellTemplate from './templates/basicspell.js';
import AoeTemplate from './templates/aoe.js';

const { SchemaField, NumberField } = foundry.data.fields;

export default class CeremonyData extends DSADataModel.mixin(AoeTemplate, DescriptionTemplate, SpellTemplate, BasicSpellTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      permanentCost: new SchemaField({
        value: new NumberField({ initial: 0, label: 'permanentCost' }),
      }),
    });
  }
}
