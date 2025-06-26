import { UserMultipickDialog } from '../../dialog/addTargetDialog.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import { ItemDataModel } from '../baseitem.js';

const { StringField, NumberField, HTMLField } = foundry.data.fields;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

export default class InformationData extends ItemDataModel {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      qs1: new HTMLField({ initial: '' }),
      qs2: new HTMLField({ initial: '' }),
      qs3: new HTMLField({ initial: '' }),
      qs4: new HTMLField({ initial: '' }),
      qs5: new HTMLField({ initial: '' }),
      qs6: new HTMLField({ initial: '' }),
      skill: new StringField({ initial: '', required: true, label: 'TYPES.Item.skill' }),
      modifier: new NumberField({ initial: 0, label: 'Modifier' }),
      crit: new HTMLField({ initial: '' }),
      botch: new HTMLField({ initial: '' }),
      fail: new HTMLField({ initial: '' }),
    });
  }

  async enrichedProperties(context) {
    const propertiesToEnrich = ['qs1', 'qs2', 'qs3', 'qs4', 'qs5', 'qs6', 'crit', 'botch', 'fail'];
    const enrichedProperties = await Promise.all(
      propertiesToEnrich.map(async (prop) => {
        return { [`enriched${prop}`]: await TextEditor.enrichHTML(context.document.system[prop], { async: true }) };
      }),
    );
    return Object.assign({}, ...enrichedProperties);
  }

  async getSheetData(data) {
    data.allSkills = await DSA5_Utility.allSkillsList();
    foundry.utils.mergeObject(data, await this.enrichedProperties(data));
  }

  static async _postItem(item) {
    const html = await renderTemplate('systems/dsa5/templates/chat/informationRequestRoll.hbs', { item });
    UserMultipickDialog.getDialog(html);
  }
}
