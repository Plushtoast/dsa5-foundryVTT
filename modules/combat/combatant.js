import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import MeleeweaponData from '../data/item/meleeweapon.js';

export default class DSA5Combatant extends Combatant {
  constructor(data, context) {
    if (!data.type) data.type = 'dsacombatant';
    super(data, context);
  }

  brawlingChange() {
    const actor = DSA5_Utility.getSpeaker({
      actor: this.actor.id,
      scene: this.sceneId,
      token: this.token.id,
    });
    const unarm = this.combat.system.unarmEveryone;
    const tokenChange = actor.system.config.autoBar
      ? actor.getActiveTokens().map((x) => {
        return { _id: x.id, bar1: { attribute: 'status.temporaryLeP' } };
      })
      : [];
    const actorChange = {
      _id: actor.id,
      system: {
        status: {
          temporaryLeP: {
            value: actor.system.status.wounds.value,
            max: actor.system.status.wounds.value,
          },
        },
      },
    };

    if (unarm) {
      const items = this.actor.items.filter((x) => x.type == 'meleeweapon' && x.system.worn.value && !MeleeweaponData.isImprovisedWeapon(x));
      if (items.length) {
        actorChange.items = items.map((x) => {
          return { _id: x.id, 'system.worn.value': false };
        });
      }
    }

    return { tokenChange, actorChange };
  }

  async getBrawlingTable() {
    if (!this.brawlingTable) {
      const pack = game.packs.get(game.i18n.lang == 'de' ? 'dsa5.patzer' : 'dsa5.botch');
      const table = (
        await pack.getDocuments({
          name__in: [game.i18n.lang == 'de' ? 'Prügelei - Verletzungen' : 'Brawling - Injuries'],
        })
      )[0];
      this.brawlingTable = table;
    }

    return this.brawlingTable;
  }

  get properInitiative() {
    return this.system.roundInitiative >= 0 ? this.system.roundInitiative : this.initiative;
  }

  async undoBrawlingChange() {
    const actor = DSA5_Utility.getSpeaker({
      actor: this.actor.id,
      scene: this.sceneId,
      token: this.token.id,
    });
    const tokenChange = actor.system.config.autoBar
      ? actor.getActiveTokens().map((x) => {
        return { _id: x.id, bar1: { attribute: 'status.wounds' } };
      })
      : [];
    const lostLP = Math.max(0, actor.system.status.temporaryLeP.max - actor.system.status.temporaryLeP.value);
    let brawlDamage = 0;

    let result;
    if (lostLP > 0) {
      result = await (await this.getBrawlingTable()).draw({ displayChat: false });
      result = result.results[0];
      const multiplier = result.getFlag('dsa5', 'brawlDamage');
      brawlDamage = Math.round(lostLP * multiplier);
    }

    const actorChange = {
      _id: actor.id,
      system: {
        status: {
          temporaryLeP: {
            value: 0,
            max: 0,
          },
          wounds: {
            value: actor.system.status.wounds.value - brawlDamage,
          },
        },
      },
    };

    return { tokenChange, actorChange, damage: { brawlDamage, result } };
  }

  async recalcInitiative() {
    if (this.initiative) {
      const roll = (await this.getFlag('dsa5', 'baseRoll')) || 0;
      const update = {
        initiative: roll + this.actor.system.status.initiative.value,
      };
      await this.update(update);
    }
  }
}