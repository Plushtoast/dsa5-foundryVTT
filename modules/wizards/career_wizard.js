import DSA5 from "../system/config-dsa5.js"
import ItemRulesDSA5 from "../system/item-rules-dsa5.js"
import DSA5_Utility from "../system/utility-dsa5.js"
import WizardDSA5 from "./dsa5_wizard.js"

export default class CareerWizard extends WizardDSA5 {
    constructor(app) {
        super(app)
        this.attributes = Object.keys(DSA5.characteristics).map(x => game.i18n.localize(`CHARAbbrev.${x.toUpperCase()}`))
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("Types.Item.career")}` })
        options.template = 'systems/dsa5/templates/wizard/add-career-wizard.html'
        return options;
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('.optional').change(ev => {
            let parent = $(ev.currentTarget).closest('.content')
            if ($(ev.currentTarget).hasClass("exclusiveTricks")) {
                let maxSelections = Number(parent.find('.maxTricks').attr("data-spelltricklimit"))
                if (parent.find('.exclusiveTricks:checked').length > maxSelections) {
                    ev.currentTarget.checked = false
                    WizardDSA5.flashElem(parent.find('.maxTricks'))
                    return
                }
            }
            let apCost = Number(parent.attr("data-cost"))
            parent.find('.optional:checked').each(function() {
                apCost += Number($(this).attr("data-cost"))
            });
            parent.find('.attributes:checked').each(function() {
                apCost += Number($(this).attr("data-cost"))
            });
            let elem = parent.find('.apCost')
            elem.text(apCost)
            WizardDSA5.flashElem(elem, "emphasize2")
        })
    }

    _validateInput(parent) {
        let choice = parent.find('.maxTricks')
        let allowed = Number(choice.attr("data-spelltricklimit")) || 0
        if (parent.find('.exclusiveTricks:checked').length != allowed) {
            ui.notifications.error(game.i18n.localize("DSAError.MissingChoices"))
            WizardDSA5.flashElem(choice)
            let tabElem = choice.closest('.tab').attr("data-tab")
            WizardDSA5.flashElem(parent.find(`.tabs a[data-tab='${tabElem}']`))
            return false
        }
        return super._validateInput(parent)
    }

    async getData(options) {
        const data = await super.getData(options);
        const requirements = await this.parseToItem(this.career.system.requirements.value, ["disadvantage", "advantage", "specialability"])
        const missingVantages = requirements.filter(x => ["advantage", "disadvantage"].includes(x.type) && !x.disabled)
        const advantages = await this.parseToItem(this.career.system.recommendedAdvantages.value, ["advantage"])
        this.fixPreviousCosts(requirements, advantages)
        const disadvantages = await this.parseToItem(this.career.system.recommendedDisadvantages.value, ["disadvantage"])
        this.fixPreviousCosts(requirements, disadvantages)
        const attributeRequirements = requirements.filter(x => x.attributeRequirement)
        const combatskillchoices = this.parseCombatskills(this.career.system.combatSkills.value)
        const baseCost = Number(this.career.system.APValue.value)
        const reqCost = requirements.reduce(function(_this, val) {
            return _this + (val.disabled ? 0 : Number(val.system.APValue.value) || 0)
        }, 0)
        const missingSpecialabilities = requirements.filter(x => x.type == "specialability" && !x.disabled)
        mergeObject(data, {
            title: game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("career")} ${this.career.name}` }),
            career: this.career,
            description: game.i18n.format("WIZARD.careerdescr", { career: this.career.name, cost: baseCost + reqCost }),
            baseCost,
            advantages,
            disadvantages,
            missingVantages,
            missingSpecialabilities,
            combatskillchoices: combatskillchoices,
            spelltricks: await this.parseToItem(this.career.system.spelltricks.value, ["magictrick"]),
            attributeRequirements,
            advantagesToChose: advantages.length > 0,
            disadvantagesToChose: disadvantages.length > 0,
            vantagesToChose: advantages.length > 0 || disadvantages.length > 0 || missingVantages.length > 0,
            missingVantagesToChose: missingVantages.length > 0,
            missingSpecialabiltiesToChose: missingSpecialabilities.length > 0,
            combatToChose: combatskillchoices.length > 0,
            magicToChose: this.career.system.spelltrickCount.value > 0,
            religionToChose: false,
            anyAttributeRequirements: attributeRequirements.length > 0,
            generalToChose: missingSpecialabilities.length > 0 || attributeRequirements.length > 0
        })
        return data
    }

    async addCareer(actor, item) {
        this.actor = actor
        this.career = duplicate(item)
    }

    parseCombatskills(combatskills) {
        let result = []
        for (let k of combatskills.split(/,|;/)) {
            if (k.includes(game.i18n.localize("combatskillcountdivider") + ":")) {
                let vals = k.split(":")
                result.push({
                    choices: vals[1].split("/").map(x => x.trim()),
                    allowedCount: Number(vals[0].match(/\d/g))
                })
            }
        }
        return result
    }

    async setAbility(value, types) {
        if (value.trim() == "")
            return

        let itemsToCreate = []
        let itemsToUpdate = []

        for (let k of value.split(",")) {
            let parsed = DSA5_Utility.parseAbilityString(k.trim())
            let item = this.actor.items.find(x => types.includes(x.type) && x.name == parsed.original)
            if (item) {
                item = duplicate(item)
                if (item.system.talentValue)
                    item.system.talentValue.value = parsed.step
                if (item.system.step)
                    item.system.step.value = parsed.step

                item = ItemRulesDSA5.reverseAdoptionCalculation(this.actor, parsed, item)
                itemsToUpdate.push(item)
            } else {
                item = await this.findCompendiumItem(parsed.original, types)
                if (!item) {
                    item = await this.findCompendiumItem(parsed.name, types)
                }
                if (item) {
                    item = duplicate(item)
                    item.name = parsed.original
                    if (item.system.talentValue)
                        item.system.talentValue.value = parsed.step
                    if (item.system.step)
                        item.system.step.value = parsed.step

                    item = ItemRulesDSA5.reverseAdoptionCalculation(this.actor, parsed, item)
                    itemsToCreate.push(item)
                } else {
                    const langCats = types.map(x => DSA5_Utility.categoryLocalization(x)).join("/")
                    this.errors.push(`${langCats}: ${k}`)
                    ui.notifications.error(game.i18n.format("DSAError.notFound", { category: langCats, name: k }))
                }
            }
        }
        await this.actor.updateEmbeddedDocuments("Item", itemsToUpdate)
        await this.actor.createEmbeddedDocuments("Item", itemsToCreate)
    }

    async addBlessing(blessings, type) {
        let itemsToCreate = []
        for (let k of blessings) {
            let name = k.trim()
            if (name == "") continue
            let item = this.actor.items.find(x => type == x.type && x.name == name)
            if (!item) {
                item = await this.findCompendiumItem(name, [type])
                if (item) {
                    item = duplicate(item)
                    itemsToCreate.push(item)
                } else {
                    this.errors.push(`${DSA5_Utility.categoryLocalization(type)}: ${k}`)
                    ui.notifications.error(game.i18n.format("DSAError.notFound", { category: game.i18n.localize(type), name: name }))
                }
            }
        }
        await this.actor.createEmbeddedDocuments("Item", itemsToCreate)
    }

    async updateCharacter() {
        let parent = $(this._element)
        parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")

        let apCost = Number(parent.find('.apCost').text())
        if (!this._validateInput($(this._element)) || !(await this.actor.checkEnoughXP(apCost)) || await this.alreadyAdded(this.actor.system.details.career.value, "career")) {
            parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")
            return
        }

        let update = {
            "system.details.career.value": this.career.name,
            "system.freeLanguagePoints.value": this.career.system.languagePoints.value
        }
        for (let k of parent.find('.attributes')) {
            let attr = $(k).attr("data-attribute").toLowerCase()
            attr = game.dsa5.config.knownShortcuts[attr.toLowerCase()][1]
            if (Number(this.actor.system.characteristics[attr].initial) + Number(this.actor.system.characteristics[attr].advances) < Number($(k).val())) {
                if (this.actor.canAdvance)
                    update[`system.characteristics.${attr}.advances`] = Number($(k).val()) - Number(this.actor.system.characteristics[attr].initial)
                else
                    update[`system.characteristics.${attr}.initial`] = Number($(k).val())
            }
        }

        if (this.career.system.mageLevel.value != "mundane") {
            update[`system.guidevalue.${this.career.system.mageLevel.value}`] = this.career.system.guidevalue.value
            update[`system.energyfactor.${this.career.system.mageLevel.value}`] = this.career.system.guidevalue.factor
            update[`system.tradition.${this.career.system.mageLevel.value}`] = this.career.system.tradition.value
            update[`system.feature.${this.career.system.mageLevel.value}`] = this.career.system.feature.value
        }
        if (this.career.system.mageLevel.value == "clerical") {
            update["system.happyTalents.value"] = this.career.system.happyTalents.value
            await this.setAbility(this.career.system.liturgies.value, ["liturgy", "ceremony"])
            await this.addBlessing(this.career.system.blessings.value.split(","), "blessing")
        }
        if (this.career.system.mageLevel.value == "magical") {
            await this.setAbility(this.career.system.spells.value, ["spell", "ritual"])
        }

        await this.setAbility(this.career.system.specialAbilities.value, ["specialability"])
        await this.actor.update(update);
        await this.actor._updateAPs(apCost)
        await this.addSelections(parent.find('.optional:checked'))
        await this.updateSkill(this.career.system.skills.value.split(","), "skill")

        let combatSkillselectChoices = []
        for (let k of parent.find('.exclusive:checked')) {
            combatSkillselectChoices.push($(k).val())
        }

        const combatSkills = this.career.system.combatSkills.value.split(",").concat(combatSkillselectChoices)
            .filter(skill => !(skill.includes(game.i18n.localize("combatskillcountdivider") + ":") || skill == ""))
        await this.updateSkill(combatSkills, "combatskill", 1, false)

        this.finalizeUpdate()
    }
}