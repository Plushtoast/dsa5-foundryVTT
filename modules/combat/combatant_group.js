import Chase from './chase/chase.js';
import NavalCombat from './mkr/naval-combat.js';

/**
 * CombatantGroup with minion auto-group, turn skipping, and tracker collapse.
 * Combatants stay separate documents; the group is a display-and-turn collapse.
 */
export class DSACombatantGroup extends CombatantGroup {
  static #queue = Promise.resolve();
  static #timers = new Map();

  static groupId(combatant) {
    if (!combatant) return null;
    const group = combatant.group;
    if (group && typeof group === 'object') return group.id ?? null;
    return group || combatant._source?.group || null;
  }

  /**
   * Combatants assigned to a group. Prefer combatant `group` ids over the
   * derived `group.members` set — Foundry clears that set in prepareBaseData and
   * it can still be empty immediately after creating the group.
   */
  static assignedMembers(group, combat = group?.parent) {
    if (!group?.id) return [];
    const parent = combat ?? group.parent;
    const combatants = parent?.combatants;
    if (typeof combatants?.[Symbol.iterator] === 'function') {
      return [...combatants].filter((combatant) => this.groupId(combatant) === group.id);
    }
    if (typeof group.members?.[Symbol.iterator] === 'function') return [...group.members];
    return [];
  }

  static isSpecialMode(combat) {
    if (!combat) return false;
    return !!(combat.isChase || combat.isNavalMkr || Chase.isChaseActive(combat) || NavalCombat.isNavalMkrActive(combat));
  }

  static canAutoGroup(combat) {
    return !!(combat?.system?.autoGroupMinions && !this.isSpecialMode(combat));
  }

  static shouldCollapse(combat) {
    return !this.isSpecialMode(combat);
  }

  static isEligible(combatant) {
    if (!combatant?.actorId) return false;
    if (combatant.hasPlayerOwner) return false;
    const token = combatant.token;
    if (!token || token.actorLink) return false;
    return true;
  }

  static membersOf(combatant) {
    if (!combatant) return [];
    const group = combatant.group;
    if (group?.members?.size && typeof group.members[Symbol.iterator] === 'function') {
      return [...group.members];
    }
    const assigned = this.assignedMembers(group, combatant.parent ?? combatant.combat);
    if (assigned.length) return assigned;
    const gid = this.groupId(combatant);
    if (!gid || !combatant.parent) return [combatant];
    const combatants = combatant.parent.combatants;
    if (typeof combatants?.[Symbol.iterator] !== 'function') return [combatant];
    return [...combatants].filter((c) => this.groupId(c) === gid);
  }

  /** Group members in combat turn order, so the flyout starts at the first minion. */
  static membersInTurnOrder(combatant) {
    const members = this.membersOf(combatant);
    const turns = combatant?.combat?.turns ?? combatant?.parent?.turns ?? [];
    if (!turns.length) return members;
    const order = new Map(turns.map((entry, index) => [entry.id, index]));
    return members.slice().sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  }

  static isGrouped(combatant) {
    return this.membersOf(combatant).length > 1;
  }

  /**
   * Next turn index after skipping remaining members of the current group.
   * @returns {number|null} Index into `turns`, or null to advance the round.
   */
  static nextTurnIndex(turns, currentIndex, { skipDefeated = false } = {}) {
    const current = currentIndex >= 0 ? turns[currentIndex] : null;
    const gid = this.groupId(current);
    for (let i = currentIndex + 1; i < turns.length; i++) {
      if (i < 0) continue;
      const combatant = turns[i];
      if (gid && this.groupId(combatant) === gid) continue;
      if (skipDefeated && combatant.isDefeated) continue;
      return i;
    }
    return null;
  }

  /**
   * Previous turn index, landing on the first living member of the previous group.
   * @returns {number|null} Index into `turns`, or null to rewind the round.
   */
  static previousTurnIndex(turns, currentIndex, { skipDefeated = false } = {}) {
    if (currentIndex <= 0) return null;
    const currentGid = this.groupId(turns[currentIndex]);
    let i = currentIndex - 1;
    while (i >= 0) {
      const combatant = turns[i];
      if (currentGid && this.groupId(combatant) === currentGid) {
        i -= 1;
        continue;
      }
      if (skipDefeated && combatant.isDefeated) {
        i -= 1;
        continue;
      }
      const gid = this.groupId(combatant);
      if (!gid) return i;

      let first = i;
      while (first > 0 && this.groupId(turns[first - 1]) === gid) first -= 1;
      if (skipDefeated) {
        for (let j = first; j <= i; j++) {
          if (!turns[j].isDefeated) return j;
        }
        i = first - 1;
        continue;
      }
      return first;
    }
    return null;
  }

