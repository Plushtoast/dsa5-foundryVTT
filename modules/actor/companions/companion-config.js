let config;
let loading;

export default class CompanionConfig {
    static ensureLoaded() {
        loading ??= import(game.i18n.lang === 'de' ? './companion-config-de.js' : './companion-config-en.js')
            .then(m => { config = m.default; });
        return loading;
    }

    static get companionSpeciesData() { return config.companionSpeciesData; }
    static get speciesImageFallbacks() { return config.speciesImageFallbacks || {}; }
    static get trainingTricks() { return config.trainingTricks; }
    static get trickRequirements() { return config.trickRequirements; }
    static get trainingNames() { return config.trainingNames; }

    static DEFAULT_SPECIES_IMAGE = 'icons/svg/mystery-man-black.svg';

    static resolveSpeciesImage(speciesName, imageMap, placeholder = this.DEFAULT_SPECIES_IMAGE) {
        const candidates = [speciesName, ...(this.speciesImageFallbacks[speciesName] || [])];
        for (const name of candidates) {
            const img = imageMap.get(name);
            if (img) return img;
        }
        return placeholder;
    }
}
