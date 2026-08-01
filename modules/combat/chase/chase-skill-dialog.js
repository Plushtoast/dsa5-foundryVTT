/**
 * Verfolgungsjagd locomotion skill picker — two-column buttons like ActAttackDialog,
 * with the GM default skill centered in its own row above the rest.
 * Crew Boote & Schiffe options appear under the vehicle's own skills.
 */
export default class ChaseSkillDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'dsa-chase-skill-dialog',
    window: { title: 'CHASE.pickSkillTitle' },
    position: { width: 550 },
    actions: {
      pickSkill: this._onPickSkill,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/dialog-chase-skill.hbs',
    },
  };

  /**
   * @param {Actor} actor
   * @param {object[]} skills  from Chase.chaseSkillsFor
   * @param {string} defaultKey LocalizedIDs key for the combat default skill
   * @param {(entry: { item: Item, roller: Actor }|null) => void} resolve
   */
  constructor(actor, skills, defaultKey, resolve) {
    super();
    this.actor = actor;
    this.skills = skills;
    this.defaultKey = defaultKey;
    this._resolve = resolve;
    this._resolved = false;
  }

  /**
   * @param {Actor} actor
   * @param {object[]} skills
   * @param {string} defaultKey
   * @returns {Promise<{ item: Item, roller: Actor }|null>}
   */
  static prompt(actor, skills, defaultKey) {
    const existing = foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
    if (existing) {
      existing.bringToTop();
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      new ChaseSkillDialog(actor, skills, defaultKey, resolve).render(true);
    });
  }

  static _onPickSkill(_event, target) {
    const key = target.dataset.key;
    const entry = this.skills.find((s) => s.key === key);
    if (!entry?.item) {
      this.#finish(null);
      return;
    }
    this.#finish({ item: entry.item, roller: entry.roller ?? this.actor });
  }

  #finish(entry) {
    if (this._resolved) return;
    this._resolved = true;
    this._resolve?.(entry);
    this.close();
  }

  async close(options) {
    if (!this._resolved) {
      this._resolved = true;
      this._resolve?.(null);
    }
    return super.close(options);
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const defaultEntry = this.skills.find((s) => s.key === this.defaultKey) ?? null;
    const vehicleSkills = this.skills.filter((s) => !s.isCrew && s.key !== defaultEntry?.key);
    const crewSkills = this.skills.filter((s) => s.isCrew);

    data.title = 'CHASE.pickSkill';
    data.defaultSkill = defaultEntry
      ? {
          key: defaultEntry.key,
          name: defaultEntry.name,
          value: defaultEntry.value,
          img: defaultEntry.img || defaultEntry.item?.img || 'systems/dsa5/icons/categories/Skill.webp',
        }
      : null;
    data.items = vehicleSkills.map((s) => ({
      key: s.key,
      name: s.name,
      value: s.value,
      img: s.img || s.item?.img || 'systems/dsa5/icons/categories/Skill.webp',
    }));
    data.crewSkills = crewSkills.map((s) => ({
      key: s.key,
      name: s.name,
      value: s.value,
      img: s.img || s.item?.img || 'systems/dsa5/icons/categories/Skill.webp',
    }));
    data.crewSectionLabel = 'CHASE.crewSkillSection';
    return data;
  }
}
