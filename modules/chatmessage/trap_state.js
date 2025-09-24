import DSA5_Utility from "../system/helpers/utility-dsa5.js";
import { ChatMessageState } from "./chatmessage_state.js";
import { localize, format } from "../system/helpers/localizer.js";
import DiceDSA5 from "../system/rolls/dice-dsa5.js";
import RequestRoll from "../system/rolls/request-roll.js";
import { ITEM_CONSTANTS } from "../config/item-constants.js";
const { renderTemplate } = foundry.applications.handlebars;
const { DAMAGE } = ITEM_CONSTANTS.COMBAT_MODES;

export class TrapState extends ChatMessageState {
    constructor(behavior, token, region, name) {
        super();
        this.behavior = behavior;
        this.token = token;
        this.region = region;
        this.name = name;
    }

    async toMessage() {
        const content = await renderTemplate('systems/dsa5/templates/chat/trap/announce.hbs', {
            behaviour: this.behavior.system,
            token: this.token,
            tokenAnchor: this.token.actor ? this.token.actor.toAnchor().outerHTML : this.token.name,
            trapName: this.behavior.name
        });

        const chatData = DSA5_Utility.chatDataSetup(content, 'selfroll', false, game.users.filter(x => x.isGM && x.active).map(x => x.id));

        chatData.flags = {
            dsa5: {
                trapData: {
                    behaviour: this.behavior.uuid,
                    token: this.token.uuid,
                    region: this.region.uuid,
                    name: this.name
                }
            }
        }
        const message = await ChatMessage.create(chatData);
        this.message = message;
    }

    static chatListeners(html) {
        html.on('click', '.trap-handling', this._handleTrapHandling.bind(this));
    }

    static async fromMessage(message) {
        const trapData = message.flags.dsa5.trapData;
        const behavior = await fromUuid(trapData.behaviour);
        const token = await fromUuid(trapData.token);
        const region = await fromUuid(trapData.region);
        const name = trapData.name;

        const trapState = new TrapState(behavior, token, region, name);
        trapState.message = message;
        return trapState;
    }

    static async _handleTrapHandling(event) {
        const action = event.currentTarget.dataset.action;
        const messageId = event.currentTarget.closest('.message').dataset.messageId;
        const message = game.messages.get(messageId);
        const trapState = await TrapState.fromMessage(message);

        switch (action) {
            case 'searchTrap':
                await trapState._handleSearch(event);
                break;
            case 'disarmTrap':
                await trapState._handleDisarm(event);
                break;
            case 'manualDisarm':
                await trapState._handleManualDisarm(event);
                break;
            case 'triggerTrap':
                await trapState._handleTrigger(event);
                break;
            case 'showTrap':
                await trapState._handleShow(event);
        }
    }

    #requestRollOptions(message, token) {
        const forceWhisperIDs = game.users.reduce((acc, user) => {
            if (!user.isGM && user.active && token.actor.testUserPermission(user, "OWNER")) acc.push(user.id);
            return acc;
        }, []);
        if (forceWhisperIDs.length === 0) {
            forceWhisperIDs.push(game.user.id);
        }

