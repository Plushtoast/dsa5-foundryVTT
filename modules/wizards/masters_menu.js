import DSA5_Utility from "../system/utility-dsa5.js"
import DSA5Payment from "../system/payment.js"
import RuleChaos from "../system/rule_chaos.js"
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js"
import { slist, tabSlider } from "../system/view_helper.js"
import PlayerMenu from "./player_menu.js"
import RequestRoll from "../system/request-roll.js"
import DialogShared from "../dialog/dialog-shared.js"
import { mergeObject, duplicate, expandObject, hasProperty } from "../system/foundry.js";

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
        this.heros = []
        this.lastSkill = `${game.i18n.localize('LocalizedIDs.perception')}|skill`
        this.randomCreation = []

        if (game.user.isGM) {
            Hooks.on("updateActor", async(document, data, options, userId) => {
                if(!this.rendered) return

                const properties = ["system.status.fatePoints", "system.status.wounds", "system.status.karmaenergy", "system.status.astralenergy"]
                if (this.heros.some(x => x.id == document.id) && properties.reduce((a, b) => {
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

                    if(!this.rendered) return

                    this.render()
                }
            })
            Hooks.on("canvasInit", () => {
                if(!this.rendered) return

                this.render()
            })
        }

    }

    async _render(force = false, options = {}) {
        if (!game.user.isGM) return ui.notifications.error("DSAError.onlyGMallowed")

        await super._render(force, options)
    }

    getSelectedActors(){
        const selected = game.settings.get("dsa5", "selectedActors")
        const tracked = game.settings.get("dsa5", "trackedActors")
        const final = {}
        for(let key of Object.keys(selected)){
            if(tracked.actors?.includes(key)) final[key] = selected[key]
        }
        return final
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('select.select2').select2()

        tabSlider(html)

        html.find('.heroLink').click(ev => {
            ev.stopPropagation()
            game.actors.get(this.getID(ev)).sheet.render(true)
        })
        html.find('.addGlobalMod').click(() => this.addGlobalMod())
        html.find('.globalModEnable').change(ev => this.toggleGlobalMod(ev))
        html.find('.removeGlobalMod').click((ev) => this.removeGlobalMod(ev))
        html.find('.editGlobalMod').click(ev => this.editGlobalMod(ev))
        html.find('.heroSelector').change(ev => {
            ev.stopPropagation()
            const selected = this.getSelectedActors()
            selected[this.getID(ev)] = $(ev.currentTarget).is(":checked")
            game.settings.set("dsa5", "selectedActors", selected)
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
        html.find('.resetSightThresholds').click(() => this.resetSightThresholds())
        html.find('.payAll').click((ev) => {
            ev.stopPropagation()
            this.doPayment(this.selectedIDs(ev), true)
        })
        html.find('.getPaidAll').click((ev) => {
            ev.stopPropagation()
            this.doPayment(this.selectedIDs(ev), false)
        })
        html.find('.selectAll').change((ev) => this._selectAll(ev, html))
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
        html.find('.addFolder').click(async(ev) => this.editFolder(ev))
        html.find('.editFolder').change(async(ev) => this._editFolder(ev))
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
        html.on("dragstart", ".dragEveryone", ev => this._dragEveryone(ev))

        if (game.dsa5.apps.LightDialog) game.dsa5.apps.LightDialog.activateButtonListener(html)
    }

    async _dragEveryone(ev) {
        ev.stopPropagation();
        let ids
        if(ev.currentTarget.dataset.folder){
            const settings = expandObject(game.settings.get("dsa5", "masterSettings"))
            ids = settings.folders.find(x => x.id == ev.currentTarget.dataset.folder).content
        } else {
            ids = this.selectedIDs()
        }
        let dragData = { type: "GroupDrop", ids }
        ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dragData))
    }

    async _selectAll(ev, html) {
        ev.stopPropagation()
        let selector ='.heroSelector'
        if(ev.currentTarget.dataset.folder)
            selector = `[data-id="${ev.currentTarget.dataset.folder}"] .heroSelector`

        const allHeros = html.find(selector)
        allHeros.prop('checked', $(ev.currentTarget).is(":checked"))
        allHeros.change()
    }

    async _deleteHero(ev) {
        ev.stopPropagation()
        ev.preventDefault()
        const toRemove = $(ev.currentTarget).closest(".hero").attr("data-id")
        const actors = game.settings.get("dsa5", "trackedActors").actors || []
        const index = actors.indexOf(toRemove)
        if (index > -1) {
            actors.splice(index, 1)
            await this.setTrackedHeros(actors)
            this.render(true)
        }
    }

    async updateHeroOrder(target) {
        const actors = []
        for (let elem of target.querySelectorAll(".hero")) {
            actors.push(elem.dataset.id)
        }
        await this.setTrackedHeros(actors)
    }

    async setTrackedHeros(actorIds) {
        await game.settings.set("dsa5", "trackedActors", { actors: actorIds.filter(x => game.actors.has(x)) })
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

    async resetSightThresholds() {
        await game.settings.set("dsa5", "sightOptions", game.settings.settings.get("dsa5.sightOptions").default)
        this.render(true)
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

    async _createFolder() {
        const settings = expandObject(game.settings.get("dsa5", "masterSettings"))
        if(!settings.folders) settings.folders = []

        settings.folders.push({
            id: randomID(),
            name: game.i18n.localize("FOLDER.ExportNewFolder"),
            content: []
        })
        await game.settings.set("dsa5", "masterSettings", settings)
        await this.render(true)
    }

    async _deleteFolder(ev) {
        const id = ev.currentTarget.dataset.id
        const settings = expandObject(game.settings.get("dsa5", "masterSettings"))
        settings.folders = settings.folders.filter(x => x.id != id)

        await game.settings.set("dsa5", "masterSettings", settings)
        await this.render(true)
    }

    async _editFolder(ev) {
        const id = ev.currentTarget.dataset.id
        const settings = expandObject(game.settings.get("dsa5", "masterSettings"))
        settings.folders.find(x => x.id == id).name = ev.currentTarget.value

        await game.settings.set("dsa5", "masterSettings", settings)
    }

    async editFolder(ev) {
        switch(ev.currentTarget.dataset.action){
            case "create":
                this._createFolder()
                break
            case "delete":
                this._deleteFolder(ev)
                break
        }
    }


    async addGlobalMod() {
        new GlobalModAddition().render(true)
    }

    async editGlobalMod(ev) {
        const id = ev.currentTarget.dataset.key
        new GlobalModAddition(id).render(true)
    }

    async toggleGlobalMod(ev) {
        const settings = game.settings.get("dsa5", "masterSettings")
        settings.globalMods[ev.currentTarget.dataset.key].enabled = ev.currentTarget.checked
        await game.settings.set("dsa5", "masterSettings", settings)
    }

    async removeGlobalMod(ev) {
        const settings = game.settings.get("dsa5", "masterSettings")
        delete settings.globalMods[ev.currentTarget.dataset.key]
        await game.settings.set("dsa5", "masterSettings", settings)
        this.render()
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
        const selected = this.getSelectedActors()
        const anythingselected = Object.values(selected).filter(x => x).length != 0;

        const heros = this.heros.length ? this.heros : await this.getTrackedHeros()
        if(heros.length == 0) {
            ui.notifications.warn(game.i18n.localize("DIALOG.noTarget"))
            return
        }
        for (const hero of heros) {
            if (!selected[hero.id] && anythingselected) continue

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

        const roll = (await new Roll(`1d${counter - 1}`).evaluate()).total
        return probabilities[roll]
    }

    async doPayment(ids, pay, amount = 0) {
        const tracked = await this.getTrackedHeros()
        const template = await renderTemplate('systems/dsa5/templates/dialog/master-ap-award.html', { selected: ids, amount, tracked, text: game.i18n.localize(game.i18n.format(pay ? "MASTER.payText" : "MASTER.getPaidText", { heros: game.i18n.localize("MASTER.theGroup") })) })
        const callback = (dlg) => {
            const number = dlg.find('.input-text').val()
            if (!isNaN(number)) {
                const actors = [] 
                dlg.find('.heroSelector:checked').each((i, elem) => actors.push(game.actors.get(elem.value)))
                for (let hero of actors)
                    DSA5Payment.handlePayAction(undefined, pay, number, hero)
            }

        }
        this.buildDialog(game.i18n.localize(pay ? 'MASTER.payTT' : 'PAYMENT.payButton'), template, callback)
    }

    async getPaid(ids) {
        this.doPayment(ids, false)
    }

    async getExp(ids, amount = 0) {
        const tracked = await this.getTrackedHeros()
        const template = await renderTemplate('systems/dsa5/templates/dialog/master-ap-award.html', { selected: ids, tracked, amount, text: game.i18n.localize(game.i18n.format("MASTER.awardXPText", { heros: game.i18n.localize('MASTER.theGroup') })) })
        const callback = async(dlg) => {
            const number = Number(dlg.find('.input-text').val())
            const familiarXP = Math.max(1, Math.round(number * 0.25))
            const heros = []
            const familiars = []
            const actors = [] 
            dlg.find('.heroSelector:checked').each((i, elem) => actors.push(game.actors.get(elem.value)))
            
            if (!isNaN(number)) {
                for (const actor of actors) {
                    let xpBonus = number
                    if (actor.system.isFamiliar || actor.system.isPet) {
                        xpBonus = familiarXP
                        familiars.push(actor)
                    } else {
                        heros.push(actor)
                    }

                    await actor.update({ "system.details.experience.total": actor.system.details.experience.total + xpBonus });
                }
                const message = []
                if (heros.length > 0) message.push(game.i18n.format('MASTER.xpMessage', { heros: this.getNames(heros), number }))
                if (familiars.length > 0) message.push(game.i18n.format('MASTER.xpMessage', { heros: this.getNames(familiars), number: familiarXP }))

                if(message.length > 0) await ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${message.join("</p><p>")}</p>`))

                if(this.rendered) this.render(true)
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
                await this.setTrackedHeros(tracked)
                this.render(true)
            }
            const isFolder = $(event.target).closest('.isFolder')
            const settings = expandObject(game.settings.get("dsa5", "masterSettings"))
            if(isFolder.length){
                settings.folders = settings.folders.map(x => {
                    x.content = x.content.filter(y => y != data.id)

                    if(x.id == isFolder[0].dataset.id) x.content.push(data.id)
                    return x
                })

            } else {
                settings.folders = settings.folders?.map(x => {
                    x.content = x.content.filter(y => y != data.id)
                    return x
                }) || []
            }
            await game.settings.set("dsa5", "masterSettings", settings)
            this.render(true)
        }
    }

    selectedIDs() {
        let ids = []
        const selected = this.getSelectedActors()
        for (const [key, value] of Object.entries(selected)) {
            if (value && game.actors.has(key)) ids.push(key)
        }
        if(!ids.length) return game.settings.get("dsa5", "trackedActors").actors || []
        return ids
    }

    async doGroupCheck(amount = 0) {
        const [skill, type] = this.lastSkill.split("|")
        if (type != "skill") return

        const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.html', { amount, text: game.i18n.localize(game.i18n.format("MASTER.doGroupCheck", { skill })) })
        const callback = (dlg) => {
            const number = Number(dlg.find('.input-text').val())
            const [skill, type] = this.lastSkill.split("|")
            if (type != "skill") return

            RequestRoll.showGCMessage(skill, number)
        }
        this.buildDialog(game.i18n.localize('HELP.groupcheck'), template, callback)
    }

    async rollRequest(amount = 0){
        const [skill, type] = this.lastSkill.split("|")

        if (!["attribute", "skill", "regeneration"].includes(type)) return

        const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.html', { amount, text: game.i18n.localize(game.i18n.format("MASTER.doRequestRoll", { skill })) })
        const callback = (dlg) => {
            const number = Number(dlg.find('.input-text').val())
            const [skill, type] = this.lastSkill.split("|")
            if(!["attribute", "skill"].includes(type)) return

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
            classes: options.classes.concat(["dsa5", "largeDialog", "masterMenu", "sheet"]),
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
            await this.setTrackedHeros(heros.map(x => x.id))
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
            lightSightCompensationEnabled: game.settings.get("dsa5", "lightSightCompensationEnabled"),
            visions,
            darkness: canvas.scene?.environment.darknessLevel || 0
        }

        this.heros = heros
        const selected = this.getSelectedActors()
        const masterSettings = expandObject(game.settings.get("dsa5", "masterSettings"))
        const copiedHeros = []
        const folders = (masterSettings.folders || []).map(x => {
            x.contents = []
            x.content = new Set(x.content)
            return x
        })
        for (let hero of heros) {
            let newHero = duplicate(hero)
            let disadvantages = []
            let advantages = []
            let purse = []
            for(let x of newHero.items){
                switch(x.type){
                    case "disadvantage":
                        disadvantages.push({ name: x.name, uuid: x.uuid })
                        break
                    case "advantage":
                        advantages.push( { name: x.name, uuid: x.uuid })
                        break
                    case "money":
                        purse.push(x)
                        break
                }
            }
            mergeObject(newHero, {
                id: hero.id,
                uuid: hero.uuid,
                selected: selected[hero.id],
                schips: hero.schipshtml(),
                purse: purse
                    .sort((a, b) => b.system.price.value - a.system.price.value)
                    .map(x => `<span data-tooltip="${x.name}">${x.system.quantity.value}</span>`).join(" - "),
                advantages,
                disadvantages,
                system: {
                    status: {
                        wounds: { max: hero.system.status.wounds.max },
                        astralenergy: { max: hero.system.status.astralenergy.max },
                        karmaenergy: { max: hero.system.status.karmaenergy.max },
                    },
                    isMage: hero.system.isMage,
                    isPriest: hero.system.isPriest,
                }
            })

            let found = false
            for(let folder of folders) {
                if(folder.content.has(hero.id)) {
                    folder.contents.push(newHero)
                    found = true
                    break
                }
            }
            if(!found) copiedHeros.push(newHero)
        }

        if (!this.abilities) {
            const skills = (await DSA5_Utility.allSkillsList())
            this.abilities = skills.map(x => { return { name: x, type: "skill" } })
                .concat(Object.values(game.dsa5.config.characteristics).map(x => {
                    return { name: game.i18n.localize(x), type: "attribute" }
                }).concat({ name: game.i18n.localize('regenerate'), type: "regeneration" })).sort((x, y) => x.name.localeCompare(y.name))
        }

        mergeObject(data, {
            hasHeros: heros.length > 0,
            heros: copiedHeros,
            folders,
            abilities: this.abilities,
            groupschips,
            masterSettings,
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

class GlobalModAddition extends FormApplication {
    constructor(id) {
        super()
        this.mod_id = id
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.template = 'systems/dsa5/templates/system/global-mod-addition.html'
        options.title= game.i18n.localize("MASTER.addGlobalMod")
        options.width = 400
        options.resizable = true
        return options;
    }

    activateListeners(html) {
        super.activateListeners(html)

        html.find('.addGlobalMod').click((ev) => this.addGlobalMod(ev))
    }

    async getData(options) {
        const data = await super.getData(options);
        if(this.mod_id) {
            data.config = expandObject(game.settings.get("dsa5", "masterSettings").globalMods[this.mod_id])
        } else {
            data.config = {
                value: 0,
                victim: {
                    npc: true,
                    player: true
                }
            }
        }
        data.categories = ["skill", "spell", "meleeweapon", "rangeweapon", "ritual", "ceremony", "liturgy", "trait" ]
        return data
    }

    async addGlobalMod(ev) {
        ev.preventDefault()
        const settings = expandObject(game.settings.get("dsa5", "masterSettings"))

        const data = expandObject(new FormDataExtended($(this._element).find('form')[0]).object)
        data.enabled = true

        if(!data.name) return

        if(this.mod_id) {
            settings.globalMods[this.mod_id] = data
        } else {
            mergeObject(settings, {
                globalMods: {
                    [randomID()]: data
                }
            })
        }
        await game.settings.set("dsa5", "masterSettings", settings)
        game.dsa5.apps.gameMasterMenu.render()
        this.close()
    }
}