import DSA5 from '../../../config/config-dsa5.js';
import { DSADataModel } from '../../abstract.js';

const { BooleanField, SchemaField, NumberField, StringField } = foundry.data.fields;

export default class AoeTemplate extends DSADataModel {
  static defineSchema() {
    const targetTypes = Object.entries(DSA5.areaTargetTypes).reduce((acc, [key]) => {
      acc[key] = `areaTargetTypes.${key}`;
      return acc;
    }, {});
    return {
      target: new SchemaField({
        value: new StringField({ initial: '0' }),
        type: new StringField({ initial: '', choices: targetTypes, blank: true }),
        showZone: new BooleanField({ initial: true, label: 'showZone' }),
        width: new NumberField({ initial: 0, placeholder: 'gridUnits', label: 'aoewidth' }),
        angle: new NumberField({ initial: 45, label: 'aoeangle' }),
      }),
    };
  }
}
