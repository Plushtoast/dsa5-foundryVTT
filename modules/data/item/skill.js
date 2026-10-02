import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import SkillTemplate from './templates/skill.js';
import DSA5 from '../../config/config-dsa5.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class SkillData extends ItemDataModel.mixin(DescriptionTemplate, SkillTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      group: new SchemaField({
        value: new StringField({ initial: 'body', label: 'Group', required: true, choices: DSA5.skillGroups }),
      }),
      talentValue: new SchemaField({
        value: new NumberField({ initial: 0, min: 0 }),
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

    if (source.group && !source.group.value) source.group.value = Object.keys(DSA5.skillGroups)[0];
  }

  get detail_name() {
    const base = super.detail_name;
    const ownerUuid = this.parent?.getFlag?.('dsa5', 'loyaltyOwner');
    if (!ownerUuid) return base;

    let owner;
    try {
      owner = fromUuidSync(ownerUuid);
    } catch {
      owner = null;
    }
    const ownerName = String(owner?.name || '').trim();
    if (!ownerName) return base;
    if (base.includes(`(${ownerName})`)) return base;
    return `${base} (${ownerName})`;
  }

  async getSheetData(data) {
    data.localizerPrefix = 'SKILLdescr.';
    data.hasLocalization = game.i18n.has(`SKILLdescr.${data.document.name}`);
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    item.name = this.detail_name;
    return item;
  }

  static chatData(data, name) {
    const hasLocalization = game.i18n.has(`SKILLdescr.${name}`);
    const description = hasLocalization ? _loc(`SKILLdescr.${name}`) : data.description.value;
    return [{ key: 'Description', val: description }];
  }
}
