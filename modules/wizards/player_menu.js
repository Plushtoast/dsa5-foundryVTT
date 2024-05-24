import Actordsa5 from "../actor/actor-dsa5.js";
import DSA5Dialog from "../dialog/dialog-dsa5.js";
import OpposedDsa5 from "../system/opposed-dsa5.js";
import RuleChaos from "../system/rule_chaos.js";
import TraitRulesDSA5 from "../system/trait-rules-dsa5.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import { tabSlider } from "../system/view_helper.js";
import { PlayerMenuSubApp } from './player_menu_subapps.js'
const { getProperty, setProperty, mergeObject } = foundry.utils

//TODO magical weapon resistance

export default class PlayerMenu extends Application {
    constructor(app) {
        super(app)
        this.entityAbilities = []

        game.dsa5.apps.PlayerMenuSubApp = PlayerMenuSubApp
        this.summoningModifiers = [{
                id: 1,
                name: 'CONJURATION.offensiveImprovement',
                descr: "CONJURATION.offensiveImprovementDescr",
                changes: [
                    { key: "system.meleeStats.attack", mode: 2, value: 2 },
                    { key: "system.meleeStats.damage", mode: 2, value: 4 },
                    { key: "system.rangeStats.attack", mode: 2, value: 2 },
                    { key: "system.rangeStats.damage", mode: 2, value: 4 }
                ]
            },
            {
                id: 2,
                name: 'CONJURATION.defensiveImprovement',
                descr: "CONJURATION.defensiveImprovementDescr",
                changes: [
                    { key: "system.meleeStats.parry", mode: 2, value: 2 },
                    { key: "system.totalArmor", mode: 2, value: 2 },
                    { key: "system.status.wounds.gearmodifier", mode: 2, value: 10 }
                ]
            },
            {
                id: 3,
                name: 'CONJURATION.speedImprovement',
                descr: "CONJURATION.speedImprovementDescr",
                changes: [
                    { key: "system.status.speed.gearmodifier", mode: 2, value: 2 },
                    { key: "system.status.dodge.gearmodifier", mode: 2, value: 2 }
                ]
            },
            { id: 4, name: 'CONJURATION.magicalImprovement', descr: "CONJURATION.magicalImprovementDescr", changes: [], fun: RuleChaos.magicalImprovement },
            {
                id: 5,
                name: 'CONJURATION.resistanceImprovement',
                descr: "CONJURATION.resistanceImprovementDescr",
                changes: [
                    { key: "system.status.soulpower.gearmodifier", mode: 2, value: 2 },
                    { key: "system.status.toughness.gearmodifier", mode: 2, value: 2 }
                ]
            },
            {
                id: 6,
                name: 'CONJURATION.mentalImprovement',
                descr: "CONJURATION.mentalImprovementDescr",
                changes: [
                    { key: "system.characteristics.mu.gearmodifier", mode: 2, value: 2 },
                    { key: "system.characteristics.kl.gearmodifier", mode: 2, value: 2 },
                    { key: "system.characteristics.in.gearmodifier", mode: 2, value: 2 },
                    { key: "system.characteristics.ch.gearmodifier", mode: 2, value: 2 }
                ]
            },
            {
                id: 7,
                name: 'CONJURATION.physicalImprovement',
                descr: "CONJURATION.physicalImprovementDescr",
                changes: [
                    { key: "system.characteristics.ff.gearmodifier", mode: 2, value: 2 },
                    { key: "system.characteristics.ge.gearmodifier", mode: 2, value: 2 },
                    { key: "system.characteristics.ko.gearmodifier", mode: 2, value: 2 },
                    { key: "system.characteristics.kk.gearmodifier", mode: 2, value: 2 }
                ]
            }
        ]

        this.conjurationData = {
                qs: 0,
                consumedQS: 0,
                packageModifier: 0,
                selectedIds: [],
                selectedEntityIds: [],
                selectedPackageIds: [],
                conjurationTypes: {
                    1: game.i18n.localize("CONJURATION.demon"),
                    2: game.i18n.localize("CONJURATION.elemental")
                },
                rules: {
                    1: { de: { pack: "dsa5-core.corerules", name: "Beschwörungen" }, en: { pack: "dsa5-core.coreenrules", name: "Summoning" } },
                    2: { de: { pack: "dsa5-core.corerules", name: "Beschwörungen" }, en: { pack: "dsa5-core.coreenrules", name: "Summoning" } }
                },
                conjurationType: 1,
                skills: {
                    1: ["invocatioMinima", "invocatioMinor", "invocatioMaior"].map(x => game.i18n.localize(`LocalizedIDs.${x}`)),
                    2: ["manifesto", "elementalServant", "callDjinn", "servantEarth", "servantFlame", "servantCold", "servantWave", "servantCloud", "servantOre"].map(x => game.i18n.localize(`LocalizedIDs.${x}`))
                },
                modifiers: {
                    1: this.summoningModifiers,
                    2: this.summoningModifiers
                },
                moreModifiers: {
                    2: [
                        { name: game.i18n.localize('CONJURATION.groupSummoning'), options: [1, 2, 3, 4, 5, 6, 7, 8].map(x => { return { name: x, val: x * -2 + 2 } }) }
                    ]
                },
                postFunction: {}
            },
            this.subApps = []
    }

