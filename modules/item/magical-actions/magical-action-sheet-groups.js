import DSA5 from '../../config/config-dsa5.js';

export default class MagicalActionSheetGroups {
  static split(items = []) {
    const remainder = [];
    const byKind = new Map();

    for (const item of items) {
      const kind = item.system?.magicalActionKind?.value;
      if (!kind) {
        remainder.push(item);
        continue;
      }

      let group = byKind.get(kind);
      if (!group) {
        group = {
          kind,
          label: DSA5.magicalActionKinds[kind] || `MAGICALACTION.${kind}`,
          items: [],
        };
        byKind.set(kind, group);
      }
      group.items.push(item);
    }

    const actions = [...byKind.values()].sort((a, b) =>
      game.i18n.localize(a.label).localeCompare(game.i18n.localize(b.label), game.i18n.lang),
    );

    return { items: remainder, actions };
  }

  static apply(magic) {
    const spells = this.split(magic.spell);
    magic.spellList = spells.items;
    magic.spellActions = spells.actions;

    const rituals = this.split(magic.ritual);
    magic.ritualList = rituals.items;
    magic.ritualActions = rituals.actions;
  }
}
