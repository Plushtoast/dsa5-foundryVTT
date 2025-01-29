import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../abstract.js';
import SpellTemplate from './templates/spell.js';
import BasicSpellTemplate from './templates/basicspell.js';
import AoeTemplate from './templates/aoe.js';
import DSA5_Utility from '../../system/utility-dsa5.js';

const {} = foundry.data.fields;

export default class LiturgyData extends ItemDataModel.mixin(AoeTemplate, DescriptionTemplate, SpellTemplate, BasicSpellTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {});
  }

  static chatData(data, name) {
    return [
      { key: 'castingTime', val: data.castingTime.value },
      { key: 'KaPCost', val: data.AsPCost.value },
      { key: 'distribution', val: data.distribution.value },
      { key: 'duration', val: data.duration.value },
      { key: 'reach', val: data.range.value },
      { key: 'targetCategory', val: data.targetCategory.value },
      { key: 'effect', val: DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.effect.value)) },
    ];
  }

  static chatData(data, name) {
    const hasLocalization = game.i18n.has(`SKILLdescr.${name}`);
    const description = hasLocalization ? game.i18n.localize(`SKILLdescr.${name}`) : data.description.value;
    return [{ key: 'Description', val: description }];
  }
}
