import DSA5StatusEffects from '../status/status_effects.js';
import DSA5 from '../config/config-dsa5.js';
import { ITEM_CONSTANTS } from '../config/item-constants.js';
import { RollDialogBuilder } from "../dialog/dialog-builder.js";
const { mergeObject, getProperty } = foundry.utils;
export class ItemDialogBuilder extends RollDialogBuilder {
    /**
         * Create spell dialog
         * @param {Object} spell - Spell item
         * @param {Object} actor - Actor
         * @param {string} tokenId - Token ID
         * @param {Object} options - Options
         * @returns {Object} Dialog configuration
         */
    static createSpellDialog(spell, actor, tokenId, options) {
        const sheet = ['ceremony', 'liturgy'].includes(spell.type) ? 'liturgy' : 'spell';
        const title = `${spell.name} ${_loc(`${spell.type}Test`)}${options.subtitle || ''}`;
        const template = 'systems/dsa5/templates/chat/roll/spell-card.hbs';
        const config = this.createBaseConfig(spell, actor, tokenId, options, template, title);
        mergeObject(config.testData, {
            opposable: spell.system.effectFormula.value.length > 0,
            advancedModifiers: {
                chars: [0, 0, 0],
                fws: 0,
                qls: 0,
            },
            calculatedSpellModifiers: {
                castingTime: 0,
                cost: 0,
                reach: 0,
                maintainCost: 0,
            },
        });
        const actorModMod = getProperty(actor, `system.${sheet}Stats.spellextension`) || 0;
        const maxMods = Math.max(0, Math.floor(Number(spell.system.talentValue.value) / 4) + actorModMod);
        const data = {
            rollMode: options.rollMode,
            spellCost: spell.system.AsPCost.value,
            maintainCost: spell.system.maintainCost.value,
            spellCastingTime: spell.system.castingTime.value,
            spellReach: spell.system.range.value,
            canChangeCost: spell.system.canChangeCost.value,
            canChangeRange: spell.system.canChangeRange.value,
            canChangeCastingTime: spell.system.canChangeCastingTime.value,
            hasSKModifier: spell.system.resistanceModifier.value === 'SK',
            hasZKModifier: spell.system.resistanceModifier.value === 'ZK',
            maxMods,
            extensions: this.#prepareExtensions(actor, spell),
            variableBaseCost: spell.system.variableBaseCost,
            characteristics: [1, 2, 3].map((x) => spell.system[`characteristic${x}`].value),
        };
        const situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, spell) : [];
        data.situationalModifiers = situationalModifiers;
        if (options.situationalModifiers) {
            data.situationalModifiers.push(...options.situationalModifiers);
        }
        return {
            dialogOptions: {
                title,
                template: ITEM_CONSTANTS.TEMPLATE_PATHS[sheet.toUpperCase() + '_DIALOG'],
                data,
            },
            ...config,
        };
    }
    /**
     * Create skill dialog
     * @param {Object} skill - Skill item
     * @param {Object} actor - Actor
     * @param {string} tokenId - Token ID
     * @param {Object} options - Options
     * @returns {Object} Dialog configuration
     */
    static createSkillDialog(skill, actor, tokenId, options) {
        const title = skill.name + ' ' + _loc('Test') + (options.subtitle || '');
        const template = 'systems/dsa5/templates/chat/roll/skill-card.hbs'
        const config = this.createBaseConfig(skill, actor, tokenId, options, template, title);
        config.testData.opposable = true;
        const data = {
            rollMode: options.rollMode,
            difficultyLabels: DSA5.skillDifficultyLabels,
            modifier: options.modifier || 0,
            characteristics: [1, 2, 3].map((x) => skill.system[`characteristic${x}`].value),
            situationalModifiers: actor ? DSA5StatusEffects.getRollModifiers(actor, skill) : [],
        };
        if (options.situationalModifiers) {
            data.situationalModifiers.push(...options.situationalModifiers);
        }
        return {
            dialogOptions: {
                title,
                template: ITEM_CONSTANTS.TEMPLATE_PATHS.SKILL_DIALOG,
                data,
            },
            ...config,
        };
    }
    /**
     * Create combat dialog
     * @param {Object} weapon - Weapon item
     * @param {Object} actor - Actor
     * @param {string} tokenId - Token ID
     * @param {Object} options - Options
     * @returns {Object} Dialog configuration
     */
    static createCombatDialog(weapon, actor, tokenId, options) {
        const mode = options.mode;
        const title = `${weapon.name} ${_loc(mode + 'test')}`;
        const template = 'systems/dsa5/templates/chat/roll/combatskill-card.hbs'
        const config = this.createBaseConfig(weapon, actor, tokenId, options, template, title);
        mergeObject(config.testData, {
            opposable: options.mode !== 'parry',
            mode,
        });
        const data = {
            rollMode: options.rollMode,
            mode,
        };
        const situationalModifiers = actor ?
            DSA5StatusEffects.getRollModifiers(actor, weapon, { mode }) : [];
        data.situationalModifiers = situationalModifiers;
        if (options.situationalModifiers) {
            data.situationalModifiers.push(...options.situationalModifiers);
        }
        return {
            dialogOptions: {
                title,
                template: ITEM_CONSTANTS.TEMPLATE_PATHS.COMBAT_DIALOG,
                data,
            },
            ...config,
        };
    }
    /**
     * Prepare spell extensions
     * @param {Object} actor - Actor
     * @param {Object} spell - Spell
     * @returns {Array} Extensions array
     */
    static #prepareExtensions(actor, spell) {
        return actor.items
            .filter((x) => x.type === 'spellextension' &&
                x.system.source === spell.name &&
                x.system.category === spell.type)
            .map((x) => {
                x.shortName = x.name.split(' - ').length > 1 ? x.name.split(' - ')[1] : x.name;
                x.descr = $(x.system.description.value).text() || '';
                return x;
            });
    }
}