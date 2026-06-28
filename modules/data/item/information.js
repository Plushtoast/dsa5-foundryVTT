import MagicAnalysisQueryService from '../../system/queries/magic-analysis-query.js';
import MagicAnalysisService from '../../system/magic-analysis/magic-analysis.js';
import InformationQueryService from '../../system/queries/information-query.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import { bindClickListener } from '../../system/helpers/view_helper.js';
import { ItemDataModel } from '../baseitem.js';

const { StringField, NumberField, HTMLField } = foundry.data.fields;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

export default class InformationData extends ItemDataModel {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      subType: new StringField({
        initial: 'default',
        required: true,
        label: 'INFORMATION.type',
        choices: {
          default: 'INFORMATION.subType.default',
          magicalAnalysis: 'INFORMATION.subType.magicalAnalysis',
        },
      }),
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
        return { [`enriched${prop}`]: await TextEditor.enrichHTML(context.document.system[prop], { }) };
      }),
    );
    return Object.assign({}, ...enrichedProperties);
  }

  static async renderInfoPreview(document, { isGM = game.user.isGM, parentUuid, sheetEmbed = false } = {}) {
    if (!document?.uuid && !document?.type) return '';
    const item = document.type === 'information' ? document : await fromUuid(document.uuid);
    if (item?.type !== 'information') return '';

    const docData = item.toObject?.() ?? item;
    if (!isGM) {
      return renderTemplate('systems/dsa5/templates/items/infopreview-player.hbs', {
        uuid: item.uuid,
        document: docData,
        parentUuid,
      });
    }

    const enriched = await item.system.enrichedProperties({ document: item });
    return renderTemplate('systems/dsa5/templates/items/infopreview.hbs', {
      uuid: item.uuid,
      document: docData,
      enriched,
      parentUuid,
      sheetEmbed,
    });
  }

  static attachPreviewListeners(element) {
    bindClickListener(element, (ev) => this.#onPreviewClick(ev, element));
  }

  static #onPreviewClick(ev, element) {
    if (InformationQueryService.handlePreviewClick(ev, element)) return;
    if (MagicAnalysisService.handlePreviewClick(ev, element)) return;

    const showItem = ev.target.closest('.show-item, [data-action="infoShow"]');
    if (showItem && element.contains(showItem)) {
      ev.preventDefault();
      ev.stopPropagation();
      void this.showPreviewItem(showItem.dataset.uuid, {
        parentUuid: showItem.dataset.parentUuid,
      });
      return;
    }

    const postInfo = ev.target.closest('.postInfo');
    if (postInfo && element.contains(postInfo)) {
      ev.preventDefault();
      ev.stopPropagation();
      void this.postPreviewItem(postInfo);
    }
  }

  static async showPreviewItem(uuid, { parentUuid } = {}) {
    if (!uuid) return;
    const item = await fromUuid(uuid);
    item?.sheet?.render(true, { magicAnalysisParentUuid: parentUuid });
  }

  static async postPreviewItem(target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;

    const parentUuid = target.dataset.parentUuid;
    const item = await fromUuid(uuid);
    if (!item) return;

    if (item.system.subType === 'magicalAnalysis') {
      await MagicAnalysisQueryService.openStartDialog({
        informationUuid: item.uuid,
        parentUuid: parentUuid || undefined,
      });
      return;
    }

    if (typeof item.postItem === 'function') await item.postItem();
  }

  async getSheetData(data) {
    data.allSkills = await DSA5_Utility.allSkillsList();
    data.isMagicalAnalysis = data.document.system.subType === 'magicalAnalysis';
    foundry.utils.mergeObject(data, await this.enrichedProperties(data));
  }

  static async _postItem(item) {
    if (item.system.subType === 'magicalAnalysis') {
      await MagicAnalysisQueryService.openStartDialog({ informationUuid: item.uuid });
      return;
    }
    const { UserMultipickDialog } = await import('../../dialog/addTargetDialog.js');
    const html = await renderTemplate('systems/dsa5/templates/chat/information/request-roll.hbs', { item });
    UserMultipickDialog.getDialog(html);
  }
}
