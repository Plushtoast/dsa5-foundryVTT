import WizardDSA5 from "./dsa5_wizard.js"

export default class CultureWizard extends WizardDSA5 {

    constructor(app) {
        super(app)
        this.actor = null
        this.culture = null
        this.dataTypes = ["advantage", "disadvantage", "specialability", "combatskill"]
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("culture")}` })
        options.template = 'systems/dsa5/templates/wizard/add-culture-wizard.html'
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
            let elem = parent.find('.apCost')
            elem.text(apCost)
            WizardDSA5.flashElem(elem, "emphasize2")
        })
    }

    getData() {
        let data = super.getData()
        let advantages = this.parseToItem(this.culture.data.recommendedAdvantages.value, ["advantage"])
        let disadvantages = this.parseToItem(this.culture.data.recommendedDisadvantages.value, ["disadvantage"])
        let writings = this.culture.data.writing.value == "" ? [] : this.parseToItem(this.culture.data.writing.value.split(",").map(x => `Schrift (${x.trim()})`).join(", "), ["specialability"])
        let languages = this.culture.data.language.value == "" ? [] : this.parseToItem(this.culture.data.language.value.split(",").map(x => `Sprache (${x.trim()})`).join(", "), ["specialability"])
        let baseCost = Number(this.culture.data.APValue.value)
        mergeObject(data, {
            title: game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("culture")} ${this.culture.name}` }),
            culture: this.culture,
            description: game.i18n.format("WIZARD.culturedescr", { culture: this.culture.name, cost: baseCost }),
            advantages: advantages,
            disadvantages: disadvantages,
            writings: writings,
            languages: languages,
            advantagesToChose: advantages.length > 0,
            disadvantagesToChose: disadvantages.length > 0,
            writingsToChose: writings.length > 0,
            languagesToChose: languages.length > 0,
            vantagesToChose: advantages.length > 0 || disadvantages.length > 0,
            generalToChose: writings.length > 0 || languages.length > 0
        })
        return data
    }

    async addCulture(actor, item) {
        this.actor = actor
        this.culture = duplicate(item)
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
            "data.details.culture.value": this.culture.name
        }

        await this.addSelections(parent.find('.optional:checked'))

        await this.actor.update(update);
        await this.actor._updateAPs(apCost)

        for (let skill of this.culture.data.skills.value.split(",")) {
            await this.updateSkill(skill, "skill")
        }

        this.finalizeUpdate()
    }
}