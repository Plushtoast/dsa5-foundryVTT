import DSA5_Utility from "../system/utility-dsa5.js"
import WizardDSA5 from "./dsa5_wizard.js"

export default class CareerWizard extends WizardDSA5 {
    constructor(app) {
        super(app)
        this.items = []
        this.actor = null
        this.career = null
        this.dataTypes = ["magictrick", "blessing", "spell", "ritual", "liturgy", "ceremony", "advantage", "disadvantage", "specialability"]
        const attrs = {
            "de": ["MU", "KL", "IN", "CH", "FF", "GE", "KO", "KK"],
            "en": ["COU", "SGC", "INT", "CHA", "DEX", "AGI", "CON", "STR"]
        }
        this.attributes = attrs[game.i18n.lang]

    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("career")}` })
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

    getData() {
        let data = super.getData()
        let advantages = this.parseToItem(this.career.data.recommendedAdvantages.value, ["advantage"])
        let disadvantages = this.parseToItem(this.career.data.recommendedDisadvantages.value, ["disadvantage"])
        let requirements = this.parseToItem(this.career.data.requirements.value, ["disadvantage", "advantage", "specialability"])
        let missingVantages = requirements.filter(x => ["advantage", "disadvantage"].includes(x.type) && !x.disabled)
        let attributeRequirements = requirements.filter(x => x.attributeRequirement)
        let combatskillchoices = this.parseCombatskills(this.career.data.combatSkills.value)
        let baseCost = Number(this.career.data.APValue.value) + requirements.reduce(function(_this, val) {
            return _this + (val.disabled ? 0 : Number(val.data.APValue.value) || 0)
        }, 0)
        let missingSpecialabilities = requirements.filter(x => x.type == "specialabilities" && !item.disabled)
        mergeObject(data, {
            title: game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("career")} ${this.career.name}` }),
            career: this.career,
            description: game.i18n.format("WIZARD.careerdescr", { career: this.career.name, cost: baseCost }),
            baseCost: baseCost,
            advantages: advantages,
            disadvantages: disadvantages,
            missingVantages: missingVantages,
            missingSpecialabilities: missingSpecialabilities,
            combatskillchoices: combatskillchoices,
            spelltricks: this.parseToItem(this.career.data.spelltricks.value, ["magictrick"]),
            attributeRequirements: attributeRequirements,
            advantagesToChose: advantages.length > 0,
            disadvantagesToChose: disadvantages.length > 0,
            vantagesToChose: advantages.length > 0 || disadvantages.length > 0 || missingVantages.length > 0,
            missingVantagesToChose: missingVantages.length > 0,
            missingSpecialabiltiesToChose: missingSpecialabilities.length > 0,
            combatToChose: combatskillchoices.length > 0,
            magicToChose: this.career.data.spelltrickCount.value > 0,
            religionToChose: false,
            anyAttributeRequirements: attributeRequirements.length > 0,
            generalToChose: missingSpecialabilities.length > 0 || attributeRequirements.length > 0
        })
        return data
    }

    async addCareer(actor, item) {
        this.actor = actor
        this.career = duplicate(item)
        await this._loadCompendiae()
    }

    parseCombatskills(combatskills) {
        let result = []
        for (let k of combatskills.split(",")) {
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

        for (let k of value.split(",")) {
            let parsed = DSA5_Utility.parseAbilityString(k.trim())
            let item = this.actor.data.items.find(x => types.includes(x.type) && x.name == parsed.original)
            if (item) {
                item = duplicate(item)
                if (item.data.talentValue)
                    item.data.talentValue.value = parsed.step
                if (item.data.step)
                    item.data.step.value = parsed.step
                await this.actor.updateEmbeddedEntity("OwnedItem", item)
            } else {
                item = this.items.find(x => types.includes(x.type) && x.name == parsed.original)
                if (!item) {
                    item = this.items.find(x => types.includes(x.type) && x.name == parsed.name)
                }
                if (item) {
                    item = duplicate(item)
                    item.name = parsed.original
                    if (item.data.talentValue)
                        item.data.talentValue.value = parsed.step
                    if (item.data.step)
                        item.data.step.value = parsed.step
                    await this.actor.createEmbeddedEntity("OwnedItem", item)
                } else {
                    this.errors.push(`${types.map(x => game.i18n.localize(x)).join("/")}: ${k}`)
                    ui.notifications.error(game.i18n.format("DSAError.notFound", { category: game.i18n.localize(types[0]), name: k }))
                }
            }
        }
    }

    async addBlessing(blessings, type) {
        for (let k of blessings) {
            let name = k.trim()
            let item = this.actor.data.items.find(x => type == x.type && x.name == name)
            if (!item)
                item = this.items.find(x => type == x.type && x.name == name)
            if (item) {
                item = duplicate(item)
                await this.actor.createEmbeddedEntity("OwnedItem", item)
            } else {
                this.errors.push(`${game.i18n.localize(type)}: ${k}`)
                ui.notifications.error(game.i18n.format("DSAError.notFound", { category: game.i18n.localize(type), name: name }))
            }
        }
    }

    /*async deleteOldCareer() {
        if (this.actor.data.data.details.career.value != "") {
            let oldCareer = this.items.find(x => x.name == this.actor.data.data.details.career.value && x.type == "career")
            if (oldCareer) {
                for (let skill of oldCareer.data.data.skills.value.split(",")) {
                    await this.updateSkill(skill, "skill", -1)
                }
            }
        }
    }*/

    async updateCharacter() {
        let parent = $(this._element)
        parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")

        let apCost = Number(parent.find('.apCost').text())
        if (!this._validateInput($(this._element)) || !(await this.actor.checkEnoughXP(apCost)) || await this.alreadyAdded(this.actor.data.data.details.career.value, "career")) {
            parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")
            return
        }

        //await this.deleteOldCareer()

        let update = {
            "data.details.career.value": this.career.name,
            "data.freeLanguagePoints.value": this.career.data.languagePoints.value
        }

        for (let k of parent.find('.attributes')) {
            let attr = $(k).attr("data-attribute").toLowerCase()
            attr = game.dsa5.config.knownShortcuts[attr.toLowerCase()][1]
            console.log(attr)
            if (Number(this.actor.data.data.characteristics[attr].initial) + Number(this.actor.data.data.characteristics[attr].advances) < Number($(k).val())) {
                update[`data.characteristics.${attr}.advances`] = Number($(k).val()) - Number(this.actor.data.data.characteristics[attr].initial)
            }
        }

        if (this.career.data.mageLevel.value != "mundane") {
            update[`data.guidevalue.${this.career.data.mageLevel.value}`] = this.career.data.guidevalue.value
            update[`data.tradition.${this.career.data.mageLevel.value}`] = this.career.data.tradition.value
            update[`data.feature.${this.career.data.mageLevel.value}`] = this.career.data.feature.value
        }
        if (this.career.data.mageLevel.value == "clerical") {
            update["data.happyTalents.value"] = this.career.data.happyTalents.value
            this.setAbility(this.career.data.liturgies.value, ["liturgy", "ceremony"])
            this.addBlessing(this.career.data.blessings.value.split(","), "blessing")
        }
        if (this.career.data.mageLevel.value == "magical") {
            this.setAbility(this.career.data.spells.value, ["spell", "ritual"])
        }

        this.setAbility(this.career.data.specialAbilities.value, ["specialability"])

        await this.actor.update(update);
        await this.actor._updateAPs(apCost)

        await this.addSelections(parent.find('.optional:checked'))

        for (let skill of this.career.data.skills.value.split(",")) {
            await this.updateSkill(skill, "skill")
        }

        let combatSkillselectChoices = []
        for (let k of parent.find('.exclusive:checked')) {
            combatSkillselectChoices.push($(k).val())
        }

        for (let skill of this.career.data.combatSkills.value.split(",").concat(combatSkillselectChoices)) {
            if (skill.includes(game.i18n.localize("combatskillcountdivider") + ":") || skill == "")
                continue

            await this.updateSkill(skill, "combatskill", 1, false)
        }

        this.finalizeUpdate()
    }
}