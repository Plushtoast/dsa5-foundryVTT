import { ActAttackDialog } from "../dialog/dialog-react.js"

export class DSA5CombatTracker extends CombatTracker {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "/systems/dsa5/templates/system/combattracker.html"
        });
    }

    activateListeners(html) {
        super.activateListeners(html)

        const combatants = html.find('.combatant.actor')
        combatants.prepend(`<div class="aggroButton specImg" title="${game.i18n.localize('attacktest')}"></div>`)
        combatants.find('.aggroButton').click(ev => {
            ev.preventDefault()
            ev.stopPropagation()
            const combatant = game.combat.combatant
            if (game.user.isGM || combatant.isOwner)
                ActAttackDialog.showDialog(combatant.actor, combatant.tokenId)
        })
    }

    async getData(options) {
        const data = await super.getData(options)
        for(let k of data.turns){
            const combatant = data.combat.turns.find(x => x.id == k.id)
            k.defenseCount = combatant.data._source.defenseCount
            k.tokenId = combatant.data.tokenId
            console.log(k)
        }
        return data
    }
}
export class DSA5Combat extends Combat {
    constructor(data, context) {
        super(data, context);
    }
    async nextRound() {
        for(let k of this.turns){
            await k.update({defenseCount: 0})
        }
        return await super.nextRound()
    }

    async getDefenseCount(speaker){
        const comb = this.getCombatantFromActor(speaker)
        return comb.data._source.defenseCount
    }

    getCombatantFromActor(speaker){
        let id
        if (speaker.token) {
            id = Array.from(this.combatants).find(x => x.data.tokenId == speaker.token).id
        } else {
            id = Array.from(this.combatants).find(x => x.data.actorId == speaker.actor).id
        }
        return this.combatants.get(id)
    }
    //TODO very clonky
    async updateDefenseCount(speaker){
        const comb = this.getCombatantFromActor(speaker)
        if (comb){
            await comb.update({ "defenseCount": comb.data._source.defenseCount + 1})
        }
    }
}

export class DSA5Combatant extends Combatant{
    constructor(data, context) {
        data.defenseCount = 0
        super(data, context);
    }
}