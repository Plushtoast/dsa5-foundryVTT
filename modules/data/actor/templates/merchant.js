import DSA5 from '../../../config/config-dsa5.js';
import { DSADataModel } from '../../abstract.js';
import DSABooleanField from '../../fields/dsa_boolean_field.js';

const { SchemaField, NumberField, StringField, ObjectField, BooleanField } = foundry.data.fields;

export default class MerchantTemplate extends DSADataModel {
  static GARADAN_CHOICES = {
    1: 'GARADAN.1',
    2: 'GARADAN.2',
    3: 'GARADAN.3',
    4: 'GARADAN.4',
    5: 'GARADAN.5',
    6: 'GARADAN.6',
  };

  static defineSchema() {
    return {
      merchant: new SchemaField({
        locked: new BooleanField({ initial: false }),
        merchantType: new StringField({ initial: 'none', required: true, choices: DSA5.merchantTypes, label: 'creatureClass' }),
        temporary: new DSABooleanField({ initial: false }),
        sellingFactor: new NumberField({ initial: 1, step: 0.01, min: 0 }),
        buyingFactor: new NumberField({ initial: 1, step: 0.01, min: 0 }),
        hidePlayer: new DSABooleanField({ initial: false, label: 'MERCHANT.hidePlayer' }),
        hideMoney: new DSABooleanField({ initial: false, label: 'MERCHANT.hideMoney' }),
        factors: new SchemaField({
          buyingFactor: new ObjectField(),
          sellingFactor: new ObjectField(),
        }),
        garadan: new NumberField({
          initial: 1,
          label: 'Garadan',
          required: true,
          choices: MerchantTemplate.GARADAN_CHOICES,
        }),
      }),
    };
  }
}
