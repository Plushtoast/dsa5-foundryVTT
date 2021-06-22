import DSA5_Utility from "./utility-dsa5.js"
import DSA5Payment from "./payment.js"
import DSA5ChatAutoCompletion from "./chat_autocompletion.js"

export default class MastersMenu {
    static registerButtons() {
        CONFIG.Canvas.layers.dsamenu = DSAMenuLayer
        Hooks.on("getSceneControlButtons", btns => {

            const dasMenuOptions = [{
                    name: "JournalBrowser",
                    title: game.i18n.localize("Book.Wizard"),
                    icon: "fa fa-book",
                    button: true,
                    onClick: () => {
                        game.dsa5.apps.journalBrowser.render(true)
                    }
                },
                {
                    name: "Library",
                    title: game.i18n.localize("ItemLibrary"),
                    icon: "fas fa-university",
                    button: true,
                    onClick: () => {
                        game.dsa5.itemLibrary.render(true)
                    }
                }
            ]
            if (game.user.isGM) {
                game.dsa5.apps.gameMasterMenu = new GameMasterMenu()
                dasMenuOptions.push({
                    name: "mastersMenu",
                    title: game.i18n.localize("gmMenu"),
                    icon: "fa fa-dsa5",
                    button: true,
                    onClick: () => {
                        game.dsa5.apps.gameMasterMenu.render(true)
                    }
                })
            }
            btns.push({
                name: "GM Menu",
                title: game.i18n.localize("gmMenu"),
                icon: "fas fa-dsa5",
                layer: "dsamenu",
                tools: dasMenuOptions
            })
        })
    }
}

class DSAMenuLayer extends CanvasLayer {
    static get layerOptions() {
        return foundry.utils.mergeObject(super.layerOptions, {
            name: "dsamenu",
            canDragCreate: false,
            controllableObjects: true,
            rotatableObjects: true,
            zIndex: 666,
        });
    }
}

class GameMasterMenu extends Application {
    constructor(app) {
        super(app)
        this.selected = {}
        this.heros = []
        this.lastSkill = game.i18n.localize('LocalizedIDs.perception')
        Hooks.on("updateActor", async(document, data, options, userId) => {
            const properties = ["data.status.fatePoints", "data.status.wounds", "data.status.karmaenergy", "data.status.astralenergy"]
            if (document.hasPlayerOwner && properties.reduce((a, b) => {
                    return a || hasProperty(data, b)
                }, false)) {
                this.render()
            }
        })
    }

    activateListeners(html) {
        super.activateListeners(html)

        html.find('.heroLink').click(ev => {
            game.actors.get(this.getID(ev)).sheet.render(true)
        })
        html.find('.heroSelector').change(ev => {
            this.selected[this.getID(ev)] = $(ev.currentTarget).is(":checked")
        })
        html.find('.skillSelektor').change(ev => {
            this.lastSkill = $(ev.currentTarget).val()
        })
        html.find('.rollChar').click(ev => {
            this.rollSkill([this.getID(ev)])
        })
        html.find('.rollAll').click(() => {
            this.rollSkill(this.selectedIDs())
        })
        html.find('.pay').click((ev) => {
            this.pay([this.getID(ev)])
        })
        html.find('.getPaid').click((ev) => {
            this.getPaid([this.getID(ev)])
        })
        html.find('.payAll').click(() => {
            this.pay(this.selectedIDs())
        })
        html.find('.getPaidAll').click(() => {
            this.getPaid(this.selectedIDs())
        })
        html.find('.exp').click((ev) => {
            this.getExp([this.getID(ev)])
        })
        html.find('.expAll').click(() => {
            this.getExp(this.selectedIDs())
        })
        html.find('.randomPlayer').click((ev) => {
            const heros = html.find('.hero')
            const count = heros.length
            const roll = new Roll(`1d${count}`).evaluate({ async: false }).total
            $(ev.currentTarget).find('i').addClass('fa-spin')
            heros.removeClass("victim")

            setTimeout(() => {
                heros.eq(roll - 1).addClass("victim")
                $(ev.currentTarget).find('i').removeClass('fa-spin')
            }, 500)
        })
        html.find('.schip').click(ev => {
            ev.preventDefault()
            let val = Number(ev.currentTarget.getAttribute("data-val"))
            if (val == 1 && $(ev.currentTarget).closest('.hero').find(".fullSchip").length == 1) val = 0

            game.actors.get(this.getID(ev)).update({ "data.status.fatePoints.value": val })
        })
        html.find('.groupCheck').click(() => {
            this.doGroupCheck()
        })
    }

