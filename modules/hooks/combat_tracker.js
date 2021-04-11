import { ActAttackDialog } from "../dialog/dialog-react.js"

export class DSA5CombatTracker extends CombatTracker {
    activateListeners(html) {
        super.activateListeners(html)

        const combatants = html.find('.combatant.actor')
        combatants.prepend(`<div class="aggroButton specImg" title="${game.i18n.localize('attacktest')}"></div>`).click(ev => {
            const combatant = this.combat.combatant
            if (game.user.isGM || combatant.permission == ENTITY_PERMISSIONS.OWNER)
                ActAttackDialog.showDialog(combatant.actor)
        })
    }
}
export class DSA5Combat extends Combat {

}