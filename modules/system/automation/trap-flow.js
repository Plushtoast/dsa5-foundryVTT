import DSA5_Utility from '../helpers/utility-dsa5.js';

/**
 * Player-started trap defenses and typed damage already stored on the trap.
 */
export default class TrapFlow {
  static types(schema, kind) {
    return Object.keys(schema?.fields?.[kind]?.element?.types || {});
  }

  static typeChoices(schema, kind) {
    return Object.fromEntries(this.types(schema, kind).map((type) => [type, `REGIONBEHAVIOR_DSATrap.FLOW.types.${type}`]));
  }

  static tabGroup(kind) {
    return `trap-${kind}`;
  }

  static displayLabel(id, label = '') {
    const custom = String(label || '').trim();
    const localized = _loc(`REGIONBEHAVIOR_DSATrap.modes.${id}`);
    if (!custom || custom === 'Fang' || custom === 'Catch') return localized;
    return custom;
  }

  static rows(model, kind, tabGroups = {}) {
    const types = model.schema.fields[kind].element.types;
    const rows = Object.entries(model[kind] || {}).map(([id, entry]) => ({
      id,
      entry,
      typeLabel: `REGIONBEHAVIOR_DSATrap.FLOW.types.${entry.type}`,
      typeHelp: `REGIONBEHAVIOR_DSATrap.FLOW.typeHelp.${entry.type}`,
      tabLabel: entry.label || _loc(`REGIONBEHAVIOR_DSATrap.FLOW.types.${entry.type}`),
      fields: Object.entries(types[entry.type]?.fields || {})
        .filter(([key]) => key !== 'type')
        .map(([key, field]) => ({
          key,
          field,
          label: `REGIONBEHAVIOR_DSATrap.FLOW.${key}`,
          hint: `REGIONBEHAVIOR_DSATrap.FLOW.hints.${key}`,
        })),
    }));
    const activeId = rows.some((row) => row.id === tabGroups[this.tabGroup(kind)])
      ? tabGroups[this.tabGroup(kind)]
      : rows[0]?.id || '';
    tabGroups[this.tabGroup(kind)] = activeId;
    for (const row of rows) row.cssClass = row.id === activeId ? 'active' : '';
    return rows;
  }

  static whenChoices(defenses = []) {
    const choices = {
      onCatch: 'REGIONBEHAVIOR_DSATrap.FLOW.onCatch',
      timeout: 'REGIONBEHAVIOR_DSATrap.FLOW.timeout',
    };
    for (const row of defenses) choices[row.id] = row.tabLabel;
    return choices;
  }

  static async sheetContext(model, tabGroups = {}) {
    const trapDefenses = this.rows(model, 'defenses', tabGroups);
    const allSkills = [...(await DSA5_Utility.allSkillsList())];
    for (const entry of Object.values(model.defenses || {})) {
      if (entry?.skill && !allSkills.includes(entry.skill)) allSkills.push(entry.skill);
    }
    allSkills.sort((a, b) => a.localeCompare(b, game.i18n.lang));
    return {
      trapDefenses,
      trapDamages: this.rows(model, 'damages', tabGroups),
      defenseTypes: this.typeChoices(model.schema, 'defenses'),
      damageTypes: this.typeChoices(model.schema, 'damages'),
      damageWhenChoices: this.whenChoices(trapDefenses),
      allSkills,
    };
  }

  static isTransientControl(event) {
    return Boolean(event.target?.closest?.('[data-trap-add]'));
  }

  static async addEntry(document, schema, kind, type) {
    const field = schema.fields[kind];
    const fieldSchema = field?.element?.types?.[type];
    if (!fieldSchema) return null;
    const id = foundry.utils.randomID();
    const value = fieldSchema.clean({ type }, { partial: false, addTypes: true, migrate: false, prune: false });
    value.type = type;
    const current = field.toObject(document.system?.[kind] ?? {});
    current[id] = _replace(value);
    await document.update({ [`system.${kind}`]: current });
    return id;
  }

  static async removeEntry(document, schema, kind, id) {
    if (!id || !schema.fields[kind]) return;
    const { ForcedDeletion } = foundry.data.operators;
    await document.update({ [`system.${kind}.${id}`]: new ForcedDeletion() });
  }

