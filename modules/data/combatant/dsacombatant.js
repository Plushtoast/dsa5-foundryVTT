import { DSADataModel } from '../abstract.js';

const { NumberField, BooleanField, StringField } = foundry.data.fields;

export class DSACombatantDataModel extends DSADataModel {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      defenseCount: new NumberField({ initial: 0, min: 0 }),
      roundInitiative: new NumberField({ initial: -1 }),
      actionsUsed: new NumberField({ initial: 0, min: 0, integer: true }),
      freeActionUsed: new BooleanField({ initial: false }),
      movementActionConsumed: new BooleanField({ initial: false }),
      chaseRole: new StringField({
        initial: 'chasing',
        blank: true,
        choices: {
          '': '',
          fleeing: 'CHASE.role.fleeing',
          chasing: 'CHASE.role.chasing',
        },
      }),
      chaseDistance: new NumberField({ initial: null, min: 0, nullable: true, integer: true }),
      chaseRolled: new BooleanField({ initial: false }),
      /** Last movement delta applied from a Verfolgungsaktion (for fate/edit reapply). */
      chaseLastMove: new NumberField({ initial: 0, min: 0, integer: true }),
      /** Chaser distance before the last Verfolgungsaktion (avoids clamp errors on reapply). */
      chaseDistanceBefore: new NumberField({ initial: null, min: 0, nullable: true, integer: true }),
    });
  }
}
