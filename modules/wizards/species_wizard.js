import WizardDSA5 from "./dsa5_wizard.js"

export default class SpeciesWizard extends WizardDSA5 {
    constructor(app) {
        super(app)
        this.actor = null
        this.culture = null
        this.dataTypes = ["advantage", "disadvantage"]
        this.attributes = []
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("species")}` })
        options.template = 'systems/dsa5/templates/wizard/add-species-wizard.html'
        return options;
    }

    activateListeners(html) {
        super.activateListeners(html)

        html.find('.optional').change(ev => {
            let parent = $(ev.currentTarget).closest('.content')
            let apCost = Number(parent.attr("data-cost"))
            parent.find('.optional:checked').each(function() {
                apCost += Number($(this).attr("data-cost"))
            });
            parent.find('.apCost').text(apCost)
        })

    }

    _toGroups(input, categories) {
        return input.split("\n").map(x => {
            let vals = x.split(":")
            if (vals.length > 1) {
                return {
                    name: vals[0].trim(),
                    res: this.parseToItem(vals[1].trim(), categories)
                }
            } else {
                return {
                    name: "",
                    res: this.parseToItem(x, categories)
                }
            }
        })
    }


    _parseAttributes(attr) {
        let result = []
        for (let k of attr.split(",")) {
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

    getData() {
        let data = super.getData()
        let advantagegroups = this._toGroups(this.species.data.recommendedAdvantages.value, ["advantage"])
        let disadvantagegroups = this._toGroups(this.species.data.recommendedDisadvantages.value, ["disadvantage"])
        let requirements = this.parseToItem(this.species.data.requirements.value, ["disadvantage", "advantage"])
        let missingVantages = requirements.filter(x => ["advantage", "disadvantage"].includes(x.type) && !x.disabled)
        let attributeRequirements = this._parseAttributes(this.species.data.attributeChange.value)
        let baseCost = Number(this.species.data.APValue.value) + requirements.reduce(function(_this, val) {
            return _this + (val.disabled ? 0 : Number(val.data.APValue.value) || 0)
        }, 0)
        mergeObject(data, {
            title: game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("species")} ${this.species.name}` }),
            species: this.species,
            description: game.i18n.format("WIZARD.speciesdescr", { species: this.species.name, cost: baseCost }),
            advantagegroups: advantagegroups,
            disadvantagegroups: disadvantagegroups,
            missingVantages: missingVantages,
            attributeRequirements: attributeRequirements,
            anyAttributeRequirements: attributeRequirements.length > 0,
            advantagesToChose: advantagegroups.length > 0,
            missingVantagesToChose: missingVantages.length > 0,
            disadvantagesToChose: disadvantagegroups.length > 0,
            vantagesToChose: advantagegroups.length > 0 || disadvantagegroups.length > 0 || missingVantages.length > 0,
            generalToChose: attributeRequirements.length > 0
        })
        return data
    }

    async addSpecies(actor, item) {
        this.actor = actor
        this.species = duplicate(item)
        await this._loadCompendiae()
    }

    async updateCharacter() {
        let parent = $(this._element)
        parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")

        let apCost = Number(parent.find('.apCost').text())
        if (!this._validateInput($(this._element)) || !this.actor.checkEnoughXP(apCost)) {
            parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")
            return
        }

        let update = {
            "data.details.species.value": this.species.name,
            "data.status.speed.initial": this.species.data.baseValues.speed.value,
            "data.status.soulpower.initial": this.species.data.baseValues.soulpower.value,
            "data.status.toughness.initial": this.species.data.baseValues.toughness.value,
            "data.status.wounds.initial": this.species.data.baseValues.wounds.value,
            "data.status.wounds.value": this.actor.data.data.status.wounds.current + this.actor.data.data.status.wounds.modifier + this.actor.data.data.status.wounds.advances
        };


        let attributeChoices = []
        for (let k of parent.find('.exclusive:checked')) {
            attributeChoices.push($(k).val())
        }

        for (let attr of this.species.data.attributeChange.value.split(",").concat(attributeChoices)) {
            if (attr.includes(game.i18n.localize("combatskillcountdivider") + ":") || attr == "")
                continue

            let attrs = attr.trim().split(" ")
            update[`data.characteristics.${attrs[0].toLowerCase()}.initial`] = this.actor.data.data.characteristics[attrs[0].toLowerCase()].initial + Number(attrs[1])
        }

        await this.actor.update(update);
        await this.actor._updateAPs(apCost)

        await this.addSelections(parent.find('.optional:checked'))

        this.finalizeUpdate()
    }
}