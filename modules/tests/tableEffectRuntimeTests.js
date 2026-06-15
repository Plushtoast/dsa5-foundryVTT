import ActiveEffectScopedRules from '../status/active_effect_scoped_rules.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSATables from '../tables/dsatables.js';
import TableEffectActiveEffects from '../tables/tableEffectActiveEffects.js';
import TableEffectHelpers from '../tables/tableEffectHelpers.js';
import TableEffects from '../tables/tableEffects.js';
import TableOpportunityAttack from '../tables/tableOpportunityAttack.js';

const { duplicate, getProperty, mergeObject, randomID } = foundry.utils;

const IMPLEMENTED_EFFECT_KEYS = [
  'attackPenaltyReduction',
  'damageModifier',
  'defenseCountModifier',
  'gearDamaged',
  'gearLost',
  'malus',
  'maneuverPenaltyIgnore',
  'nextAction',
  'opportunityAttack',
  'resistEffect',
  'scopedModifier',
  'scopedRestriction',
  'selfAttack',
  'selfDamage',
  'weaponDelay',
  'weaponRepairPenalty',
];

export default class TableEffectRuntimeTests {
  static async run(options = {}) {
    if (!game.user.isGM) throw new Error('Table effect runtime tests require a GM user.');

    await this.#prepareChat();

    const results = [];
    const cleanup = { actorIds: [], messageIds: [], tokenIds: [] };
    const fixtures = await this.#createFixtures(cleanup);
    this.#clearTargets();

    const record = async (name, fn) => {
      try {
        const details = await fn(fixtures);
        results.push({ name, pass: true, details });
      } catch (err) {
        results.push({ name, pass: false, error: err?.message || String(err) });
      }
    };

    await record('bleeding condition registered', () => this.#assertBleedingRegistered());
    await record('target resolution: self', () => this.#testTargetSelf(fixtures));
    await record('target resolution: victim', () => this.#testTargetVictim(fixtures));
    await record('target resolution: attacker', () => this.#testTargetAttacker(fixtures));
    await record('malus noTarget fallback', () => this.#testMalusNoTarget(fixtures));
    await record('malus systemEffect prone', () => this.#testMalusProne(fixtures));
    await record('scopedModifier active effect', () => this.#testScopedModifier(fixtures));
    await record('scopedRestriction active effect', () => this.#testScopedRestriction(fixtures));
    await record('maneuverPenaltyIgnore charge effect', () => this.#testManeuverPenaltyIgnore(fixtures));
    await record('defenseCountModifier charge effect', () => this.#testDefenseCountModifier(fixtures));
    await record('attackPenaltyReduction effect', () => this.#testAttackPenaltyReduction(fixtures));
    await record('gearLost unequips weapon', () => this.#testGearLost(fixtures));
    await record('weaponDelay reload progress', () => this.#testWeaponDelay(fixtures));
    await record('weaponRepairPenalty on item', () => this.#testWeaponRepairPenalty(fixtures));
    await record('selfDamage without weapon source', () => this.#testSelfDamageFallback(fixtures));
    await record('resistEffect fail.damage buildEffects', () => this.#testResistFailDamageBuild());
    await record('resistEffect apply flow', () => this.#testResistEffectApply(fixtures));
    await record('gearDamaged apply', () => this.#testGearDamaged(fixtures));
    await record('nextAction modifier', () => this.#testNextAction(fixtures));
    await record('selfAttack damage apply', () => this.#testSelfAttackApply(fixtures));
    await record('opportunityAttack chat card', () => this.#testOpportunityAttackCard(fixtures));

    if (options.samplePack !== false) {
      await record('compendium row smoke apply', () => this.#testPackSamples(fixtures, cleanup));
    }

    await this.#cleanup(cleanup);

    const summary = {
      passed: results.filter((x) => x.pass).length,
      failed: results.filter((x) => !x.pass).length,
      total: results.length,
      failedTests: results.filter((x) => !x.pass).map((x) => ({ name: x.name, error: x.error })),
      results,
    };

    console.warn('DSA5 table effect runtime tests', summary);
    if (summary.failed) {
      for (const failure of summary.failedTests) console.error(`DSA5 table effect runtime failure: ${failure.name} — ${failure.error}`);
    }
    return summary;
  }

  static #statusEffect(id) {
    return CONFIG.statusEffects.find((effect) => effect.id == id) || CONFIG.statusEffects[id];
  }

  static #assertBleedingRegistered() {
    if (!this.#statusEffect('bleeding')) throw new Error('bleeding is not registered in CONFIG.statusEffects');
    return 'bleeding available';
  }

  static async #createFixtures(cleanup) {
    const createActor = async (name) => {
      const [actor] = await Actor.createDocuments([duplicate(DSA5_Utility.emptyActor(12, name).emptyActor)]);
      await actor.update({
        'system.status.wounds.max': 50,
        'system.status.wounds.value': 25,
      });
      cleanup.actorIds.push(actor.id);
      return actor;
    };

    let self = await createActor('TableTest Self');
    let victim = await createActor('TableTest Victim');
    let attacker = await createActor('TableTest Attacker');

    await self.createEmbeddedDocuments('Item', [
      this.#combatSkillData('Dolche'),
      this.#combatSkillData('Bogen', true),
    ]);

    let selfToken;
    let victimToken;
    let attackerToken;
    if (canvas.scene) {
      const created = await canvas.scene.createEmbeddedDocuments('Token', [
        { actorId: self.id, x: 100, y: 100, name: self.name },
        { actorId: victim.id, x: 200, y: 100, name: victim.name },
        { actorId: attacker.id, x: 300, y: 100, name: attacker.name },
      ]);
      selfToken = created[0];
      victimToken = created[1];
      attackerToken = created[2];
      cleanup.tokenIds.push(selfToken.id, victimToken.id, attackerToken.id);
      selfToken = canvas.scene.tokens.get(selfToken.id);
      victimToken = canvas.scene.tokens.get(victimToken.id);
      attackerToken = canvas.scene.tokens.get(attackerToken.id);
    }

    const [meleeWeapon] = await self.createEmbeddedDocuments('Item', [{
      name: 'TableTest Sword',
      type: 'meleeweapon',
      system: {
        damagedie: '1d6',
        damageAdd: 0,
        combatskill: { value: 'Dolche' },
        atmod: { value: 0, offhandMod: 0 },
        pamod: { value: 0, offhandMod: 0 },
        worn: { value: true, offHand: false },
        structure: { value: 8, max: 8 },
      },
    }]);

    const [rangedWeapon] = await self.createEmbeddedDocuments('Item', [{
      name: 'TableTest Bow',
      type: 'rangeweapon',
      system: {
        damagedie: '1d6',
        damageAdd: 0,
        combatskill: { value: 'Bogen' },
        atmod: { value: 0, offhandMod: 0 },
        pamod: { value: 0, offhandMod: 0 },
        worn: { value: false, offHand: false },
        structure: { value: 8, max: 8 },
        reloadTime: { progress: 3, value: 2 },
        aimTime: { progress: 0 },
      },
    }]);

    self = await Actor.get(self.id);
    victim = await Actor.get(victim.id);
    attacker = await Actor.get(attacker.id);

    return {
      self,
      victim,
      attacker,
      selfToken,
      victimToken,
      attackerToken,
      meleeWeapon: self.items.get(meleeWeapon.id),
      rangedWeapon: self.items.get(rangedWeapon.id),
      speaker: this.#speakerRef(self, selfToken),
      victimSpeaker: this.#speakerRef(victim, victimToken),
      attackerSpeaker: this.#speakerRef(attacker, attackerToken),
    };
  }

  static #speakerRef(actor, token) {
    if (!actor) return undefined;
    return {
      actor: actor.id,
      token: token?.id || actor.token?.id,
      scene: token?.parent?.id || actor.token?.parent?.id || canvas.scene?.id,
    };
  }

  static #combatSkillData(name, ranged = false) {
    return {
      name,
      type: 'combatskill',
      system: {
        guidevalue: { value: ranged ? 'ff' : 'ge' },
        weapontype: { value: ranged ? 1 : 0 },
        talentValue: { value: 10 },
        attack: { value: 10 },
        parry: { value: 5 },
      },
    };
  }

  static async #prepareChat() {
    if (!ui.sidebar?.rendered) return;
    if (!ui.sidebar.expanded) ui.sidebar.expand();
    await ui.sidebar.changeTab('chat', 'primary');
  }

  static async #createTableMessage(hasEffect, options, cleanup, { persist = false } = {}) {
    const data = {
      content: '<div class="hideAnchor"></div>',
      flags: {
        dsa5: {
          hasEffect: duplicate(hasEffect),
          options: duplicate(options),
        },
      },
    };

    if (!persist) {
      const id = randomID();
      return {
        id,
        ...duplicate(data),
        async update(changes) {
          mergeObject(this, changes, { inplace: true });
          return this;
        },
      };
    }

    await this.#prepareChat();
    const message = await ChatMessage.create({
      user: game.user.id,
      chatBubble: false,
      ...data,
    });
    cleanup.messageIds.push(message.id);
    return message;
  }

  static #tableOptions(fixtures, extra = {}) {
    return {
      speaker: fixtures.speaker,
      source: fixtures.meleeWeapon.id,
      table: 'criticalAttack',
      tableContext: {
        table: 'criticalAttack',
        speaker: fixtures.speaker,
        targets: [fixtures.victimSpeaker],
        attacker: fixtures.attackerSpeaker,
        defenders: [],
      },
      ...extra,
    };
  }

  static async #testTargetSelf(fixtures) {
    const resolved = TableEffectHelpers.evaluateTargetArg({ target: 'self' }, [fixtures.self], {
      speaker: fixtures.self,
    });
    if (!resolved.hasTargets || resolved.finalTargets[0]?.id != fixtures.self.id) {
      throw new Error('self target resolution failed');
    }
    return `resolved ${resolved.finalTargets[0].name}`;
  }

  static async #testTargetVictim(fixtures) {
    if (!fixtures.victimToken) throw new Error('no active scene token for victim test');

    this.#clearTargets();
    await fixtures.victimToken.object?.setTarget?.(true, { releaseOthers: true });
    const resolved = TableEffectHelpers.evaluateTargetArg({ target: 'victim' }, [fixtures.self], {
      speaker: fixtures.self,
      targets: [fixtures.victim],
    });
    if (!resolved.hasTargets || resolved.finalTargets[0]?.id != fixtures.victim.id) {
      throw new Error('victim target resolution failed');
    }
    return `resolved ${resolved.finalTargets[0].name}`;
  }

  static async #testTargetAttacker(fixtures) {
    const context = {
      ...TableEffectHelpers.buildEffectContext(this.#tableOptions(fixtures), fixtures.self),
      attacker: fixtures.attacker,
    };
    const resolved = TableEffectHelpers.evaluateTargetArg({ target: 'attacker' }, [fixtures.self], context);
    if (!resolved.hasTargets || resolved.finalTargets[0]?.id != fixtures.attacker.id) {
      throw new Error('attacker target resolution failed');
    }
    return `resolved ${resolved.finalTargets[0].name}`;
  }

  static #clearTargets() {
    for (const token of [...game.user.targets]) {
      token.object?.setTarget?.(false, { releaseOthers: false });
    }
    game.user.targets.clear();
  }

  static async #testMalusNoTarget(fixtures) {
    this.#clearTargets();
    const cleanup = { messageIds: [] };
    const self = await Actor.get(fixtures.self.id);
    const message = await this.#createTableMessage({
      malus: [{
        target: 'victim',
        noTarget: {
          changes: [{ key: 'system.meleeStats.attack', mode: 2, value: -2 }],
          duration: { rounds: 1 },
        },
      }],
    }, this.#tableOptions(fixtures, {
      tableContext: {
        table: 'criticalAttack',
        speaker: fixtures.speaker,
        targets: [],
        attacker: fixtures.attackerSpeaker,
        defenders: [],
      },
    }), cleanup);

    const before = self.effects.size;
    const context = TableEffectHelpers.buildEffectContext(message.flags.dsa5.options, self);
    const ok = await TableEffects.malus(getProperty(message, 'flags.dsa5.hasEffect').malus, 'self', [self], fixtures.meleeWeapon, message.id, message, context);
    const after = (await Actor.get(fixtures.self.id)).effects.size;
    if (!ok || after <= before) throw new Error('noTarget malus did not create an effect');
    await this.#cleanup(cleanup);
    return 'fallback malus applied to self';
  }

  static async #testMalusProne(fixtures) {
    const cleanup = { messageIds: [] };
    const message = await this.#createTableMessage({
      malus: [{ systemEffect: 'prone', duration: { rounds: 1 } }],
    }, this.#tableOptions(fixtures), cleanup);

    const ok = await TableEffects.malus(getProperty(message, 'flags.dsa5.hasEffect').malus, 'self', [fixtures.self], fixtures.meleeWeapon, message.id, message, { speaker: fixtures.self });
    if (!ok) throw new Error('prone malus handler returned false');
    await this.#cleanup(cleanup);
    return 'prone malus applied';
  }

  static async #testScopedModifier(fixtures) {
    await TableEffects.scopedModifier({
      target: 'self',
      scopeTarget: 'attacker',
      changes: [{ key: 'system.meleeStats.attack', value: 2 }],
      duration: { rounds: 1 },
    }, 'self', [fixtures.self], fixtures.meleeWeapon, null, null, TableEffectHelpers.buildEffectContext(this.#tableOptions(fixtures), fixtures.self));

    const actor = await Actor.get(fixtures.self.id);
    const entries = ActiveEffectScopedRules.activeEntries(actor, 'modifier');
    if (!entries.length) throw new Error('scoped modifier effect missing');
    return `${entries.length} scoped modifier effect(s)`;
  }

  static async #testScopedRestriction(fixtures) {
    await TableEffects.scopedRestriction({
      target: 'self',
      restrictions: ['attack'],
      duration: { rounds: 1 },
    }, 'self', [fixtures.self], fixtures.meleeWeapon, null, null, TableEffectHelpers.buildEffectContext(this.#tableOptions(fixtures), fixtures.self));

    const actor = await Actor.get(fixtures.self.id);
    const entries = ActiveEffectScopedRules.activeEntries(actor, 'restriction');
    if (!entries.length) throw new Error('scoped restriction effect missing');
    return `${entries.length} scoped restriction effect(s)`;
  }

  static async #testManeuverPenaltyIgnore(fixtures) {
    await TableEffectActiveEffects.createManeuverPenaltyIgnore(fixtures.self, 2, { rounds: 1 });
    const actor = await Actor.get(fixtures.self.id);
    const effect = actor.effects.find((ef) => !ef.disabled && ef.system?.charges?.max == 1);
    if (!effect) throw new Error('maneuver penalty ignore effect missing');
    return effect.name;
  }

  static async #testDefenseCountModifier(fixtures) {
    const before = fixtures.self.effects.size;
    await TableEffectActiveEffects.createDefenseCountModifier(fixtures.self, { floor: -1 }, { rounds: 1 });
    const actor = await Actor.get(fixtures.self.id);
    if (actor.effects.size <= before) throw new Error('defense count modifier effect missing');
    return 'defense count modifier created';
  }

  static async #testAttackPenaltyReduction(fixtures) {
    const before = fixtures.self.effects.size;
    await TableEffectActiveEffects.createAttackPenaltyReduction(fixtures.self, { value: 2 }, { rounds: 1 });
    const actor = await Actor.get(fixtures.self.id);
    if (actor.effects.size <= before) throw new Error('attack penalty reduction effect missing');
    return 'attack penalty reduction created';
  }

  static async #testGearLost(fixtures) {
    const actor = await Actor.get(fixtures.self.id);
    await actor.updateEmbeddedDocuments('Item', [{ _id: fixtures.meleeWeapon.id, 'system.worn.value': true }]);
    const weapon = actor.items.get(fixtures.meleeWeapon.id);
    const ok = await TableEffects.gearLost({ distance: '1d6' }, 'self', [actor], weapon);
    if (!ok) throw new Error('gearLost handler returned false');
    const refreshed = await Actor.get(fixtures.self.id);
    const stillEquipped = refreshed.items.filter((item) => item.id == fixtures.meleeWeapon.id && item.system.worn?.value);
    if (stillEquipped.length) throw new Error('gearLost did not unequip weapon');
    return 'weapon unequipped';
  }

  static async #testWeaponDelay(fixtures) {
    const actor = await Actor.get(fixtures.self.id);
    const weapon = actor.items.get(fixtures.rangedWeapon.id);
    const before = weapon.system.reloadTime.progress;
    const ok = await TableEffects.weaponDelay({ actions: 1 }, 'self', [actor], weapon);
    const item = (await Actor.get(fixtures.self.id)).items.get(fixtures.rangedWeapon.id);
    if (!ok || Number(item.system.reloadTime.progress) >= before) throw new Error('weaponDelay did not reduce reload progress');
    return `reload ${before} -> ${item.system.reloadTime.progress}`;
  }

  static async #testWeaponRepairPenalty(fixtures) {
    const actor = await Actor.get(fixtures.self.id);
    const weapon = actor.items.get(fixtures.meleeWeapon.id);
    const ok = await TableEffects.weaponRepairPenalty({ value: -2 }, 'self', [actor], weapon);
    const item = (await Actor.get(fixtures.self.id)).items.get(fixtures.meleeWeapon.id);
    const penaltyEffects = [...item.effects].filter((effect) => effect.flags?.dsa5?.tableEffect?.type == 'weaponRepairPenalty');
    if (!ok || !penaltyEffects.length) throw new Error('weaponRepairPenalty effect missing');
    return 'repair penalty embedded on weapon';
  }

  static async #testSelfDamageFallback(fixtures) {
    const woundsBefore = fixtures.self.system.status.wounds.value;
    const cleanup = { messageIds: [] };
    const message = await this.#createTableMessage({ selfDamage: { target: 'self' } }, this.#tableOptions(fixtures, { source: undefined }), cleanup);
    const ok = await TableEffects.selfDamage(getProperty(message, 'flags.dsa5.hasEffect').selfDamage, 'self', [fixtures.self], undefined, message.id, message, { speaker: fixtures.self });
    const actor = await Actor.get(fixtures.self.id);
    if (!ok || actor.system.status.wounds.value >= woundsBefore) throw new Error('selfDamage fallback did not apply damage');
    await this.#cleanup(cleanup);
    return `wounds ${woundsBefore} -> ${actor.system.status.wounds.value}`;
  }

