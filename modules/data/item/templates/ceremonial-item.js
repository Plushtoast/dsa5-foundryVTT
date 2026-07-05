import { DSADataModel } from '../../abstract.js';
const { StringField } = foundry.data.fields;
import DSA5 from '../../../config/config-dsa5.js';

class CeremonialItemField extends StringField {
  _toInput(config) {
    const { choices, groups } = DSA5.getCeremonialItemChoices();
    config.choices ??= choices;
    config.groups ??= groups;
    return super._toInput(config);
  }
}



export default class CeremonialItemTemplate extends DSADataModel {

  static defineSchema() {
    return {
      ceremonialItem: new CeremonialItemField({
        label: 'SpecCategory.ceremonial',
      }),
    };
  }
}
