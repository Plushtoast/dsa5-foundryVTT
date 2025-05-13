import { DSADataModel } from '../../abstract.js';

const { SchemaField, ObjectField, BooleanField, NumberField } = foundry.data.fields;

export default class RidingTemplate extends DSADataModel {
  static defineSchema() {
    return {
      horse: new SchemaField({
        actorLink: new BooleanField(),
        token: new ObjectField(),
        isRiding: new NumberField({ initial: 0, choices: {
          0: 'RIDING.mountOptions.0',
          1: 'RIDING.mountOptions.1',
          2: 'RIDING.mountOptions.2',
        } }),
      }),
    };
  }
}
