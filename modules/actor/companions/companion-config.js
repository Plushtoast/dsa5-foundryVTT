let config;
let loading;

export default class CompanionConfig {
    static ensureLoaded() {
        loading ??= import(game.i18n.lang === 'de' ? './companion-config-de.js' : './companion-config-en.js')
            .then(m => { config = m.default; });
        return loading;
    }

    static get companionSpeciesData() { return config.companionSpeciesData; }
    static get trainingTricks() { return config.trainingTricks; }
    static get trickRequirements() { return config.trickRequirements; }
    static get trainingNames() { return config.trainingNames; }
}
