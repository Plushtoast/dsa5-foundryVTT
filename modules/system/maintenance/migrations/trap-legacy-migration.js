/**
 * Convert last-release formula / attack / timer / chase fields into defenses and damages,
 * then drop those leftover keys so item and region documents only store flow.
 */
export default class TrapLegacyMigration {
  static LEGACY_KEYS = [
    'damageText',
    'damageFormula',
    'attack',
    'attacks',
    'timerRounds',
    'escapeModifier',
    'escalateEvery',
    'escalateMax',
    'chaseGs',
    'chaseFw',
    'chaseDistanceFormula',
  ];

  static materialize(system = {}) {
    const hasLegacy = this.LEGACY_KEYS.some((key) => key in system);
    if (hasLegacy && (!system.defenses || !Object.keys(system.defenses).length)) {
      const built = this.fromLegacy(system);
      system.defenses = built.defenses;
      system.damages = built.damages;
    }
    this.stripLegacy(system);
    return system;
  }

  static stripLegacy(system = {}) {
    for (const key of this.LEGACY_KEYS) delete system[key];
    return system;
  }

  static fromLegacy(system = {}) {
    const type = Number(system.trapType) || 0;
    const difficulty = Number(system.difficulty) || 0;
    const name = String(system.name || '');
    const defenses = {};
    const damages = {};

    const addDefense = (id, entry) => { defenses[id] = { type: entry.type, ...entry }; };
    const addDamage = (id, entry) => { damages[id] = { type: entry.type, ...entry }; };

    if (type === 2) {
      addDefense('react', {
        type: 'combat', label: 'Ausweichen', order: 0, gate: 'choice', after: '',
        reactions: 'nothing,dodge,parry', attackValue: Number(system.attack?.at) || 12,
      });
      this.#weaponDamages(system, damages, 'react', 'rangeweapon');
    } else if (type === 3) {
      addDefense('dodge', {
        type: 'skill', label: 'Ausweichen', order: 0, gate: 'choice', after: '',
        skill: _loc('dodge'),
        applications: '', modifier: difficulty, undetectedMod: -2,
      });
      this.#weaponDamages(system, damages, 'dodge', 'meleeweapon');
      Object.assign(damages, this.nameDamages(name, 'blade'));
    } else if (type === 1) {
      addDefense('dodge', {
        type: 'skill', label: 'Ausweichen', order: 0, gate: 'choice', after: '',
        skill: _loc('dodge'), applications: '', modifier: difficulty, undetectedMod: 0,
      });
      addDefense('chase', {
        type: 'chase', label: 'Verfolgungsjagd', order: 1, gate: 'onFail', after: 'dodge',
        gs: Number(system.chaseGs) || Math.max(0, 8 - Math.min(0, difficulty)),
        fw: Number(system.chaseFw) || Math.abs(difficulty) * 2,
        distanceFormula: system.chaseDistanceFormula || '2d6',
      });
      if (system.damageFormula) {
        addDamage('catch', { type: 'formula', label: 'Fang', when: 'onCatch', formula: system.damageFormula, chanceDie: 0, chanceMin: 0, chanceMax: 0 });
      }
    } else if (type === 4 || type === 6) {
      addDefense('escape', {
        type: 'group', label: 'Kraftakt', order: 0, gate: 'whileTimer', after: '',
        skill: _loc('LocalizedIDs.featOfStrength'),
        applications: type === 6 ? 'Eintreten & Zertrümmern' : 'Drücken & Verbiegen',
        interval: type === 6 ? '5 KR' : '2 KR',
        modifier: Number(system.escapeModifier) || 0,
        targetQs: 1,
        maxRolls: 0,
        timerRounds: Number(system.timerRounds) || 0,
        escalateEvery: Number(system.escalateEvery) || 0,
        escalateMax: Number(system.escalateMax) || 0,
      });
    } else if (type === 7) {
      return { defenses, damages };
    } else {
      const avoidId = 'avoid';
      addDefense(avoidId, {
        type: 'skill', label: 'Körperbeherrschung', order: 0, gate: 'choice', after: '',
        skill: _loc('LocalizedIDs.bodyControl'),
        applications: 'Akrobatik,Springen',
        modifier: difficulty,
        undetectedMod: 0,
      });
      addDefense('hold', {
        type: 'skill', label: 'Kraftakt', order: 1, gate: 'onFail', after: avoidId,
        skill: _loc('LocalizedIDs.featOfStrength'),
        applications: 'Ziehen & Zerren',
        modifier: difficulty,
        undetectedMod: 0,
      });
      addDefense('climb', {
        type: 'skill', label: 'Klettern', order: 2, gate: 'onFail', after: 'hold',
        skill: _loc('LocalizedIDs.climbing'),
        applications: '',
        modifier: 0,
        undetectedMod: 0,
      });
      if (type === 5) {
        if (system.damageFormula) {
          addDamage('slide', { type: 'formula', label: 'Rutsche', when: 'hold', formula: system.damageFormula, chanceDie: 0, chanceMin: 0, chanceMax: 0 });
        }
        this.#weaponDamages(system, damages, 'hold', 'meleeweapon', { includePrimary: false });
        addDefense('stun', {
          type: 'skill', label: 'Selbstbeherrschung', order: 3, gate: 'onDamage', after: 'slide',
          skill: _loc('LocalizedIDs.selfControl'),
          applications: 'Handlungsfähigkeit bewahren',
          modifier: 0,
          modifierFromDamage: 'slide',
          undetectedMod: 0,
        });
      } else {
        const height = this.d6Count(system.damageFormula);
        if (height > 0) {
          const unit = _loc('GROUP.schritt');
          addDamage('fall', {
            type: 'falling',
            label: `${_loc('fallingDamage')} (${height} ${unit})`,
            when: 'hold',
            height,
            floorMod: 0,
          });
        }
        this.#weaponDamages(system, damages, 'hold', 'formula', { includePrimary: false });
        Object.assign(damages, this.nameDamages(name, 'pit'));
      }
    }

    return { defenses, damages };
  }

