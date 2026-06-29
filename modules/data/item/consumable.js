import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import DSA5 from '../../config/config-dsa5.js';
import DSAStringField from '../fields/dsa_string_field.js';
import AoeTemplate from './templates/aoe.js';
import ObfuscableTemplate from './templates/obfuscable.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import { ItemFactory } from '../../item/item-factory.js';

const { StringField, SchemaField, NumberField, HTMLField } = foundry.data.fields;
const { TextEditor } = foundry.applications.ux;

export default class ConsumableData extends ItemDataModel.mixin(OnUseTemplate, AoeTemplate, ObfuscableTemplate, DescriptionTemplate, EquipmentTemplate) {
  get detail_name() {
    if (this.detailsObfuscated && !game.user.isGM) return super.detail_name;

    return `${super.detail_name} (${_loc('CHARAbbrev.QS')} ${this.QL})`;
  }

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
    const availableSteps = data.document.system.QLList.split('\n');
    data.calculatedPrice = ItemFactory.getSubClass(data.document.type).consumablePrice(data.document);
    data.availableSteps = Object.fromEntries(availableSteps.map((_, i) => [i + 1, i + 1]));
    data.enrichedIngredients = await TextEditor.enrichHTML(data.document.system.ingredients, { secrets: data.document.isOwner });
    data.currentStep = availableSteps[data.document.system.QL - 1] || '';
    data.detail_name = this.detail_name;
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
    item.name = this.parent.system.detail_name;
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
  

 //	Sammeln alle relevanten Consumables des Actors 

  static addConsumableModifiers(situationalModifiers, actor, testData) {
      if (!actor) return;
      
      const consumables = actor.items.filter(x => x.type == "consumable" && x.system.quantity.value > 0);
      const targetName = testData.source.name; 
      const targetType = testData.source.type;
      const typeLabel = game.i18n.localize("TYPES.Item.consumable");

      for (let item of consumables) {
          const relevantEffect = item.effects.find(e => {
              if (e.disabled || e.transfer) return false;
              return e.changes.some(change => {
                  const key = change.key;
                  const val = typeof change.value === "string" ? change.value : String(change.value);
                  return key.includes(targetName) || val.includes(targetName) || 
                         (targetType == "spell" && key.includes("spell"));
              });
          });

          if (relevantEffect) {
              let change = relevantEffect.changes.find(c => 
                  c.key.includes(targetName) || 
                  (typeof c.value === "string" && c.value.includes(targetName))
              ) || relevantEffect.changes[0];

              let modType = "";
              if (change.key.includes(".FP") || change.key.includes("SkillPoints")) modType = "FP";
              else if (change.key.includes(".QL") || change.key.includes("qualityStep")) modType = "QL";
              else if (change.key.includes(".FW") || change.key.includes("talentValue")) modType = "FW";

              let numericPart = change.value;
              if (typeof numericPart === "string" && isNaN(Number(numericPart))) {
                   const match = String(numericPart).match(/-?\d+/);
                   if (match) numericPart = match[0];
              }

              if (!numericPart && numericPart != 0) continue;

              let finalValue = numericPart;
              switch (parseInt(change.mode)) {
                  case 1: finalValue = `*${numericPart}`; break; 
                  case 5: finalValue = `=${numericPart}`; break; 
                  default: finalValue = Number(numericPart);
              }

              let displayName = `${typeLabel}: ${item.name}`;
              if (item.system.QL) displayName += ` (QS ${item.system.QL})`;

              situationalModifiers.push({
                  name: displayName,
                  value: finalValue, 
                  type: modType,       
                  selected: false,
                  consumableId: item.id 
              });
          }
      }
  }


 //	Verbrauch ausführen (Menge -1 oder Item löschen)

  async consumeItem() {
      const item = this.parent;
      const newQty = item.system.quantity.value - 1;
      
      if (newQty <= 0) {
          await item.delete();
      } else {
          await item.update({"system.quantity.value": newQty});
      }
  }


//	Prüft ausgewählte Modifikatoren und löst Verbrauch aus 
   
  static async triggerConsumptions(testData, actor) {
      if (!actor || !testData.situationalModifiers) return;

      for (let mod of testData.situationalModifiers) {
          if (mod.consumableId && mod.selected) {
              let item = actor.items.get(mod.consumableId);
              if (item) {
				await item.system.consumeItem();
              }
          }
      }
  }
}
