import Migrakel from "../system/migrakel.js"

export default class DialogActorConfig extends Dialog{
  constructor(actor, options){
    super(options)
    this.actor = actor
  }
  static async buildDialog(actor){
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

  activateListeners(html){
    super.activateListeners(html)
    html.find('.updateSpells').click(() => {
      Migrakel.updateSpellsAndLiturgies(this.actor)
    })
    html.find('.updateAbilities').click(() => {
      Migrakel.updateSpecialAbilities(this.actor)
    })
    html.find('.updateSkills').click(() => {
      Migrakel.updateCombatskills(this.actor)
    })
  }
}