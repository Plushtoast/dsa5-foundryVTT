import Migrakel from "../system/migrakel.js"

export default class DialogActorConfig extends Dialog {
    constructor(actor, options) {
        super(options)
        this.actor = actor
        this.locks = {
            spells: false,
            abilities: false,
            combatskills: false,
            skills: false
        }
    }
    static async buildDialog(actor) {
        const template = await renderTemplate("systems/dsa5/templates/actors/parts/actorConfig.html", { actor: actor.data })
        new DialogActorConfig(actor, {
            title: game.i18n.localize("SHEET.actorConfig"),
            content: template,
            default: 'Save',
            buttons: {
                Save: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("Save"),
                    callback: dlg => {
                        let update = { "data.config.autoBar": dlg.find('[name="autoBar"]').is(":checked") }
                        if (actor.data.type == "creature") {
                            update["data.config.autoSize"] = dlg.find('[name="autoSize"]').is(":checked")
                        }
                        actor.update(update)
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel")
                }
            }
        }).render(true)
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('.updateSpells').click(async(ev) => {
            if (this.locks.spells) return

            this.locks.spells = true
            $(ev.currentTarget).prepend('<i class="fas fa-spinner fa-spin"></i>')
            await Migrakel.updateSpellsAndLiturgies(this.actor)
            $(ev.currentTarget).find("i").remove()
            this.locks.spells = false
        })
        html.find('.updateAbilities').click(async(ev) => {
            if (this.locks.abilities) return

            this.locks.abilities = true
            $(ev.currentTarget).prepend('<i class="fas fa-spinner fa-spin"></i>')
            await Migrakel.updateSpecialAbilities(this.actor)
            $(ev.currentTarget).find("i").remove()
            this.locks.abilities = false
        })
        html.find('.updatecSkills').click(async(ev) => {
            if (this.locks.combatskills) return

            this.locks.combatskills = true
            $(ev.currentTarget).prepend('<i class="fas fa-spinner fa-spin"></i>')
            await Migrakel.updateCombatskills(this.actor)
            $(ev.currentTarget).find("i").remove()
            this.locks.combatskills = false
        })
        html.find('.updateSkills').click(async(ev) => {
            if (this.locks.skills) return

            this.locks.skills = true
            $(ev.currentTarget).prepend('<i class="fas fa-spinner fa-spin"></i>')
            await Migrakel.updateSkills(this.actor)
            $(ev.currentTarget).find("i").remove()
            this.locks.skills = false
        })
    }
}