import { ItemDataModel } from '../abstract.js';
import SkillTemplate from './templates/skill.js';
import DSA5 from '../../system/config-dsa5.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class CombatskillData extends ItemDataModel.mixin(SkillTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      guidevalue: new SchemaField({
        value: new StringField({ initial: 'ff', label: 'guidevalue', required: true, choices: DSA5.combatskillsGuidevalues  }),        
      }),
      parry: new SchemaField({
        value: new NumberField({ initial: 0 }),
      }),
      attack: new SchemaField({
        value: new NumberField({ initial: 0 }),
      }),
      talentValue: new SchemaField({
        value: new NumberField({ initial: 6 }),
      }),
      weapontype: new SchemaField({
        value: new NumberField({ initial: 0, label: 'weapontype', required: true, choices: DSA5.weapontypes }),
      }),
    });
  }

  static _migrateData(source) {
    super._migrateData(source);

    if(typeof source.weapontype.value === 'string') {
      source.weapontype.value = {
        'melee': 0,
        'range': 1,
      }[source.weapontype.value];
    }
  }

  async getSheetData(data) {
    data.hasLocalization = game.i18n.has(`Combatskilldescr.${data.document.name}`);
    data.localizerPrefix = 'Combatskilldescr.';
  }

  static chatData(data, name) {
    return [{key:'Description', val: `Combatskilldescr.${name}`, localizeVal: true}];
  }
}
