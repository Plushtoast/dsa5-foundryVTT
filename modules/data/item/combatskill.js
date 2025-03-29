import { ItemDataModel } from '../baseitem.js';
import SkillTemplate from './templates/skill.js';
import DSA5 from '../../system/config-dsa5.js';
import DSA5_Utility from '../../system/utility-dsa5.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class CombatskillData extends ItemDataModel.mixin(SkillTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      guidevalue: new SchemaField({
        value: new StringField({ initial: 'ff', label: 'guidevalue', required: true, choices: DSA5.combatskillsGuidevalues }),
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

    if (typeof source.weapontype.value === 'string') {
      source.weapontype.value = {
        melee: 0,
        range: 1,
      }[source.weapontype.value];
    }
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    this.constructor._calculateCombatSkillValues(item, this.actor.system);
    return item;
  }

  async getSheetData(data) {
    data.hasLocalization = game.i18n.has(`Combatskilldescr.${data.document.name}`);
    data.localizerPrefix = 'Combatskilldescr.';
  }

  static chatData(data, name) {
    return [{ key: 'Description', val: `Combatskilldescr.${name}`, localizeVal: true }];
  }

  static _calculateCombatSkillValues(skill, actorData, { step, parry, attack } = { step: 0, parry: 0, attack: 0 }) {
    const modifiedTalentValue = skill.system.talentValue.value + step;

    if (skill.system.weapontype.value == 0) {
      const vals = skill.system.guidevalue.value
        .split('/')
        .map(
          (x) =>
            Number(actorData.characteristics[x].initial) +
            Number(actorData.characteristics[x].modifier) +
            Number(actorData.characteristics[x].advances) +
            Number(actorData.characteristics[x].gearmodifier),
        );

      const parryChar = Math.max(...vals);
      const attackChar =
        actorData.characteristics.mu.initial + actorData.characteristics.mu.modifier + actorData.characteristics.mu.advances + actorData.characteristics.mu.gearmodifier;

      skill.system.parry.value = Math.ceil(modifiedTalentValue / 2) + Math.max(0, Math.floor((parryChar - 8) / 3)) + Number(game.settings.get('dsa5', 'higherDefense')) + parry;
      skill.system.attack.value = modifiedTalentValue + Math.max(0, Math.floor((attackChar - 8) / 3)) + attack;
    } else {
      const attackChar =
        actorData.characteristics.ff.initial + actorData.characteristics.ff.modifier + actorData.characteristics.ff.advances + actorData.characteristics.ff.gearmodifier;

      skill.system.parry.value = 0;
      skill.system.attack.value = modifiedTalentValue + Math.max(0, Math.floor((attackChar - 8) / 3)) + attack;
    }

    skill.cost = game.i18n.format('advancementCost', {
      cost: DSA5_Utility._calculateAdvCost(skill.system.talentValue.value, skill.system.StF.value),
    });
    return skill;
  }
}
