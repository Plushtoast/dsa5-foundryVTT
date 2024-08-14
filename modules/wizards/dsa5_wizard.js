import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js"
import DSA5 from "../system/config-dsa5.js"
import ItemRulesDSA5 from "../system/item-rules-dsa5.js"
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js"
import DSA5_Utility from "../system/utility-dsa5.js"
import { clickableAbility, tabSlider } from "../system/view_helper.js"
const { mergeObject, duplicate, getProperty } = foundry.utils

export default class WizardDSA5 extends Application {
    constructor(app) {
        super(app)
        this.actor = null
        this.errors = []
        this.attributes = []
        this.updating = false
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "description" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "largeDialog", "generationWizard"]),
            width: 770,
            height: 740,
        });
        options.resizable = true
        return options;
    }

    async findCompendiumItem(name, types){
        for(let type of types){
            //todo make sure this loads the right thing e.g. armory instead of core
            let result = await game.dsa5.itemLibrary.findCompendiumItem(name, type)
            result = result.find((x) => x.name == name && x.type == type && x.system)

            if(result) return result
        }
        return undefined
    }

    _parseAttributes(attr, splitter = ",") {
        const result = []
        const splstr = game.i18n.localize("combatskillcountdivider") + ":"
        for (let k of attr.split(splitter)) {
            if (k.includes(splstr)) {
                const vals = k.split(":")
                result.push({
                    choices: vals[1].split("/").map(x => x.trim()),
                    allowedCount: Number(vals[0].match(/\d/g))
                })
            }
        }
        return result
    }

    async parseToItem(value, types) {
        if (value.trim() == "")
            return []

        return await Promise.all(value.split(", ").map(async(x) => {
            let parsed = DSA5_Utility.parseAbilityString(x.trim())
            let item = await this.findCompendiumItem(parsed.original, types)
            if (!item) {
                item = await this.findCompendiumItem(parsed.name, types)
            }
            if (!item) {
                if (this.attributes.includes(parsed.name)) {
                    let cost = 0

                    for (let i = this.actor.system.characteristics[game.dsa5.config.knownShortcuts[parsed.name.toLowerCase()][1]].value + 1; i < parsed.step + 1; i++) {
                        cost += DSA5.advancementCosts.E[i]
                    }
                    item = {
                        name: parsed.name,
                        step: parsed.step,
                        attributeRequirement: true,
                        apCost: cost,
                        system: {
                            APValue: {
                                value: cost
                            }
                        }
                    }
                } else {
                    console.warn(`Not found <${x}>`)
                    const langCats = types.map(x => DSA5_Utility.categoryLocalization(x)).join("/")
                    this.errors.push(`${langCats}: ${x}`)
                    item = {
                        name: x.trim(),
                        notFound: true,
                        tooltip: game.i18n.localize('DSAError.itemNotFound'),
                        apCost: "?"
                    }
                }
            } else {
                const uuid = item.uuid
                item = duplicate(item)
                item.uuid = uuid
                item.tooltip = game.i18n.localize("Details")
                item = ItemRulesDSA5.reverseAdoptionCalculation(this.actor, parsed, item)
                if (item.system.APValue) {
                    item.APunparseable = isNaN(item.system.APValue.value)
                    item.apCost = item.APunparseable ? item.system.APValue.value : parsed.step * Number(item.system.APValue.value)
                }
            }
            item.replaceName = parsed.original
            item.step = parsed.step
            let actorHasItem = this.actor.items.find(y => types.includes(y.type) && y.name == parsed.original) != undefined
            item.disabled = actorHasItem || item.notFound || item.APunparseable
            if (actorHasItem)
                item.tooltip = game.i18n.localize("YouAlreadyHaveit")
            return item
        }))
    }

    mergeLevels(itemsToAdd, item, keyMax) {
        let merged = false
        let existing = itemsToAdd.find(x => x.name == item.name && x.type == item.type)
        if (existing) {
            merged = true
            let level = Number(getProperty(item, "system.step.value"))
            if (level) {
                existing.system.step.value = Math.min(existing.system.step.value += level, existing.system[keyMax].value)
            }
        } else {
            itemsToAdd.push(item)
        }
        return merged
    }

    async addSelections(elems, render = true) {
        let itemsToAdd = []

        for (let k of elems) {
            const val = $(k).val()
            if (val == "") continue

            let item = (await fromUuid($(k).val())).toObject()
            let parsed = DSA5_Utility.parseAbilityString(item.name)
            item.name = $(k).attr("name")

            switch (item.type) {
                case "advantage":
                case "disadvantage":
                    item.system.step.value = Number(k.dataset.step)
                    item = ItemRulesDSA5.reverseAdoptionCalculation(this.actor, parsed, item)

                    if (!this.mergeLevels(itemsToAdd, item, "max")) AdvantageRulesDSA5.vantageAdded(this.actor, item)
                    break
                case "specialability":
                    item.system.step.value = Number(k.dataset.step)

                    if (k.dataset.free == "true") item.system.APValue.value = 0

                    item = ItemRulesDSA5.reverseAdoptionCalculation(this.actor, parsed, item)

                    if (!this.mergeLevels(itemsToAdd, item, "maxRank")) SpecialabilityRulesDSA5.abilityAdded(this.actor, item)
                    break
                case "magictrick":
                    this.mergeLevels(itemsToAdd, item)
                    break
            }
        }
        await this.actor.createEmbeddedDocuments("Item", itemsToAdd, { render })
    }

    async fixPreviousCosts(previous, toFix) {
        for(let item of toFix){
            const hasFixable = previous.find(x => x.type == item.type && x.name == item.name)

            if(hasFixable) item.apCost -= hasFixable.apCost
        }
    }

    async alreadyAdded(string, category) {
        if (string == "") return false

        let result = false
        result = await new Promise((resolve, reject) => {
            new Dialog({
                title: game.i18n.localize("DIALOG.warning"),
                content: game.i18n.format('DIALOG.alreadyAddedCharacterpart', { category: DSA5_Utility.categoryLocalization(category) }),
                default: 'ok',
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: game.i18n.localize('Ok'),
                        callback: () => {
                            resolve(false);
                        },
                    },
                    cancel: {
                        icon: '<i class="fas fa-close"></i>',
                        label: game.i18n.localize('Cancel'),
                        callback: () => {
                            resolve(true);
                        },
                    }
                }
            }).render(true);
        });
        return result
    }

    async updateSkill(skills, itemType, factor = 1, bonus = true) {
        let itemsToUpdate = []
        for (let skill of skills) {
            let parsed = DSA5_Utility.parseAbilityString(skill.trim())
            let res = this.actor.items.find(i => { return i.type == itemType && i.name == parsed.name });
            if (res) {
                itemsToUpdate.push({_id: res.id, "system.talentValue.value": Math.max(0, factor * parsed.step + (bonus ? Number(res.system.talentValue.value) : 0))})
            } else {
                console.warn(`Could not find ${itemType} ${skill}`)
                this.errors.push(`${DSA5_Utility.categoryLocalization(itemType)}: ${skill}`)
            }
        }
        await this.actor.updateEmbeddedDocuments("Item", itemsToUpdate, { render: false });
    }

    async getData(options){
        const data = await super.getData(options)
        await game.dsa5.itemLibrary.buildEquipmentIndex()
        return data
    }

    _validateInput(parent, app = this) {
        let regex = /^exclusive_/
        for(let tab of parent.find('.tab')){
            const tb = $(tab)
            let exclusives = new Set()
            for (let k of tb.find('.exclusive')) {
                exclusives.add(k.className.split(/\s+/).filter(x => regex.test(x))[0])
            }
            for (let k of exclusives) {
                let choice = tb.find('.allowedCount_' + k.split("_")[1])
                let allowed = Number(choice.attr('data-count'))
                if (tb.find(`.${k}:checked`).length != allowed) {
                    this._showInputValidation(choice, tb, app)
                    return false
                }
            }
        }
        return true
    }

    _showInputValidation(choice, parent, app){
        ui.notifications.error("DSAError.MissingChoices", { localize: true })
        let tabElem = choice.closest('.tab').attr("data-tab")
        app.activateTab(tabElem)
        WizardDSA5.flashElem(parent.find(`.tabs a[data-tab='${tabElem}']`))
        WizardDSA5.flashElem(choice.closest("div"))
    }

    activateListeners(html) {
        super.activateListeners(html)

        tabSlider(html)
        html.find('button.ok').click(() => {
            if (!this.updating) {
                this.updating = true
                this.updateCharacter($(this._element)).then(
                    () => this.updating = false
                )
            }
        })
        html.find('button.cancel').click(() => { this.close() })

        const itemDragStart = (event) => {
            event.stopPropagation()
            const type = event.currentTarget.dataset.type
            const uuid = event.currentTarget.dataset.uuid
            if(!uuid || !type) return

            event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({
                type,
                uuid
            }))
        }
        const showItem = html.find('.show-item')
        showItem.click(async(ev) => {
            let itemId = ev.currentTarget.dataset.uuid
            const item = await fromUuid(itemId)
            item.sheet.render(true)
        })
        showItem.attr("draggable", true).on("dragstart", event => itemDragStart(event))

        html.on('click', '.searchableAbility a', ev => clickableAbility(ev))

        html.find('.exclusive').change(ev => {
            let parent = $(ev.currentTarget).closest('.tab')
            let sel = $(ev.currentTarget).attr('data-sel')
            let maxDomElem = parent.find(`.allowedCount_${sel}`)
            let maxSelections = Number(maxDomElem.attr("data-count"))
            if (parent.find(`.exclusive_${sel}:checked`).length > maxSelections) {
                ev.currentTarget.checked = false
                WizardDSA5.flashElem(maxDomElem)
                return
            }
        })
    }

    static flashElem(elem, cssClass = "emphasize") {
        elem.addClass(cssClass)
        setTimeout(function() { elem.removeClass(cssClass) }, 600)
    }

    finalizeUpdate() {
        if (this.errors.length == 0) {
            this.close()
        } else {
            $(this._element).find('.dialog-buttons').html(`<div class="error"><p>${game.i18n.localize('DSAError.notUnderstood')}</p><ul><li>${this.errors.join("</li><li>")}</li></ul></div>`)
        }
    }
}