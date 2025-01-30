import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../abstract.js';
import DSA5_Utility from '../../system/utility-dsa5.js';

const { SchemaField, StringField, NumberField, HTMLField } = foundry.data.fields;

export default class AggregatedtestData extends ItemDataModel.mixin(DescriptionTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      interval: new SchemaField({
        value: new StringField({ initial: '', label: 'interval' }),
      }),
      allowedTestCount: new SchemaField({
        value: new NumberField({ initial: 7, label: 'allowedTestCount', min: 0 }),
      }),
      usedTestCount: new SchemaField({
        value: new NumberField({ initial: 0, label: 'usedTestCount', min: 0 }),
      }),
      previousFailedTests: new SchemaField({
        value: new NumberField({ initial: 0, label: 'previousFailedTests', min: 0 }),
      }),
      talent: new SchemaField({
        value: new StringField({ initial: '', label: 'skill1' }),
        value2: new StringField({ initial: '', label: 'skill2' }),
        value3: new StringField({ initial: '', label: 'skill3' }),
      }),
      cummulatedQS: new SchemaField({
        value: new NumberField({ initial: 0, label: 'cummulatedQS', min: 0 }),
      }),
      baseModifier: new NumberField({ initial: 0, label: 'Modifier' }),
      partsuccess: new HTMLField({ label: 'PartSuccess' }),
      success: new HTMLField({ label: 'Success' }),
    });
  }

  async getSheetData(data) {
    const embeddedItem = data.document.getFlag('dsa5', 'embeddedItem');
    let renderedItem;
    if (embeddedItem) renderedItem = await renderTemplate(`systems/dsa5/templates/items/browse/${embeddedItem.type}.html`, { document: embeddedItem });

    data.allSkills = await DSA5_Utility.allSkillsList();
    data.embeddedItem = embeddedItem;
    data.renderedItem = renderedItem;
    data.enrichedsuccess = await TextEditor.enrichHTML(data.document.system.success, { secrets: data.document.isOwner });
    data.enrichedpartsuccess = await TextEditor.enrichHTML(data.document.system.partsuccess, { secrets: data.document.isOwner });
  }

  static async _postItem(item) {
    let txt = '';
    let result = 'Ongoing';
    if (item.system.cummulatedQS.value >= 10) {
      result = 'Success';
      txt = `${await TextEditor.enrichHTML(item.system.partsuccess, { secrets: item.isOwner })}${await TextEditor.enrichHTML(item.system.success, {
        secrets: item.isOwner,
        async: true,
      })}`;
    } else if (item.system.cummulatedQS.value >= 6) {
      result = 'PartSuccess';
      txt = `${await TextEditor.enrichHTML(item.system.partsuccess, { secrets: item.isOwner })}`;
    } else if (item.system.allowedTestCount.value - item.system.usedTestCount.value <= 0) {
      result = 'Failure';
    }
    const properties = [
      this._chatLineHelper({ key: 'cummulatedQS', val: `${item.system.cummulatedQS.value} / 10` }),
      this._chatLineHelper({ key: 'interval', val: item.system.interval.value }),
      this._chatLineHelper({ key: 'probes', val: `${item.system.usedTestCount.value} / ${item.system.allowedTestCount.value}` }),
      this._chatLineHelper({ key: 'result', val: result, localizeVal: true }),
      txt,
    ];
    const descriptionObfuscated = foundry.utils.getProperty(item, 'system.obfuscation.description');

    const html = await renderTemplate('systems/dsa5/templates/chat/aggregatedTestResult.html', { descriptionObfuscated, item, properties });
    const chatOptions = DSA5_Utility.chatDataSetup(html);
    ChatMessage.create(chatOptions);
  }
}