    async pay(ids) {
        const actors = game.actors.filter(x => ids.includes(x.id))
        const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.html', { text: game.i18n.localize(game.i18n.format("MASTER.payText", { heros: this.getNames(actors) })) })
        const callback = (dlg) => {
            const number = dlg.find('.input-text').val()
            DSA5Payment.createPayChatMessage(number)
        }
        this.buildDialog(game.i18n.localize('PAYMENT.payButton'), template, callback)
    }

    async getPaid(ids) {
        const actors = game.actors.filter(x => ids.includes(x.id))
        const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.html', { text: game.i18n.localize(game.i18n.format("MASTER.getPaidText", { heros: this.getNames(actors) })) })
        const callback = (dlg) => {
            const number = dlg.find('.input-text').val()
            DSA5Payment.createGetPaidChatMessage(number)
        }
        this.buildDialog(game.i18n.localize('MASTER.payTT'), template, callback)
    }

    async getExp(ids) {
        const actors = game.actors.filter(x => ids.includes(x.id))
        const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.html', { text: game.i18n.localize(game.i18n.format("MASTER.awardXPText", { heros: this.getNames(actors) })) })
        const callback = async(dlg) => {
            const number = Number(dlg.find('.input-text').val())
            if (!isNaN(number)) {
                for (const actor of actors) {
                    await actor.update({ "data.details.experience.total": actor.data.data.details.experience.total + number });
                }
                await ChatMessage.create(DSA5_Utility.chatDataSetup(game.i18n.format('MASTER.xpMessage', { heros: this.getNames(actors), number })));
            }
        }
        this.buildDialog(game.i18n.localize('MASTER.awardXP'), template, callback)
    }

    getNames(actors) {
        return actors.map(x => x.name).join(", ")
    }

    buildDialog(title, content, callbackFunction) {
        new Dialog({
            title,
            content,
            default: 'yes',
            buttons: {
                Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("yes"),
                    callback: dlg => {
                        callbackFunction(dlg)
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel")
                }
            }
        }).render(true)
    }

    selectedIDs() {
        let ids = []
        for (const [key, value] of Object.entries(this.selected)) {
            if (value) ids.push(key)
        }
        return ids
    }

    async doGroupCheck() {
        const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.html', { text: game.i18n.localize(game.i18n.format("MASTER.doGroupCheck", { skill: this.lastSkill })) })
        const callback = (dlg) => {
            const number = Number(dlg.find('.input-text').val())
            DSA5ChatAutoCompletion.showGCMessage(this.lastSkill, number)
        }
        this.buildDialog(game.i18n.localize('HELP.groupcheck'), template, callback)
    }

    rollSkill(actorIds) {
        const actors = game.actors.filter(x => actorIds.includes(x.id))
        for (const actor of actors) {
            let skill = actor.items.find(x => x.name == this.lastSkill && x.type == "skill")
            actor.setupSkill(skill.data, { rollMode: "blindroll", subtitle: ` (${actor.name})` }, undefined).then(setupData => {
                actor.basicTest(setupData)
            });
        }
    }

    getID(ev) {
        return $(ev.currentTarget).closest('.hero').attr("data-id")
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "main" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "largeDialog", "masterMenu"]),
            width: 470,
            height: 740,
            title: game.i18n.localize("gmMenu"),
        });
        options.template = 'systems/dsa5/templates/system/mastermenu.html'
        options.resizable = true
        return options;
    }

    async getData(options) {
        const data = await super.getData(options);
        const heros = game.actors.filter(x => x.hasPlayerOwner)
        this.heros = heros
        for (const hero of heros) {
            hero.gmSelected = this.selected[hero.id]
            let schips = []
            for (let i = 1; i <= Number(hero.data.data.status.fatePoints.max); i++) {
                schips.push({
                    value: i,
                    cssClass: i <= Number(hero.data.data.status.fatePoints.value) ? "fullSchip" : "emptySchip"
                })
            }
            hero.schips = schips
        }
        const skills = Object.fromEntries(Object.entries(await DSA5_Utility.allSkillsList()).sort((a, b) => a[0].localeCompare(b[0])))

        mergeObject(data, {
            heros,
            skills,
            lastSkill: this.lastSkill
        })
        return data
    }
}