  static async #testResistEffectApply(fixtures) {
    const cleanup = { messageIds: [] };
    const beforeCount = game.messages.size;
    const message = await this.#createTableMessage({
      resistEffect: {
        target: 'self',
        roll: 'Körperbeherrschung',
        modifier: -2,
        fail: [{ description: 'Fall prone', systemEffect: 'prone' }],
      },
    }, this.#tableOptions(fixtures), cleanup);

    const ok = await TableEffects.resistEffect(
      getProperty(message, 'flags.dsa5.hasEffect').resistEffect,
      'self',
      [fixtures.self],
      fixtures.meleeWeapon,
      message.id,
      message,
      { speaker: fixtures.self },
    );
    if (!ok) throw new Error('resistEffect apply returned false');

    const resistMessage = [...game.messages].slice(beforeCount).find((msg) => msg.content?.includes('resist-roll') || msg.content?.includes('Körperbeherrschung'));
    if (!resistMessage) throw new Error('resistEffect did not create a resist roll message');
    cleanup.messageIds.push(resistMessage.id);
    await this.#cleanup(cleanup);
    return resistMessage.id;
  }

  static async #testGearDamaged(fixtures) {
    const previousSetting = game.settings.get('dsa5', 'armorAndWeaponDamage');
    await game.settings.set('dsa5', 'armorAndWeaponDamage', true);

    try {
      const weapon = fixtures.meleeWeapon;
      const structureBefore = weapon.system.structure.value;
      const cleanup = { messageIds: [] };
      const message = await this.#createTableMessage({ gearDamaged: 1 }, this.#tableOptions(fixtures), cleanup);
      const ok = await TableEffects.gearDamaged(
        getProperty(message, 'flags.dsa5.hasEffect').gearDamaged,
        'self',
        [fixtures.self],
        weapon,
      );
      const item = (await Actor.get(fixtures.self.id)).items.get(weapon.id);
      if (!ok || item.system.structure.value >= structureBefore) {
        throw new Error('gearDamaged did not reduce weapon structure');
      }
      await this.#cleanup(cleanup);
      return `structure ${structureBefore} -> ${item.system.structure.value}`;
    } finally {
      await game.settings.set('dsa5', 'armorAndWeaponDamage', previousSetting);
    }
  }

  static async #testNextAction(fixtures) {
    const cleanup = { messageIds: [] };
    const message = await this.#createTableMessage({
      nextAction: { modifier: -2, duration: { rounds: 1 } },
    }, this.#tableOptions(fixtures), cleanup);
    const effectsBefore = (await Actor.get(fixtures.self.id)).effects.size;
    const ok = await TableEffects.nextAction(
      getProperty(message, 'flags.dsa5.hasEffect').nextAction,
      'self',
      [fixtures.self],
      fixtures.meleeWeapon,
      message.id,
      message,
      { speaker: fixtures.self },
    );
    const actor = await Actor.get(fixtures.self.id);
    if (!ok || actor.effects.size <= effectsBefore) throw new Error('nextAction did not create an active effect');
    await this.#cleanup(cleanup);
    return `effects ${effectsBefore} -> ${actor.effects.size}`;
  }

  static async #testSelfAttackApply(fixtures) {
    const woundsBefore = fixtures.self.system.status.wounds.value;
    const cleanup = { messageIds: [] };
    const message = await this.#createTableMessage({
      selfAttack: { target: 'self' },
    }, this.#tableOptions(fixtures), cleanup);
    const ok = await TableEffects.selfAttack(
      getProperty(message, 'flags.dsa5.hasEffect').selfAttack,
      'self',
      [fixtures.self],
      fixtures.meleeWeapon,
      message.id,
      message,
      { speaker: fixtures.self },
    );
    const actor = await Actor.get(fixtures.self.id);
    if (!ok || actor.system.status.wounds.value >= woundsBefore) throw new Error('selfAttack did not apply damage');
    await this.#cleanup(cleanup);
    return `wounds ${woundsBefore} -> ${actor.system.status.wounds.value}`;
  }

  static async #testResistFailDamageBuild() {
    const effects = await DSATables.buildEffects({
      results: [{ flags: { dsa5: false } }],
    }, {
      resistEffect: {
        roll: 'Körperbeherrschung',
        modifier: -2,
        fail: [{ description: 'Fall damage', damage: '1d6+1' }],
      },
    });
    const macro = effects.find((effect) => getProperty(effect, 'system.macroArgs.macro'));
    if (!macro) throw new Error('resistEffect fail.damage did not produce macro effect');
    return 'fail.damage macro built';
  }

  static async #testOpportunityAttackCard(fixtures) {
    const cleanup = { messageIds: [] };
    await this.#prepareChat();

    const actor = await Actor.get(fixtures.self.id);
    await actor.updateEmbeddedDocuments('Item', [{ _id: fixtures.meleeWeapon.id, 'system.worn.value': true }]);
    const weapon = actor.items.get(fixtures.meleeWeapon.id);

    const tableMessage = await this.#createTableMessage({}, this.#tableOptions(fixtures), cleanup);
    const context = TableEffectHelpers.buildEffectContext(tableMessage.flags.dsa5.options, actor);
    const ok = await TableOpportunityAttack.createCard({
      count: 1,
      attackModifier: 0,
    }, 'self', [await Actor.get(fixtures.attacker.id)], weapon, tableMessage.id, tableMessage, context);
    if (!ok) throw new Error('opportunity attack card was not created');

    const card = game.messages.find((msg) => this.#opportunityAttackFlag(msg)?.tableMessageId == tableMessage.id);
    if (!card) throw new Error('opportunity attack message missing');
    cleanup.messageIds.push(card.id);
    await this.#cleanup(cleanup);
    return card.id;
  }

  static #opportunityAttackFlag(message) {
    return message?.getFlag?.('dsa5', 'opportunityAttack') ?? getProperty(message, 'flags.dsa5.opportunityAttack');
  }

  static async #testPackSamples(fixtures, cleanup) {
    const pack = game.packs.get('dsa5-compendium2.critbotch');
    if (!pack) throw new Error('dsa5-compendium2.critbotch pack not found');

    const samples = Object.fromEntries(IMPLEMENTED_EFFECT_KEYS.map((key) => [key, null]));
    const skipped = [];

    const tables = await pack.getDocuments();
    for (const table of tables) {
      for (const result of table.results) {
        const effects = result.flags?.dsa5 || {};
        for (const key of Object.keys(effects)) {
          if (samples[key] === null) samples[key] = { table: table.name, range: result.range, effects };
        }
      }
    }

    const applied = [];
    for (const key of IMPLEMENTED_EFFECT_KEYS) {
      const sample = samples[key];
      if (!sample) {
        skipped.push(key);
        continue;
      }

      const payload = { [key]: duplicate(sample.effects[key]) };
      if (['damageModifier', 'malus', 'resistEffect', 'selfAttack', 'selfDamage'].includes(key)) {
        const targetKey = Array.isArray(payload[key]) ? payload[key][0]?.target : payload[key]?.target;
        if (targetKey == 'victim' && fixtures.victimToken) {
          await fixtures.victimToken.object?.setTarget(true, { releaseOthers: true });
        }
      }

      await this.#prepareChat();
      const message = await this.#createTableMessage(payload, {
        ...this.#tableOptions(fixtures),
        source: ['weaponDelay', 'weaponRepairPenalty', 'gearDamaged', 'gearLost'].includes(key)
          ? fixtures.rangedWeapon.id
          : fixtures.meleeWeapon.id,
      }, cleanup, { persist: ['gearDamaged', 'gearLost', 'weaponRepairPenalty'].includes(key) });

      const mode = key == 'damageModifier' && getProperty(payload, 'damageModifier.target') == 'victim' ? 'target' : 'self';
      await TableEffects.applyEffect(message.id, mode);
      applied.push(`${key}@${sample.table}[${(sample.range || []).join('-')}]`);
    }

    if (!applied.length) throw new Error('no compendium samples were exercised');
    return `${applied.join(', ')}${skipped.length ? `; skipped: ${skipped.join(', ')}` : ''}`;
  }

  static async #cleanup({ actorIds = [], messageIds = [], tokenIds = [] }) {
    this.#clearTargets();
    if (tokenIds.length && canvas.scene) {
      await canvas.scene.deleteEmbeddedDocuments('Token', tokenIds.filter((id) => canvas.scene.tokens.has(id)));
    }
    if (messageIds.length) {
      await ChatMessage.deleteDocuments(messageIds.filter((id) => game.messages.has(id)));
    }
    if (actorIds.length) {
      await Actor.deleteDocuments(actorIds.filter((id) => game.actors.has(id)));
    }
  }
}
