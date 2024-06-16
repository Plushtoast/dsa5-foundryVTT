import Actordsa5 from "../actor/actor-dsa5.js";
import { ActAttackDialog } from "../dialog/dialog-react.js"
import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5StatusEffects from "../status/status_effects.js"
import RuleChaos from "../system/rule_chaos.js";
const { debounce, getProperty, mergeObject } = foundry.utils

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

        html.find('#combat-tracker').on('scroll.combattracker', debounce(function(ev) {
            const log = $(ev.target);
            const comb = html.find(".combatant.active")[0].offsetTop
            html.find(".aggroButton").animate({top: comb - log.scrollTop()}, 50)
        }, 50));
        html.find('.convertToBrawl').click(() => game.combat.convertToBrawl())
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
                turn.actionCount = Number(getProperty(combatant, "actor.system.actionCount.value")) || 0
                turn.actionCounts = `${turn.actionCount} ${game.i18n.localize('actionCount')}`

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
                    turn.ongoings = `${game.i18n.localize('COMBATTRACKER.ongoing')}<br>${remainders.map((x) => `${x.name} - ${x.remaining}`).join("<br>")}`

                turn.ongoing = remainders[0].remaining
            }

            turn.effects = new Set();
            if (combatant.actor) combatant.actor.temporaryEffects.forEach(e => {
                if (e.statuses.has(CONFIG.Combat.defeatedStatusId)) turn.defeated = true;
                else if (e.img && isAllowedToSeeEffects && !e.notApplicable && (game.user.isGM || !e.getFlag("dsa5", "hidePlayers")) && !e.getFlag("dsa5", "hideOnToken")) turn.effects.add(e.img);
            })
        }
        data.isBrawling = game.combat?.isBrawling
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

    get isBrawling() {
        return this.getFlag("dsa5", "isBrawling")
    }

    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
        this.refreshTokenbars()
    }

    _onDelete(options, userId) {
        super._onDelete(options, userId);
        this.refreshTokenbars()
    }

    async brawlingDialog() {
        return new Promise((resolve, reject) => {
            new Dialog({
                title: game.i18n.localize("BRAWLING.unarmEveryone"),
                content: `<p>${game.i18n.localize("BRAWLING.unarmEveryoneText")}</p>`,
                default: "Yes",
                buttons: {
                Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("yes"),
                    callback: () => {
                        resolve(true);
                    },
                },
                No: {
                    icon: '<i class="fa fa-times"></i>',
                    label: game.i18n.localize("no"),
                    callback: () => {
                        resolve(false);
                    },
                }
                },
            }).render(true);
        });
    }

    async convertToBrawl(force = undefined) {
        const goBrawling = force ?? !this.isBrawling

        const actorUpdates = []
        const tokenUpdates = []
        const chatMessages = []

        if(goBrawling) {
            await this.setFlag("dsa5", "unarmEveryone", await this.brawlingDialog())

            for(let x of this.combatants){
                if(!x.actor) return {}

                const change = await x.brawlingChange()

                if(x.actor.isToken) {
                    await x.actor.update(change.actorChange)
                } else {
                    actorUpdates.push(change.actorChange)
                }

                tokenUpdates.push(...change.tokenChange)
                DSA5Combat.brawlStart()
            }
        } else {
            for(let x of this.combatants){
                if(!x.actor) return {}

                const change = await x.undoBrawlingChange()
                if(x.actor.isToken) {
                    await x.actor.update(change.actorChange)
                } else {
                    actorUpdates.push(change.actorChange)
                }

                tokenUpdates.push(...change.tokenChange)
                if(change.damage.brawlDamage > 0){
                    chatMessages.push({name: x.token.name, id: x.token.id, data: change.damage})
                }
            }
        }

        await Actordsa5.updateDocuments(actorUpdates)
        await game.canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates)
        await this.setFlag("dsa5", "isBrawling", goBrawling)

        if(chatMessages.length) {
            await this.showBrawlingDamage(chatMessages)
        }
    }

    async showBrawlingDamage(messages) {
        const template = await renderTemplate("systems/dsa5/templates/chat/brawling-damage.html", { messages })
        ChatMessage.create(DSA5_Utility.chatDataSetup(template))
    }

    static async brawlStart(timeout = 2000, broadcast = true) {
        if (broadcast && DSA5_Utility.isActiveGM()) {
            await game.socket.emit("system.dsa5", {
                type: "brawlStart",
                payload: {}
            })
        }

        $('.bumFight').remove()
        const brawlAnim = await renderTemplate("systems/dsa5/templates/system/bumFight/animation.html", {  })
        $('body').append(brawlAnim)

        const bum = $('.bumFight')
        bum.on('click', () => bum.remove())
        bum.addClass("fight")
        setTimeout(function() {
           bum.fadeOut(1000, () => bum.remove());
        }, timeout);
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

    brawlingChange() {
        const actor = DSA5_Utility.getSpeaker({actor: this.actor.id, scene: this.sceneId, token: this.token.id})
        const unarm = this.combat.getFlag("dsa5", "unarmEveryone")
        const tokenChange = getProperty(actor, "system.config.autoBar") ? actor.getActiveTokens().map(x => {return { _id: x.id, bar1: { attribute: "status.temporaryLeP" } }}) : []
        const actorChange = {
            _id: actor.id,
            system: {
                status: {
                    temporaryLeP: {
                        value: actor.system.status.wounds.value,
                        max: actor.system.status.wounds.value
                    }
                }
            }
        }

        if(unarm) {
            const items = this.actor.items.filter(x => x.type == "meleeweapon" && x.system.worn.value && !RuleChaos.improvisedWeapon.test(x.name))
            if(items.length){
                actorChange.items = items.map(x => { return { _id: x.id, "system.worn.value": false } })
            }
        }

        return { tokenChange, actorChange }
    }

    async getBrawlingTable() {
        if(!this.brawlingTable) {
            const pack = game.packs.get(game.i18n.lang == "de" ? "dsa5.patzer" : "dsa5.botch")
            const table = (await pack.getDocuments({ name__in: [game.i18n.lang == "de" ? "Prügelei - Verletzungen" : "Brawling - Injuries"] }))[0]
            this.brawlingTable = table
        }

        return this.brawlingTable
    }

    async undoBrawlingChange() {
        const actor = DSA5_Utility.getSpeaker({actor: this.actor.id, scene: this.sceneId, token: this.token.id})
        const tokenChange = getProperty(actor, "system.config.autoBar") ? actor.getActiveTokens().map(x => { return { _id: x.id, bar1: { attribute: "status.wounds" } }}) : []
        const lostLP = Math.max(0, actor.system.status.temporaryLeP.max - actor.system.status.temporaryLeP.value)
        let brawlDamage = 0

        let result
        if(lostLP > 0) {
            result = await (await this.getBrawlingTable()).draw({ displayChat: false })
            result = result.results[0]
            const multiplier = result.getFlag("dsa5", "brawlDamage")
            brawlDamage = Math.round(lostLP * multiplier)
        }

        const actorChange = {
            _id: actor.id,
            system: {
                status: {
                    temporaryLeP: {
                        value: 0,
                        max: 0
                    },
                    wounds: {
                        value: actor.system.status.wounds.value - brawlDamage
                    }
                }
            }
        }

        return { tokenChange, actorChange, damage: { brawlDamage, result } }
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
    const actor = DSA5_Utility.getSpeaker({actor: data.actorId, scene: data.sceneId, token: data.tokenId})
    if(getProperty(actor.system, "merchant.merchantType") == "loot") return false

    if(data.combat.isBrawling) {
        const conf = data.brawlingChange()
        delete conf.actorChange._id
        actor.update(conf.actorChange).then(() => {
            game.canvas.scene.updateEmbeddedDocuments("Token", conf.tokenChange)
        })
    }
})

