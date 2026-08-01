import { DSADataModel } from '../abstract.js';

const { NumberField, BooleanField, StringField, TypedObjectField } = foundry.data.fields;

export class DSACombatantDataModel extends DSADataModel {
  /** System fields cleared when a combat round advances or rewinds. */
  static ROUND_SCOPED_FIELDS = Object.freeze([
    'defenseCount',
    'roundInitiative',
    'actionsUsed',
    'freeActionUsed',
    'movementActionConsumed',
    'chaseRolled',
    'chaseLastMove',
    'chaseDistanceBefore',
  ]);

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
      /** Volle Breitseite: weaponId → shots already fired this combat turn. */
      broadsideShots: new TypedObjectField(new NumberField({ initial: 0, min: 0, integer: true }), { initial: {} }),
    });
  }

  /**
   * Flat update payload resetting all round-scoped combatant system fields to schema initials.
   * @returns {Record<string, unknown>}
   */
  static getRoundStateResetUpdate() {
    const { ForcedReplacement } = foundry.data.operators;
    const { TypedObjectField } = foundry.data.fields;
    const update = {};
    for (const key of this.ROUND_SCOPED_FIELDS) {
      const field = this.schema.get(key);
      const initial = foundry.utils.deepClone(field.getInitialValue({}));
      // Plain `{}` merges into TypedObjectField and leaves prior keys (e.g. broadsideShots).
      update[`system.${key}`] = field instanceof TypedObjectField
        ? ForcedReplacement.create(initial)
        : initial;
    }
    return update;
  }
}
