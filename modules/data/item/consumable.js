import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import DSA5 from '../../config/config-dsa5.js';
import DSAStringField from '../fields/dsa_string_field.js';
import AoeTemplate from './templates/aoe.js';
import ObfuscableTemplate from './templates/obfuscable.js';
import Itemdsa5 from '../../item/item-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import { ItemFactory } from '../../item/item-factory.js';

const { StringField, SchemaField, NumberField, HTMLField } = foundry.data.fields;
const { TextEditor } = foundry.applications.ux;

export default class ConsumableData extends ItemDataModel.mixin(OnUseTemplate, AoeTemplate, ObfuscableTemplate, DescriptionTemplate, EquipmentTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      equipmentType: new SchemaField({
        value: new StringField({ initial: 'misc', required: true, label: 'equipmentType', choices: DSA5.equipmentTypes }),
      }),
      QLList: new DSAStringField({ initial: '', label: 'qualitySteps' }),
      QL: new NumberField({ initial: 1, required: true, label: 'qualityStep' }),
      charges: new NumberField({ initial: 1, min: 0 }),
      maxCharges: new NumberField({ initial: 1, min: 0 }),
      difficulty: new NumberField({ initial: 0, label: 'Difficulty' }),
      ingredients: new HTMLField({ initial: '' }),
      tools: new StringField({ initial: '', label: 'Equipment.tools' }),
    });
  }

  async getSheetData(data) {
    data.calculatedPrice = ItemFactory.getSubClass(data.document.type).consumablePrice(data.document);
    data.availableSteps = Object.fromEntries(data.document.system.QLList.split('\n').map((_, i) => [i + 1, i + 1]));
    data.enrichedIngredients = await TextEditor.enrichHTML(data.document.system.ingredients, { secrets: data.document.isOwner });
  }

  static chatData(data, name) {
    return [
      { key: 'qualityStep', val: data.QL },
      { key: 'effect', val: DSA5_Utility.replaceDies(data.QLList.split('\n')[data.QL - 1]) },
      { key: 'charges', val: data.charges },
    ];
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    item.system.preparedWeight = this.parent.system.preparedWeight;
    this.constructor._prepareConsumable(item);
    return item;
  }

  static _prepareConsumable(item) {
    if (item.system.maxCharges) {
      item.consumable = true;
      item.structureMax = item.system.maxCharges;
      item.structureCurrent = item.system.charges;
    }
    return item;
  }
}
