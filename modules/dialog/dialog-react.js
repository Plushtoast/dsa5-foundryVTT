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
        let attackMessage = game.messages.get(startMessage.data.flags.unopposeData.attackMessageId)
        let source = attackMessage.data.flags.data.preData.source
        let item = source.name
        let items = [{
            name: game.i18n.localize("doNothing"),
            id: "doNothing"
        }]

        let skills = await DSA5_Utility.allSkills()
        for (let k of skills) {
            items.push({
                name: k.name,
                id: k.name
            })
        }

        return renderTemplate('systems/dsa5/templates/dialog/dialog-reaction.html', { items: items, original: item })
    }

    static callbackResult(text, message) {
        const { actor, tokenId } = DialogReactDSA5.getTargetActor(message)
        if ("doNothing" == text) {
            OpposedDsa5.resolveUndefended(message)
        } else {
            let skill = actor.items.find(i => i.name == text && i.type == "skill")
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
        let fun = this.callbackResult
        new DialogReactDSA5({
            title: game.i18n.localize("attacktest"),
            content: await this.getTemplate(actor),
            default: 'ok',
            buttons: {
                ok: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("ok"),
                    callback: dlg => {
                        fun(dlg.find('[name="entryselection"]').val(), actor, tokenId)
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel"),

                }
            }

        }).render(true)
    }

    static async getTemplate(actor) {
        let item = ""
        let items = [{
            name: game.i18n.localize("attackWeaponless"),
            id: "attackWeaponless"
        }]

        let types = ["meleeweapon", "rangeweapon"]
        let traitTypes = ["meleeAttack", "rangeAttack"]
        let result = actor.data.items.filter(x => {
            return (types.includes(x.type) && x.data.data.worn.value == true) || (x.type == "trait" && traitTypes.includes(x.data.data.traitType.value))
        })
        for (let res of result) {
            items.push({
                name: res.name,
                id: res.name
            })
        }

        return await renderTemplate('systems/dsa5/templates/dialog/dialog-act.html', { items: items, original: item })
    }
    static callbackResult(text, actor, tokenId) {
        if ("attackWeaponless" == text) {
            actor.setupWeaponless("attack", {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        } else {
            let types = ["meleeweapon", "trait", "rangeweapon"]
            let result = actor.data.items.find(x => { return types.includes(x.type) && x.name == text })
            if (result) {
                actor.setupWeapon(result, "attack", {}, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            }
        }
    }
}

export class ReactToAttackDialog extends DialogReactDSA5 {

    static async getTemplate(startMessage) {
        let item = ""
        let items = [{
            name: game.i18n.localize("doNothing"),
            id: "doNothing"
        }, {
            name: game.i18n.localize("dodge"),
            id: "dodge"
        }, {
            name: game.i18n.localize("parryWeaponless"),
            id: "parryWeaponless"
        }]

        const { actor, tokenId } = DialogReactDSA5.getTargetActor(startMessage)
        if (actor) {
            let types = ["meleeweapon"]
            let result = actor.data.items.filter(x => { return (types.includes(x.type) && x.data.data.worn.value == true) || (x.type == "trait" && Number(x.data.data.pa) > 0) })
            for (let res of result) {
                items.push({
                    name: res.name,
                    id: res.name
                })
            }
        }

        return await renderTemplate('systems/dsa5/templates/dialog/dialog-reaction.html', { items: items, original: item })
    }

    static callbackResult(text, message) {
        const { actor, tokenId } = DialogReactDSA5.getTargetActor(message)

        if ("doNothing" == text) {
            OpposedDsa5.resolveUndefended(message)
        } else if ("dodge" == text) {
            actor.setupDodge({}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        } else if ("parryWeaponless" == text) {
            actor.setupWeaponless("parry", {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        } else {
            let types = ["meleeweapon", "trait"]
            let result = actor.data.items.find(x => { return types.includes(x.type) && x.name == text })
            if (result) {
                actor.setupWeapon(result, "parry", {}, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            }
        }
    }
}