  /**
   * Damages implied by the trap's name. kind limits them to the branch that owns that name.
   * @param {string} name
   * @param {'pit'|'blade'|''} [kind]
   */
  static nameDamages(name, kind = '') {
    const damages = {};
    const text = String(name || '');
    if ((!kind || kind === 'blade') && /brand[oö]l/i.test(text)) {
      damages.ignite = {
        type: 'formula', label: 'Brandöl', when: 'dodge', formula: '',
        chanceDie: 6, chanceMin: 1, chanceMax: 3,
      };
    }
    if ((!kind || kind === 'pit') && /splitter/i.test(text)) {
      damages.splinter = { type: 'fromQs', label: 'Splitter', when: 'climb', base: 6, perQs: 0.5 };
    }
    if ((!kind || kind === 'pit') && /gas/i.test(text)) {
      damages.gas = {
        type: 'formula', label: 'Explosion', when: 'hold', formula: '',
        chanceDie: 6, chanceMin: 1, chanceMax: 1,
      };
    }
    return damages;
  }

  /** Schritt of a fall. Each d6 in the formula is one Schritt. */
  static d6Count(formula) {
    const text = String(formula || '').trim();
    if (!text || !Roll.validate(text)) return 0;
    let count = 0;
    for (const term of new Roll(text).dice) {
      if (Number(term.faces) !== 6) continue;
      count += term.number;
    }
    return count;
  }

  static #weaponDamages(system, damages, when, fallbackType, { includePrimary = true } = {}) {
    const strikes = [];
    if (includePrimary && system.damageFormula && fallbackType !== 'falling') {
      strikes.push({ name: '', formula: system.damageFormula, weaponType: system.attack?.weaponType, traits: system.attack?.traits });
    }
    for (const [id, attack] of Object.entries(system.attacks || {})) {
      if (!attack?.damageFormula) continue;
      strikes.push({ id, name: attack.name, formula: attack.damageFormula, weaponType: attack.weaponType || system.attack?.weaponType, traits: attack.traits });
    }
    if (fallbackType === 'falling') {
      for (const strike of strikes) {
        const id = foundry.utils.randomID();
        damages[id] = {
          type: 'formula', label: strike.name || 'Schaden', when, formula: strike.formula,
          chanceDie: 0, chanceMin: 0, chanceMax: 0,
        };
      }
      return;
    }
    let index = 0;
    for (const strike of strikes) {
      const id = strike.id || `strike${index++}`;
      const type = strike.weaponType === 'meleeweapon' || strike.weaponType === 'rangeweapon'
        ? strike.weaponType
        : fallbackType;
      damages[id] = {
        type, label: strike.name || 'Schaden', when, formula: strike.formula, traits: strike.traits || '',
        chanceDie: 0, chanceMin: 0, chanceMax: 0,
      };
    }
  }
}
