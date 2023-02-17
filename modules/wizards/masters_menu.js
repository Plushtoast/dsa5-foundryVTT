import DSA5_Utility from "../system/utility-dsa5.js"
import DSA5Payment from "../system/payment.js"
import RuleChaos from "../system/rule_chaos.js"
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js"
import { slist } from "../system/view_helper.js"
import PlayerMenu from "./player_menu.js"
import RequestRoll from "../system/request-roll.js"
import DialogShared from "../dialog/dialog-shared.js"

export default class MastersMenu {
    static registerButtons() {
        game.dsa5.apps.playerMenu = new PlayerMenu()
        CONFIG.Canvas.layers.dsamenu = { layerClass: DSAMenuLayer, group: "interface" }
        Hooks.on("getSceneControlButtons", btns => {
            const dasMenuOptions = [{
                    name: "JournalBrowser",
                    title: game.i18n.localize("Book.Wizard"),
                    icon: "fa fa-book",
                    button: true,
                    onClick: () => { DSA5_Utility.renderToggle(game.dsa5.apps.journalBrowser) }
                },
                {
                    name: "Library",
                    title: game.i18n.localize("SHEET.Library"),
                    icon: "fas fa-university",
                    button: true,
                    onClick: () => { DSA5_Utility.renderToggle(game.dsa5.itemLibrary) }
                },
                {
                    name: "PlayerMenu",
                    title: game.i18n.localize("PLAYER.title"),
                    icon: "fas fa-dsa5-player",
                    button: true,
                    onClick: () => { DSA5_Utility.renderToggle(game.dsa5.apps.playerMenu) }
                }
            ]
            if (game.user.isGM) {
                if (!game.dsa5.apps.gameMasterMenu) game.dsa5.apps.gameMasterMenu = new GameMasterMenu()
                dasMenuOptions.push({
                    name: "mastersMenu",
                    title: game.i18n.localize("gmMenu"),
                    icon: "fa fa-dsa5",
                    button: true,
                    onClick: () => { DSA5_Utility.renderToggle(game.dsa5.apps.gameMasterMenu) }
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

class DSAMenuLayer extends InteractionLayer {
    static get layerOptions() {
        return foundry.utils.mergeObject(super.layerOptions, {
            name: "dsamenu",
            canDragCreate: false,
            controllableObjects: true,
            rotatableObjects: true,
            zIndex: 666,
        });
    }   
    
    selectObjects(optns) {
        canvas.tokens.selectObjects(optns)
    }
}

class GameMasterMenu extends Application {
    constructor(app) {
        super(app)
        this.selected = {}
        this.heros = []
        this.lastSkill = `${game.i18n.localize('LocalizedIDs.perception')}|skill`
        this.randomCreation = []

        if (game.user.isGM) {
            Hooks.on("updateActor", async(document, data, options, userId) => {
                const properties = ["system.status.fatePoints", "system.status.wounds", "system.status.karmaenergy", "system.status.astralenergy"]
                if (this.heros.find(x => x.id == document.id) && properties.reduce((a, b) => {
                        return a || hasProperty(data, b)
                    }, false)) {
                    this.render()
                }
            })
            Hooks.on("updateScene", async(document, data, options, userId) => {
                const properties = ["darkness"]
                if (game.canvas.id == document.id && properties.reduce((a, b) => {
                        return a || hasProperty(data, b)
                    }, false)) {
                    if (game.dsa5.apps.LightDialog) game.dsa5.apps.LightDialog.onDarknessChange()
                    this.render()
                }
            })
            Hooks.on("canvasInit", () => {
                this.render()
            })
        }

    }

    async _render(force = false, options = {}) {
        if (!game.user.isGM) return ui.notifications.error("DSAError.onlyGMallowed")

        await super._render(force, options)
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('select.select2').select2()

        html.find('.heroLink').click(ev => {
            ev.stopPropagation()
            game.actors.get(this.getID(ev)).sheet.render(true)
        })
        html.find('.heroSelector').change(ev => {
            ev.stopPropagation()
            this.selected[this.getID(ev)] = $(ev.currentTarget).is(":checked")
        })
        html.find('.skillSelektor').change(ev => {
            ev.stopPropagation()
            this.lastSkill = $(ev.currentTarget).val()
        })
        html.find('.rollChar').click(ev => {
            ev.stopPropagation()
            this.rollAbility([this.getID(ev)])
        })
        html.find('.rollAll').click((ev) => {
            ev.stopPropagation()
            this.rollAbility(this.selectedIDs())
        })
        html.find('.pay').click((ev) => {
            ev.stopPropagation()
            this.doPayment([this.getID(ev)], true)
        })
        html.find('.actorItem').click(async(ev) => {
            ev.stopPropagation()
            const id = ev.currentTarget.dataset.uuid
            const document = await fromUuid(id)
            document.sheet.render(true)
        })
        html.find('.getPaid').click((ev) => {
            ev.stopPropagation()
            this.doPayment([this.getID(ev)], false)
        })
        html.find('.payAll').click((ev) => {
            ev.stopPropagation()
            this.doPayment(this.selectedIDs(ev), true)
        })
        html.find('.getPaidAll').click((ev) => {
            ev.stopPropagation()
            this.doPayment(this.selectedIDs(ev), false)
        })
        html.find('.selectAll').change((ev) => {
            ev.stopPropagation()
            const allHeros = html.find('.heroSelector')
            allHeros.prop('checked', $(ev.currentTarget).is(":checked"))
            allHeros.change()
        })
        html.find('.exp').click((ev) => {
            ev.stopPropagation()
            this.getExp([this.getID(ev)])
        })
        html.find('.expAll').click((ev) => {
            ev.stopPropagation()
            this.getExp(this.selectedIDs())
        })
        html.find('.randomPlayer').mousedown((ev) => {
            ev.stopPropagation()
            this._randomPlayer(html, ev)
        })
        html.find('.requestRoll').click(ev => {
            ev.stopPropagation()
            this.rollRequest()
        })
        html.find('.heroSelector').click(ev => ev.stopPropagation())
        html.find('.hero').click(ev => {
            ev.stopPropagation(ev)
            $(ev.currentTarget).find('.expandDetails').fadeToggle()
        })

        let deletehand = ev => this._deleteHero(ev);

        html.find(".hero").mouseenter(ev => {
            if (ev.currentTarget.getElementsByClassName('hovermenu').length == 0) {
                let div = document.createElement('div')
                div.classList.add("hovermenu")
                let del = document.createElement('i')
                del.classList.add("fas", "fa-times")
                del.title = game.i18n.localize('SHEET.DeleteItem')
                del.addEventListener('click', deletehand, false)
                div.appendChild(del)
                ev.currentTarget.appendChild(div)
            }
        });
        html.find(".hero").mouseleave(ev => {
            let e = ev.toElement || ev.relatedTarget;
            if (!e || e.parentNode == this || e == this)
                return;

            ev.currentTarget.querySelectorAll('.hovermenu').forEach(e => e.remove());
        });


        html.find('.addGroupSchip').click(async(ev) => {
            await this.changeGroupSchipCount(Number(ev.currentTarget.dataset.value))
        })
        html.find('.groupschip').click(ev => {
            this.changeGroupSchip(ev)
        })
        html.find('.heroschip').click(ev => {
            ev.stopPropagation()
            ev.preventDefault()
            let val = Number(ev.currentTarget.getAttribute("data-val"))
            if (val == 1 && $(ev.currentTarget).closest('.hero').find(".fullSchip").length == 1) val = 0

            game.actors.get(this.getID(ev)).update({ "system.status.fatePoints.value": val })
        })
        html.find('.groupCheck').click((ev) => {
            ev.stopPropagation()
            this.doGroupCheck()
        })
        html.find('.changeSetting').change(async(ev) => {
            await game.settings.set('dsa5', ev.currentTarget.name, ev.currentTarget.checked)
        })
        html.find('.changeSightTreshold').change(async(ev) => {
            $(ev.currentTarget).closest('.row-section').find('.range-value').text(ev.currentTarget.value)
            this.updateSightThreshold(ev)
        })
        html.find('.updateDarkness').change(async(ev) => {
            $(ev.currentTarget).closest('.row-section').find('.range-value').text(ev.currentTarget.value)
            this.updateDarkness(ev)
        })

        for (let elem of this.randomCreation) {
            elem.activateListeners(html)
        }
        slist(html, '.heros', this.updateHeroOrder, '.hero')
        html.on("dragstart", ".hero", event => {
            event.stopPropagation();
            const a = event.currentTarget;
            let dragData = { type: "Actor", uuid: a.dataset.uuid };
            event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        })

        html.find('.dragEveryone').each(function(i, cond) {
            cond.setAttribute("draggable", true);
        })
        html.on("dragstart", ".dragEveryone", ev => {
            ev.stopPropagation();
            const a = ev.currentTarget;
            let dragData = { type: "GroupDrop", ids: this.selectedIDs() };
            ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        })

        if (game.dsa5.apps.LightDialog) game.dsa5.apps.LightDialog.activateButtonListener(html)
    }

    async _deleteHero(ev) {
        ev.stopPropagation()
        ev.preventDefault()
        const toRemove = $(ev.currentTarget).closest(".hero").attr("data-id")
        const actors = game.settings.get("dsa5", "trackedActors").actors || []
        const index = actors.indexOf(toRemove)
        if (index > -1) {
            actors.splice(index, 1)
            await game.settings.set("dsa5", "trackedActors", { actors })
            this.render(true)
        }
    }

    async updateHeroOrder(target) {
        const actors = []
        for (let elem of target.querySelectorAll(".hero")) {
            actors.push(elem.dataset.id)
        }
        await game.settings.set("dsa5", "trackedActors", { actors })
    }

    async updateDarkness(ev) {
        if (canvas.scene) canvas.scene.update({ darkness: Number(ev.currentTarget.value) }, { animateDarkness: 3000 })
    }

    async updateSightThreshold(ev) {
        const index = Number(ev.currentTarget.dataset.index)
        const value = Number(ev.currentTarget.value)
        const optns = game.settings.get("dsa5", "sightOptions").split("|")
        optns[index] = value
        await game.settings.set("dsa5", "sightOptions", optns.join("|"))
    }

    getGroupSchipSetting() {
        return game.settings.get("dsa5", "groupschips").split("/").map(x => Number(x))
    }

    async changeGroupSchipCount(value) {
        const schipSetting = this.getGroupSchipSetting()
        schipSetting[1] = Math.max(0, schipSetting[1] + value)
        schipSetting[0] = Math.min(schipSetting[1], schipSetting[0])
        await game.settings.set("dsa5", "groupschips", schipSetting.join("/"))
    }

    async changeGroupSchip(ev) {
        let val = Number(ev.currentTarget.getAttribute("data-val"))
        if (val == 1 && $(ev.currentTarget).closest('.col').find(".fullSchip").length == 1) val = 0

        const schipSetting = this.getGroupSchipSetting()
        schipSetting[0] = val
        await game.settings.set("dsa5", "groupschips", schipSetting.join("/"))
    }

    async _randomPlayer(html, ev) {
        const heros = html.find('.hero')
        const result = await this.rollRandomPlayer(ev.button == 2)

        $(ev.currentTarget).find('i').addClass('fa-spin')
        heros.removeClass("victim")

        setTimeout(() => {
            $(this._element).find(`.hero[data-id="${result}"]`).addClass("victim")
            $(ev.currentTarget).find('i').removeClass('fa-spin')
        }, 500)
    }

    async rollRandomPlayer(withMisfortune){
        let probabilities = {}
        let counter = 1
        const anythingselected = Object.keys(this.selected).length != 0;

        const heros = this.heros.length ? this.heros : await this.getTrackedHeros()
        for (const hero of heros) {
            if (!this.selected[hero.id] && anythingselected) continue

            probabilities[counter] = hero.id
            counter++
            if (withMisfortune && AdvantageRulesDSA5.hasVantage(hero, game.i18n.localize("LocalizedIDs.misfortune"))) {
                probabilities[counter] = hero.id
                counter++
            }
            if (withMisfortune && hero.hasCondition("badluck")) {
                probabilities[counter] = hero.id
                counter++
            }
        }

        const roll = (await new Roll(`1d${counter - 1}`).evaluate({ async: true })).total
        return probabilities[roll]
    }

    async doPayment(ids, pay) {
        const actors = game.actors.filter(x => ids.includes(x.id))
        const heros = this.getNames(actors)
        const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.html', { text: game.i18n.localize(game.i18n.format(pay ? "MASTER.payText" : "MASTER.getPaidText", { heros })) })
        const callback = (dlg) => {
            const number = dlg.find('.input-text').val()
            for (let hero of actors)
                DSA5Payment.handlePayAction(undefined, pay, number, hero)

        }
        this.buildDialog(game.i18n.localize(pay ? 'MASTER.payTT' : 'PAYMENT.payButton'), template, callback)
    }

    async getPaid(ids) {
        this.doPayment(ids, false)
    }

    async getExp(ids) {
        const actors = game.actors.filter(x => ids.includes(x.id))
        const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.html', { text: game.i18n.localize(game.i18n.format("MASTER.awardXPText", { heros: this.getNames(actors) })) })
        const callback = async(dlg) => {
            const number = Number(dlg.find('.input-text').val())
            const familiarXP = Math.max(1, Math.round(number * 0.25))
            const heros = []
            const familiars = []
            if (!isNaN(number)) {
                for (const actor of actors) {
                    let xpBonus = number
                    if (RuleChaos.isFamiliar(actor) || RuleChaos.isPet(actor)) {
                        xpBonus = familiarXP
                        familiars.push(actor)
                    } else {
                        heros.push(actor)
                    }

                    await actor.update({ "system.details.experience.total": actor.system.details.experience.total + xpBonus });
                }
                if (heros.length > 0) await ChatMessage.create(DSA5_Utility.chatDataSetup(game.i18n.format('MASTER.xpMessage', { heros: this.getNames(heros), number })));
                if (familiars.length > 0) await ChatMessage.create(DSA5_Utility.chatDataSetup(game.i18n.format('MASTER.xpMessage', { heros: this.getNames(familiars), number })));
            }
        }
        this.buildDialog(game.i18n.localize('MASTER.awardXP'), template, callback)
    }

    getNames(actors) {
        return actors.map(x => x.name).join(", ")
    }

    buildDialog(title, content, callbackFunction) {
        new DialogShared({
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

    _canDragDrop(selector) {
        return true
    }

    async _onDrop(event) {
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData('text/plain'));
            data = await Actor.implementation.fromDropData(data)
        } catch (err) {
            return false;
        }
        if (data.documentName == "Actor") {
            let tracked = game.settings.get("dsa5", "trackedActors")
            tracked = tracked.actors || []
            if (tracked.indexOf(data.id) == -1 && !data.pack) {
                tracked.push(data.id)
                await game.settings.set("dsa5", "trackedActors", { actors: tracked })
                this.render(true)
            }

        }
    }

    selectedIDs() {
        let ids = []
        for (const [key, value] of Object.entries(this.selected)) {
            if (value) ids.push(key)
        }
        if(!ids.length) return game.settings.get("dsa5", "trackedActors").actors || []
        return ids
    }

    async doGroupCheck() {
        const [skill, type] = this.lastSkill.split("|")
        if (type != "skill") return

        const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.html', { text: game.i18n.localize(game.i18n.format("MASTER.doGroupCheck", { skill })) })
        const callback = (dlg) => {
            const number = Number(dlg.find('.input-text').val())
            const [skill, type] = this.lastSkill.split("|")
            if (type != "skill") return

            RequestRoll.showGCMessage(skill, number)
        }
        this.buildDialog(game.i18n.localize('HELP.groupcheck'), template, callback)
    }

    async rollRequest(){
        const [skill, type] = this.lastSkill.split("|")
        if (type != "skill") return

        const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.html', { text: game.i18n.localize(game.i18n.format("MASTER.doRequestRoll", { skill })) })
        const callback = (dlg) => {
            const number = Number(dlg.find('.input-text').val())
            const [skill, type] = this.lastSkill.split("|")
            if (type != "skill") return

            RequestRoll.showRQMessage(skill, number)
        }
        this.buildDialog(game.i18n.localize('HELP.request'), template, callback)
    }

    rollAbility(actorIds) {
        const [name, type] = this.lastSkill.split("|")
        switch (type) {
            case "skill":
                this.rollSkill(actorIds, name)
                break
            case "attribute":
                this.rollAttribute(actorIds, name)
                break
            case "regeneration":
                this.rollRegeneration(actorIds)
                break
        }
    }

    rollRegeneration(actorIds) {
        const actors = game.actors.filter(x => actorIds.includes(x.id))
        for (const actor of actors) {
            actor.setupRegeneration("regenerate", { rollMode: "blindroll", subtitle: ` (${actor.name})` }, undefined).then(setupData => { actor.basicTest(setupData) });
        }
    }

    rollAttribute(actorIds, name) {
        const actors = game.actors.filter(x => actorIds.includes(x.id))
        let characteristic = Object.keys(game.dsa5.config.characteristics).find(key => game.i18n.localize(game.dsa5.config.characteristics[key]) == name)
        for (const actor of actors) {
            actor.setupCharacteristic(characteristic, { rollMode: "blindroll", subtitle: ` (${actor.name})` }, undefined).then(setupData => { actor.basicTest(setupData) });
        }
    }

    rollSkill(actorIds, name) {
        const actors = game.actors.filter(x => actorIds.includes(x.id))
        for (const actor of actors) {
            let skill = actor.items.find(x => x.name == name && x.type == "skill")
            actor.setupSkill(skill, { rollMode: "blindroll", subtitle: ` (${actor.name})` }, undefined).then(setupData => {
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
            dragDrop: [{ dragSelector: null, dropSelector: null }]
        });
        options.template = 'systems/dsa5/templates/system/mastermenu.html'
        options.resizable = true
        return options;
    }

    async getTrackedHeros(){
        const trackedActors = game.settings.get("dsa5", "trackedActors")
        let heros = []
        if (trackedActors.actors && trackedActors.actors.length > 0) {
            heros = game.actors.filter(x => trackedActors.actors.includes(x.id)).sort((a, b) => { return trackedActors.actors.indexOf(a.id) - trackedActors.actors.indexOf(b.id) })
        } else {
            heros = game.actors.filter(x => x.hasPlayerOwner)
            await game.settings.set("dsa5", "trackedActors", { actors: heros.map(x => x.id) })
        }
        return heros
    }

    async getData(options) {
        const data = await super.getData(options);
        const heros = await this.getTrackedHeros()
        const groupschips = RuleChaos.getGroupSchips()
        
        const thresholds = game.settings.get("dsa5", "sightOptions").split("|")
        const regex = / \[[a-zA-Zäöü\d-]+\]/
        const visions = [1, 2, 3, 4].map(x => { return { label: game.i18n.localize(`VisionDisruption.step${x}`).replace(regex, ""), value: thresholds[x - 1] } })
        data.sceneConfig = {
            sceneAutomationEnabled: game.settings.get("dsa5", "sightAutomationEnabled"),
            enableDPS: game.settings.get("dsa5", "enableDPS"),
            visions,
            darkness: canvas.scene ? canvas.scene.darkness : 0
        }

        this.heros = heros
        for (const hero of heros) {
            hero.gmSelected = this.selected[hero.id]
            hero.schips = hero.schipshtml()
            hero.purse = hero.items.filter(x => x.type == "money")
                .sort((a, b) => b.system.price.value - a.system.price.value)
                .map(x => `<span data-tooltip="${game.i18n.localize(x.name)}">${x.system.quantity.value}</span>`).join(" - ")
            hero.advantages = hero.items.filter(x => x.type == "advantage").map(x => { return { name: x.name, uuid: x.uuid } })
            hero.disadvantages = hero.items.filter(x => x.type == "disadvantage").map(x => { return { name: x.name, uuid: x.uuid } })
        }

        if (!this.abilities) {
            const skills = (await DSA5_Utility.allSkillsList())
            this.abilities = skills.map(x => { return { name: x, type: "skill" } })
                .concat(Object.values(game.dsa5.config.characteristics).map(x => {
                    return { name: game.i18n.localize(x), type: "attribute" }
                }).concat({ name: game.i18n.localize('regenerate'), type: "regeneration" })).sort((x, y) => x.name.localeCompare(y.name))
        }

        mergeObject(data, {
            heros,
            abilities: this.abilities,
            groupschips,
            lastSkill: this.lastSkill,
            randomCreation: this.randomCreation.map(x => x.template),
            lightButton: game.dsa5.apps.LightDialog ? await game.dsa5.apps.LightDialog.getButtonHTML() : ""
        })
        return data
    }

    registerRandomCreation(elem) {
        this.randomCreation.push(elem)
    }
}