  static defenseOfType(system = {}, type) {
    return Object.values(system.defenses || {}).find((entry) => entry?.type === type) || null;
  }

  static pendingIds(system, flow = {}) {
    const defenses = system.defenses || {};
    const resolved = new Set(flow.resolvedIds || []);
    const failed = new Set(flow.failedIds || []);
    const ids = [];
    for (const [id, entry] of Object.entries(defenses)) {
      if (resolved.has(id)) continue;
      const gate = entry.gate || 'choice';
      if (gate === 'choice' && !flow.started) ids.push(id);
      else if (gate === 'onFail' && failed.has(entry.after)) ids.push(id);
      else if (gate === 'whileTimer' && flow.timer) ids.push(id);
      else if (gate === 'onDamage' && (flow.damageIds || []).includes(entry.after)) ids.push(id);
      else if (gate === 'ifUndetected' && flow.undetected) ids.push(id);
    }
    return ids.sort((a, b) => (defenses[a].order || 0) - (defenses[b].order || 0));
  }

  static initialFlow(system) {
    const flow = { started: false, resolvedIds: [], failedIds: [], damageIds: [], lines: [], caught: false };
    flow.pending = this.pendingIds(system, flow);
    flow.started = true;
    const timer = this.defenseOfType(system, 'group');
    if (Number(timer?.timerRounds) > 0) {
      flow.timer = {
        remaining: Number(timer.timerRounds) || 0,
        escapeModifier: Number(timer.modifier) || 0,
        escalateEvery: Number(timer.escalateEvery) || 0,
        escalateMax: Number(timer.escalateMax) || 0,
        elapsed: 0,
        timedOut: false,
      };
      flow.pending = this.pendingIds(system, flow);
    }
    return flow;
  }

  static repeatsForVolley(entry) {
    if (!entry) return false;
    if (entry.type === 'combat') return true;
    return entry.type === 'skill' && (entry.gate || 'choice') === 'choice';
  }

  /**
   * Record a player result. status is success or failure.
   * Returns damage entries that should render now.
   */
  static advance(system, flow, { id, status, qs = 0, reaction = '' } = {}) {
    const next = foundry.utils.duplicate(flow);
    const defenses = system.defenses || {};
    const entry = defenses[id];
    const shotIndex = Number(next.shotIndex) || 0;
    next.resolvedIds = [...(next.resolvedIds || []), id];
    const success = status === 'success' || status === 'critical';
    if (!success) next.failedIds = [...(next.failedIds || []), id];
    if (reaction === 'nothing') next.failedIds = [...new Set([...(next.failedIds || []), id])];
    next.pending = next.pending.filter((entryId) => entryId !== id);

    if (entry?.type === 'chase') next.chaseStarted = true;
    if (!success && entry?.type === 'skill' && defenses.chase?.after === id) {
      next.chaseStarted = false;
    }

    const due = this.#damagesDue(system, id, success, reaction);
    const opened = [];
    for (const damage of due) {
      const line = this.#lineFor(damage, qs, next);
      if (!line) continue;
      next.lines.push(line);
      next.damageIds.push(damage.id);
      opened.push(line);
    }

    if (!success && defenses.chase?.after === id) next.offerChase = true;
    next.pending = [...new Set([...next.pending, ...this.pendingIds(system, next)])];
    next.shotsRemaining = Math.max(0, (Number(next.shotsRemaining ?? 1) || 1) - 1);
    next.shotIndex = shotIndex + 1;
    if (next.shotsRemaining > 0 && this.repeatsForVolley(entry)) {
      next.resolvedIds = next.resolvedIds.filter((entryId) => entryId !== id);
      if (!next.pending.includes(id)) next.pending.unshift(id);
    }
    return { flow: next, lines: opened };
  }

