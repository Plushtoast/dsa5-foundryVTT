import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../abstract.js';
import DSA5_Utility from '../../system/utility-dsa5.js';

const { StringField } = foundry.data.fields;

export default class ApplicationData extends ItemDataModel.mixin(DescriptionTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      skill: new StringField({ initial: '', label: 'TYPES.Item.skill' }),
    });
  }

  async getSheetData(data) {
    data.localizerPrefix = `APPLICATION.${data.document.system.skill} - `;
    data.hasLocalization = game.i18n.has(`${data.localizerPrefix}${data.document.name}`);
    data.allSkills = await DSA5_Utility.allSkillsList();
  }

  static chatData(data, name) {
    const hasLocalization = game.i18n.has(`APPLICATION.${data.skill} - ${name}`);
    const description = hasLocalization ? game.i18n.localize(`APPLICATION.${data.skill} - ${name}`) : data.description.value;
    return [{ key: 'Description', val: description }];
  }
}
