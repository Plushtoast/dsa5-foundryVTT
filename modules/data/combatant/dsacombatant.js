import { DSADataModel } from '../abstract.js';

const { NumberField } = foundry.data.fields;

export class DSACombatantDataModel extends DSADataModel {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      defenseCount: new NumberField({ initial: 0, min: 0 }),
      roundInitiative: new NumberField({ initial: -1 }),
    });
  }
}