  /**
   * Drop a recorded defense so fate / GM edits can replace it.
   * Choice-gate ids are not re-derived after start, so the id is put back on pending.
   */
  static rewind(system, flow, id) {
    const damages = system.damages || {};
    const damageIds = new Set(Object.entries(damages).filter(([, damage]) => damage.when === id).map(([damageId]) => damageId));
    const next = foundry.utils.duplicate(flow);
    next.resolvedIds = (next.resolvedIds || []).filter((entryId) => entryId !== id);
    next.failedIds = (next.failedIds || []).filter((entryId) => entryId !== id);
    next.lines = (next.lines || []).filter((line) => !damageIds.has(line.sourceId || line.id) && !damageIds.has(line.id));
    next.damageIds = (next.damageIds || []).filter((damageId) => !damageIds.has(damageId));
    if (damageIds.size) next.payloadApplied = false;
    const rest = (next.pending || []).filter((entryId) => entryId !== id);
    next.pending = [id, ...rest];
    return next;
  }

  static rewindShot(system, flow, id, shotIndex) {
    const damages = system.damages || {};
    const index = Number(shotIndex) || 0;
    const next = foundry.utils.duplicate(flow);
    next.lines = (next.lines || []).filter((line) => {
      const source = line.sourceId || line.id;
      if (damages[source]?.when !== id && damages[line.id]?.when !== id) return true;
      return Number(line.shotIndex || 0) !== index;
    });
    next.shotsRemaining = (Number(next.shotsRemaining) || 0) + 1;
    next.shotIndex = index;
    next.resolvedIds = (next.resolvedIds || []).filter((entryId) => entryId !== id);
    const rest = (next.pending || []).filter((entryId) => entryId !== id);
    next.pending = [id, ...rest];
    return next;
  }

  static #damagesDue(system, defenseId, success, reaction) {
    return Object.entries(system.damages || {})
      .filter(([, damage]) => {
        if (damage.when !== defenseId) return false;
        if (damage.type === 'fromQs') return true;
        return !success || reaction === 'nothing';
      })
      .map(([id, damage]) => ({ id, ...damage }));
  }

  static #lineFor(damage, qs, flow) {
    const chance = this.#chanceMeta(damage);
    const label = this.displayLabel(damage.id, damage.label);
    let line;
    if (damage.type === 'falling') {
      const height = Math.max(1, Number(damage.height) || 1);
      line = { id: damage.id, label, formula: `${height}d6`, kind: 'falling', height, needsFall: true };
    } else if (damage.type === 'fromQs') {
      const total = Math.max(0, Math.floor((Number(damage.base) || 0) - (Number(qs) || 0) * (Number(damage.perQs) || 0)));
      line = { id: damage.id, label, formula: String(total), total, kind: 'flat' };
    } else if (!damage.formula) {
      line = { id: damage.id, label, formula: '', total: 0, kind: 'note' };
    } else {
      line = { id: damage.id, label, formula: damage.formula, kind: damage.type || 'formula' };
    }
    const shotIndex = Number(flow?.shotIndex) || 0;
    const volley = (Number(flow?.shotsTotal) || 1) > 1;
    if (volley) {
      line = { ...line, id: `${damage.id}:${shotIndex}`, sourceId: damage.id, shotIndex };
    }
    return chance ? { ...line, ...chance } : line;
  }

  static #chanceMeta(damage) {
    const die = Number(damage.chanceDie) || 0;
    if (!die) return null;
    const min = Number(damage.chanceMin) || 1;
    const max = Number(damage.chanceMax) || min;
    const range = min === max ? String(min) : `${min}–${max}`;
    return {
      needsChance: true,
      chanceDie: die,
      chanceMin: min,
      chanceMax: max,
      chanceLabel: _loc('REGIONBEHAVIOR_DSATrap.chanceOnDie', { range, die }),
    };
  }

  static chanceHits(damage, total) {
    const sides = Number(damage?.chanceDie) || 0;
    if (!sides) return true;
    const min = Number(damage.chanceMin) || 1;
    const max = Number(damage.chanceMax) || min;
    const roll = total ?? (Math.floor(Math.random() * sides) + 1);
    return roll >= min && roll <= max;
  }

  static async rollLine(line) {
    if (!line?.formula || line.kind === 'flat' || line.kind === 'note' || line.needsChance) return line;
    if (!Roll.validate(line.formula)) return line;
    const roll = await new Roll(line.formula).evaluate();
    return { ...line, total: Number(roll.total) || 0, roll };
  }

  static catchDamage(system) {
    return Object.entries(system.damages || {})
      .filter(([, damage]) => damage.when === 'onCatch')
      .map(([id, damage]) => ({ id, ...damage, kind: damage.type }));
  }
}
