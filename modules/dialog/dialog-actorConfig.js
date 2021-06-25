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

    async updateWrapper(lock, fnct, ev) {
        if (this.locks[lock]) return

        this.locks[lock] = true
        $(ev.currentTarget).prepend('<i class="fas fa-spinner fa-spin"></i>')
        Migrakel[fnct](this.actor)
        $(ev.currentTarget).find("i").remove()
        this.locks[lock] = false
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('.updateSpells').click(async(ev) => {
            this.updateWrapper("spells", "updateSpellsAndLiturgies", ev)
        })
        html.find('.updateAbilities').click(async(ev) => {
            this.updateWrapper("abilities", "updateSpecialAbilities", ev)
        })
        html.find('.updatecSkills').click(async(ev) => {
            this.updateWrapper("combatskills", "updateCombatskills", ev)
        })
        html.find('.updateSkills').click(async(ev) => {
            this.updateWrapper("skills", "updateSkills", ev)
        })
    }
}