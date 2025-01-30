import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import APValueTemplate from './templates/apvalue.js';
import DSAStringField from '../fields/dsa_string_field.js';

const { StringField, SchemaField } = foundry.data.fields;

export default class CultureData extends ItemDataModel.mixin(DescriptionTemplate, APValueTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      language: new SchemaField({
        value: new StringField({ initial: '', label: 'language' }),
      }),
      writing: new SchemaField({
        value: new StringField({ initial: '', label: 'writing' }),
      }),
      localKnowledge: new SchemaField({
        value: new StringField({ initial: '', label: 'LocalizedIDs.localKnowledge' }),
      }),
      suitableProfessions: new SchemaField({
        value: new StringField({ initial: '', label: 'recommendedProfessions' }),
      }),
      recommendedAdvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'recommendedAdvantages' }),
      }),
      recommendedDisadvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'recommendedDisadvantages' }),
      }),
      recommendedTalents: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'recommendedTalents' }),
      }),
      notsuitableAdvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'notsuitableAdvantages' }),
      }),
      notsuitableTalents: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'notsuitableTalents' }),
      }),
      notsuitableDisadvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'notsuitableDisadvantages' }),
      }),
      socialstate: new SchemaField({
        value: new StringField({ initial: '', label: 'Socialstate' }),
      }),
      skills: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'skills' }),
      }),
      clothing: new SchemaField({
        value: new StringField({ initial: '' }),
      }),
    });
  }

  async getSheetData(data) {
    data.enrichedClothing = await TextEditor.enrichHTML(data.document.system.clothing.value, { secrets: data.document.isOwner });
  }
}
