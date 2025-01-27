import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import SkillTemplate from './templates/skill.js';
import DSA5 from '../../system/config-dsa5.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class SkillData extends DSADataModel.mixin(DescriptionTemplate, SkillTemplate) {

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
        group: new SchemaField({
            value: new StringField({ initial: '', label: 'Group', required: true, choices: DSA5.skillGroups }),
        }),
        talentValue: new SchemaField({
            value: new NumberField({ initial: 0 }),
        }),
        characteristic1: new SchemaField({
            value: new StringField({ initial: 'mu', label: 'Characteristic1', required: true, choices: DSA5.characteristics }),
        }),
        characteristic2: new SchemaField({
            value: new StringField({ initial: 'mu', label: 'Characteristic2', required: true, choices: DSA5.characteristics }),
        }),
        characteristic3: new SchemaField({
            value: new StringField({ initial: 'mu', label: 'Characteristic3', required: true, choices: DSA5.characteristics }),
        }),
        RPr: new SchemaField({
            value: new StringField({ initial: 'no' }),
        }),
        burden: new SchemaField({
            value: new StringField({ initial: 'no', label: 'encumbrance', required: true, choices: DSA5.skillBurdens }),
        }),
    });
  }

  static _migrateData(source) {
    super._migrateData(source);

    if(!source.group.value) source.group.value = Object.keys(DSA5.skillGroups)[0];
  }
}
