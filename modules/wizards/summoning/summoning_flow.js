import ItemEnchantment from '../../item/item-enchantment.js';

/**
 * Entry points into the guided summoning flow.
 *
 * The Beschwörung tab of the PlayerMenu is the only place where a summoning can actually be
 * assembled, so every entry point (companions tab, ritual roll, item context menu) funnels through
 * {@link SummoningFlow.open}.
 */
export class SummoningFlow {
  static RITUAL_TYPES = ['spell', 'ritual', 'liturgy', 'ceremony'];

  /** All conjuration type ids together with the ritual names that summon them. */
  static #skillMap() {
    return game.dsa5.apps.playerMenu?.conjurationData?.skills ?? {};
  }

  static #allSkillNames() {
    return Object.values(SummoningFlow.#skillMap()).flat();
  }

  /**
   * Is this item one of the rituals registered for any conjuration type?
   * @param {Item} item
   * @returns {boolean}
   */
  static isConjurationSkill(item) {
    return SummoningFlow.typeIdForSkill(item) !== null;
  }

  /**
   * The conjuration type a ritual belongs to, so the tab can preselect it.
   * @param {Item} item
   * @returns {string|null}
   */
  static typeIdForSkill(item) {
    if (!item || !SummoningFlow.RITUAL_TYPES.includes(item.type)) return null;

    for (const [typeId, skills] of Object.entries(SummoningFlow.#skillMap())) {
      if (skills?.includes(item.name)) return typeId;
    }
    return null;
  }

  /**
   * Owned rituals and matching item enchantments for a conjuration type.
   * @param {Actor} actor
   * @param {string} typeId
   * @returns {{ owned: Item[], enchantments: { sourceItem: Item, enchantment: object }[], missing: string[], requiredSkills: string[] }}
   */
  static collectConjurationRituals(actor, typeId) {
    const requiredSkills = SummoningFlow.#skillMap()[typeId] ?? [];
    const owned = (actor?.items ?? []).filter(
      (x) => requiredSkills.includes(x.name) && SummoningFlow.RITUAL_TYPES.includes(x.type),
    );
    const enchantments = ItemEnchantment.listOnActor(actor).filter(({ enchantment }) =>
      requiredSkills.includes(enchantment.name),
    );
    const presentNames = new Set([
      ...owned.map((x) => x.name),
      ...enchantments.map(({ enchantment }) => enchantment.name),
    ]);
    const missing = requiredSkills.filter((name) => !presentNames.has(name));
    return { owned, enchantments, missing, requiredSkills };
  }

  /** Does this actor know any summoning ritual at all? Drives the companions-tab button. */
  static hasConjurationSkills(actor) {
    if (!actor) return false;
    if (actor.items.some((item) => SummoningFlow.isConjurationSkill(item))) return true;
    const names = SummoningFlow.#allSkillNames();
    return ItemEnchantment.listOnActor(actor).some(({ enchantment }) => names.includes(enchantment.name));
  }

  /**
   * Open the Beschwörung tab, preconfigured for the given actor and ritual.
   * @param {Actor} actor
   * @param {Item} [item] Ritual whose conjuration type should be preselected.
   * @param {{ creature?: Actor }} [options]
   */
  static async open(actor, item, options = {}) {
    const menu = game.dsa5.apps.playerMenu;
    if (!menu) return;

    if (actor) menu.actor = actor;

    const typeId = SummoningFlow.typeIdForSkill(item);
    if (typeId !== null && typeId !== String(menu.conjurationData.conjurationType)) {
      menu.conjurationData.conjurationType = typeId;
      menu.conjurationData.selectedIds = [];
      menu.conjurationData.selectedEntityIds = [];
      menu.conjurationData.selectedPackageIds = [];
      menu.conjurationData.consumedQS = 0;
      menu.conjurationData.packageModifier = 0;
    }

    if (options.creature) menu.applyConjurationTarget(options.creature);

    await menu.render(true);
    await menu.changeTab('elementals', 'sheet');
  }

  /**
   * Ask whether a left-click on a summoning ritual should just roll the test or start the full
   * summoning. Only used when the `summoningRollChooser` setting is on.
   * @returns {Promise<'roll'|'summon'|null>} null when the dialog was dismissed.
   */
  static async chooseRollMode(item) {
    return foundry.applications.api.DialogV2.wait({
      id: 'dsa5-summoning-roll-chooser',
      window: { title: 'CONJURATION.startSummoning' },
      classes: ['dsa5'],
      content: `<p>${_loc('CONJURATION.rollOrSummon', { name: item.name })}</p>`,
      buttons: [
        {
          action: 'summon',
          label: 'CONJURATION.startSummoning',
          icon: 'fas fa-hat-wizard',
          default: true,
        },
        {
          action: 'roll',
          label: 'CONJURATION.plainRoll',
          icon: 'fas fa-dice-d20',
        },
      ],
      rejectClose: false,
    });
  }

  /**
   * Left-click handling for a ritual on the actor sheet.
   * @returns {Promise<boolean>} true when the summoning flow took over and no roll should happen.
   */
  static async interceptRoll(actor, item) {
    if (!game.settings.get('dsa5', 'summoningRollChooser')) return false;
    if (!SummoningFlow.isConjurationSkill(item)) return false;

    const choice = await SummoningFlow.chooseRollMode(item);
    if (choice === 'summon') {
      await SummoningFlow.open(actor, item);
      return true;
    }
    // A dismissed dialog must not silently roll either.
    return choice !== 'roll';
  }
}
