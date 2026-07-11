import { DSADataModel } from '../abstract.js';

const { BooleanField, NumberField, StringField, ArrayField, TypedObjectField, ObjectField } = foundry.data.fields;

const MKR_PHASES = ['heroActions', 'movement', 'attacks', 'damageReport'];
const DEFAULT_KR_PER_MKR = 60;

const MKR_PHASE_CHOICES = Object.fromEntries(
  MKR_PHASES.map((phase) => [phase, `VEHICLE.mkr.phase.${phase}`]),
);

const WATER_TERRAIN_CHOICES = {
  open: 'VEHICLE.mkr.chase.terrain.open',
  passable: 'VEHICLE.mkr.chase.terrain.passable',
  normal: 'VEHICLE.mkr.chase.terrain.normal',
  difficultSeas: 'VEHICLE.mkr.chase.terrain.difficultSeas',
  difficultShoals: 'VEHICLE.mkr.chase.terrain.difficultShoals',
  severeStorm: 'VEHICLE.mkr.chase.terrain.severeStorm',
  severeShoals: 'VEHICLE.mkr.chase.terrain.severeShoals',
};

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
          },
        }),
        mkrRound: new NumberField({ initial: 0, min: 0 }),
        mkrKrStart: new NumberField({ initial: 0, min: 0 }),
        mkrPhase: new StringField({ initial: 'heroActions', choices: MKR_PHASE_CHOICES }),
        krPerMkr: new NumberField({ initial: DEFAULT_KR_PER_MKR, min: 1 }),
        maneuverModifiers: new TypedObjectField(new ObjectField(), { initial: {} }),
        commandedGuns: new ArrayField(new ObjectField(), { initial: [] }),
        pendingHits: new ArrayField(new ObjectField(), { initial: [] }),
        waterTerrain: new StringField({ initial: 'normal', choices: WATER_TERRAIN_CHOICES }),
    });
  }
}
