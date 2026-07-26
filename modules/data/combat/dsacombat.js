import { DSADataModel } from '../abstract.js';

const { BooleanField, NumberField, StringField, ArrayField, TypedObjectField, ObjectField } = foundry.data.fields;

const MKR_PHASES = ['heroActions', 'movement', 'attacks', 'damageReport'];
const DEFAULT_KR_PER_MKR = 60;
const DEFAULT_CHASE_MAX_ROUNDS = 5;

const MKR_PHASE_CHOICES = Object.fromEntries(
  MKR_PHASES.map((phase) => [phase, `VEHICLE.mkr.phase.${phase}`]),
);

export class DSACombatDataModel extends DSADataModel {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
        unarmEveryone: new BooleanField(),
        isBrawling: new BooleanField(),
        combatMode: new StringField({
          initial: 'standard',
          choices: {
            standard: 'COMBAT.MODE.standard',
            brawling: 'COMBAT.MODE.brawling',
            navalMkr: 'COMBAT.MODE.navalMkr',
            chase: 'COMBAT.MODE.chase',
            vehicleChase: 'COMBAT.MODE.vehicleChase',
          },
        }),
        mkrRound: new NumberField({ initial: 0, min: 0 }),
        mkrKrStart: new NumberField({ initial: 0, min: 0 }),
        mkrPhase: new StringField({ initial: 'heroActions', choices: MKR_PHASE_CHOICES }),
        krPerMkr: new NumberField({ initial: DEFAULT_KR_PER_MKR, min: 1 }),
        maneuverModifiers: new TypedObjectField(new ObjectField(), { initial: {} }),
        commandedGuns: new ArrayField(new ObjectField(), { initial: [] }),
        pendingHits: new ArrayField(new ObjectField(), { initial: [] }),
        chaseTerrain: new StringField({ initial: 'normal' }),
        chaseStartRound: new NumberField({ initial: 0, min: 0 }),
        chaseMaxRounds: new NumberField({ initial: DEFAULT_CHASE_MAX_ROUNDS, min: 1 }),
        chaseDefaultSkill: new StringField({ initial: 'bodyControl' }),
    });
  }
}