  /**
   * Collapse consecutive grouped combatants to one header (plus expanded members).
   * Turn objects may carry `groupId` / `hidden` / `isDefeated` / `active`.
   */
  static collapseTurns(turns, { isGM = false, expandedGroupIds = new Set() } = {}) {
    const result = [];
    const seen = new Set();
    for (const turn of turns ?? []) {
      if (turn?.isChaseSection) {
        result.push(turn);
        continue;
      }
      const gid = turn?.groupId;
      if (!gid) {
        result.push(turn);
        continue;
      }
      if (seen.has(gid)) continue;
      seen.add(gid);

      const members = (turns ?? []).filter((t) => t && !t.isChaseSection && t.groupId === gid);
      const visible = members.filter((t) => isGM || !t.hidden);
      if (visible.length < 2) {
        result.push(...visible);
        continue;
      }

      const living = visible.filter((t) => !t.isDefeated);
      const expanded = expandedGroupIds.has(gid);
      result.push({
        ...visible[0],
        isCombatantGroup: true,
        groupId: gid,
        groupCount: living.length,
        groupTotal: visible.length,
        expanded,
        active: members.some((t) => t.active),
        groupMembers: visible.map((t) => ({
          id: t.id,
          name: t.name,
          img: t.img,
          hidden: t.hidden,
          isDefeated: t.isDefeated,
          active: t.active,
        })),
      });

      if (expanded) {
        for (const member of visible) {
          result.push({
            ...member,
            isGroupMember: true,
            hideInitiative: true,
            groupId: gid,
          });
        }
      }
    }
    return result;
  }

  static async toggleAutoGroup(combat) {
    if (!game.user.isGM || !combat) return;
    await combat.update({ 'system.autoGroupMinions': !combat.system.autoGroupMinions });
  }