Hooks.on("deleteCombatant", (data, options, user) => {
    const actor = DSA5_Utility.getSpeaker({actor: data.actorId, scene: data.sceneId, token: data.tokenId})
    if(getProperty(actor.system, "merchant.merchantType") == "loot") return false

    if(data.combat.isBrawling) {
        data.undoBrawlingChange().then(async(conf) => {
            if(!data.token) return

            delete conf.actorChange._id
            await actor.update(conf.actorChange)
            await game.canvas.scene.updateEmbeddedDocuments("Token", conf.tokenChange)
            if(conf.damage.brawlDamage > 0){
                data.combat.showBrawlingDamage([{name: data.token.name, id: data.token.id, data: conf.damage}])
            }
        })
    }
})

Hooks.on("preDeleteCombat", (combat, options, user) => {
    if(options.noHook) return

    if(combat.isBrawling) {
        combat.convertToBrawl(false).then(() => {
            combat.delete({noHook: true})
        })
        return false
    }
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
        if (!game.users.activeGM?.isSelf) return

        for (let turn of combat.turns) {
            if (!turn.defeated) {                
                if (turn.actor?.system.condition.bleeding > 0) await this.applyBleeding(turn, combat)
                if (turn.actor?.system.condition.burning > 0) await this.applyBurning(turn, combat)

                await this.startOfRoundEffects(turn, combat)
            }
        }
    }

    static async startOfRoundEffects(turn, combat){
        const regenerationAttributes = ["wounds", "astralenergy", "karmaenergy"]
        for(const attr of regenerationAttributes){
            if(getProperty(turn.actor.system.repeatingEffects, `disabled.${attr}`)) continue

            const effectvalues = turn.actor.system.repeatingEffects.startOfRound[attr].map(x => x.value).join("+")
            if(!effectvalues) continue

            const damageRoll = await new Roll(effectvalues).evaluate()
            const damage = await damageRoll.render()
            const type = game.i18n.localize(damageRoll.total > 0 ? "CHATNOTIFICATION.regenerates" : "CHATNOTIFICATION.getsHurt")
            const applyDamage = `${this.buildActorName(turn)} ${type} ${game.i18n.localize(attr)} ${damage}`

            await this.sendEventMessage(applyDamage, combat, turn)
            if (attr == "wounds") await turn.actor.applyDamage(damageRoll.total * -1)
            else await turn.actor.applyMana(damageRoll.total * -1, attr == "astralenergy" ? "AsP" : "KaP")

        }
    }

    static async applyBleeding(turn, combat) {
        if(turn.actor.system.status.wounds.value < 1) return

        const msg = game.i18n.format('CHATNOTIFICATION.bleeding', { actor: this.buildActorName(turn) })
        await this.sendEventMessage(msg, combat, turn)
        await turn.actor.applyDamage(1)
    }

    static async applyBurning(turn, combat) {
        if(turn.actor?.system.status.wounds.value < 1) return

        const step = turn.actor?.system.condition.burning
        const protection = DSA5StatusEffects.resistantToEffect(turn.actor, "burning")
        const die =  { 0: "1", 1: "1d3", 2: "1d6", 3: "2d6" }[step - protection] || "1"
        const damageRoll = await new Roll(die).evaluate()
        const damage = await damageRoll.render()
        const msg = game.i18n.format(`CHATNOTIFICATION.burning.${step}`, { actor: this.buildActorName(turn), damage })

        await this.sendEventMessage(msg, combat, turn)
        await turn.actor.applyDamage(damageRoll.total)
    }

    static buildActorName(turn) {
        let name = turn.token.name
        if(game.settings.get("dsa5", "hideRegenerationToOwner")) {
            if(turn.token.name != turn.token.actor.name)
                name += ` (${turn.token.actor.name})`
        }
        return turn.token.actor.toAnchor( { name }).outerHTML
    }

    static async sendEventMessage(content, combat, turn){
        if(game.settings.get("dsa5", "hideRegenerationToOwner")){
            const recipients = combat.combatants.get(turn.id).players
            recipients.push(...game.users.filter(x => x.isGM).map(x => x.id))
            const chatData = DSA5_Utility.chatDataSetup(content, undefined, undefined, recipients)
            delete chatData.speaker
            await ChatMessage.create(chatData)
        }else{
            await ChatMessage.create(DSA5_Utility.chatDataSetup(content))
        }
    }
}

Hooks.on("updateCombat", RepeatingEffectsHelper.updateCombatHook)