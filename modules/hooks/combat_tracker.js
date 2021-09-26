import Actordsa5 from "../actor/actor-dsa5.js";
import { ActAttackDialog } from "../dialog/dialog-react.js"
import DSA5_Utility from "../system/utility-dsa5.js";

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
        const aggroButtons = combatants.find('.aggroButton')
        aggroButtons.click(ev => {
            ev.preventDefault()
            ev.stopPropagation()
            const combatant = game.combat.combatant
            if (game.user.isGM || combatant.isOwner)
                ActAttackDialog.showDialog(combatant.actor, combatant.data.tokenId)
        })

    }

    async getData(options) {

            const data = await super.getData(options);

            for (let turn of data.turns) {
                const combatant = data.combat.turns.find(x => x.id == turn.id)
                const isAllowedToSeeEffects = (game.user.isGM || (combatant.actor && combatant.actor.testUserPermission(game.user, "OBSERVER")) || !(game.settings.get("dsa5", "hideEffects")));
                turn.defenseCount = combatant.data._source.defenseCount

                let remainders = []

                for (const x of combatant._actor.data.items) {
                    if (x.type == "rangeweapon" && x.data.data.worn.value && x.data.data.reloadTime.progress > 0) {
                        const wpn = { name: x.name, remaining: Actordsa5.calcLZ(x.data, combatant._actor.data) - x.data.data.reloadTime.progress }
                        if (wpn.remaining > 0) remainders.push(wpn)
                    } else if (["spell", "liturgy"].includes(x.type) && x.data.data.castingTime.modified > 0) {
                        const wpn = { name: x.name, remaining: x.data.data.castingTime.modified - x.data.data.castingTime.progress }
                        if (wpn.remaining > 0) remainders.push(wpn)
                    }
                }
                remainders = remainders.sort((a, b) => a.remaining - b.remaining)

                if (remainders.length > 0) {
                    turn.ongoings = `${game.i18n.localize('COMBATTRACKER.ongoing')}\n${remainders.map((x) => `${x.name} - ${x.remaining}`).join("\n")}`
        turn.ongoing = remainders[0].remaining
        }

        
        turn.effects = new Set();
        if (combatant.token) {
            combatant.token.data.effects.forEach(e => turn.effects.add(e));
            if (combatant.token.data.overlayEffect) turn.effects.add(combatant.token.data.overlayEffect);
        }
        if (combatant.actor) combatant.actor.temporaryEffects.forEach(e => {
            if (e.getFlag("core", "statusId") === CONFIG.Combat.defeatedStatusId) turn.defeated = true;
            else if (e.data.icon && isAllowedToSeeEffects && !e.notApplicable && (game.user.isGM || !e.getFlag("dsa5", "hidePlayers")) && !e.getFlag("dsa5", "hideOnToken")) turn.effects.add(e.data.icon);
        })
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
            if (comb && !getProperty(comb.actor, "data.data.config.defense")) {
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



class RepeatingEffectsHelper {
    static async preUpdateCombatHook(combat, updateData)  {
        if (!updateData.round && !updateData.turn)
            return
    
        if (combat.data.round != 0 && combat.turns && combat.data.active && combat.current.turn > -1 && combat.current.turn == combat.turns.length - 1) await RepeatingEffectsHelper.endOfRound(combat)
    }

    static async endOfRound(combat){
        const activeGM = game.users.find(u => u.active && u.isGM)
            
        if (!(activeGM && game.user.id == activeGM.id)) return

        for (let turn of combat.turns) {
            if(!turn.defeated){
                for(let x of turn.actor.effects){
                    const statusId = x.getFlag("core", "statusId")
                    if( statusId == "bleeding") await this.applyBleeding(turn)
                    else if(statusId == "burning") await this.applyBurning(turn, x)
                }
            } 
        }
    }

    static async applyBleeding(turn){
        await ChatMessage.create(DSA5_Utility.chatDataSetup(game.i18n.format('CHATNOTIFICATION.bleeding', { actor: turn.actor.name})))
        await turn.actor.applyDamage(1)
    }

    static async applyBurning(turn, effect) {
        const step = Number(effect.getFlag("dsa5", "value"))
        const die = {1: "1d3", 2: "1d6", 3: "2d6"}[step]
        const damageRoll = new Roll(die).evaluate({ async: false })
        const damage = await damageRoll.render()
        
        await ChatMessage.create(DSA5_Utility.chatDataSetup(game.i18n.format(`CHATNOTIFICATION.burning.${step}`, { actor: turn.actor.name, damage})))
        await turn.actor.applyDamage(damageRoll.total)
    }
}

Hooks.on("preUpdateCombat", RepeatingEffectsHelper.preUpdateCombatHook)