import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import GroupCheck from '../../system/rolls/group-check.js';

const { SchemaField, StringField, NumberField, HTMLField } = foundry.data.fields;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

export default class AggregatedtestData extends ItemDataModel.mixin(DescriptionTemplate) {
  static DEFAULT_TARGET_QS = 10;
  static DEFAULT_MAX_ROLLS = 7;
  static PART_SUCCESS_FRACTION = 3 / 5;

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      interval: new SchemaField({
        value: new StringField({ initial: '', label: 'interval' }),
      }),
      allowedTestCount: new SchemaField({
        value: new NumberField({ initial: this.DEFAULT_MAX_ROLLS, label: 'allowedTestCount', min: 0, hint: 'GROUPCHECK.maxRollsHint' }),
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
      targetQs: new SchemaField({
        value: new NumberField({
          initial: this.DEFAULT_TARGET_QS,
          label: 'GROUPCHECK.targetQs',
          min: 1,
          integer: true,
          hint: 'GROUPCHECK.targetQsHint',
        }),
      }),
      baseModifier: new NumberField({ initial: 0, label: 'Modifier' }),
      partsuccess: new HTMLField({ label: 'PartSuccess' }),
      success: new HTMLField({ label: 'Success' }),
    });
  }

  static resolveTargetQs(value, fallback = this.DEFAULT_TARGET_QS) {
    const qs = Number(value);
    return Number.isFinite(qs) && qs > 0 ? Math.trunc(qs) : fallback;
  }

  static partSuccessQs(targetQs = this.DEFAULT_TARGET_QS) {
    const needed = this.resolveTargetQs(targetQs);
    return Math.max(1, Math.round(needed * this.PART_SUCCESS_FRACTION));
  }

  get targetQsNeeded() {
    return this.constructor.resolveTargetQs(this.targetQs?.value);
  }

  get partSuccessThreshold() {
    return this.constructor.partSuccessQs(this.targetQsNeeded);
  }

  get qsProgressLabel() {
    return `${this.cummulatedQS.value} / ${this.targetQsNeeded}`;
  }

  get isFullSuccess() {
    return this.cummulatedQS.value >= this.targetQsNeeded;
  }

  get isPartSuccess() {
    return !this.isFullSuccess && this.cummulatedQS.value >= this.partSuccessThreshold;
  }

  async getSheetData(data) {
    const embeddedItem = data.document.getFlag('dsa5', 'embeddedItem');
    let renderedItem;
    if (embeddedItem) renderedItem = await renderTemplate(`systems/dsa5/templates/items/browse/${embeddedItem.type}.hbs`, { document: embeddedItem });

    data.allSkills = await DSA5_Utility.allSkillsList();
    data.embeddedItem = embeddedItem;
    data.renderedItem = renderedItem;
    data.partSuccessThreshold = this.partSuccessThreshold;
    const isGM = data.isGM ?? game.user.isGM;
    data.showPartSuccess = isGM || this.cummulatedQS.value >= this.partSuccessThreshold;
    data.showSuccess = isGM || this.isFullSuccess;
    data.enrichedsuccess = await TextEditor.enrichHTML(data.document.system.success, { secrets: data.document.isOwner });
    data.enrichedpartsuccess = await TextEditor.enrichHTML(data.document.system.partsuccess, { secrets: data.document.isOwner });
  }

  get unlimited() {
    return GroupCheck.isUnlimited(this.allowedTestCount.value);
  }

  get testsExhausted() {
    if (this.unlimited) return false;
    return this.usedTestCount.value >= this.allowedTestCount.value;
  }

  get probesLabel() {
    return `${this.usedTestCount.value} / ${GroupCheck.formatMaxRolls(this.allowedTestCount.value)}`;
  }

  static async _postItem(item) {
    let txt = '';
    let result = 'Ongoing';
    const system = item.system;
    const targetQs = system.targetQsNeeded ?? this.resolveTargetQs(system.targetQs?.value);
    const partQs = system.partSuccessThreshold ?? this.partSuccessQs(targetQs);
    if (system.cummulatedQS.value >= targetQs) {
      result = 'Success';
      txt = `${await TextEditor.enrichHTML(system.partsuccess, { secrets: item.isOwner })}${await TextEditor.enrichHTML(system.success, {
        secrets: item.isOwner,
      })}`;
    } else if (system.cummulatedQS.value >= partQs) {
      result = 'PartSuccess';
      txt = `${await TextEditor.enrichHTML(system.partsuccess, { secrets: item.isOwner })}`;
    } else if (system.testsExhausted) {
      result = 'Failure';
    }
    const properties = [
      this._chatLineHelper({ key: 'cummulatedQS', val: `${system.cummulatedQS.value} / ${targetQs}` }),
      this._chatLineHelper({ key: 'interval', val: item.system.interval.value }),
      this._chatLineHelper({ key: 'probes', val: item.system.probesLabel }),
      this._chatLineHelper({ key: 'result', val: result, localizeVal: true }),
      txt,
    ];
    const descriptionObfuscated = foundry.utils.getProperty(item, 'system.obfuscation.description');

    const html = await renderTemplate('systems/dsa5/templates/chat/aggregatedTestResult.hbs', { descriptionObfuscated, item, properties });
    const chatOptions = DSA5_Utility.chatDataSetup(html);
    return ChatMessage.create(chatOptions);
  }
}
