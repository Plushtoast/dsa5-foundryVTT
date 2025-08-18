import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import DSA5 from '../config/config-dsa5.js';
import { ITEM_CONSTANTS } from '../config/item-constants.js';

const { mergeObject, getProperty } = foundry.utils;

/**
 * Factory for creating item test dialogs
 */
export class DialogBuilder {
    /**
     * Build speaker object for chat
     * @param {Object} actor - Actor
     * @param {string} tokenId - Token ID
     * @returns {Object} Speaker object
     */
    static buildSpeaker(actor, tokenId) {
        const speaker = {
            token: tokenId,
            actor: actor?.id,
            scene: canvas.scene?.id,
        };
        if (speaker.token == 'emptyActor') speaker.emptyActor = actor.emptyActor;
        return speaker
    }
    /**
     * Create base dialog configuration
     * @param {Object} item - Item
     * @param {Object} actor - Actor
     * @param {string} tokenId - Token ID
     * @param {Object} options - Options
     * @returns {Object} Base dialog configuration
     */
    static createBaseConfig(item, actor, tokenId, options, template, title) {
        return {
            testData: {
                source: item,
                extra: {
                    options,
                    speaker: this.buildSpeaker(actor, tokenId),
                },
            },
            cardOptions: this._setupCardOptions(template, title, tokenId, actor)
        };
    }

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
        const title = `${spell.name} ${game.i18n.localize(`${spell.type}Test`)}${options.subtitle || ''}`;
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
            extensions: this.prepareExtensions(actor, spell),
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

    static _setupCardOptions(template, title, tokenId, actor) {
        const token = game.canvas?.tokens?.get(tokenId);
        let cardOptions = {
            speaker: {
                alias: token ? token.name : actor.prototypeToken.name,
                actor: actor.id,
            },
            title,
            template,
            flags: {
                img: { src: actor.prototypeToken.randomImg ? actor.img : actor.prototypeToken.texture.src },
            },
        };
        if (actor.token) {
            cardOptions.speaker.alias = actor.token.name;
            cardOptions.speaker.token = actor.token.id;
            cardOptions.speaker.scene = canvas.scene.id;
            cardOptions.flags.img.src = actor.token.texture.src;
        } else {
            let speaker = ChatMessage.getSpeaker();
            if (speaker.actor == actor.id) {
                cardOptions.speaker.alias = speaker.alias;
                cardOptions.speaker.token = speaker.token;
                cardOptions.speaker.scene = speaker.scene;
                cardOptions.flags.img.src = speaker.token ? canvas.tokens.get(speaker.token).document.texture.src : cardOptions.flags.img.src;
            }
        }
        return cardOptions;
    }

    /**
     * Setup card options for chat
     * @param {string} template - Template path
     * @param {string} title - Card title
     * @param {string} tokenId - Token ID
     * @returns {Object} Card options
     */
    static _setupItemCardOptions(template, title, tokenId) {
        const speaker = ChatMessage.getSpeaker();
        return {
            speaker: {
                alias: speaker.alias,
                scene: speaker.scene,
            },
            flags: {
                img: { src: speaker.token ? canvas.tokens.get(speaker.token).document.texture.src : this.img },
            },
            title,
            template,
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
        const title = skill.name + ' ' + game.i18n.localize('Test') + (options.subtitle || '');
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
        const title = `${weapon.name} ${game.i18n.localize(mode + 'test')}`;
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
    static prepareExtensions(actor, spell) {
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
