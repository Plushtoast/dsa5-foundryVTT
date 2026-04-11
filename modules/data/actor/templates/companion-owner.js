import { DSADataModel } from '../../abstract.js';

const { SchemaField, StringField, BooleanField, TypedObjectField } = foundry.data.fields;

export default class CompanionOwnerTemplate extends DSADataModel {
  static defineSchema() {
    return {
      companions: new TypedObjectField(new SchemaField({
        uuid: new StringField({ required: true }),
        hotbar: new BooleanField({ initial: false }),
      })),
    };
  }
}