    registerSubApp(app) {
        this.subApps.push(app)
    }

    async rollConjuration(ev) {
        if (!this.conjuration) return ui.notifications.warn(game.i18n.localize("CONJURATION.dragConjuration"))

        const itemId = $(ev.currentTarget).closest('.item').attr("data-item-id")
        const skill = this.actor.items.get(itemId);
        const moreModifiers = [
            { name: game.i18n.localize("conjuringDifficulty"), value: getProperty(this.conjuration, "system.conjuringDifficulty.value") || 0, selected: true }
        ]
        if (this.conjurationData.packageModifier)
            moreModifiers.push({ name: game.i18n.localize("summoningPackage"), value: this.conjurationData.packageModifier, selected: true })

        if (this.conjurationData.moreModifiers[this.conjurationData.conjurationType]) {
            const mods = this.conjurationData.moreModifiers[this.conjurationData.conjurationType].filter(x => x.selected)
            for (const mod of mods) {
                moreModifiers.push({ name: mod.name, value: Number(mod.selected), selected: true })
            }
        }

        this.actor.setupSkill(skill, { moreModifiers, subtitle: ` (${this.conjuration.name})` }, undefined).then(async(setupData) => {
            const res = await this.actor.basicTest(setupData)
            this.conjurationData.qs = res.result.qualityStep || 0
            this.render(true)
        })
    }

    activateListeners(html) {
        super.activateListeners(html)

        tabSlider(html)

        html.find('.conjurationData').change(ev => {
            const elem = $(ev.currentTarget)
            setProperty(this.conjurationData, elem.attr("name"), elem.val())

            if (elem.attr("data-refresh")) this.render()
        })
        html.find('.skill-select').click(ev => this.rollConjuration(ev))
        html.find('.initLibrary').click(async(ev) => {
            $(ev.currentTarget).html('<i class="fas fa-spin fa-spinner"></i>')
            await game.dsa5.itemLibrary.buildEquipmentIndex()
            this.render()
        })
        html.find('.item-edit').click(ev => {
            const itemId = $(ev.currentTarget).closest('.item').attr("data-item-id")
            const item = this.actor.items.get(itemId)
            item.sheet.render(true);
        })
        html.find('.selectableRow').click(ev => this.selectImprovement(ev))
        html.find('.finalizeConjuration').click(() => this.finalizeConjuration())
        html.find('.ruleLink').click((ev) => this.openRules(ev))
        html.find('.openChar').click(() => { this.actor?.sheet.render(true) })
        html.find('.showCC').click(() => { 
            const cc = new game.dsa5.apps.DSACharacterCalculator()
            cc.actor = this.actor
            cc.render(true)
         })
        html.find('.showEntity').click(ev => {
            ev.stopPropagation()
            const fun = async() => {
                (await fromUuid(ev.currentTarget.dataset.uuid)).sheet.render(true)
            }
            fun()
        })
        html.find('.moreModifiers').change(ev => {
            const mod = this.conjurationData.moreModifiers[this.conjurationData.conjurationType].find(x => x.name == ev.currentTarget.dataset.name)
            mod.selected = $(ev.currentTarget).val()
        })

        for (let app of this.subApps) {
            app.activateListeners(html)
        }
    }

