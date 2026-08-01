import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import MeleeweaponData from '../data/item/meleeweapon.js';

export default class DSA5Combatant extends Combatant {
  constructor(data, context) {
    if (!data.type) data.type = 'dsacombatant';
    super(data, context);
  }

  #speakerActor() {
    return DSA5_Utility.getSpeaker({
      actor: this.actor.id,
      scene: this.sceneId,
      token: this.token.id,
    });
  }

  #tokenBarChange(actor, attribute) {
    if (!actor.system.config.autoBar) return [];
    return actor.getActiveTokens().map((x) => ({ _id: x.id, bar1: { attribute } }));
  }

  /**
   * @param {object} [options]
   * @param {'current'|'max'} [options.ppSource]
   * @param {boolean} [options.resetPP]
   * @param {boolean} [options.applyPostDamage]
   * @param {boolean} [options.unarm]
   */
  async brawlingChange(options = {}) {
    const actor = this.#speakerActor();
    const {
      ppSource = 'current',
      resetPP = true,
      applyPostDamage = false,
      unarm = this.combat.system.unarmEveryone,
    } = options;

    const tokenChange = this.#tokenBarChange(actor, 'status.temporaryLeP');
    const actorChange = {
      _id: actor.id,
      system: { status: {} },
    };

    let damage = { brawlDamage: 0, result: null };
    let woundsValue = actor.system.status.wounds.value;
    let ppValue = Number(actor.system.status.temporaryLeP.value) || 0;
    let ppMax = Number(actor.system.status.temporaryLeP.max) || 0;

    if (applyPostDamage && ppMax > 0) {
      damage = await this.rollPostBrawlDamage(actor);
      if (damage.brawlDamage > 0) {
        woundsValue = actor.system.status.wounds.value - damage.brawlDamage;
        actorChange.system.status.wounds = { value: woundsValue };
      }
      ppValue = 0;
      ppMax = 0;
    }

    const shouldInit = resetPP || ppMax <= 0;
    if (shouldInit) {
      const sourceLep = ppSource === 'max' ? actor.system.status.wounds.max : woundsValue;
      ppValue = sourceLep;
      ppMax = sourceLep;
    }

    actorChange.system.status.temporaryLeP = { value: ppValue, max: ppMax };

    if (unarm) {
      const items = this.actor.items.filter(
        (x) => x.type == 'meleeweapon' && x.system.worn.value && !MeleeweaponData.isImprovisedWeapon(x),
      );
      if (items.length) {
        actorChange.items = items.map((x) => ({ _id: x.id, 'system.worn.value': false }));
      }
    }

    return { tokenChange, actorChange, damage };
  }

  /**
   * Leave brawling mode without clearing PP or converting injuries.
   */
  leaveBrawling() {
    const actor = this.#speakerActor();
    return {
      tokenChange: this.#tokenBarChange(actor, 'status.wounds'),
      actorChange: null,
      damage: { brawlDamage: 0, result: null },
    };
  }

  /**
   * Convert lost PP into LeP injuries and clear PP.
   * @param {object} [options]
   * @param {boolean} [options.switchTokenBar=true]
   */
  async settlePostBrawlDamage(options = {}) {
    const { switchTokenBar = true } = options;
    const actor = this.#speakerActor();
    const ppMax = Number(actor.system.status.temporaryLeP.max) || 0;
    const tokenChange = switchTokenBar ? this.#tokenBarChange(actor, 'status.wounds') : [];

    if (ppMax <= 0) {
      return { tokenChange, actorChange: null, damage: { brawlDamage: 0, result: null } };
    }

    const damage = await this.rollPostBrawlDamage(actor);
    const actorChange = {
      _id: actor.id,
      system: {
        status: {
          temporaryLeP: { value: 0, max: 0 },
        },
      },
    };
    if (damage.brawlDamage > 0) {
      actorChange.system.status.wounds = {
        value: actor.system.status.wounds.value - damage.brawlDamage,
      };
    }

    return { tokenChange, actorChange, damage };
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

  /**
   * Convert lost PP into LeP damage via the brawling injuries table (does not mutate actor).
   * @param {Actor} actor
   */
  async rollPostBrawlDamage(actor) {
    const lostLP = Math.max(0, (Number(actor.system.status.temporaryLeP.max) || 0) - (Number(actor.system.status.temporaryLeP.value) || 0));
    let brawlDamage = 0;
    let result = null;

    if (lostLP > 0) {
      result = await (await this.getBrawlingTable()).draw({ displayChat: false });
      result = result.results[0];
      const multiplier = result.getFlag('dsa5', 'brawlDamage');
      brawlDamage = Math.round(lostLP * multiplier);
    }

    return { brawlDamage, result };
  }

  /** @deprecated Use leaveBrawling() — kept for callers that still expect damage settlement. */
  async undoBrawlingChange() {
    return this.leaveBrawling();
  }

  get properInitiative() {
    return this.system.roundInitiative >= 0 ? this.system.roundInitiative : this.initiative;
  }

  /**
   * Prefer token art over actor portrait for combatants without a placed token
   * (e.g. added from the combat tracker / ship-crew prompt).
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    if (this.token || this._videoSrc || !this.actor) return;

    const tokenArt = DSA5Combatant.tokenImageFor(this.actor);
    if (tokenArt && (!this.img || this.img === this.actor.img)) this.img = tokenArt;
  }

  /** Scene token texture, else prototype token texture (not portrait). */
  static tokenImageFor(actor, sceneToken = null) {
    if (!actor) return null;
    if (sceneToken?.texture?.src) return sceneToken.texture.src;
    if (actor.prototypeToken?.randomImg) return null;
    return actor.prototypeToken?.texture?.src || null;
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
