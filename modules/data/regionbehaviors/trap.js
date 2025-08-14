import DSA5_Utility from "../../system/helpers/utility-dsa5.js";
import RequestRoll from "../../system/rolls/request-roll.js";

const { BooleanField, FilePathField, NumberField, HTMLField, StringField } = foundry.data.fields;
const { renderTemplate } = foundry.applications.handlebars;

export class DSATrapRegionBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
    static REGION_TYPE = 'DSATrap'
    static LOCALIZATION_PREFIXES = ["REGIONBEHAVIOR_DSATrap"];

    static PRIMITIV_TRAP = 0;
    static EINFACH_TRAP = 1;
    static KOMPLEX_TRAP = 2;

    static TRAPTRIGGER_PRESSURE_PLATE = 0;
    static TRAPTRIGGER_WIRE = 1;
    static TRAPTRIGGER_LOCK = 2;
    static TRAPTRIGGER_SUPERNATURAL = 3;

    static sharedSchema() {
        return {
            difficulty: new NumberField({ required: true, initial: 0 }),
            stealth: new NumberField({ required: true, initial: 0 }),
            complexity: new NumberField({
                initial: 0,
                choices: {
                    [DSATrapRegionBehavior.PRIMITIV_TRAP]: "REGIONBEHAVIOR_DSATrap.COMPLEXITIES.0",
                    [DSATrapRegionBehavior.EINFACH_TRAP]: "REGIONBEHAVIOR_DSATrap.COMPLEXITIES.1",
                    [DSATrapRegionBehavior.KOMPLEX_TRAP]: "REGIONBEHAVIOR_DSATrap.COMPLEXITIES.2",
                }
            }),
            damageFormula: new StringField({ initial: "" }),
            tools: new StringField({ initial: "" }),
            trigger: new NumberField({
                initial: 0,
                choices: {
                    [DSATrapRegionBehavior.TRAPTRIGGER_PRESSURE_PLATE]: "REGIONBEHAVIOR_DSATrap.TRIGGERS.0",
                    [DSATrapRegionBehavior.TRAPTRIGGER_WIRE]: "REGIONBEHAVIOR_DSATrap.TRIGGERS.1",
                    [DSATrapRegionBehavior.TRAPTRIGGER_LOCK]: "REGIONBEHAVIOR_DSATrap.TRIGGERS.2",
                    [DSATrapRegionBehavior.TRAPTRIGGER_SUPERNATURAL]: "REGIONBEHAVIOR_DSATrap.TRIGGERS.3"
                }
            }),
            autoPause: new BooleanField({ required: true, initial: true }),
            sound: new FilePathField({ categories: ["AUDIO"] }),
            events: foundry.data.regionBehaviors.RegionBehaviorType._createEventsField({
                events: [
                    CONST.REGION_EVENTS.TOKEN_ENTER,
                    CONST.REGION_EVENTS.TOKEN_EXIT,
                    CONST.REGION_EVENTS.TOKEN_ANIMATE_IN,
                    CONST.REGION_EVENTS.TOKEN_ANIMATE_OUT,
                    CONST.REGION_EVENTS.TOKEN_MOVE_IN,
                    CONST.REGION_EVENTS.TOKEN_MOVE_OUT,
                    CONST.REGION_EVENTS.TOKEN_TURN_START,
                    CONST.REGION_EVENTS.TOKEN_TURN_END,
                    CONST.REGION_EVENTS.TOKEN_ROUND_START,
                    CONST.REGION_EVENTS.TOKEN_ROUND_END,
                ],
            }),
        }
    }

    static defineSchema() {
        return {
            gmdescription: new HTMLField({ initial: "" }),
            description: new HTMLField({ initial: "" }),
            ...this.sharedSchema(),
            disarmed: new BooleanField({ required: true, initial: false }),
            charges: new NumberField({ required: true, initial: 0 }),
            remainingCharges: new NumberField({ required: true, initial: 0 })
        }
    }

    async _handleRegionEvent(regionEvent) {
        if (!DSA5_Utility.isActiveGM()) return;

        if (this.disarmed) return;
        if (this.remainingCharges < 1 && this.charges > 0) return;

        const { name, data, region } = regionEvent;

        const token = data.token;

        if (!token) return;

        token.stopMovement();

        if (this.autoPause) {
            game.togglePause(true);
            canvas.animatePan({ x: token.x, y: token.y });
        }

        const content = await renderTemplate('systems/dsa5/templates/chat/trap/announce.hbs', {
            behaviour: this,
            token,
            tokenAnchor: token.actor ? token.actor.toAnchor().outerHTML : token.name,
            trapName: this.parent.toAnchor().outerHTML
        });

        const chatData = DSA5_Utility.chatDataSetup(content, 'selfroll', false, game.users.filter(x => x.isGM && x.active).map(x => x.id));

        chatData.flags = {
            dsa5: {
                trapData: {
                    behaviour: this.parent.uuid,
                    token: token.uuid,
                    region: region.uuid,
                    name
                }
            }
        }
        ChatMessage.create(chatData);        
    }

    async playSound() {
        if (!this.sound) return
        foundry.audio.AudioHelper.play({ src: this.sound, loop: false }, true);
    }

    static async _handleTrapHandling(event) {
        const action = event.currentTarget.dataset.action;
        const messageId = event.currentTarget.closest('.message').dataset.messageId;
        const message = game.messages.get(messageId);
        const trapData = message.flags.dsa5.trapData;
        const behavior = await fromUuid(trapData.behaviour);
        const options = {
            token: await fromUuid(trapData.token),
            region: await fromUuid(trapData.region),
            message
        }

        switch (action) {
            case 'searchTrap':
                await behavior.system._handleSearch(event, options);
                break;
            case 'disarmTrap':
                await behavior.system._handleDisarm(event, options);
                break;
            case 'triggerTrap':
                await behavior.system._handleTrigger(event, options);
                break;
            case 'showTrap':
                await behavior.system._handleShow(event, options);
        }
    }

    requestRollOptions(message, token) {
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

    async _handleSearch(event, { token, region, message }) {
        const skill = game.i18n.localize('LocalizedIDs.perception');
        const customLabel = undefined
        const options = this.requestRollOptions(message, token);
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
                        RequestRoll.showRQMessage(skill, this.stealth + 1, customLabel, options);
                    },
                },
                {
                    action: 'notice',
                    icon: 'fa fa-eye',
                    label: 'REGIONBEHAVIOR_DSATrap.notice',
                    callback: (event, button, dialog) => {
                        RequestRoll.showRQMessage(skill, this.stealth, customLabel, options);
                    },
                }
            ]
        }).render(true)
    }

    async _handleShow(event, { token, region, message }) {
        const state = Object.keys(CONST.REGION_VISIBILITY)[this.parent.parent.visibility];

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
                    default: this.parent.parent.visibility === 1,
                    callback: (event, button, dialog) => {
                        this.parent.parent.update({ visibility: 1 })
                    },
                },
                {
                    action: 'showTrapAll',
                    icon: 'fa fa-users',
                    label: 'REGIONBEHAVIOR_DSATrap.showTrapAll',
                    default: this.parent.parent.visibility === 2,
                    callback: (event, button, dialog) => {
                        this.parent.parent.update({ visibility: 2 })
                    },
                },
                {
                    action: 'hideTrapAll',
                    icon: 'fa fa-eye-slash',
                    label: 'REGIONBEHAVIOR_DSATrap.hideTrapAll',
                    default: this.parent.parent.visibility === 0,
                    callback: (event, button, dialog) => {
                        this.parent.parent.update({ visibility: 0 })
                    },
                }
            ]
        }).render(true)
    }

    async _handleDisarm(event, { token, region, message }) {
        const skill = game.i18n.localize('LocalizedIDs.lockpick');
        const customLabel = undefined;
        const options = this.requestRollOptions(message, token);
        const duration = [1, 5, 5][this.complexity];
        options.otherMessage = `<b>${game.i18n.format('REGIONBEHAVIOR_DSATrap.disarmMessage', {
            duration
        })}</b>`;

        Object.assign(options.datasetOptions, {
            mode: 'disarm'
        });

        if (this.complexity > 1) {
            RequestRoll.showGCMessage(skill, this.difficulty, {}, options);
        } else {
            RequestRoll.showRQMessage(skill, this.difficulty, customLabel, options);
        }
    }

    async _handleTrigger(event, { token, region, message }) {
        this.playSound();

        const description = this.description || this.gmdescription || '';

        const roll = await new Roll(this.damageFormula).evaluate();
        const rollString = await roll.render();
        const msg = `
            <div>
            <p>${game.i18n.format("REGIONBEHAVIOR_DSATrap.trapstart", { name: token.name, trap: this.parent.name })}</p>
            <p>${description}</p>
            ${rollString}
            </div>
        `
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
        
        if (this.charges > 0) {
            this.update({ remainingCharges: this.remainingCharges - 1 });
        }
    }

    static chatListeners(html) {
        html.on('click', '.trap-handling', this._handleTrapHandling.bind(this));
    }

    async toItem() {
        const data = {
            name: this.parent.name,
            system: {}
        }

        for (const key of Object.keys(DSATrapRegionBehavior.sharedSchema())) {
            if (this[key] !== undefined) {
                data.system[key] = this[key];
            }
        }

        data.charges = `${this.charges}`;

        return data;
    }

    static handleRequestRoll(options) {

    }
}
