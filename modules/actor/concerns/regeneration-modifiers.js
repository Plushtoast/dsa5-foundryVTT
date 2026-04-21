export class RegenerationModifiers {
    static get(actor) {
        const modifiers = [];
        const attrs = ['LeP', 'KaP', 'AsP'];

        for(const attr of attrs) {
            const mods = actor.system.status.regeneration[`${attr}Conditional`];
            modifiers.push(...mods.map(f => ({
              name: f.target || f.source,
              value: f.value,
              source: f.source,
              type: attr
            })));
        }

        return modifiers;
    }
}