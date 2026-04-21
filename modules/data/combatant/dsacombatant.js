import { DSADataModel } from '../abstract.js';

const { NumberField, BooleanField } = foundry.data.fields;

export class DSACombatantDataModel extends DSADataModel {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      defenseCount: new NumberField({ initial: 0, min: 0 }),
      roundInitiative: new NumberField({ initial: -1 }),
      actionsUsed: new NumberField({ initial: 0, min: 0, integer: true }),
      freeActionUsed: new BooleanField({ initial: false }),
      movementActionConsumed: new BooleanField({ initial: false }),
      /*newRoundFavor: new SchemaField({ // todo taktische befehle
        flavor: new StringField(),
        initiative: new NumberField(),
      })*/
    });
  }
}
