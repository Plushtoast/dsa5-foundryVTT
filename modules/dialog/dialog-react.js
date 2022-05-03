import OpposedDsa5 from "../system/opposed-dsa5.js";
import DSA5_Utility from "../system/utility-dsa5.js";

export default class DialogReactDSA5 extends Dialog {
    static async showDialog(startMessage) {
        let fun = this.callbackResult
        new DialogReactDSA5({
            title: game.i18n.localize("Unopposed"),
            content: await this.getTemplate(startMessage),
            default: 'ok',
            buttons: {
                ok: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("ok"),
                    callback: dlg => {
                        fun(dlg.find('[name="entryselection"]').val(), startMessage)
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel"),

                }
            }

        }).render(true)
    }

    static getTargetActor(message) {
        if (!canvas.tokens) return {}

        let speaker = message.data.flags.unopposeData.targetSpeaker
        let actor = canvas.tokens.get(speaker.token).actor

        if (!actor) {
            ui.notifications.error(game.i18n.localize("DSAError.noProperActor"))
            return {}
        }
        return {
            actor,
            tokenId: speaker.token
        }
    }

    static async getTemplate(startMessage) { return "" }

    static callbackResult(selection, message, ev) {}

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            resizable: true
        });
        return options;
    }
}


export class ReactToSkillDialog extends DialogReactDSA5 {
    static async getTemplate(startMessage) {
        const attackMessage = game.messages.get(startMessage.data.flags.unopposeData.attackMessageId)
        const source = attackMessage.data.flags.data.preData.source
        const item = source.name
        let items = (await DSA5_Utility.allSkillsList()).map(k => { return { name: k, id: k } })
        items.unshift({
            name: game.i18n.localize("doNothing"),
            id: "doNothing"
        })
        return renderTemplate('systems/dsa5/templates/dialog/dialog-act.html', { items, original: item, title: "DIALOG.selectReaction" })
    }

    static callbackResult(text, message) {
        const { actor, tokenId } = DialogReactDSA5.getTargetActor(message)
        if ("doNothing" == text) {
            OpposedDsa5.resolveUndefended(message)
        } else {
            const skill = actor.items.find(i => i.name == text && i.type == "skill")
            if (skill) {
                actor.setupSkill(skill.data, {}, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            }
        }
    }
}

export class ActAttackDialog extends Dialog {
    static async showDialog(actor, tokenId) {
        const dialog = new ActAttackDialog({
            title: game.i18n.localize("attacktest"),
            content: await this.getTemplate(actor),
            buttons: {}
        })
        dialog.actor = actor
        dialog.tokenId = tokenId
        dialog.render(true)
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.reactClick').click(ev => {
            this.callbackResult(ev.currentTarget.dataset.value, this.actor, this.tokenId)
            this.close()
        })
    }

    static async getTemplate(actor) {
        let items = [{
            name: game.i18n.localize("attackWeaponless"),
            id: "attackWeaponless",
            img: "systems/dsa5/icons/categories/attack_weaponless.webp"
        }]

        const types = ["meleeweapon", "rangeweapon"]
        const traitTypes = ["meleeAttack", "rangeAttack"]
        const result = actor.data.items.filter(x => {
            return (types.includes(x.type) && x.data.data.worn.value == true) || (x.type == "trait" && traitTypes.includes(x.data.data.traitType.value))
        })
        for (let res of result) {
            items.push({
                name: res.name,
                id: res.name,
                img: res.img
            })
        }

        return await renderTemplate('systems/dsa5/templates/dialog/dialog-reaction-attack.html', { items, title: "DIALOG.selectAction" })
    }
    callbackResult(text, actor, tokenId) {
        if ("attackWeaponless" == text) {
            actor.setupWeaponless("attack", {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        } else {
            const types = ["meleeweapon", "trait", "rangeweapon"]
            const result = actor.data.items.find(x => { return types.includes(x.type) && x.name == text })
            if (result) {
                actor.setupWeapon(result, "attack", {}, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            }
        }
    }
}

export class ReactToAttackDialog extends DialogReactDSA5 {
    static async showDialog(startMessage) {
        const dialog = new ReactToAttackDialog({
            title: game.i18n.localize("Unopposed"),
            content: await this.getTemplate(startMessage),
            buttons: {}
        })
        dialog.startMessage = startMessage
        dialog.render(true)
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.reactClick').click(ev => {
            this.callbackResult(ev.currentTarget.dataset.value, this.startMessage)
            this.close()
        })
    }

    static
    get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 500,

        });
        return options;
    }

    static async getTemplate(startMessage) {
        let items = [{
            name: game.i18n.localize("doNothing"),
            id: "doNothing",
            img: "systems/dsa5/icons/categories/disease.webp"
        }, {
            name: game.i18n.localize("dodge"),
            id: "dodge",
            img: "systems/dsa5/icons/categories/Dodge.webp"
        }, {
            name: game.i18n.localize("parryWeaponless"),
            id: "parryWeaponless",
            img: "systems/dsa5/icons/categories/attack_weaponless.webp"
        }]

        const { actor, tokenId } = DialogReactDSA5.getTargetActor(startMessage)
        let defenses = 0
        if (actor) {
            let types = ["meleeweapon"]
            let result = actor.data.items.filter(x => { return (types.includes(x.type) && x.data.data.worn.value == true) || (x.type == "trait" && Number(x.data.data.pa) > 0) })
            for (let res of result) {
                items.push({
                    name: res.name,
                    id: res.name,
                    img: res.img
                })
            }
            if(game.combat)
                defenses = await game.combat.getDefenseCount({actor: actor.id, token: tokenId, scene: canvas.scene ? canvas.scene.id : null})
        }
        

        return await renderTemplate('systems/dsa5/templates/dialog/dialog-reaction-attack.html', { items: items, defenses, title: "DIALOG.selectReaction" })
    }

    callbackResult(text, message) {
        const { actor, tokenId } = DialogReactDSA5.getTargetActor(message)

        if ("doNothing" == text) {
            OpposedDsa5.resolveUndefended(message)
        } else if ("dodge" == text) {
            actor.setupDodge({}, tokenId).then(setupData => { actor.basicTest(setupData) });
        } else if ("parryWeaponless" == text) {
            actor.setupWeaponless("parry", {}, tokenId).then(setupData => { actor.basicTest(setupData) });
        } else {
            const types = ["meleeweapon", "trait"]
            const result = actor.data.items.find(x => { return types.includes(x.type) && x.name == text })
            if (result) {
                actor.setupWeapon(result, "parry", {}, tokenId).then(setupData => { actor.basicTest(setupData) });
            }
        }
    }
}