import WizardDSA5 from "./dsa5_wizard.js"
import APTracker from "../system/ap-tracker.js";
import { mergeObject, getProperty, duplicate } from "../system/foundry.js"

export default class CultureWizard extends WizardDSA5 {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("TYPES.Item.culture")}` })
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

    async getData(options) {
        const data = await super.getData(options);
        let advantages = await this.parseToItem(this.culture.system.recommendedAdvantages.value, ["advantage"])
        let disadvantages = await this.parseToItem(this.culture.system.recommendedDisadvantages.value, ["disadvantage"])
        let writings = this.culture.system.writing.value == "" ? [] : await this.parseToItem(this.culture.system.writing.value.split(",").map(x => `${game.i18n.localize("LocalizedIDs.literacy")} (${x.trim()})`).join(", "), ["specialability"])
        let languages = this.culture.system.language.value == "" ? [] : await this.parseToItem(this.culture.system.language.value.split(",").map(x => `${game.i18n.localize("LocalizedIDs.language")} (${x.trim()}) 3`).join(", "), ["specialability"])

        let baseCost = Number(this.culture.system.APValue.value)
        mergeObject(data, {
            title: game.i18n.format("WIZARD.addItem", { item: `${game.i18n.localize("TYPES.Item.culture")} ${this.culture.name}` }),
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
            generalToChose: writings.length > 0 || languages.length > 0,
            enrichedClothing: await TextEditor.enrichHTML(getProperty(this.culture.system, "clothing.value"), {secrets: false, async: true}),
            enrichedDescription: await TextEditor.enrichHTML(getProperty(this.culture.system, "description.value"), {secrets: false, async: true})
        })
        return data
    }

    async addCulture(actor, item) {
        this.actor = actor
        this.culture = item
    }

    _validateInput(parent, app = this) {
        const choice = parent.find('.localKnowledge')
        if (choice.val() == "") {
            this._showInputValidation(choice, parent, app)
            return false
        }
        const selectOnlyOne = parent.find('.selectOnlyOne')
        if (selectOnlyOne.length) {
            const options = selectOnlyOne.find('.optional:checked')
            if (options.length != 1) {
                this._showInputValidation(selectOnlyOne, parent, app)
                return false
            }
        }
        return super._validateInput(parent, app)
    }

    async updateCharacter(parent, app = this) {
        parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")

        let apCost = Number(parent.find('.apCost').text())
        if (!this._validateInput(parent, app) || !(await this.actor.checkEnoughXP(apCost)) || await this.alreadyAdded(this.actor.system.details.culture.value, "culture")) {
            parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")
            return
        }

        let update = { "system.details.culture.value": this.culture.name }

        let localKnowledge = await this.findCompendiumItem(`${game.i18n.localize('LocalizedIDs.localKnowledge')} ()`, [ "specialability"])
        if (localKnowledge) {
            localKnowledge = duplicate(localKnowledge)
            localKnowledge.name = `${game.i18n.localize('LocalizedIDs.localKnowledge')} (${parent.find(".localKnowledge").val()})`
            localKnowledge.system.APValue.value = 0
            await this.actor.createEmbeddedDocuments("Item", [localKnowledge], { render: false })
        }

        await this.addSelections(parent.find('.optional:checked'), false)
        await this.actor._updateAPs(apCost, {}, { render: false })
        await this.updateSkill(this.culture.system.skills.value.split(","), "skill")
        await this.actor.update(update);

        await APTracker.track(this.actor, { type: "item", item: this.culture, state: 1 }, apCost)

        this.finalizeUpdate()
    }
}