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

  static rows(model, kind) {
    const types = model.schema.fields[kind].element.types;
    return Object.entries(model[kind] || {}).map(([id, entry]) => ({
      id,
      entry,
      fields: Object.entries(types[entry.type]?.fields || {})
        .filter(([key]) => key !== 'type')
        .map(([key, field]) => ({ key, field })),
    }));
  }

  static whenChoices(defenses = []) {
    const choices = {
      onCatch: 'REGIONBEHAVIOR_DSATrap.FLOW.onCatch',
      timeout: 'REGIONBEHAVIOR_DSATrap.FLOW.timeout',
    };
    for (const row of defenses) choices[row.id] = row.entry.label || row.id;
    return choices;
  }

  static sheetContext(model) {
    const trapDefenses = this.rows(model, 'defenses');
    return {
      trapDefenses,
      trapDamages: this.rows(model, 'damages'),
      defenseTypes: this.typeChoices(model.schema, 'defenses'),
      damageTypes: this.typeChoices(model.schema, 'damages'),
      damageWhenChoices: this.whenChoices(trapDefenses),
    };
  }

  static async addEntry(document, schema, kind, type) {
    const fieldSchema = schema.fields[kind]?.element?.types?.[type];
    if (!fieldSchema) return null;
    const id = foundry.utils.randomID();
    const value = fieldSchema.getInitialValue();
    value.type = type;
    await document.update({ [`system.${kind}.${id}`]: value });
    return id;
  }

  static async removeEntry(document, schema, kind, id) {
    if (!id || !schema.fields[kind]) return;
    const { ForcedDeletion } = foundry.data.operators;
    await document.update({ [`system.${kind}.${id}`]: new ForcedDeletion() });
  }

  static defenseOfType(system = {}, type) {
    return Object.values(system.defenses || {}).find((entry) => entry.type === type) || null;
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
    const timer = Object.values(system.defenses || {}).find((entry) => entry.type === 'group' && entry.timerRounds);
    if (timer) {
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

  /**
   * Record a player result. status is success or failure.
   * Returns damage entries that should render now.
   */
  static advance(system, flow, { id, status, qs = 0, reaction = '' } = {}) {
    const next = foundry.utils.duplicate(flow);
    const entry = system.defenses?.[id];
    next.resolvedIds = [...(next.resolvedIds || []), id];
    const success = status === 'success' || status === 'critical';
    if (!success) next.failedIds = [...(next.failedIds || []), id];
    if (reaction === 'nothing') next.failedIds = [...new Set([...(next.failedIds || []), id])];
    next.pending = next.pending.filter((entryId) => entryId !== id);

    const opened = [];
    if (entry?.type === 'chase') next.chaseStarted = true;
    if (!success && entry?.type === 'skill' && system.defenses?.chase?.after === id) {
      next.chaseStarted = false;
    }

    const due = this.#damagesDue(system, id, success, reaction);
    for (const damage of due) {
      if (!this.#chanceHits(damage)) continue;
      const line = this.#lineFor(damage, qs, next);
      if (!line) continue;
      next.lines.push(line);
      next.damageIds.push(damage.id);
      opened.push(line);
    }

    if (!success && system.defenses?.chase?.after === id) next.offerChase = true;
    next.pending = [...new Set([...next.pending, ...this.pendingIds(system, next)])];
    return { flow: next, lines: opened };
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

  static #chanceHits(damage) {
    const die = Number(damage.chanceDie) || 0;
    if (!die) return true;
    const roll = Math.floor(Math.random() * die) + 1;
    const min = Number(damage.chanceMin) || 1;
    const max = Number(damage.chanceMax) || min;
    return roll >= min && roll <= max;
  }

  static #lineFor(damage, qs, flow) {
    if (damage.type === 'falling') {
      const height = Math.max(1, Number(damage.height) || 1);
      return { id: damage.id, label: damage.label, formula: `${height}d6`, kind: 'falling', height, needsFall: true };
    }
    if (damage.type === 'fromQs') {
      const total = Math.max(0, Math.floor((Number(damage.base) || 0) - (Number(qs) || 0) * (Number(damage.perQs) || 0)));
      return { id: damage.id, label: damage.label, formula: String(total), total, kind: 'flat' };
    }
    if (!damage.formula) return { id: damage.id, label: damage.label, formula: '', total: 0, kind: 'note' };
    return { id: damage.id, label: damage.label, formula: damage.formula, kind: damage.type || 'formula' };
  }

  static async rollLine(line) {
    if (!line?.formula || line.kind === 'flat' || line.kind === 'note') return line;
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
