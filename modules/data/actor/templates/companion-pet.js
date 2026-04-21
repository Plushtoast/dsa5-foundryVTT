import { DSADataModel } from '../../abstract.js';

const { SchemaField, StringField, ArrayField } = foundry.data.fields;

export default class CompanionPetTemplate extends DSADataModel {
  static defineSchema() {
    return {
      companionData: new SchemaField({
        owners: new ArrayField(new StringField()),
        species: new StringField({ nullable: true, initial: null }),
        skillHotbar: new ArrayField(new StringField({ nullable: true }), { initial: Array(14).fill(null) }),
      }),
    };
  }
}
