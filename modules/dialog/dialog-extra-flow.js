/**
 * Extra flows on skill/spell check dialogs: specAbs-style buttons plus a drop zone
 * that close the dialog without rolling and open a Player Menu workflow.
 *
 * Skill matching reuses the social-conflict reverse lookup (`LocalizedSkills.{item.name}`)
 * and LocalizedIDs for bilingual names.
 */
export class DialogExtraFlow {
  static #flows = new Map();

  /**
   * @param {object} def
   * @param {string} def.id
   * @param {string} def.label
   * @param {string} [def.tooltip]
   * @param {string} [def.dropHint]
   * @param {string} [def.icon]
   * @param {string[]} [def.skillKeys]
   * @param {string[]} [def.localizedIds]
   * @param {(item: object, actor?: object) => boolean} [def.matches]
   * @param {(doc: object, ctx?: object) => boolean} [def.canAcceptDrop]
   * @param {(ctx: object) => void|Promise<void>} [def.start]
   */
  static register(def) {
    if (!def?.id) throw new Error('DialogExtraFlow.register requires an id');
    this.#flows.set(def.id, def);
    return def;
  }

  static unregister(id) {
    this.#flows.delete(id);
  }

  static get(id) {
    return this.#flows.get(id);
  }

  /**
   * Template-safe extras for a check dialog.
   * @param {Item|object} item
   * @param {Actor} [actor]
   * @returns {{ id: string, label: string, tooltip: string, dropHint: string, icon: string }[]}
   */
  static forItem(item, actor) {
    if (!item) return [];
    const extras = [];
    for (const flow of this.#flows.values()) {
      if (!this.matches(flow, item, actor)) continue;
      extras.push(this.#toTemplate(flow));
    }
    return extras;
  }

  static prepare(data, item, actor) {
    data.extraFlows = this.forItem(item, actor);
  }

  static matches(flow, item, actor) {
    if (!flow || !item) return false;
    if (typeof flow.matches === 'function') return !!flow.matches(item, actor);
    return this.#matchesSkillKeys(flow, item) || this.#matchesLocalizedIds(flow, item);
  }

  /**
   * @param {DragEvent} event
   * @returns {Promise<Document|object|null>}
   */
  static async fromDropEvent(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (_err) {
      return null;
    }
    try {
      if (data?.type === 'Actor') return await Actor.implementation.fromDropData(data);
      if (data?.type === 'Item') return await Item.implementation.fromDropData(data);
    } catch (_err) {
      return null;
    }
    return data;
  }

  /**
   * Close the check dialog without rolling, then start the registered flow.
   * @param {string} flowId
   * @param {{ actor?: Actor, source?: object, dropped?: object, dialog?: object }} ctx
   */
  static async launch(flowId, ctx = {}) {
    const flow = this.get(flowId);
    if (!flow?.start) return false;
    const { dialog, ...rest } = ctx;
    if (dialog) {
      dialog._extraFlowStarted = true;
      await dialog.close();
    }
    await flow.start(rest);
    return true;
  }

  static #toTemplate(flow) {
    return {
      id: flow.id,
      label: flow.label,
      tooltip: flow.tooltip || flow.label,
      dropHint: flow.dropHint || '',
      icon: flow.icon || '',
    };
  }

  static #matchesSkillKeys(flow, item) {
    if (!flow.skillKeys?.length || item.type !== 'skill') return false;
    const reverse = _loc(`LocalizedSkills.${item.name}`);
    const englishKey = reverse.startsWith('LocalizedSkills.') ? item.name : reverse;
    for (const key of flow.skillKeys) {
      if (englishKey === key || item.name === key) return true;
      const locId = `${key.charAt(0).toLowerCase()}${key.slice(1)}`;
      if (item.name === _loc(`LocalizedIDs.${locId}`)) return true;
    }
    return false;
  }

  static #matchesLocalizedIds(flow, item) {
    if (!flow.localizedIds?.length) return false;
    return flow.localizedIds.some((id) => item.name === _loc(`LocalizedIDs.${id}`));
  }
}
