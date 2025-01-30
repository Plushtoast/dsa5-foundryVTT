import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import SpellTemplate from './templates/spell.js';
import BasicSpellTemplate from './templates/basicspell.js';
import AoeTemplate from './templates/aoe.js';
import DSA5_Utility from '../../system/utility-dsa5.js';
import SkillTemplate from './templates/skill.js';

const { StringField } = foundry.data.fields;

export default class SpellData extends ItemDataModel.mixin(AoeTemplate, DescriptionTemplate, SkillTemplate, SpellTemplate, BasicSpellTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      feature: new StringField({ initial: '', label: 'feature' }),
      reversalis: new StringField({ label: 'LocalizedIDs.reversalis' }),
    });
  }

  static chatData(data, name) {
    return [
      { key: 'castingTime', val: data.castingTime.value },
      { key: 'AsPCost', val: data.AsPCost.value },
      { key: 'distribution', val: data.distribution.value },
      { key: 'duration', val: data.duration.value },
      { key: 'reach', val: data.range.value },
      { key: 'targetCategory', val: data.targetCategory.value },
      { key: 'effect', val: DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.effect.value)) },
    ];
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    this.constructor._perpareItemAdvancementCost(item, this.actor);
    this.constructor.buildSpellChargeProgress(item);
    return item;
  }
}
