import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import DSAActiveEffect from '../../status/dsa_active_effects.js';
import { ModifierCalculator } from './modifier-calculator.js';
import SpecialabilityData from '../../data/item/specialability.js';

const { getProperty } = foundry.utils;

/**
 * Handles combat special abilities processing and filtering
 */
export class CombatSpecialAbilities {
    /**
     * Build combat special abilities dataset
     * @param {Array} combatSpecAbs - Combat special abilities
     * @param {Object} actor - Actor object
     * @param {string} mode - Combat mode (attack/parry)
     * @param {string} path - Property path for effects
     * @returns {Array} Processed special abilities
     */
    static buildDataset(combatSpecAbs, actor, mode, path = 'effect.value') {
        const isDefense = mode === 'parry';
        const keys = isDefense ? ['pa'] : ['at', 'tp', 'dm'];
        const translatedKeys = Object.fromEntries(
            keys.map(key => [key, game.i18n.localize(`LocalizedAbilityModifiers.${key}`)])
        );
        const validSpecAb = isDefense
            ? vals => vals.pa.some(v => v !== 0)
            : vals => vals.at.some(v => v !== 0) || vals.tp.some(v => v !== 0) || vals.dm.some(v => v !== 0);

        return combatSpecAbs.reduce((acc, com) => {
            const effects = ModifierCalculator.parseEffect(getProperty(com.system, path), actor);
            const variantCount = ['', '2', '3'].filter(x => getProperty(com, `system.effect.value${x}`)).length;
            const vals = Object.fromEntries(
                keys.map(key => [key, effects[translatedKeys[key]] || [0]])
            );

            if (validSpecAb(vals) || (!isDefense && com.effects.size > 0)) {
                const subCategory = game.i18n.localize(SpecialabilityData.combatSkillSubCategories[com.system.category.sub]);
                const steps = variantCount > 1 && getProperty(com, 'system.step.canNotMultiply') ? 1 : com.system.step.value;
                acc.push({
                    name: com.name,
                    atbonus: vals.at || [0],
                    pabonus: vals.pa || [0],
                    tpbonus: vals.tp || [0],
                    dmmalus: vals.dm || [0],
                    steps,
                    category: {
                        id: com.system.category.sub,
                        css: `ab_${com.system.category.sub}`,
                        name: subCategory,
                    },
                    id: com.id,
                    actor: actor.id,
                    variantCount,
                });
            }
            return acc;
        }, []);
    }

    /**
     * Create search filter for special abilities
     * @param {Array|null} toSearch - Search terms
     * @returns {Function} Filter function
     */
    static #createSearchFilter(toSearch) {
        if (!toSearch) return () => true;

        const normalizedSearch = [...toSearch, game.i18n.localize('LocalizedIDs.all')].map(x => x.toLowerCase());
        return (item) =>
            item.system.list.value
                .split(/;|,/)
                .map(y => y.trim().toLowerCase().replace(/ \([a-zA-Z äüöÄÖÜ]*\)/, ''))
                .some(y => normalizedSearch.includes(y));
    }

    /**
     * Create brawling filter
     * @returns {Function} Filter function
     */
    static #createBrawlingFilter() {
        return game.combat?.isBrawling ? () => true : item => Number(item.system.category.sub) !== 5;
    }

    /**
     * Process source effects to extract allowed/forbidden names and changes
     * @param {Object} source - Source item
     * @returns {Object} Processing results
     */
    static #processSourceEffects(source) {
        const allowedNames = new Set();
        const forbiddenNames = new Set();
        const effectChanges = {};

        for (const effect of source.effects || []) {
            if (!DSAActiveEffect.realyRealyEnabled(effect)) continue;
            
            for (const change of effect.changes) {
                if (!change.key.startsWith('self.maneuver.')) continue;
                
                const parsed = DSA5_Utility.parseAbilityString(change.value);

                if (parsed.name.endsWith('-')) {
                    forbiddenNames.add(parsed.name.slice(0, -1).trim());
                } else if (parsed.name.endsWith('+')) {
                    allowedNames.add(parsed.name.slice(0, -1).trim());
                } else {
                    const changeMode = change.key.split('.')[2];
                    effectChanges[parsed.name] ??= {};
                    effectChanges[parsed.name][changeMode] ??= 0;
                    effectChanges[parsed.name][changeMode] += parsed.step;
                }
            }
        }

        return { allowedNames, forbiddenNames, effectChanges };
    }

    /**
     * Apply effect changes to special abilities
     * @param {Array} result - Special abilities result
     * @param {Object} effectChanges - Effect changes to apply
     * @returns {Array} Modified result
     */
    static #applyEffectChanges(result, effectChanges) {
        for (const specAb of result) {
            const changes = effectChanges[specAb.name];
            if (changes) {
                for (const key in changes) {
                    const flatKey = `${key}-flat`;
                    if (!specAb[flatKey]) specAb[flatKey] = [];
                    specAb[flatKey].push(changes[key]);
                }
            }
        }
        return result;
    }

    /**
     * Build combat special abilities with filtering and processing
     * @param {Object} actor - Actor object
     * @param {Array} categories - Ability categories
     * @param {Array|null} toSearch - Search terms
     * @param {string} mode - Combat mode
     * @param {Object} source - Source item
     * @returns {Array} Processed combat special abilities
     */
    static build(actor, categories, toSearch, mode, source) {
        const searchFilter = this.#createSearchFilter(toSearch);
        const brawlingFilter = this.#createBrawlingFilter();
        const { allowedNames, forbiddenNames, effectChanges } = this.#processSourceEffects(source);

        const combatSpecAbs = actor.items.filter(item =>
            item.type === 'specialability' &&
            categories.includes(item.system.category.value) &&
            item.system.effect.value &&
            (searchFilter(item, toSearch) || allowedNames.has(item.name)) &&
            brawlingFilter(item) &&
            !forbiddenNames.has(item.name)
        );

        const result = this.buildDataset(combatSpecAbs, actor, mode);
        return this.#applyEffectChanges(result, effectChanges);
    }
}
