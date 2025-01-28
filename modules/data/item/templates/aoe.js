import DSA5 from '../../../system/config-dsa5.js';
import { DSADataModel } from '../../abstract.js';

const { SchemaField, NumberField, StringField } = foundry.data.fields;

export default class AoeTemplate extends DSADataModel {
  static defineSchema() {
    const targetTypes = Object.entries(DSA5.areaTargetTypes).reduce((acc, [key, name]) => {
      acc[key] = `areaTargetTypes.${name}`;
      return acc;
    }, {});
    return {
      target: new SchemaField({
        value: new NumberField({ initial: 0 }),
        type: new StringField({ initial: '', choices: targetTypes, blank: true }),
        width: new NumberField({ initial: 0, placeholder: 'gridUnits', label: 'aoewidth' }),
        angle: new NumberField({ initial: 45, label: 'aoeangle' }),
      }),
    };
  }

  static _migrateData(source) {
    super._migrateData(source);

    if(isNaN(source.target.value)) {
      source.target.value = Number(source.target.value) || 0;
    }
}
}
