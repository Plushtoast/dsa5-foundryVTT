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
        magical: new NumberField({ initial: 1, label: 'energyfactor' }),
        clerical: new NumberField({ initial: 1, label: 'energyfactor' }),
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
}
