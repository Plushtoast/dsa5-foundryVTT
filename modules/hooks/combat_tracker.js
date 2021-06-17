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

        for (let turn of data.turns) {
            const combatant = data.combat.turns.find(x => x.id == turn.id)
            const isAllowedToSeeEffects = (game.user.isGM || combatant.actor.isOwner || !(game.settings.get("dsa5", "hideEffects")))
            turn.defenseCount = combatant.data._source.defenseCount

            turn.effects = new Set();
            if (combatant.token) {
                combatant.token.data.effects.forEach(e => turn.effects.add(e));
                if (combatant.token.data.overlayEffect) turn.effects.add(combatant.token.data.overlayEffect);
            }
            if (combatant.actor) combatant.actor.temporaryEffects.forEach(e => {
                if (e.getFlag("core", "statusId") === CONFIG.Combat.defeatedStatusId) turn.defeated = true;
                else if (e.data.icon) {
                    if (isAllowedToSeeEffects && !e.notApplicable && (game.user.isGM || !e.getFlag("dsa5", "hidePlayers")) && !e.getFlag("dsa5", "hideOnToken"))
                        turn.effects.add(e.data.icon);
                }
            });
        }
        return data

    }
}
export class DSA5Combat extends Combat {
    constructor(data, context) {
        super(data, context);
    }

    async refreshTokenbars() {
        if (ui.hotbar) ui.hotbar.updateDSA5Hotbar()
    }

    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
        this.refreshTokenbars()
    }

    _onDelete(options, userId) {
        super._onDelete(options, userId);
        this.refreshTokenbars()
    }

    async nextRound() {
        if (game.user.isGM) {
            for (let k of this.turns) {
                await k.update({ defenseCount: 0 })
            }
        } else {
            await game.socket.emit("system.dsa5", {
                type: "clearCombat",
                payload: {}
            })
        }
        return await super.nextRound()
    }

    async getDefenseCount(speaker) {
        const comb = this.getCombatantFromActor(speaker)
        return comb ? comb.data._source.defenseCount : 0
    }

    //TODO very clonky
    getCombatantFromActor(speaker) {
        let id
        if (speaker.token) {
            id = Array.from(this.combatants).find(x => x.data.tokenId == speaker.token)
        } else {
            id = Array.from(this.combatants).find(x => x.data.actorId == speaker.actor)
        }
        return id ? this.combatants.get(id.id) : undefined
    }

    async updateDefenseCount(speaker) {
        if (game.user.isGM) {
            const comb = this.getCombatantFromActor(speaker)
            if (comb) {
                await comb.update({ "defenseCount": comb.data._source.defenseCount + 1 })
            }
        } else {
            await game.socket.emit("system.dsa5", {
                type: "updateDefenseCount",
                payload: {
                    speaker
                }
            })
        }
    }
}

export class DSA5Combatant extends Combatant {
    constructor(data, context) {
        data.defenseCount = 0
        super(data, context);
    }
}