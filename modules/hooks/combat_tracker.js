import { ActAttackDialog } from "../dialog/dialog-react.js"

export class DSA5CombatTracker extends CombatTracker {
    activateListeners(html) {
        super.activateListeners(html)

        const combatants = html.find('.combatant.actor')
        combatants.prepend(`<div class="aggroButton specImg" title="${game.i18n.localize('attacktest')}"></div>`)
        combatants.find('.aggroButton').click(ev => {
            ev.preventDefault()
            ev.stopPropagation()
            const combatant = this.combat.combatant
            if (game.user.isGM || combatant.isOwner)
                ActAttackDialog.showDialog(combatant.actor, combatant.tokenId)
        })
    }
}
export class DSA5Combat extends Combat {

}