    async openRules(ev) {
        const subapp = ev.currentTarget.dataset.subapp
        const rule = (subapp ? this.subApps.find(x => x.constructor.name == subapp).constructor.rulePath : this.conjurationData.rules[this.conjurationData.conjurationType])[game.i18n.lang]
        const fun = async() => {
            const pack = game.packs.get(rule.pack)
            const docs = await pack.getDocuments({ name: rule.name })
            for (let doc of docs) {
                doc.sheet.render(true)
            }
        }
        fun()
    }

    finalizeConjuration() {
        if (!this.conjurationData) return

        if (!this.conjuration) return ui.notifications.warn(game.i18n.localize('DSAError.noConjurationActive'))

        const modifiers = []
        for(let sel of this.conjurationData.selectedIds) {
            modifiers.push(this.conjurationData.modifiers[this.conjurationData.conjurationType].find(x => x.id == sel))
        }
        const payload = {
            source: this.conjuration.toObject(),
            creationData: {
                type: this.conjurationData.conjurationType,
                typeName: this.conjurationData.conjurationTypes[this.conjurationData.conjurationType],
                qs: this.conjurationData.qs,
                consumedQS: this.conjurationData.consumedQS,
                modifiers,
                entityIds: this.conjurationData.selectedEntityIds,
                packageIds: this.conjurationData.selectedPackageIds
            },
            summoner: { name: this.actor.name, img: this.actor.img }
        }

        if (game.user.isGM) {
            PlayerMenu.createConjuration(payload)
        } else {
            game.socket.emit("system.dsa5", {
                type: "summonCreature",
                payload
            })
            ui.notifications.notify(game.i18n.localize('CONJURATION.requestSend'))
        }
    }

    static createConjuration({ source, creationData, summoner }) {
        new ConjurationRequest(source, summoner, creationData).render(true)
    }

