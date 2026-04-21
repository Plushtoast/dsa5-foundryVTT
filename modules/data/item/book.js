import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import DSA5 from '../../config/config-dsa5.js';
import ObfuscableTemplate from './templates/obfuscable.js';

const { NumberField, StringField } = foundry.data.fields;

export default class BookData extends ItemDataModel.mixin(OnUseTemplate, DescriptionTemplate, ObfuscableTemplate, EquipmentTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      author: new StringField({ initial: '', label: 'BOOKITEM.author' }),
      category: new StringField({ initial: '', label: 'BOOKITEM.category' }),
      otherNames: new StringField({ initial: '', label: 'BOOKITEM.otherNames' }),
      format: new NumberField({ initial: 0, label: 'BOOKITEM.format', choices: DSA5.bookFormats }),
      pages: new StringField({ initial: '', label: 'BOOKITEM.pages' }),
      releaseDate: new StringField({ initial: '', label: 'BOOKITEM.releaseDate' }),
      exemplar: new StringField({ initial: '', label: 'BOOKITEM.exemplar' }),
      storage: new StringField({ initial: '', label: 'BOOKITEM.storage' }),
      language: new StringField({ initial: '', label: 'BOOKITEM.language' }),
      quality: new NumberField({ initial: 0, label: 'BOOKITEM.quality', choices: DSA5.bookQualities }),
      rule: new StringField({ initial: '', label: 'BOOKITEM.rule' }),
      legality: new NumberField({ initial: 0, label: 'BOOKITEM.legality', choices: DSA5.legalities }),
      availability: new StringField({ initial: '', label: 'BOOKITEM.availability' }),
      exemplarType: new NumberField({ initial: 0, label: 'BOOKITEM.exemplarType', choices: DSA5.exemplarTypes }),
      special: new StringField({ initial: '', label: 'BOOKITEM.special' }),
    });
  }

  static _migrateData(source) {
    super._migrateData(source);

    if('legality' in source) {
      source.legality = Number(source.legality) || 0;
    }

    if('quality' in source) {
      source.quality = Number(source.quality) || 0;
    }
  }
}
