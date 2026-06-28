import { DSADataModel } from '../../abstract.js';
import InformationData from '../information.js';

const { TypedObjectField, SchemaField, DocumentUUIDField } = foundry.data.fields;
const { randomID } = foundry.utils;

export const INFORMABLE_INFO_REFS_TEMPLATE = 'systems/dsa5/templates/items/partials/informable-info-refs.hbs';

export default class InformableTemplate extends DSADataModel {
  static defineSchema() {
    return {
      refs: new TypedObjectField(new SchemaField({
        uuid: new DocumentUUIDField({
          type: 'Item',
          required: false,
          blank: true,
          label: 'INFORMABLE.refs.uuid',
        }),
      }), { initial: {} }),
    };
  }

  static listRefs(item) {
    return Object.entries(item.system?.refs || {})
      .filter(([, ref]) => ref?.uuid)
      .map(([id, ref]) => ({ id, uuid: ref.uuid }));
  }

  static hasInformationRef(item) {
    return this.listRefs(item).length > 0;
  }

  static getInformationRefUuid(item) {
    return this.listRefs(item)[0]?.uuid || '';
  }

  static async addInformationRef(item, uuid) {
    const id = randomID();
    await item.update({ [`system.refs.${id}`]: { uuid } });
    return id;
  }

  static async removeInformationRef(item, id) {
    if (!id) return;
    await item.update({ [`system.refs.${id}`]: _del });
  }

  static async resolveInformationDocument(item, { uuid } = {}) {
    const resolvedUuid = uuid || this.getInformationRefUuid(item);
    if (!resolvedUuid) return null;
    const doc = await fromUuid(resolvedUuid);
    return doc?.type === 'information' ? doc : null;
  }

  async getSheetData(data) {
    if (!game.user.isGM) return;

    const refs = InformableTemplate.listRefs(data.document);
    data.informationRefs = [];
    for (const { id, uuid } of refs) {
      const doc = await fromUuid(uuid);
      if (doc?.type !== 'information') continue;
      data.informationRefs.push({
        id,
        uuid,
        preview: await InformationData.renderInfoPreview(doc, {
          isGM: true,
          parentUuid: data.document.uuid,
          sheetEmbed: true,
        }),
      });
    }
    if (!data.informationRefs.length) return;
    data.hasInformationRef = true;
  }
}
