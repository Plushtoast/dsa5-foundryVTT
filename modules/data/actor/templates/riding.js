import { DSADataModel } from '../../abstract.js';

const { SchemaField, ObjectField, BooleanField } = foundry.data.fields;

export default class RidingTemplate extends DSADataModel {
  static defineSchema() {
    return {
      horse: new SchemaField({
        actorLink: new BooleanField(),
        token: new ObjectField(),
        isRiding: new BooleanField(),
      }),
    };
  }
}
