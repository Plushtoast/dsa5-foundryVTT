import Migrakel from "../system/migrakel.js"

export default class DialogActorConfig extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
        window: {
            title: "SHEET.actorConfig",
        }
    }

    static PARTS = {
        main: {
            template: 'systems/dsa5/templates/actors/parts/actorConfig.html'
        }
    }

    constructor(actor, options) {
        super(options)
        this.actor = actor
        this.lock = false
    }

    async _prepareContext(_options) {
        const data = await super._prepareContext(_options)
        data.actor = this.actor
        return data
    }

    _onRender(context, options) {
        super._onRender((context, options))

        const html = $(this.element)
        html.find('.updateSpells').on('click', async(ev) => this.updateWrapper("updateSpellsAndLiturgies", ev))
        html.find('.updateAbilities').on('click', async(ev) => this.updateWrapper("updateSpecialAbilities", ev))
        html.find('.updatecSkills').on('click', async(ev) => this.updateWrapper("updateCombatskills", ev))
        html.find('.updateSkills').on('click', async(ev) => this.updateWrapper("updateSkills", ev))
        html.find('.updateGear').on('click', async(ev) => this.updateWrapper("updateGear", ev))
    }

    async updateWrapper(fnct, ev) {
        if (this.lock) return

        this.lock = true
        $(ev.currentTarget).prepend('<i class="fas fa-spinner fa-spin"></i>')
        await Migrakel[fnct](this.actor)
        $(ev.currentTarget).find("i").remove()
        this.lock = false
    }
}