        return {
            datasetOptions: {
                function: 'game.dsa5.dataModels.RegionBehavior.DSATrap.handleRequestRoll',
                message: message.uuid
            },
            forceWhisperIDs
        }
    }

    async _handleSearch(event) {
        const { token, region, message, behavior } = this;
        const skill = localize('LocalizedIDs.perception');
        const customLabel = undefined
        const options = this.#requestRollOptions(message, token);
        Object.assign(options.datasetOptions, {
            mode: 'search'
        });

        new foundry.applications.api.DialogV2({
            window: {
                title: 'REGIONBEHAVIOR_DSATrap.search'
            },
            position: {
                width: 400
            },
            content: await renderTemplate('systems/dsa5/templates/chat/trap/search.hbs', { token, region, message }),
            buttons: [
                {
                    action: 'search',
                    icon: 'fa fa-magnifying-glass',
                    label: 'REGIONBEHAVIOR_DSATrap.search',
                    default: true,
                    callback: (event, button, dialog) => {
                        RequestRoll.showRQMessage(skill, behavior.system.stealth + 1, customLabel, options);
                    },
                },
                {
                    action: 'notice',
                    icon: 'fa fa-eye',
                    label: 'REGIONBEHAVIOR_DSATrap.notice',
                    callback: (event, button, dialog) => {
                        RequestRoll.showRQMessage(skill, behavior.system.stealth, customLabel, options);
                    },
                }
            ]
        }).render(true)
    }

    async _handleShow(event) {
        const { token, region, message, behavior } = this;
        const state = Object.keys(CONST.REGION_VISIBILITY)[behavior.parent.visibility];

        new foundry.applications.api.DialogV2({
            window: {
                title: 'REGIONBEHAVIOR_DSATrap.showTrap'
            },
            position: {
                width: 600
            },
            content: await renderTemplate('systems/dsa5/templates/chat/trap/showTrap.hbs', { token, region, message, state }),
            buttons: [
                {
                    action: 'showTrap',
                    icon: 'fa fa-mask',
                    label: 'REGIONBEHAVIOR_DSATrap.showTrap',
                    default: behavior.parent.visibility === 1,
                    callback: (event, button, dialog) => {
                        behavior.parent.update({ visibility: 1 })
                    },
                },
                {
                    action: 'showTrapAll',
                    icon: 'fa fa-users',
                    label: 'REGIONBEHAVIOR_DSATrap.showTrapAll',
                    default: behavior.parent.visibility === 2,
                    callback: (event, button, dialog) => {
                        behavior.parent.update({ visibility: 2 })
                    },
                },
                {
                    action: 'hideTrapAll',
                    icon: 'fa fa-eye-slash',
                    label: 'REGIONBEHAVIOR_DSATrap.hideTrapAll',
                    default: behavior.parent.visibility === 0,
                    callback: (event, button, dialog) => {
                        behavior.parent.update({ visibility: 0 })
                    },
                }
            ]
        }).render(true)
    }

    async _handleDisarm(event) {
        const { token, region, message, behavior } = this;
        const skill = localize('LocalizedIDs.lockpick');
        const customLabel = undefined;
        const options = this.#requestRollOptions(message, token);
        const duration = [1, 5, 5][behavior.system.complexity];
        options.otherMessage = `<b>${game.i18n.format('REGIONBEHAVIOR_DSATrap.disarmMessage', {
            duration
        })}</b>`;

        Object.assign(options.datasetOptions, {
            mode: 'disarm'
        });

        if (behavior.system.complexity > 1) {
            RequestRoll.showGCMessage(skill, behavior.system.difficulty, {}, options);
        } else {
            RequestRoll.showRQMessage(skill, behavior.system.difficulty, customLabel, options);
        }
    }

    async _handleManualDisarm(event) {
        const { token, region, message, behavior } = this;
        if (!game.user.isGM) return;

        if (behavior.system.disarmed) {
            ui.notifications.warn(localize("REGIONBEHAVIOR_DSATrap.alreadyDisarmed"));
            return;
        }

        new foundry.applications.api.DialogV2({
            window: {
                title: 'REGIONBEHAVIOR_DSATrap.manualDisarm'
            },
            position: {
                width: 400
            },
            content: await renderTemplate('systems/dsa5/templates/chat/trap/manualDisarm.hbs', { token, region, message, behaviour: behavior.system }),
            buttons: [
                {
                    action: 'confirm',
                    icon: 'fa fa-check',
                    label: 'REGIONBEHAVIOR_DSATrap.confirmDisarm',
                    default: true,
                    callback: async (event, button, dialog) => {
                        await behavior.update({ "system.disarmed": true });
                        ui.notifications.info("REGIONBEHAVIOR_DSATrap.manuallyDisarmed", { format: { trap: behavior.name, gm: game.user.name } });                        
                    },
                },
                {
                    action: 'cancel',
                    icon: 'fa fa-times',
                    label: 'Cancel'
                }
            ]
        }).render(true);
    }

    async _handleTrigger(event) {
        const { behavior, token, region, message } = this;
        behavior.system.playSound();

        const description = behavior.system.description || behavior.system.gmdescription || '';

        const roll = await new Roll(behavior.system.damageFormula).evaluate();
        const rollString = await roll.render();
        const msg = `
            <div>
            <p>${format("REGIONBEHAVIOR_DSATrap.trapstart", { name: token.name, trap: behavior.name })}</p>
            <p>${description}</p>
            ${rollString}
            </div>
        `
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
        DiceDSA5._addRollDiceSoNice({ rollMode: game.settings.get("core", "rollMode") }, roll, game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration(DAMAGE));

        if (behavior.system.charges > 0) behavior.update({ 'system.remainingCharges': behavior.system.remainingCharges - 1 });
    }
}