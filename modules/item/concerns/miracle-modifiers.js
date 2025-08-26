import SpecialabilityRulesDSA5 from '../../system/rules/specialability-rules-dsa5.js';

const { getProperty } = foundry.utils;

/**
 * Handles miracle modifier calculations
 */
export class MiracleModifiers {
    /**
     * Get miracle modifiers for an actor and source
     * @param {Object} actor - Actor object
     * @param {Object} source - Source item
     * @param {string} type - Modifier type
     * @param {string} bonusAttribute - Bonus attribute name
     * @returns {Array} Miracle modifiers
     */
    static get(actor, source, type, bonusAttribute) {
        if(!this.#canUseMiracles(actor, source)) return [];

        const bonus = getProperty(actor, `system.miracle.${bonusAttribute}`) || 0;
        const result = [{
            name: game.i18n.localize('LocalizedIDs.miracle'),
            value: 2 + bonus,
            type,
            selected: false,
        }];

        const availableKaP = actor.system.status.karmaenergy.max - actor.system.status.karmaenergy.value;
        const miracleMight = game.i18n.localize('LocalizedIDs.miracleMight');
        if (availableKaP >= 6 && SpecialabilityRulesDSA5.hasAbility(actor, miracleMight, false)) {
            result.push({
                name: miracleMight,
                value: 3 + bonus,
                type,
                selected: false,
            });
        }

        return result;
    }

    /**
     * Check if actor can use miracles for the given source
     * @param {Object} actor - Actor object
     * @param {Object} source - Source item
     * @returns {boolean} Whether miracles can be used
     */
    static #canUseMiracles(actor, source) {
        const regex = new RegExp(`${game.i18n.localize('TYPES.Item.combatskill')} `, 'gi');
        const happyTalents = (getProperty(actor, 'system.happyTalents.value') || '')
            .split(/;|,/)
            .map((x) => x.replace(regex, '').trim());
        
        return happyTalents.includes(source.name) && actor.system.status.karmaenergy.value >= 4;
    }
}
