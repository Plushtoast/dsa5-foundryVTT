import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import SpellTemplate from './templates/spell.js';
import BasicSpellTemplate from './templates/basicspell.js';
import AoeTemplate from './templates/aoe.js';

const { } = foundry.data.fields;

export default class LiturgyData extends DSADataModel.mixin(AoeTemplate, DescriptionTemplate, SpellTemplate, BasicSpellTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {});
  }
}
