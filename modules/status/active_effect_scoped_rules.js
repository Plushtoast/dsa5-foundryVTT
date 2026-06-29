import SpecialabilityData from '../data/item/specialability.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';

const { duplicate, getProperty } = foundry.utils;

export default class ActiveEffectScopedRules {
  static summaries(effect) {
    return Object.values(effect.system?.scopedRules || {}).map((rule) => {
      const type = rule.key == 'restriction' ? 'restriction' : 'modifier';
      return {
        label: `ActiveEffects.scopedRuleTypes.${type}`,
        identifiers: this.identifiers(rule).join(', '),
      };
    });
  }

  static identifiers(rule) {
    const identifiers = [...(rule.identifiers || []), ...(rule.categories || [])].filter(Boolean);
    if (identifiers.length) return identifiers;
    if (rule.scope == 'self') return ['self'];
    if (['incomingAttack', 'allOpponents'].includes(rule.scope)) return ['all'];

    const target = rule.target || {};
    const targetIdentifiers = [];
    if (target.scene && target.token) targetIdentifiers.push(`Scene.${target.scene}.Token.${target.token}`);
    if (target.actor) targetIdentifiers.push(`Actor.${target.actor}`);
    return targetIdentifiers.length ? targetIdentifiers : ['all'];
  }

  static activeEntries(actor, key) {
    return (actor?.effects || []).reduce((entries, effect) => {
      if (effect.disabled || effect.isDepleted?.()) return entries;

      for (const rule of Object.values(effect.system?.scopedRules || {})) {
        const data = this.#normalizeRule(rule, effect);
        if (!data.key || (key && data.key != key)) continue;

        entries.push({ effect, data });
      }
      return entries;
    }, []);
  }

  static targetFor(actor, mode) {
    if (mode == 'attack') return game.user.targets.first()?.actor;

    return DSA5_Utility.getSpeaker(actor?.flags?.oppose?.speaker);
  }

  static combatModifiers({ actor, mode, source, target, html }) {
    return [
      ...this.#actorModifiers(actor, mode, source, target, html),
      ...this.#incomingModifiers(target, actor, mode, source, html),
      ...this.restrictionModifiers(this.restrictions({ actor, mode, target }), mode, html),
    ];
  }

  static defenseCountModifier(actor, multipleDefenseValue, defenseCount) {
    if (!Number(defenseCount)) return { value: multipleDefenseValue };

    let best = { value: multipleDefenseValue };
    for (const entry of actor?.system?.skillModifiers?.combat?.defenseCount || []) {
      const floor = Number(entry.value);
      if (!Number.isFinite(floor)) continue;

      const value = Math.max(multipleDefenseValue, floor);
      if (value > best.value) best = { value, ref: entry.ref };
    }
    return best;
  }

  static restrictions({ actor, mode, target }) {
    const restrictions = actor ? this.activeEntries(actor, 'restriction').map(({ data }) => data).filter((entry) => {
      if (entry.scope == 'self') return true;
      if (!target) return false;
      return this.#matchesDocument(entry, target);
    }) : [];

    if (mode == 'attack' && target) {
      restrictions.push(...this.activeEntries(target, 'restriction').map(({ data }) => data).filter((entry) => {
        return ['incomingAttack', 'allOpponents'].includes(entry.scope) && this.#matchesDocument(entry, actor, { emptyMatches: true });
      }));
    }

    return restrictions;
  }

  static restrictionModifiers(restrictions, mode, html) {
    return [];
  }

  static restrictionViolation({ actor, mode, source, html, target = undefined }) {
    const scopedTarget = target || this.targetFor(actor, mode);
    return this.#restrictionViolation(this.restrictions({ actor, mode, source, target: scopedTarget }), mode, html);
  }

  static dialogRestrictionViolation(testData, html) {
    const actor = DSA5_Utility.getSpeaker(testData.extra.speaker);
    return this.restrictionViolation({ actor, mode: testData.mode, source: testData.source, html });
  }

  static maneuverRestricted(restrictions, subcategory) {
    const cTypes = SpecialabilityData.COMBAT_SKILL_TYPES;
    const basicCategories = [cTypes.BASEMANEUVER, cTypes.COMBATSTYLE_EXTENDED_BASE];
    const specialCategories = [cTypes.SPECIALMANEUVER, cTypes.COMBATSTYLE_EXTENDED];
    const isBasic = basicCategories.includes(subcategory);
    const isSpecial = specialCategories.includes(subcategory);
    if (!isBasic && !isSpecial) return false;

    return restrictions.some((entry) => {
      const values = entry.restrictions || [];
      return values.includes('maneuver') || (isSpecial && values.includes('specialManeuver'));
    });
  }

  static #actorModifiers(actor, mode, source, target, html) {
    if (!actor) return [];

