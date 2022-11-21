import Actordsa5 from "../actor/actor-dsa5.js";
import { ActAttackDialog } from "../dialog/dialog-react.js"
import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5StatusEffects from "../status/status_effects.js"

export class DSA5CombatTracker extends CombatTracker {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "/systems/dsa5/templates/system/combattracker.html"
        });
    }

    activateListeners(html) {
        super.activateListeners(html)

        html.find('.combatant.actor .aggroButton').click(ev => {
            ev.preventDefault()
            ev.stopPropagation()
            DSA5CombatTracker.runActAttackDialog()
        })
    }

    static runActAttackDialog() {
        if (!game.combat) return

        const combatant = game.combat.combatant
        if (game.user.isGM || combatant.isOwner)
            ActAttackDialog.showDialog(combatant.actor, combatant.tokenId)
            
    }

    async getData(options) {
            const data = await super.getData(options);

            for (let turn of data.turns) {
                const combatant = data.combat.turns.find(x => x.id == turn.id)
                const isAllowedToSeeEffects = (game.user.isGM || (combatant.actor && combatant.actor.testUserPermission(game.user, "OBSERVER")) || !(game.settings.get("dsa5", "hideEffects")));
                turn.defenseCount = combatant.getFlag("dsa5", "defenseCount") || 0

                let remainders = []
                if (combatant.actor) {
                    for (const x of combatant.actor.items) {
                        if (x.type == "rangeweapon" && x.system.worn.value && x.system.reloadTime.progress > 0) {
                            const wpn = { name: x.name, remaining: Actordsa5.calcLZ(x, combatant.actor) - x.system.reloadTime.progress }
                            if (wpn.remaining > 0) remainders.push(wpn)
                        } else if (["spell", "liturgy"].includes(x.type) && x.system.castingTime.modified > 0) {
                            const wpn = { name: x.name, remaining: x.system.castingTime.modified - x.system.castingTime.progress }
                            if (wpn.remaining > 0) remainders.push(wpn)
                        }
                    }
                }
                remainders = remainders.sort((a, b) => a.remaining - b.remaining)

                if (remainders.length > 0) {
                    turn.ongoings = `${game.i18n.localize('COMBATTRACKER.ongoing')}\n${remainders.map((x) => `${x.name} - ${x.remaining}`).join("\n")}`

                turn.ongoing = remainders[0].remaining
            }

            turn.effects = new Set();
            if (combatant.token) {
                combatant.token.effects.forEach(e => turn.effects.add(e));
                if (combatant.token.overlayEffect) turn.effects.add(combatant.token.overlayEffect);
            }
            if (combatant.actor) combatant.actor.temporaryEffects.forEach(e => {
                if (e.getFlag("core", "statusId") === CONFIG.Combat.defeatedStatusId) turn.defeated = true;
                else if (e.icon && isAllowedToSeeEffects && !e.notApplicable && (game.user.isGM || !e.getFlag("dsa5", "hidePlayers")) && !e.getFlag("dsa5", "hideOnToken")) turn.effects.add(e.icon);
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
        if (game.dsa5.apps.tokenHotbar) game.dsa5.apps.tokenHotbar.updateDSA5Hotbar()
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
                await k.setFlag("dsa5", "defenseCount", 0 )
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
        return comb ? (comb.getFlag("dsa5", "defenseCount") || 0) : 0
    }

    //TODO very clonky
    getCombatantFromActor(speaker) {
        let id
        if (speaker.token) {
            id = Array.from(this.combatants).find(x => x.tokenId == speaker.token)
        } else {
            id = Array.from(this.combatants).find(x => x.actorId == speaker.actor)
        }
        return id ? this.combatants.get(id.id) : undefined
    }

    async updateDefenseCount(speaker) {
        if (game.user.isGM) {
            const comb = this.getCombatantFromActor(speaker)
            if (comb && !getProperty(comb.actor, "system.config.defense")) {
                await comb.setFlag("dsa5", "defenseCount", (comb.getFlag("dsa5", "defenseCount") || 0) + 1)
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
        if(data.flags == undefined) data.flags = {}
        mergeObject(data.flags, {
            dsa5: {defenseCount: 0}
        })
        super(data, context);
    }

    async recalcInitiative(){
        if(this.initiative){
            const roll = await this.getFlag("dsa5", "baseRoll") || 0
            const update = { "initiative": roll + this.actor.system.status.initiative.value}
            await this.update(update)
        }
    }
}

Hooks.on("preCreateCombatant", (data, options, user) => {
    const actor = DSA5_Utility.getSpeaker({actor: data.actorId, scene: data.sceneId, token: data.token_id})
    if(getProperty(actor.system, "merchant.merchantType") == "loot") return false
})

Hooks.on("updateCombatant", (combatant, change, user) => {
    if(!game.user.isGM) return

    if(change.initiative){
        const baseRoll = combatant.getFlag("dsa5", "baseRoll")
        if(!baseRoll) {
            const parts = `${change.initiative}`.split(".")
            const roll = Number(parts[0]) - Math.round(combatant.actor.system.status.initiative.value)
            combatant.setFlag("dsa5", "baseRoll", roll)
        }
    } else if("initiative" in change && change.initiative == null){
        combatant.update({ [`flags.dsa5.-=baseRoll`]: null })
    }
})

class RepeatingEffectsHelper {
    static async updateCombatHook(combat, updateData, x, y) {
        if (!updateData.round && !updateData.turn)
            return

        if (combat.round != 0 && combat.turns && combat.active){
            if(combat.previous.round < combat.current.round)
                await RepeatingEffectsHelper.startOfRound(combat)
        }
    }

    static async startOfRound(combat) {
        const activeGM = game.users.find(u => u.active && u.isGM)

        if (!(activeGM && game.user.id == activeGM.id)) return

        for (let turn of combat.turns) {
            if (!turn.defeated) {
                for (let x of turn.actor.effects) {
                    const statusId = x.getFlag("core", "statusId")
                    if (statusId == "bleeding") await this.applyBleeding(turn, combat)
                    else if (statusId == "burning") await this.applyBurning(turn, x, combat)
                }

                await this.startOfRoundEffects(turn, combat)
            }
        }
    }

    static async startOfRoundEffects(turn, combat){
        const regenerationAttributes = ["wounds", "astralenergy", "karmaenergy"]
        for(const attr of regenerationAttributes){
            for (const ef of turn.actor.system.repeatingEffects.startOfRound[attr]){
                if(getProperty(turn.actor.system.repeatingEffects, `disabled.${attr}`)) continue

                const damageRoll = await new Roll(ef.value).evaluate({ async: true })
                const damage = await damageRoll.render()
                const type = game.i18n.localize(damageRoll.total > 0 ? "CHATNOTIFICATION.regenerates" : "CHATNOTIFICATION.getsHurt")
                const applyDamage = `${turn.actor.name} ${type} ${game.i18n.localize(attr)} ${damage}`
                
                await this.sendEventMessage(applyDamage, combat, turn)
                if (attr == "wounds") await turn.actor.applyDamage(damageRoll.total * -1)
                else await turn.actor.applyMana(damageRoll.total * -1, attr == "astralenergy" ? "AsP" : "KaP")
            }
        }
    }

    static async applyBleeding(turn, combat) {
        if(turn.actor.system.status.wounds.value < 1) return 
        
        const msg = game.i18n.format('CHATNOTIFICATION.bleeding', { actor: turn.actor.name })
        await this.sendEventMessage(msg, combat, turn)
        await turn.actor.applyDamage(1)
    }

    static async applyBurning(turn, effect, combat) {
        if(turn.actor.system.status.wounds.value < 1) return 
        
        const step = Number(effect.getFlag("dsa5", "value"))
        const protection = DSA5StatusEffects.resistantToEffect(turn.actor, effect)
        const die =  { 0: "1", 1: "1d3", 2: "1d6", 3: "2d6" }[step - protection] || "1"
        const damageRoll = await new Roll(die).evaluate({ async: true })
        const damage = await damageRoll.render()
        const msg = game.i18n.format(`CHATNOTIFICATION.burning.${step}`, { actor: turn.actor.name, damage })
        
        await this.sendEventMessage(msg, combat, turn)
        await turn.actor.applyDamage(damageRoll.total)
    }

    static async sendEventMessage(content, combat, turn){
        if(game.settings.get("dsa5", "hideRegenerationToOwner")){
            const recipients = combat.combatants.get(turn.id).players
            recipients.push(...game.users.filter(x => x.isGM).map(x => x.id))
            await ChatMessage.create(DSA5_Utility.chatDataSetup(content, undefined, undefined, recipients))
        }else{
            await ChatMessage.create(DSA5_Utility.chatDataSetup(content))
        }
    }
}

Hooks.on("updateCombat", RepeatingEffectsHelper.updateCombatHook)