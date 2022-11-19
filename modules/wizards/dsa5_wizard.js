import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js"
import DSA5 from "../system/config-dsa5.js"
import ItemRulesDSA5 from "../system/item-rules-dsa5.js"
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js"
import DSA5_Utility from "../system/utility-dsa5.js"

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
            classes: options.classes.concat(["dsa5", "largeDialog"]),
            width: 770,
            height: 740,
        });
        options.resizable = true
        return options;
    }

    async findCompendiumItem(name, types){
        for(let type of types){
            const results = await game.dsa5.itemLibrary.findCompendiumItem(name, type)
            //todo make sure this loads the right thing e.g. armory instead of core
            if(results.length) return results.find((x) => x.name == name && x.type == type && x.system);
        }
        
        return undefined
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

    mergeLevels(itemsToAdd, item) {
        let merged = false
        let existing = itemsToAdd.find(x => x.name == item.name && x.type == item.type)
        if (existing) {
            merged = true
            let level = Number(getProperty(item, "system.step.value")) 
            if (level) {
                existing.system.step.value += level
            }
        } else {
            itemsToAdd.push(item)
        }
        return merged
    }

    async addSelections(elems) {
        let itemsToAdd = []

        for (let k of elems) {
            const val = $(k).val()
            if (val == "") continue

            let item = await fromUuid($(k).val())
            let parsed = DSA5_Utility.parseAbilityString(item.name)
            item.name = $(k).attr("name")

            switch (item.type) {
                case "advantage":
                case "disadvantage":
                    item.system.step.value = Number($(k).attr("data-step"))
                    item = ItemRulesDSA5.reverseAdoptionCalculation(this.actor, parsed, item)

                    if (!this.mergeLevels(itemsToAdd, item)) AdvantageRulesDSA5.vantageAdded(this.actor, item)
                    break
                case "specialability":
                    item.system.step.value = Number($(k).attr("data-step"))

                    if ($(k).attr("data-free")) item.system.APValue.value = 0

                    item = ItemRulesDSA5.reverseAdoptionCalculation(this.actor, parsed, item)

                    if (!this.mergeLevels(itemsToAdd, item)) SpecialabilityRulesDSA5.abilityAdded(this.actor, item)
                    break
                case "magictrick":
                    this.mergeLevels(itemsToAdd, item)
                    break
            }
        }
        await this.actor.createEmbeddedDocuments("Item", itemsToAdd)
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
                        default: true,
                        callback: () => {
                            resolve(false);
                        },
                    },
                    cancel: {
                        icon: '<i class="fas fa-close"></i>',
                        label: game.i18n.localize('Cancel'),
                        default: true,
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
        await this.actor.updateEmbeddedDocuments("Item", itemsToUpdate);
    }

    async getData(options){
        const data = await super.getData(options)
        await game.dsa5.itemLibrary.buildEquipmentIndex()
        return data
    }

    _validateInput(parent) {
        let exclusives = new Set()
        let regex = /^exclusive_/
        for (let k of parent.find('.exclusive')) {
            exclusives.add(k.className.split(/\s+/).filter(x => regex.test(x))[0])
        }
        for (let k of exclusives) {
            let choice = parent.find('.allowedCount_' + k.split("_")[1])
            let allowed = Number(choice.attr('data-count'))
            if (parent.find(`.${k}:checked`).length != allowed) {
                ui.notifications.error(game.i18n.localize("DSAError.MissingChoices"))
                WizardDSA5.flashElem(choice)
                let tabElem = choice.closest('.tab').attr("data-tab")
                WizardDSA5.flashElem(parent.find(`.tabs a[data-tab='${tabElem}']`))
                return false
            }
        }
        return true
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('button.ok').click(() => {
            if (!this.updating) {
                this.updating = true
                this.updateCharacter().then(
                    () => this.updating = false
                )
            }
        })
        html.find('button.cancel').click(() => { this.close() })
        html.find('.show-item').click(async(ev) => {
            let itemId = $(ev.currentTarget).attr("data-id")
            const item = await fromUuid(itemId)
            item.sheet.render(true)
        })

        html.find('.exclusive').change(ev => {
            let parent = $(ev.currentTarget).closest('.content')
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