    const changeKey = this.#modifierChangeKey(mode, source);
    const modifiers = [];
    for (const { data } of this.activeEntries(actor, 'modifier')) {
      if (data.scope == 'incomingAttack') continue;
      if (data.scope != 'self') {
        if (!target) continue;
        if (!this.#matchesDocument(data, target)) continue;
      }
      if (!this.#requirementsMatch(data, html, actor)) continue;

      modifiers.push(...this.#modifiersFromChanges(data.changes, changeKey));
    }
    return modifiers;
  }

  static #incomingModifiers(target, actor, mode, source, html) {
    if (mode != 'attack' || !target) return [];

    const changeKey = this.#modifierChangeKey(mode, source);
    const modifiers = [];
    for (const { data } of this.activeEntries(target, 'modifier')) {
      if (data.scope != 'incomingAttack') continue;
      if (!this.#matchesDocument(data, actor, { emptyMatches: true })) continue;
      if (!this.#requirementsMatch(data, html, actor)) continue;

      modifiers.push(...this.#modifiersFromChanges(data.changes, changeKey));
    }
    return modifiers;
  }

  static #modifiersFromChanges(changes = [], changeKey) {
    return changes.reduce((modifiers, change) => {
      if (change.key != changeKey) return modifiers;

      modifiers.push({
        name: _loc('botchCritEffect'),
        value: Number(change.value) || 0,
      });
      return modifiers;
    }, []);
  }

  static #restrictionViolation(restrictions, mode, html) {
    if (!restrictions.length) return undefined;

    const selectedForbiddenManeuver = Array.from(html.find('.specAbs')).some((element) => {
      const step = Number(element.dataset.step);
      return step > 0 && this.maneuverRestricted(restrictions, Number(element.dataset.category));
    });
    if (selectedForbiddenManeuver) return 'DSAError.tableEffectManeuverForbidden';

    if (mode == 'attack' && restrictions.some((entry) => entry.restrictions?.includes('attack'))) return 'DSAError.tableEffectAttackForbidden';
    if (['parry', 'dodge'].includes(mode) && restrictions.some((entry) => entry.restrictions?.includes('defense'))) return 'DSAError.tableEffectDefenseForbidden';

    return undefined;
  }

  static #requirementsMatch(rule, html, actor) {
    if (rule.requiresManeuver && !this.#hasSelectedManeuver(html, rule.maneuverTypes)) return false;
    if (rule.requiresNoManeuver && this.#hasSelectedManeuver(html, rule.maneuverTypes)) return false;
    if (rule.requiresOpponentManeuver && !this.#opposingAttackUsedManeuver(actor)) return false;
    return true;
  }

  static #hasSelectedManeuver(html, types = ['base', 'special']) {
    return Array.from(html.find('.specAbs')).some((element) => Number(element.dataset.step) > 0 && this.#maneuverTypeMatches(Number(element.dataset.category), types));
  }

  static #maneuverTypeMatches(subcategory, types = ['base', 'special']) {
    const cTypes = SpecialabilityData.COMBAT_SKILL_TYPES;
    const selectedTypes = Array.isArray(types) ? types : [types];
    const basicCategories = [cTypes.BASEMANEUVER, cTypes.COMBATSTYLE_EXTENDED_BASE];
    const specialCategories = [cTypes.SPECIALMANEUVER, cTypes.COMBATSTYLE_EXTENDED];
    return (selectedTypes.includes('base') && basicCategories.includes(subcategory)) || (selectedTypes.includes('special') && specialCategories.includes(subcategory));
  }

  static #opposingAttackUsedManeuver(actor) {
    const messageId = actor?.flags?.oppose?.messageId;
    const message = messageId ? game.messages.get(messageId) : null;
    const modifiers = getProperty(message, 'flags.data.preData.situationalModifiers') || [];
    return modifiers.some((modifier) => modifier.ref?.id && modifier.step !== undefined);
  }

  static #modifierChangeKey(mode, source) {
    if (mode == 'dodge') return 'system.status.dodge.gearmodifier';
    if (mode != 'attack') return 'system.meleeStats.parry';

    return source.type == 'rangeweapon' || source.system?.traitType?.value == 'rangeAttack' ? 'system.rangeStats.attack' : 'system.meleeStats.attack';
  }

  static #matchesDocument(rule, document, { emptyMatches = false } = {}) {
    const identifiers = [...(rule.identifiers || []), ...(rule.categories || [])].filter(Boolean);
    if (identifiers.includes('all')) return true;
    if (identifiers.length) {
      const documentIdentifiers = this.#documentIdentifiers(document);
      return identifiers.some((identifier) => documentIdentifiers.has(identifier));
    }

    const scopedTarget = DSA5_Utility.getSpeaker(rule.target);
    if (scopedTarget && document) return scopedTarget.uuid == document.uuid;
    return emptyMatches;
  }

  static #documentIdentifiers(document) {
    const identifiers = new Set();
    if (!document) return identifiers;

    if (document.uuid) identifiers.add(document.uuid);
    if (document.id && document.documentName) identifiers.add(`${document.documentName}.${document.id}`);
    if (document.type) {
      identifiers.add(document.type);
      identifiers.add(`${document.documentName || 'Document'}:${document.type}`);
    }

    const token = document.token?.object?.document || document.token;
    if (token?.uuid) identifiers.add(token.uuid);
    if (token?.parent?.id && token?.id) identifiers.add(`Scene.${token.parent.id}.Token.${token.id}`);
    return identifiers;
  }

  static #normalizeRule(rule, effect) {
    const data = duplicate(rule.data || {});
    const value = duplicate(rule.value || {});
    return {
      ...data,
      ...duplicate(rule),
      key: rule.key,
      scope: rule.scope || 'self',
      changes: value.changes || data.changes || [],
      restrictions: value.restrictions || data.restrictions || [],
      sourceUuid: effect.origin || data.origin || rule.origin || '',
    };
  }
}