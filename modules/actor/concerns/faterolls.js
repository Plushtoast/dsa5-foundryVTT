import DSA5Dialog from '../../dialog/dialog-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import DiceDSA5 from '../../system/rolls/dice-dsa5.js';
import RuleChaos from '../../system/rules/rule_chaos.js';
const { renderTemplate } = foundry.applications.handlebars;
/**
 * FateRolls class handles fate point mechanics for DSA5 rolls
 * Provides methods for rerolling damage, talented rerolls, fate rerolls, 
 * quality step additions, and roll improvements
 */
export class FateRolls {
    static FLAGS = {
        FATE_DAMAGE_REROLL: 'fatePointDamageRerollUsed',
        TALENTED_REROLL: 'talentedRerollUsed',
        FATE_REROLL: 'fatePointRerollUsed',
        FATE_ADD_QS: 'fatePointAddQSUsed',
        FATE_IMPROVED: 'fateImproved'
    };
    static SCHIP_SOURCES = { PERSONAL: 0, GROUP: 1 };
    static DICE_COLOR_BLACK = 'black';
    static IMPROVEMENT_VALUE = 2;
    static MULTI_DIE_ROLL_TYPES = ['spell', 'liturgy', 'ceremony', 'ritual', 'skill'];
    /**
     * Rerolls damage dice using fate points
     * @param {Object} actor - The actor performing the reroll
     * @param {string} infoMsg - Information message to display
     * @param {Object} cardOptions - Card display options
     * @param {Object} newTestData - Test data for the roll
     * @param {Object} message - Chat message object
     * @param {Object} data - Roll data containing postData
     * @param {number} schipsource - Source of fate points (0=personal, 1=group)
     */
    static async fatererollDamage(actor, infoMsg, cardOptions, newTestData, message, data, schipsource) {
        cardOptions.fatePointDamageRerollUsed = true;
        this.#resetTargetAndMessage(data, cardOptions);
        const { damageRoll } = data.postData;
        const rollFormula = damageRoll.formula || damageRoll._formula;
        const newRoll = await DiceDSA5.manualRolls(
            await new Roll(rollFormula).evaluate(),
            'CHATCONTEXT.rerollDamage'
        );
        newRoll.dice.forEach(die => die.options.colorset = this.DICE_COLOR_BLACK);
        await DiceDSA5.showDiceSoNice(newRoll, newTestData.messageMode);
        await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        newTestData.damageRoll = duplicate(newRoll);
        await actor[data.postData.postFunction]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
        await message.update({ [`flags.data.${this.FLAGS.FATE_DAMAGE_REROLL}`]: true });
        await this.#reduceSchips(actor, schipsource);
    }
    /**
     * Handles talented rerolls where players can reroll dice and take the better result
     * @param {Object} actor - The actor performing the reroll
     * @param {string} infoMsg - Information message to display
     * @param {Object} cardOptions - Card display options
     * @param {Object} newTestData - Test data for the roll
     * @param {Object} message - Chat message object
     * @param {Object} data - Roll data containing postData
     */
    static async fateisTalented(actor, infoMsg, cardOptions, newTestData, message, data) {
        cardOptions.talentedRerollUsed = true;
        this.#resetTargetAndMessage(data, cardOptions);
        const pendingPostRollReroll = foundry.utils.getProperty(message, 'flags.dsa5.postRoll.pendingReroll');
        const isPostRollReroll = !!pendingPostRollReroll?.effectUuid;
        const enhancedInfoMsg = isPostRollReroll
            ? ''
            : `<h5 class="center"><b>${_loc('CHATFATE.fatepointUsed')}</b></h5>
                ${_loc('CHATFATE.isTalented', {
                character: `<b>${actor.name}</b>`,
            })}`;
        const html = await renderTemplate('systems/dsa5/templates/dialog/isTalentedReroll-dialog.hbs', {
            testData: newTestData,
            postData: data.postData,
        });
        const dialog = new DSA5Dialog({
            window: { title: 'CHATFATE.selectDice' },
            content: html,
            buttons: [
                {
                    action: 'yes',
                    icon: 'fa fa-check',
                    label: 'ok',
                    callback: async (event, button, dialog) => {
                        const diesToReroll = this.#getSelectedDiceIndices($(button.form));
                        if (diesToReroll.length === 0) return;
                        const pending = foundry.utils.getProperty(message, 'flags.dsa5.postRoll.pendingReroll');
                        if (pending?.effectUuid) {
                            const maxDice = Math.max(1, Number(pending.dice) || 1);
                            if (diesToReroll.length > maxDice) {
                                ui.notifications.warn('DIALOG.postRollRerollMaxDice', { localize: true, format: { max: maxDice } }, { permanent: false });
                                return;
                            }
                        }
                        const { newRoll, changedRolls, changes } = await this.#processReroll(
                            diesToReroll,
                            newTestData,
                            'CHATCONTEXT.talentedReroll',
                            true
                        );
                        // For post-roll rerolls we create a dedicated ActiveEffect charge-consumption card (see below).
                        // Avoid emitting the standard fate/begabung informational chat message.
                        if (!isPostRollReroll) {
                            const finalInfoMsg = `${enhancedInfoMsg}<b>${_loc('Roll')}</b>: ${changedRolls.join(', ')}`;
                            await ChatMessage.create(DSA5_Utility.chatDataSetup(finalInfoMsg));
                        }
                        await actor[data.postData.postFunction]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                        await message.update({ [`flags.data.${this.FLAGS.TALENTED_REROLL}`]: true });
                        // If this was triggered by a post-roll reroll effect, consume its charge and mark it used.
                        const pendingAfter = foundry.utils.getProperty(message, 'flags.dsa5.postRoll.pendingReroll');
                        if (pendingAfter?.effectUuid) {
                            try {
                                const effect = await fromUuid(pendingAfter.effectUuid);
                                const diceCount = Math.max(1, Number(pendingAfter.dice) || diesToReroll.length || 1);
                                const extra = _loc('ActiveEffects.chargesChatPostRollRerolled', { count: diceCount });
                                const effectName = effect?.name || effect?.label || _loc('ActiveEffects.custom');
                                const chargeData = typeof effect?.getChargeData === 'function' ? effect.getChargeData() : null;
                                // Create a dedicated post-roll reroll chat card (no fate/begabung wording).
                                const rollLine = `<p><b>${_loc('Roll')}</b>: ${changedRolls.join(', ')}</p>`;
                                let chargesLines = '';
                                if (chargeData && Number.isFinite(chargeData.value)) {
                                    const oldValue = chargeData.value;
                                    const max = chargeData.max;
                                    const newValue = Math.max(0, oldValue - 1);
                                    const maxSuffix = max === null ? '' : `/${max}`;
                                    const changeValueDisplay = `${oldValue}${maxSuffix} <i class="fas fa-arrow-right"></i> ${newValue}${maxSuffix}`;
                                    const chargeLabel = _loc('charges');
                                    let descriptionKey = 'ActiveEffects.chargesChatConsumed';
                                    if (newValue <= 0) {
                                        descriptionKey = effect?.parent?.documentName === 'Item'
                                            ? 'ActiveEffects.chargesChatDepletedDisabled'
                                            : 'ActiveEffects.chargesChatDepletedDeleted';
                                    }
                                    const description = _loc(descriptionKey);
                                    chargesLines = `
                                                    <p>${description}</p>
                                                    <p><b>${chargeLabel}:</b> ${changeValueDisplay}</p>`;
                                }
                                const content = `
                                                <div class="dsa5 chat-card item-card">
                                                    <header class="card-header media">
                                                        <h5 class="item-name">${foundry.utils.escapeHTML(effectName)}</h5>
                                                    </header>
                                                    <div class="card-content">
                                                        <p>${extra}</p>
                                                        ${rollLine}
                                                        ${chargesLines}
                                                    </div>
                                                </div>`;
                                await ChatMessage.create({
                                    content,
                                    speaker: message.speaker,
                                });
                                // Consume charges after messaging; may disable/delete the effect.
                                if (effect?.consumeCharges) {
                                    await effect.consumeCharges(1, {
                                        createChatMessage: false,
                                        speaker: message.speaker,
                                    });
                                }
                                const used = foundry.utils.getProperty(message, 'flags.dsa5.postRoll.usedEffectUuids') || [];
                                const usedSet = new Set(Array.isArray(used) ? used : []);
                                usedSet.add(pendingAfter.effectUuid);
                                await message.update({
                                    'flags.dsa5.postRoll.usedEffectUuids': Array.from(usedSet),
                                    'flags.dsa5.postRoll.-=pendingReroll': null,
                                });
                            } catch (e) {
                                console.warn('postRoll reroll consumption failed', e);
                                await message.update({ 'flags.dsa5.postRoll.-=pendingReroll': null });
                            }
                        }
                    },
                },
                {
                    action: 'cancel',
                    icon: 'fas fa-times',
                    label: 'cancel',
                    callback: async () => {
                        const pending = foundry.utils.getProperty(message, 'flags.dsa5.postRoll.pendingReroll');
                        if (pending?.effectUuid) {
                            await message.update({ 'flags.dsa5.postRoll.-=pendingReroll': null });
                        }
                    },
                },
            ],
        });
        dialog.render(true);
    }
    /**
     * Handles fate rerolls with optional Phex tradition rules
     * @param {Object} actor - The actor performing the reroll
     * @param {string} infoMsg - Information message to display
     * @param {Object} cardOptions - Card display options
     * @param {Object} newTestData - Test data for the roll
     * @param {Object} message - Chat message object
     * @param {Object} data - Roll data containing postData
     * @param {number} schipsource - Source of fate points (0=personal, 1=group)
     */
    static async fatereroll(actor, infoMsg, cardOptions, newTestData, message, data, schipsource) {
        cardOptions.fatePointDamageRerollUsed = true;
        this.#resetTargetAndMessage(data, cardOptions);
        const { characteristics } = data.postData;
        const html = await renderTemplate('systems/dsa5/templates/dialog/fateReroll-dialog.hbs', {
            testData: newTestData,
            postData: data.postData,
            singleDie: characteristics.length === 1,
        });
        const dialog = new DSA5Dialog({
            window: { title: 'CHATFATE.selectDice' },
            content: html,
            buttons: [
                {
                    action: 'yes',
                    icon: 'fa fa-check',
                    label: 'ok',
                    callback: async (event, button, dialog) => {
                        const diesToReroll = this.#getSelectedDiceIndices($(button.form));
                        if (diesToReroll.length === 0) return;
                        const phexTradition = _loc('LocalizedIDs.traditionPhex');
                        const isPhex = actor.items.some(item =>
                            item.type === 'specialability' && item.name === phexTradition
                        );
                        const { newRoll, changedRolls, changes } = await this.#processReroll(
                            diesToReroll,
                            newTestData,
                            'CHATCONTEXT.Reroll',
                            false,
                            actor,
                            isPhex
                        );
                        newTestData.fateUsed = true;
                        const finalInfoMsg = `${infoMsg}<p><b>${_loc('Roll')}</b>: ${changedRolls.join(', ')}</p>`;
                        await ChatMessage.create(DSA5_Utility.chatDataSetup(finalInfoMsg));
                        await actor[data.postData.postFunction]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                        await message.update({ [`flags.data.${this.FLAGS.FATE_REROLL}`]: true });
                        await this.#reduceSchips(actor, schipsource);
                    },
                },
                {
                    action: 'cancel',
                    icon: 'fas fa-times',
                    label: 'cancel',
                },
            ],
        });
        dialog.render(true);
    }
    /**
     * Adds a quality step to a successful roll using fate points
     * @param {Object} actor - The actor performing the action
     * @param {string} infoMsg - Information message to display
     * @param {Object} cardOptions - Card display options
     * @param {Object} newTestData - Test data for the roll
     * @param {Object} message - Chat message object
     * @param {Object} data - Roll data containing postData
     * @param {number} schipsource - Source of fate points (0=personal, 1=group)
     */
    static async fateaddQS(actor, infoMsg, cardOptions, newTestData, message, data, schipsource) {
        await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        // Clear all current targets
        game.user.targets.forEach(target =>
            target.setTarget(false, {
                user: game.user,
                releaseOthers: false,
                groupSelection: true,
            })
        );
        cardOptions.fatePointAddQSUsed = true;
        newTestData.qualityStep = 1;
        await actor[data.postData.postFunction]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
        await message.update({ [`flags.data.${this.FLAGS.FATE_ADD_QS}`]: true });
        await this.#reduceSchips(actor, schipsource);
    }
    /**
     * Improves a roll by reducing dice results using fate points
     * @param {Object} actor - The actor performing the improvement
     * @param {string} infoMsg - Information message to display
     * @param {Object} cardOptions - Card display options
     * @param {Object} newTestData - Test data for the roll
     * @param {Object} message - Chat message object
     * @param {Object} data - Roll data containing postData
     * @param {number} schipsource - Source of fate points (0=personal, 1=group)
     */
    static async fateImprove(actor, infoMsg, cardOptions, newTestData, message, data, schipsource) {
        await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        this.#resetTargetAndMessage(data, cardOptions);
        const rollType = message.flags.data.preData.source.type;
        if (this.MULTI_DIE_ROLL_TYPES.includes(rollType)) {
            await this.#handleMultiDieImprovement(actor, newTestData, message, data, cardOptions, schipsource);
        } else {
            await this.#handleSingleDieImprovement(actor, newTestData, message, data, cardOptions, schipsource);
        }
    }
    /**
     * Main entry point for using fate points on rolls
     * @param {Object} actor - The actor using fate points
     * @param {Object} message - The chat message containing roll data
     * @param {string} type - Type of fate point usage (reroll, addQS, etc.)
     * @param {number} schipsource - Source of fate points (0=personal, 1=group)
     */
    static async useFateOnRoll(actor, message, type, schipsource) {
        const isGroupSource = schipsource === this.SCHIP_SOURCES.GROUP;
        if (type === 'isTalented' || DSA5_Utility.fateAvailable(actor, isGroupSource)) {
            const { data } = message.flags;
            const cardOptions = this.#preparePostRollAction(message);
            const { fateAvailable, schipText } = this.#getFatePointInfo(actor, schipsource);
            const infoMsg = this.#buildFateInfoMessage(actor, type, fateAvailable, schipText, schipsource);
            const newTestData = data.preData;
            await actor[`fate${type}`](infoMsg, cardOptions, newTestData, message, data, schipsource);
        }
    }
    /**
     * Resets target selection and message state
     * @param {Object} data - Roll data containing target and message information
     * @param {Object} cardOptions - Card display options to update
     */
    static #resetTargetAndMessage(data, cardOptions) {
        const { originalTargets, defenderMessage, startMessagesList } = data;
        if (originalTargets?.size) {
            game.user.targets = originalTargets;
            game.user.targets.user = game.user;
        }
        if (!defenderMessage && startMessagesList) {
            cardOptions.startMessagesList = startMessagesList;
        }
    }
    /**
     * Reduces fate points (schips) from the appropriate source
     * @param {Object} actor - The actor spending fate points
     * @param {number} schipsource - Source of fate points (0=personal, 1=group)
     */
    static async #reduceSchips(actor, schipsource) {
        if (schipsource === this.SCHIP_SOURCES.PERSONAL) {
            const currentPoints = actor.system.status.fatePoints.value;
            await actor.update({
                'system.status.fatePoints.value': currentPoints - 1,
            });
        } else {
            await this.reduceGroupSchip();
        }
        this.#throwCoin();
    }
    /**
     * Reduces group fate points (schips)
     * Handles both GM and player contexts via socket communication
     */
    static async reduceGroupSchip() {
        if (game.user.isGM) {
            const groupschips = game.settings
                .get('dsa5', 'groupschips')
                .split('/')
                .map(x => Number(x));
            groupschips[0] = Math.max(0, groupschips[0] - 1);
            await game.settings.set('dsa5', 'groupschips', groupschips.join('/'));
        } else {
            game.socket.emit('system.dsa5', {
                type: 'reduceGroupSchip',
                payload: {},
            });
        }
    }
    /**
     * Prepares card options for post-roll actions
     * @param {Object} message - The chat message containing roll data
     * @returns {Object} Card options object
     */
    static #preparePostRollAction(message) {
        const { data } = message.flags;
        const { img } = message.flags;
        const { messageMode, template, title } = data;
        const { speaker, author } = message;
        const cardOptions = {
            flags: { img: { src: img.src } },
            messageMode,
            speaker,
            template,
            title,
            user: author,
        };
        const optionalProps = ['attackerMessage', 'defenderMessage', 'unopposedStartMessage'];
        optionalProps.forEach(prop => {
            if (data[prop]) cardOptions[prop] = data[prop];
        });
        return cardOptions;
    }
    /**
     * Extracts selected dice indices from dialog form
     * @param {jQuery} $form - The dialog form element
     * @returns {number[]} Array of selected dice indices
     */
    static #getSelectedDiceIndices($form) {
        return $form
            .find('.dieSelected')
            .map(function () {
                return Number(this.dataset.index);
            })
            .get();
    }
    /**
     * Processes reroll logic for dice, handling roll creation and result calculation
     * @param {number[]} diceIndices - Indices of dice to reroll
     * @param {Object} testData - Test data containing roll information
     * @param {string} rollContext - Localization key for roll context
     * @param {boolean} useMinimum - Whether to use minimum of old/new values (talented rule)
     * @param {Object} actor - The actor (for Phex tradition check)
     * @param {boolean} isPhex - Whether actor has Phex tradition
     * @returns {Object} Object containing newRoll, changedRolls array, and changes array
     */
    static async #processReroll(diceIndices, testData, rollContext, useMinimum = false, actor = null, isPhex = false) {
        const rollFormulas = diceIndices.map(index => {
            const term = testData.roll.terms[index * 2];
            return `${term.number}d${term.faces}[${term.options.colorset}]`;
        });
        // Execute the reroll
        const newRoll = await DiceDSA5.manualRolls(
            await new Roll(rollFormulas.join('+')).evaluate(),
            rollContext
        );
        await DiceDSA5.showDiceSoNice(newRoll, testData.messageMode);
        const changedRolls = [];
        const changes = [];
        testData.roll = Roll.fromData(testData.roll);
        diceIndices.forEach((dieIndex, rollIndex) => {
            const characteristic = testData.source.system[`characteristic${dieIndex + 1}`];
            const attr = characteristic ?
                `${_loc(`CHARAbbrev.${characteristic.value.toUpperCase()}`)} - ` : '';
            const newValue = newRoll.terms[rollIndex * 2].results[0].result;
            const originalValue = testData.roll.terms[dieIndex * 2].results[0].result;
            changedRolls.push(`${attr}${originalValue}/${newValue}`);
            let finalValue = newValue;
            if (useMinimum || isPhex) {
                finalValue = Math.min(newValue, originalValue);
            }
            changes.push({ index: dieIndex, val: finalValue });
        });
        testData.roll.editRollAtIndex(changes);
        return { newRoll, changedRolls, changes };
    }
    /**
     * Gets fate point information based on source
     * @param {Object} actor - The actor
     * @param {number} schipsource - Source of fate points
     * @returns {Object} Object containing fateAvailable count and schipText key
     */
    static #getFatePointInfo(actor, schipsource) {
        if (schipsource === this.SCHIP_SOURCES.PERSONAL) {
            return {
                fateAvailable: actor.system.status.fatePoints.value - 1,
                schipText: 'PointsRemaining',
                schipsource,
            };
        } else {
            return {
                fateAvailable: Number(game.settings.get('dsa5', 'groupschips').split('/')[0]) - 1,
                schipText: 'GroupPointsRemaining',
                schipsource,
            };
        }
    }
    static #buildSchipIconRow(actor, schipsource, remaining, tooltipText) {
        const safeRemaining = Math.max(0, Number(remaining) || 0);
        let schipList = [];
        if (schipsource === this.SCHIP_SOURCES.PERSONAL && typeof actor?.schipshtml === 'function') {
            // Reuse Actor helper for max size; override filled state based on remaining.
            schipList = actor.schipshtml().map((x) => ({ ...x }));
        } else if (schipsource === this.SCHIP_SOURCES.GROUP) {
            // Reuse RuleChaos helper for max size; override filled state based on remaining.
            schipList = RuleChaos.getGroupSchips().map((x) => ({ ...x }));
        }
        if (!Array.isArray(schipList) || schipList.length === 0) {
            // Fallback to old numeric display if we can't build icons.
            return `<b>${foundry.utils.escapeHTML(tooltipText)}</b>: ${safeRemaining}`;
        }
        for (let i = 0; i < schipList.length; i++) {
            schipList[i].cssClass = i + 1 <= safeRemaining ? 'fullSchip' : 'emptySchip';
        }
        const icons = schipList
            .map((x) => `<span class="schip tiny ${x.cssClass}"></span>`)
            .join('');
        return `<div class="row-schips flexrow flexAlignCenter stackedSchips" data-tooltip="${foundry.utils.escapeHTML(tooltipText)}">${icons}</div>`;
    }
    /**
     * Builds formatted info message for fate point usage
     * @param {Object} actor - The actor using fate points
     * @param {string} type - Type of fate usage
     * @param {number} fateAvailable - Number of fate points remaining
     * @param {string} schipText - Localization key for fate point text
     * @returns {string} Formatted HTML message
     */
    static #buildFateInfoMessage(actor, type, fateAvailable, schipText, schipsource) {
        const tooltipText = _loc(`CHATFATE.${schipText}`);
        const schipsRow = this.#buildSchipIconRow(actor, schipsource, fateAvailable, tooltipText);
        return `<h5 class="center"><b>${_loc('CHATFATE.fatepointUsed')}</b></h5>
                <div class="flexrow">
                    <div>${_loc(`CHATFATE.${type}`, { character: `<b>${actor.name}</b>` })}</div>
                    ${schipsRow}
                </div>`;
    }
    /**
     * Handles improvement for multi-die roll types (spells, liturgies, etc.)
     * @param {Object} actor - The actor performing improvement
     * @param {Object} newTestData - Test data for the roll
     * @param {Object} message - Chat message object
     * @param {Object} data - Roll data
     * @param {Object} cardOptions - Card options
     * @param {number} schipsource - Fate point source
     */
    static async #handleMultiDieImprovement(actor, newTestData, message, data, cardOptions, schipsource) {
        const html = await renderTemplate('systems/dsa5/templates/dialog/fateImprove-dialog.hbs', {
            testData: newTestData,
            postData: data.postData,
        });
        const dialog = new DSA5Dialog({
            window: { title: 'CHATFATE.selectDice' },
            content: html,
            buttons: [
                {
                    action: 'Yes',
                    icon: 'fa fa-check',
                    label: 'ok',
                    callback: async (event, button, dialog) => {
                        const diesToUpgrade = this.#getSelectedDiceIndices($(button.form));
                        if (diesToUpgrade.length === 1) {
                            const dieIndex = diesToUpgrade[0];
                            const fws = [0, 0, 0];
                            fws[dieIndex] = this.IMPROVEMENT_VALUE;
                            const modifier = {
                                name: _loc('CHATCONTEXT.improveFate'),
                                value: fws.join('|'),
                                type: 'roll',
                            };
                            newTestData.roll = Roll.fromData(newTestData.roll);
                            const originalResult = newTestData.roll.terms[dieIndex * 2].results[0].result;
                            const improvedResult = Math.max(1, originalResult - this.IMPROVEMENT_VALUE);
                            newTestData.roll.editRollAtIndex([{ index: dieIndex, val: improvedResult }]);
                            newTestData.situationalModifiers.push(modifier);
                            await actor[data.postData.postFunction]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                            await message.update({ [`flags.data.${this.FLAGS.FATE_IMPROVED}`]: true });
                            await this.#reduceSchips(actor, schipsource);
                        }
                    },
                },
                {
                    action: 'cancel',
                    icon: 'fas fa-times',
                    label: 'cancel',
                },
            ],
        });
        dialog.render(true);
    }
    /**
     * Handles improvement for single-die roll types
     * @param {Object} actor - The actor performing improvement
     * @param {Object} newTestData - Test data for the roll
     * @param {Object} message - Chat message object
     * @param {Object} data - Roll data
     * @param {Object} cardOptions - Card options
     * @param {number} schipsource - Fate point source
     */
    static async #handleSingleDieImprovement(actor, newTestData, message, data, cardOptions, schipsource) {
        const modifier = {
            name: _loc('CHATCONTEXT.improveFate'),
            value: this.IMPROVEMENT_VALUE,
            type: 'roll',
        };
        newTestData.situationalModifiers.push(modifier);
        newTestData.roll = Roll.fromData(newTestData.roll);
        const originalResult = newTestData.roll.terms[0].results[0].result;
        const improvedResult = Math.max(1, originalResult - this.IMPROVEMENT_VALUE);
        newTestData.roll.editRollAtIndex([{ index: 0, val: improvedResult }]);
        await actor[data.postData.postFunction]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
        await message.update({ [`flags.data.${this.FLAGS.FATE_IMPROVED}`]: true });
        await this.#reduceSchips(actor, schipsource);
    }
    /**
     * Perform a coin toss by rolling a single "1DC" die and display the result with Dice So Nice.
     *
     * This private static async helper evaluates a Roll created from the "1DC" notation,
     * then forwards the evaluated Roll to DiceDSA5.showDiceSoNice using the current core roll mode.
     *
     * @private
     * @static
     * @async
     * @returns {Promise<void>} Resolves after the roll is evaluated and the visualization is requested.
     * @throws {Error} If the roll evaluation fails.
     */
    static async #throwCoin() {
        const coinRoll = await new Roll('1DC').evaluate();
        DiceDSA5.showDiceSoNice(coinRoll, game.settings.get("core", "messageMode"));
    }
}