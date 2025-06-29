import { DSADataModel } from '../../abstract.js';

const { SchemaField, NumberField, StringField } = foundry.data.fields;
import DSA5 from '../../../system/config-dsa5.js';

export default class MagicTemplate extends DSADataModel {
  static defineSchema() {
    const guidevalues = foundry.utils.duplicate(DSA5.characteristics);
    guidevalues['-'] = '-';
    return {
      guidevalue: new SchemaField({
        magical: new StringField({ initial: '-', label: 'guidevalue', required: true, choices: guidevalues }),
        clerical: new StringField({ initial: '-', label: 'guidevalue', required: true, choices: guidevalues }),
      }),
      energyfactor: new SchemaField({
        magical: new NumberField({ initial: 1, label: 'energyfactor', step: 0.1 }),
        clerical: new NumberField({ initial: 1, label: 'energyfactor', step: 0.1 }),
      }),
      tradition: new SchemaField({
        magical: new StringField({ initial: '', label: 'tradition' }),
        clerical: new StringField({ initial: '', label: 'tradition' }),
      }),
      feature: new SchemaField({
        magical: new StringField({ initial: '', label: 'feature' }),
        clerical: new StringField({ initial: '', label: 'aspect' }),
      }),
      happyTalents: new SchemaField({
        value: new StringField({ initial: '', label: 'happyTalents' }),
      }),
    };
  }

  static _migrateData(source) {
    super._migrateData(source);

    const downCaseFields = ['guidevalue.magical', 'guidevalue.clerical'];
    for (const field of downCaseFields) {
      const prop = foundry.utils.getProperty(source, field)
      if (prop && typeof prop === 'string') {
        foundry.utils.setProperty(source, field, prop.toLowerCase());
      }
    }
  }
}
