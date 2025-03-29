import { DSADataModel } from '../abstract.js';

const { BooleanField, NumberField } = foundry.data.fields;

export class DSACombatDataModel extends DSADataModel {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
        unarmEveryone: new BooleanField(),
        isBrawling: new BooleanField(),
    });
  }
}