    selectImprovement(ev) {
        const max = Number(ev.currentTarget.dataset.max) || 1
        const selected = Number(ev.currentTarget.dataset.selected) || 0

        if(selected >= max) {
            $(ev.currentTarget).removeClass("selected")
        } else {
            $(ev.currentTarget).addClass("selected")
            ev.currentTarget.dataset.selected = selected + 1
        }
        const selectedIds = []
        const selectedEntityIds = []
        const selectedPackageIds = []
        let entityCost = 0
        let packageModifier = 0
        $(this._element).find('.selectableRow.selected').each((index, element) => {
            for(let i=0;i<Number(element.dataset.selected);i++) {
                if (element.dataset.entityid) {
                    selectedEntityIds.push(element.dataset.id)
                    entityCost += (Number(element.dataset.qs) || 0) * -1
                } else if (element.dataset.packageid) {
                    selectedPackageIds.push(element.dataset.id)
                    packageModifier += (Number(element.dataset.mod) || 0)
                } else {
                    selectedIds.push(Number(element.dataset.id))
                }
            }
        })
        this.conjurationData.selectedIds = selectedIds
        this.conjurationData.selectedEntityIds = selectedEntityIds
        this.conjurationData.selectedPackageIds = selectedPackageIds
        this.conjurationData.consumedQS = selectedIds.length + entityCost
        this.conjurationData.packageModifier = packageModifier
        this.render()
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [
            { navSelector: ".tabs", contentSelector: ".content", initial: "summoning" }
        ]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "largeDialog", "playerMenu", "sheet"]),
            width: 500,
            height: 740,
            title: game.i18n.localize("PLAYER.title"),
            dragDrop: [{ dragSelector: null, dropSelector: null }]
        });
        options.template = 'systems/dsa5/templates/system/playermenu.html'
        options.resizable = true
        return options;
    }

    _canDragDrop(selector) {
        return true
    }

    async _onDrop(event) {
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData('text/plain'));
            switch(data.type) {
                case "Actor":
                    data = await Actor.implementation.fromDropData(data)
                    break
                case "Item":
                    data = await Item.implementation.fromDropData(data)
                    break
            }
        } catch (err) {
            return false;
        }
        if (data.documentName == "Actor") {
            const actor = game.actors.get(data.id)

            if (actor.type == "creature" || $(event.target).closest('.summoningArea').length > 0) {
                this.conjuration = actor
                this.conjurationData.selectedIds = []
                this.conjurationData.selectedEntityIds = []
                this.conjurationData.selectedPackageIds = []
                if (actor.type == "creature") {
                    for (const key of Object.keys(this.conjurationData.conjurationTypes)) {
                        if (actor.system.creatureClass.value.includes(this.conjurationData.conjurationTypes[key])) {
                            this.conjurationData.conjurationType = key
                            break
                        }
                    }
                }
            } else {
                this.trackedId = data.id
                this.actor = actor
            }
            this.render(true)
        } else {
            for (let app of this.subApps) {
                const res = await app._onDrop(data)
                if(res === true) break
            }
        }
    }

    async prepareEntityAbilities() {
        const data = { entityAbilities: [], entityPackages: [] }
        if (game.dsa5.itemLibrary.equipmentBuild) {
            const entitiesToSearch = [game.i18n.localize("LocalizedIDs.all"), this.conjurationData.conjurationTypes[this.conjurationData.conjurationType]]
            const items = await Promise.all((await game.dsa5.itemLibrary.getCategoryItems("trait", false)).map(x => x.getItem()))

            let entitySet = new Set()
            let packageSet = new Set()
            for (const x of items) {
                if (x.system.distribution && entitiesToSearch.some(y => x.system.distribution.includes(y))) {
                    if (x.system.traitType.value == "entity" && !entitySet.has(x.name)) {
                        entitySet.add(x.name)
                        data.entityAbilities.push(x)
                        x.count = this.conjurationData.selectedEntityIds.filter(y => y == x.uuid).length
                        x.max = x.system.at.value || 1
                    } else if (x.system.traitType.value == "summoning" && !packageSet.has(x.name)) {
                        packageSet.add(x.name)
                        x.count = this.conjurationData.selectedPackageIds.filter(y => y == x.uuid).length
                        data.entityPackages.push(x)
                    }
                }
            }
        }
        return data
    }

    async getData(options) {
        const data = await super.getData(options);

        if (!game.user.isGM && !this.actor) this.actor = game.user.character

        if (this.actor) {
            const services = this.conjurationData.qs - this.conjurationData.consumedQS + 1
            const equipmentIndexLoaded = game.dsa5.itemLibrary.equipmentBuild
            const { entityAbilities, entityPackages } = await this.prepareEntityAbilities()
            const conjurationskills = this.actor.items.filter(x => this.conjurationData.skills[this.conjurationData.conjurationType].includes(x.name) && ["liturgy", "ceremony", "spell", "ritual"].includes(x.type)).map(x => x.toObject())

            let hasMighty = false
            for(let skill of conjurationskills){
                skill.hasMighty = this.actor.items.find(x => x.name == `${skill.name} - ${game.i18n.localize("CONJURATION.powerfulCreature")}`)
                hasMighty ||= skill.hasMighty
            }
            const conjurationModifiers = this.conjurationData.modifiers[this.conjurationData.conjurationType]
            const max = hasMighty ? 2 : 1
            for(let mod of conjurationModifiers) {
                mod.max = max
                mod.count = this.conjurationData.selectedIds.filter(x => x == mod.id).length
            }

            let moreModifiers = this.conjurationData.moreModifiers[this.conjurationData.conjurationType]

            if (moreModifiers){
                moreModifiers = duplicate(moreModifiers)
                for(let item of moreModifiers) {
                    item.options = item.options.map(x => {
                        x.label = `${x.name} (${x.val})`
                        return x
                    })
                }
            }            
            
            const conjurationSheet = await renderTemplate("systems/dsa5/templates/system/conjuration/summoning.html", {
                actor: this.actor,
                conjuration: this.conjuration || { name: game.i18n.localize('CONJURATION.dragConjuration'), img: "icons/svg/mystery-man-black.svg" },
                conjurationData: this.conjurationData,
                services,
                conjurationModifiers,
                equipmentIndexLoaded,
                entityAbilities,
                entityPackages,
                moreModifiers,
                hasMighty
            })


            mergeObject(data, {
                conjurationSheet,
                conjurationskills
            })
        }

        mergeObject(data, {
            actor: this.actor || { name: game.i18n.localize("CONJURATION.dragActor"), img: "icons/svg/mystery-man-black.svg" },
            conjurationData: this.conjurationData,
            conjurationTypes: this.conjurationData.conjurationTypes,
            canCalculate: DSA5_Utility.moduleEnabled("dsa5-core") && this.actor?.type == "character"
        })
        await this.prepareSubApps(data)
        return data
    }

    async prepareSubApps(data) {
        data.subApps = []
        for (let app of this.subApps) {
            data.subApps.push(await app.prepareApp(data))
        }
    }
}

