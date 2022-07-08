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

    getData(options) {
        const data = super.getData(options);
        let advantages = this.parseToItem(this.culture.system.recommendedAdvantages.value, ["advantage"])
        let disadvantages = this.parseToItem(this.culture.system.recommendedDisadvantages.value, ["disadvantage"])
        let writings = this.culture.system.writing.value == "" ? [] : this.parseToItem(this.culture.system.writing.value.split(",").map(x => `${game.i18n.localize("LocalizedIDs.literacy")} (${x.trim()})`).join(", "), ["specialability"])
        let languages = this.culture.system.language.value == "" ? [] : this.parseToItem(this.culture.system.language.value.split(",").map(x => `${game.i18n.localize("LocalizedIDs.language")} (${x.trim()}) 3`).join(", "), ["specialability"])

        let baseCost = Number(this.culture.system.APValue.value)
        mergeObject(data, {
            title: game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("culture")} ${this.culture.name}` }),
            culture: this.culture,
            description: game.i18n.format("WIZARD.culturedescr", { culture: this.culture.name, cost: baseCost }),
            advantages,
            disadvantages,
            writings,
            languages,
            advantagesToChose: advantages.length > 0,
            disadvantagesToChose: disadvantages.length > 0,
            writingsToChose: writings.length > 0,
            languagesToChose: languages.length > 0,
            languagesToSelect: languages.length > 1,
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

    _validateInput(parent) {
        const choice = parent.find('.localKnowledge')
        if (choice.val() == "") {
            ui.notifications.error(game.i18n.localize("DSAError.MissingChoices"))
            WizardDSA5.flashElem(choice)
            let tabElem = choice.closest('.tab').attr("data-tab")
            WizardDSA5.flashElem(parent.find(`.tabs a[data-tab='${tabElem}']`))
            return false
        }
        const selectOnlyOne = parent.find('.selectOnlyOne')
        if (selectOnlyOne.length) {
            const options = selectOnlyOne.find('.optional:checked')
            if (options.length != 1) {
                ui.notifications.error(game.i18n.localize("DSAError.MissingChoices"))
                WizardDSA5.flashElem(selectOnlyOne)
                let tabElem = selectOnlyOne.closest('.tab').attr("data-tab")
                WizardDSA5.flashElem(parent.find(`.tabs a[data-tab='${tabElem}']`))
                return false
            }
        }
        return super._validateInput(parent)
    }

    async updateCharacter() {
        let parent = $(this._element)
        parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")

        let apCost = Number(parent.find('.apCost').text())
        if (!this._validateInput($(this._element)) || !(await this.actor.checkEnoughXP(apCost)) || await this.alreadyAdded(this.actor.system.details.culture.value, "culture")) {
            parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")
            return
        }

        let update = { "system.details.culture.value": this.culture.name }

        let localKnowledge = this.items.find(x => x.name == `${game.i18n.localize('LocalizedIDs.localKnowledge')} ()` && x.type == "specialability")
        if (localKnowledge) {
            localKnowledge = duplicate(localKnowledge)
            localKnowledge.name = `${game.i18n.localize('LocalizedIDs.localKnowledge')} (${parent.find(".localKnowledge").val()})`
            localKnowledge.system.APValue.value = 0
            await this.actor.createEmbeddedDocuments("Item", [localKnowledge])
        }

        await this.addSelections(parent.find('.optional:checked'))
        await this.actor.update(update);
        await this.actor._updateAPs(apCost)
        await this.updateSkill(this.culture.system.skills.value.split(","), "skill")

        this.finalizeUpdate()
    }
}