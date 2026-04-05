import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import ObfuscableTemplate from './templates/obfuscable.js';

const { NumberField, BooleanField, StringField, SchemaField, HTMLField } = foundry.data.fields;
const { TextEditor } = foundry.applications.ux;

export default class PlantData extends ItemDataModel.mixin(OnUseTemplate, DescriptionTemplate, EquipmentTemplate, ObfuscableTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      price: new SchemaField({
        raw: new NumberField({ initial: 0 }),
        value: new NumberField({ initial: 0 }),
      }),
      location: new SchemaField({
        landscape: new StringField({ initial: '', label: 'PLANT.landscape' }),
        region: new StringField({ initial: '', label: 'PLANT.region' }),
      }),
      difficulty: new SchemaField({
        search: new NumberField({ initial: 0, label: 'PLANT.search' }),
        identify: new NumberField({ initial: 0, label: 'PLANT.identify' }),
      }),
      usages: new StringField({ initial: '0/0/0/0/0/0', label: 'PLANT.usages' }),
      effect: new HTMLField({ initial: '', label: 'effect' }),
      infos: new HTMLField({ initial: '' }),
      recipes: new HTMLField({ initial: '' }),
      planttype: new SchemaField({
        healing: new BooleanField({}),
        poison: new BooleanField({}),
        physical: new BooleanField({}),
        psychic: new BooleanField({}),
        crop: new BooleanField({}),
        defensive: new BooleanField({}),
        supernatural: new BooleanField({}),
      }),
      availability: new SchemaField({
        highNorth: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        grasLands: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        swamps: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        woods: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        jungle: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        mountains: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        desert: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        maraskan: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
      }),
    });
  }

  async getSheetData(data) {
    data.attributes = Object.keys(data.document.system.planttype).map((x) => {
      return { name: x, checked: data.document.system.planttype[x] };
    });
    data.enrichedEffect = await TextEditor.enrichHTML(data.document.system.effect, { secrets: data.document.isOwner });
    data.enrichedRecipes = await TextEditor.enrichHTML(data.document.system.recipes, { secrets: data.document.isOwner });
    data.enrichedInformation = await TextEditor.enrichHTML(data.document.system.infos, { secrets: data.document.isOwner });
  }

  static chatData(data, name) {
    return [
      { key: 'effect', val: data.effect },
      { key: 'PLANT.recipes', val: data.recipes },
      { key: 'PLANT.usages', val: data.usages },
    ];
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    item.system.preparedWeight = this.parent.system.preparedWeight;
    return item;
  }
}