class ConjurationRequest extends DSA5Dialog {
    constructor(conjuration, summoner, creationData) {
        super({
            title: `${game.i18n.localize("CONJURATION.request")} (${summoner.name})`,
            default: 'ok',
            buttons: {}
        })
        this.conjuration = conjuration
        this.summoner = summoner
        this.creationData = creationData
        this.confirmed = false
    }

    async getData(options) {
        const data = await super.getData(options)
        const uniqueIds = this.uniqueCountIds(this.creationData.entityIds)
        mergeObject(data, {
            conjuration: this.conjuration,
            summoner: this.summoner,
            confirmed: this.confirmed,
            services: this.creationData.qs - this.creationData.consumedQS + 1,
            creationData: this.creationData,
            conjurationModifiers: this.creationData.modifiers,
            entityModifiers: await Promise.all(Object.keys(uniqueIds).map(async x => {
                const res = (await fromUuid(x)).toObject(false)
                res.uuid = x
                res.count = uniqueIds[x]
                res.cost = Number(res.system.AsPCost.value) * uniqueIds[x]
                return res
            })),
            packageModifiers: await Promise.all(this.creationData.packageIds.map(x => fromUuid(x))),
            actor: this.actor
        })
        return data
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "main" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "largeDialog"]),
            width: 470,
        });
        options.template = 'systems/dsa5/templates/system/conjuration/request.html'
        return options;
    }

    uniqueCountIds(uids) {
        return uids.reduce((acc, curr) => {
            return acc[curr] ? ++acc[curr] : acc[curr] = 1, acc
        }, {})
    }

    async createActor() {
        this.confirmed = true
        const head = await DSA5_Utility.getFolderForType("Actor", null, game.i18n.localize('PLAYER.conjuration'))
        const folder = await DSA5_Utility.getFolderForType("Actor", head.id, this.creationData.typeName)
        const services = this.creationData.qs - this.creationData.consumedQS + 1
        this.conjuration.folder = folder.id
        if (!this.conjuration.effects) this.conjuration.effects = []

        for (let modifier of this.creationData.modifiers) {
            this.conjuration.effects.push({
                "changes": modifier.changes,
                "duration": {},
                "icon": "icons/svg/aura.svg",
                "label": game.i18n.localize(modifier.name),
                "flags": {
                    "dsa5": {
                        "description": `${game.i18n.localize('PLAYER.conjuration')} ${game.i18n.localize('extensions')}`,
                        "hideOnToken": true,
                        "hidePlayers": false
                    }
                }
            })
            if (modifier.fun) {
                modifier.fun(this.conjuration, this.creationData)
            }
        }

        const uniqueIds = this.uniqueCountIds(this.creationData.entityIds)
        const entityAbilities = (await Promise.all(Object.keys(uniqueIds).map(x => fromUuid(x)))).map(x => {
            const res = x.toObject(false)

            if(uniqueIds[x.uuid] > 1) res.system.step = { value: uniqueIds[x.uuid] }
            return res
        })

        const entityPackages = (await Promise.all(this.creationData.packageIds.map(x => fromUuid(x)))).map(x => x.toObject(false))
            //this.conjuration.items.push(...entityAbilities, ...entityPackages)
        this.conjuration.effects.push({
            "changes": [],
            "duration": {},
            "icon": "icons/svg/aura.svg",
            "id": "services",
            "name": game.i18n.localize('PLAYER.services'),
            "flags": {
                "dsa5": {
                    "value": services,
                    "max": 500,
                    "description": `${game.i18n.localize('PLAYER.conjuration')} ${game.i18n.localize('PLAYER.services')}`,
                    "manual": services,
                    "auto": 0,
                    "hideOnToken": true,
                    "hidePlayers": false
                }
            }
        })

        if (game.dsa5.apps.playerMenu.conjurationData.postFunction[this.creationData.type]) {
            await game.dsa5.apps.playerMenu.conjurationData.postFunction[this.creationData.type](this.conjuration, this.creationData.qs - this.creationData.consumedQS, this.creationData.type)
        }

        if (this.conjuration.type == "creature" && !(this.conjuration.system.creatureClass.value.includes(this.creationData.typeName))) {
            this.conjuration.system.creatureClass.value += `, ${this.creationData.typeName}`
        }

        this.actor = await Actordsa5.create(this.conjuration)

        const itemsToAdd = [...entityAbilities, ...entityPackages].filter(x => !this.conjuration.items.find(y => y.type == x.type && x.name == y.name))
        await this.actor.createEmbeddedDocuments("Item", itemsToAdd)

        for (let item of entityPackages)
            await TraitRulesDSA5.traitAdded(this.actor, item)

        for (let item of entityAbilities)
            await TraitRulesDSA5.traitAdded(this.actor, item)

        await this.actor.update({ "system.status.wounds.value": this.actor.system.status.wounds.max })

        const chatmsg = await renderTemplate("systems/dsa5/templates/system/conjuration/chat.html", {
            actor: this.actor,
            modifiers: this.creationData.modifiers,
            summoner: this.summoner,
            summonerImg: OpposedDsa5.videoOrImgTag(this.summoner.img),
            conjureImg: OpposedDsa5.videoOrImgTag(this.actor.img),
            services
        })
        await ChatMessage.create(DSA5_Utility.chatDataSetup(chatmsg));
        this.render()
    }

    activateListeners(html) {
        super.activateListeners(html)

        html.find('.createActor').click(() => {
            this.createActor()
        })

        html.on('mousedown', '.newNPC', async(ev) => {
            const id = ev.currentTarget.dataset.id
            if (ev.button == 2) {
                game.actors.get(id).delete()
                $(ev.currentTarget).remove()
            }
        })
        html.on('click', '.newNPC', async(ev) => {
            const id = ev.currentTarget.dataset.id
            game.actors.get(id).sheet.render(true)
        })

        html.on("dragstart", ".newNPC", event => {
            event.stopPropagation();
            const a = event.currentTarget;
            let dragData = { type: "Actor", uuid: a.dataset.uuid };
            event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        })
        html.find('.showEntity').click(ev => {
            ev.stopPropagation()
            const fun = async() => {
                (await fromUuid(ev.currentTarget.dataset.uuid)).sheet.render(true)
            }
            fun()
        })
    }
}