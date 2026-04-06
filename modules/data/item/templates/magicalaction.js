import DSA5 from '../../../config/config-dsa5.js';
import { DSADataModel } from '../../abstract.js';

const { SchemaField, StringField } = foundry.data.fields;

export default class MagicalActionTemplate extends DSADataModel {
  static defineSchema() {
    return {
      magicalActionKind: new SchemaField({
        value: new StringField({
          initial: '',
          label: 'magicalActionKind',
          choices: DSA5.magicalActionKinds,
        }),
      }),
    };
  }
}