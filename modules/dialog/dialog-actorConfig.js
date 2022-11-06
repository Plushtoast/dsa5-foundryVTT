import Migrakel from "../system/migrakel.js"

export default class DialogActorConfig extends Dialog {
    constructor(actor, options) {
        super(options)
        this.actor = actor
        this.lock = false
    }
    static async buildDialog(actor) {
        const template = await renderTemplate("systems/dsa5/templates/actors/parts/actorConfig.html", { actor })
        new DialogActorConfig(actor, {
            title: game.i18n.localize("SHEET.actorConfig"),
            content: template,
            default: 'Save',
            buttons: {
                Save: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("Save"),
                    callback: dlg => {
                        actor.update({ 
                            "system.config.autoBar": dlg.find('[name="autoBar"]').is(":checked"),
                            "system.config.autoSize": dlg.find('[name="autoSize"]').is(":checked")
                        })
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel")
                }
            }
        }).render(true)
    }

    async updateWrapper(fnct, ev) {
        if (this.lock) return

        const upd = async() => {
            this.lock = true
            $(ev.currentTarget).prepend('<i class="fas fa-spinner fa-spin"></i>')
            await Migrakel[fnct](this.actor)
            $(ev.currentTarget).find("i").remove()
            this.lock = false
        }
        upd()
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('.updateSpells').click(async(ev) => this.updateWrapper("updateSpellsAndLiturgies", ev))
        html.find('.updateAbilities').click(async(ev) => this.updateWrapper("updateSpecialAbilities", ev))
        html.find('.updatecSkills').click(async(ev) => this.updateWrapper("updateCombatskills", ev))
        html.find('.updateSkills').click(async(ev) => this.updateWrapper("updateSkills", ev))
        html.find('.updateGear').click(async(ev) => this.updateWrapper("updateGear", ev))
    }
}