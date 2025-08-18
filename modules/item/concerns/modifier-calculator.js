import { ITEM_CONSTANTS } from '../../config/item-constants.js';
import CreatureType from '../../system/automation/creature-type.js';

const { getProperty, mergeObject } = foundry.utils;

const { SPELL, LITURGY, CEREMONY, RITUAL } = ITEM_CONSTANTS.TEST_TYPES;

/**
 * Utility class for handling modifier calculations and parsing
 */
export class ModifierCalculator {
    /**
     * Parse modifier value from dataset
     * @param {Object} dataset - Element dataset
     * @param {string} mainAttribute - Main attribute key
     * @param {number} step - Step value
     * @returns {Object|null} Parsed modifier with value and type
     */
    static parseModifierValue(dataset, mainAttribute, step) {
        const val = dataset[mainAttribute];
        if (!val) return null;

        const isMultiplier = /^\*/.test(val);

        let reducedVal;
        if (val.includes(',')) {
            reducedVal = val.split(',').reduce((sum, cur) => sum + Number(cur), 0);
        } else {
            reducedVal = Number(val.replace(/^\*/, ''));
        }

        if (isNaN(reducedVal)) return null;

        return {
            value: isMultiplier ? reducedVal : reducedVal * step,
            type: isMultiplier ? '*' : undefined
        };
    }

    /**
     * Extract flat values from dataset
     * @param {Object} dataset - Element dataset
     * @param {Object} matchers - Matcher mapping
     * @returns {Object} Flat values object
     */
    static extractFlatValues(dataset, matchers) {
        const flatValues = {};

        for (const key in dataset) {
            if (!key.endsWith('Flat')) continue;

            const flatValue = dataset[key];
            if (!flatValue?.length) continue;

            const replacedKey = key.replace('Flat', '');
            const matcherKey = matchers[replacedKey];

            if (matcherKey) {
                const value = flatValue.split(',').reduce((sum, x) => sum + (Number(x) || 0), 0);
                flatValues[matcherKey] = value;
            }
        }

        return flatValues;
    }

    /**
     * Parse effect string into modifiers
     * @param {string} effect - Effect string
     * @param {Object} actor - Actor object
     * @returns {Object} Parsed modifiers
     */
    static parseEffect(effect, actor) {
        const itemModifiers = {};
        const speedRegex = new RegExp(game.i18n.localize('CHARAbbrev.GS'), 'gi');
        const valuePatterns = ITEM_CONSTANTS.VALUE_PATTERNS;

        const modifiers = effect.split(/[,;]/).map(x => x.trim()).filter(Boolean);

        for (const modifier of modifiers) {
            const cleanedModifier = modifier.replace(/\s+/g, ' ').trim();
            const parts = cleanedModifier.split(' ').map(x => x.trim());

            if (parts.length !== 2) continue;

            const [value, key] = parts;
            const processedValue = value.replace(speedRegex, actor.system.status.speed.max);

            if (!isNaN(processedValue) || valuePatterns.some(pattern => pattern.test(processedValue))) {
                const normalizedKey = key.toLowerCase();
                itemModifiers[normalizedKey] ??= [];
                itemModifiers[normalizedKey].push(processedValue);
            }
        }

        return itemModifiers;
    }

    /**
     * Parse value type string
     * @param {string} name - Modifier name
     * @param {string|number} val - Value
     * @returns {Object} Parsed value type
     */
    static parseValueType(name, val) {
        let type = '';
        if (/^\*/.test(val)) {
            type = '*';
            val = val.substring(1).replace(',', '.');
        }
        return {
            name,
            value: Number(val),
            type,
        };
    }

    /**
     * Get SK/ZK modifiers for target resistance
     * @param {Object} data - Data object to modify
     * @param {Object} source - Source item
     */
    static getSkZkModifier(data, source) {
        let skMod = [];
        let zkMod = [];

        const hasSpellResistance = [SPELL, LITURGY, CEREMONY, RITUAL].includes(source.type) &&
            source.system.effectFormula.value.trim() === '';

        if (game.user.targets.size) {
            game.user.targets.forEach((target) => {
                if (target.actor) {
                    let spellResistance = 0;
                    if (hasSpellResistance) {
                        const creatureTypes = CreatureType.detectCreatureType(target.actor);
                        spellResistance = creatureTypes.reduce((sum, x) => {
                            return sum + x.spellResistanceModifier(target.actor);
                        }, 0);
                    }
                    const itemResistSoulpower = getProperty(target.actor, `system.status.soulpower.${source.type}resist`) || 0;
                    const itemResistToughness = getProperty(target.actor, `system.status.toughness.${source.type}resist`) || 0;
                    skMod.push((target.actor.system.status.soulpower.max + itemResistSoulpower) * -1 - spellResistance);
                    zkMod.push((target.actor.system.status.toughness.max + itemResistToughness) * -1 - spellResistance);
                }
            });
        }

        mergeObject(data, {
            SKModifier: skMod.length > 0 ? Math.min(...skMod) : 0,
            ZKModifier: zkMod.length > 0 ? Math.min(...zkMod) : 0,
        });
    }
}