  static #isLive(combat) {
    const id = typeof combat === 'string' ? combat : combat?.id;
    return !!(id && game.combats?.has(id));
  }

  static cancelAutoGroup(combat) {
    const id = typeof combat === 'string' ? combat : combat?.id;
    if (!id) return;
    const previous = this.#timers.get(id);
    if (previous) clearTimeout(previous);
    this.#timers.delete(id);
  }

  static scheduleAutoGroup(combat) {
    if (!this.#isLive(combat)) return;
    this.cancelAutoGroup(combat);
    const id = combat.id;
    const timer = setTimeout(() => {
      this.#timers.delete(id);
      const live = game.combats.get(id);
      if (live) this.autoGroup(live);
    }, 50);
    this.#timers.set(id, timer);
  }

  static autoGroup(combat) {
    const next = this.#queue.then(() => this.#runAutoGroup(combat));
    this.#queue = next.catch(() => {});
    return next;
  }

  static async #runAutoGroup(combat) {
    if (!game.user.isGM || !this.#isLive(combat)) return;
    try {
      const live = game.combats.get(combat.id);
      if (!live) return;
      if (!live.system?.autoGroupMinions) {
        await this.#dissolveAutoGroups(live);
        return;
      }
      if (this.isSpecialMode(live)) return;
      await this.#applyAutoGroups(live);
    } catch (err) {
      if (!this.#isLive(combat)) return;
      throw err;
    }
  }

  static async #dissolveAutoGroups(combat) {
    const auto = [...combat.groups].filter((group) => group.getFlag?.('dsa5', 'autoGroup'));
    if (!auto.length) return;
    const updates = [];
    for (const group of auto) {
      for (const member of this.assignedMembers(group, combat)) updates.push({ _id: member.id, group: null });
    }
    if (updates.length) await combat.updateEmbeddedDocuments('Combatant', updates);
    await combat.deleteEmbeddedDocuments('CombatantGroup', auto.map((group) => group.id));
  }

  static async #applyAutoGroups(combat) {
    const eligible = [...combat.combatants].filter((combatant) => {
      if (!this.isEligible(combatant)) return false;
      const group = combatant.group;
      if (group && !group.getFlag?.('dsa5', 'autoGroup')) return false;
      return true;
    });

    const byActor = new Map();
    for (const combatant of eligible) {
      const list = byActor.get(combatant.actorId) ?? [];
      list.push(combatant);
      byActor.set(combatant.actorId, list);
    }

    const autoGroups = [...combat.groups].filter((group) => group.getFlag?.('dsa5', 'autoGroup'));
    const combatantUpdates = [];
    const toCreate = [];
    const usedGroupIds = new Set();

    for (const [actorId, members] of byActor) {
      if (members.length < 2) {
        for (const combatant of members) {
          if (this.groupId(combatant)) combatantUpdates.push({ _id: combatant.id, group: null });
        }
        continue;
      }

      let group = autoGroups.find((g) => g.getFlag('dsa5', 'sourceActorId') === actorId);
      if (!group) {
        toCreate.push({ actorId, members, name: members[0].name, img: members[0].img });
        continue;
      }

      usedGroupIds.add(group.id);
      for (const combatant of members) {
        if (this.groupId(combatant) !== group.id) combatantUpdates.push({ _id: combatant.id, group: group.id });
      }
    }

    for (const combatant of combat.combatants) {
      const group = combatant.group;
      if (!group?.getFlag?.('dsa5', 'autoGroup')) continue;
      const pack = byActor.get(combatant.actorId);
      if (this.isEligible(combatant) && pack?.length >= 2) continue;
      if (!combatantUpdates.some((update) => update._id === combatant.id)) {
        combatantUpdates.push({ _id: combatant.id, group: null });
      }
    }

    if (toCreate.length) {
      const created = await combat.createEmbeddedDocuments('CombatantGroup', toCreate.map((entry) => ({
        name: entry.name,
        img: entry.img,
        flags: { dsa5: { autoGroup: true, sourceActorId: entry.actorId } },
      })));
      created.forEach((group, index) => {
        usedGroupIds.add(group.id);
        for (const combatant of toCreate[index].members) {
          combatantUpdates.push({ _id: combatant.id, group: group.id });
        }
      });
    }

    if (combatantUpdates.length) await combat.updateEmbeddedDocuments('Combatant', combatantUpdates);

    const empty = [...combat.groups].filter((group) => {
      if (!group.getFlag?.('dsa5', 'autoGroup')) return false;
      if (usedGroupIds.has(group.id)) return false;
      return this.assignedMembers(group, combat).length < 2;
    });
    if (!empty.length) return;

    const leftovers = [];
    for (const group of empty) {
      for (const member of this.assignedMembers(group, combat)) leftovers.push({ _id: member.id, group: null });
    }
    if (leftovers.length) await combat.updateEmbeddedDocuments('Combatant', leftovers);
    await combat.deleteEmbeddedDocuments('CombatantGroup', empty.map((group) => group.id));
  }

  static async updateMembers(combatant, update) {
    const members = this.membersOf(combatant);
    if (members.length <= 1) return combatant.update(update);
    return combatant.parent.updateEmbeddedDocuments(
      'Combatant',
      members.map((member) => ({ _id: member.id, ...update })),
    );
  }

  static async syncGroupInitiative(combatant, value) {
    const group = combatant?.group;
    if (!group || this.assignedMembers(group, combatant.parent ?? combatant.combat).length < 2) return;
    if (group.initiative === value) return;
    await group.update({ initiative: value });
  }

  static async ungroup(combatant) {
    if (!combatant || !this.groupId(combatant)) return;
    await combatant.update({ group: null });
    await this.autoGroup(combatant.combat);
  }

  static async groupCombatants(combatants) {
    const list = (combatants ?? []).filter(Boolean);
    if (list.length < 2) return;
    const combat = list[0].parent;
    if (!combat) return;
    const first = list[0];
    const [group] = await combat.createEmbeddedDocuments('CombatantGroup', [{
      name: first.name,
      img: first.img,
      flags: { dsa5: { autoGroup: false } },
    }]);
    await combat.updateEmbeddedDocuments(
      'Combatant',
      list.map((combatant) => ({ _id: combatant.id, group: group.id })),
    );
  }

  static idsForInitiativeRoll(combat, ids) {
    const seenGroups = new Set();
    const filtered = [];
    for (const id of ids) {
      const combatant = combat.combatants.get(id);
      const gid = this.groupId(combatant);
      if (gid && this.isGrouped(combatant)) {
        if (seenGroups.has(gid)) continue;
        seenGroups.add(gid);
      }
      filtered.push(id);
    }
    return filtered;
  }
}
