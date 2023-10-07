import DSA5ChatListeners from '../system/chat_listeners.js';
import DSA5 from '../system/config-dsa5.js'
import CreatureType from '../system/creature-type.js';

export default class DSA5StatusEffects {
    static bindButtons(html) {
        html.find('.chat-condition').each(function(i, cond) {
            cond.setAttribute("draggable", true);
            cond.addEventListener("dragstart", ev => {
                const dataTransfer = {
                    data: {
                        type: "condition",
                        payload: {
                            id: ev.currentTarget.dataset.id
                        }
                    }
                }
                ev.dataTransfer.setData("text/plain", JSON.stringify(dataTransfer));
            });
        })
        html.on('click', '.chat-condition', ev => DSA5ChatListeners.postStatus(ev.currentTarget.dataset.id))
    }

    static createCustomEffect(owner, description = "", name) {
        name = name || game.i18n.localize("CONDITION.custom")
        if (description == "") description = name

        owner.addCondition({
            name,
            icon: "icons/svg/aura.svg",
            origin: owner.uuid,
            flags: {
                dsa5: {
                    value: null,
                    editable: true,
                    description,
                    custom: true
                }
            }
        })
    }

    static prepareActiveEffects(target, data) {
        let systemConditions = duplicate(CONFIG.statusEffects) //.filter(x => x.flags.dsa5.editable)
        let appliedSystemConditions = []
        data.conditions = []
        data.transferedConditions = []

        let appliedConditions
        if(target.documentName == "Item") {
            appliedConditions = target.effects
        } else {
            appliedConditions = Array.from(target.allApplicableEffects())

            if(!game.user.isGM)
                appliedConditions = appliedConditions.filter(e => { return !e.getFlag("dsa5", "hidePlayers") })
        }

        for (let cnd of appliedConditions) {
            let condition = cnd.toObject()
            condition.boolean = cnd.getFlag("dsa5", "value") == null
            const statusesId = [...cnd.statuses][0]
            if (statusesId) {
                condition.value = cnd.getFlag("dsa5", "value")
                condition.editable = cnd.getFlag("dsa5", "editable")
                condition.descriptor = statusesId
                condition.manual = cnd.getFlag("dsa5", "manual")
                appliedSystemConditions.push(statusesId)
            }
            if(target.documentName == "Item") {
                data.conditions.push(condition)
            } else if (cnd.parent?.documentName != "Item" && !cnd.notApplicable)
                data.conditions.push(condition)
            else if (!cnd.notApplicable) {
                condition.uuid = cnd.uuid
                data.transferedConditions.push(condition)
            }
        }
        data.manualConditions = systemConditions.filter(x => !appliedSystemConditions.includes(x.id))

        const cumulativeConditions = []
        for(let key of Object.keys(target.system?.condition || {})) {
          if(target.system.condition[key]){
            const ef = DSA5.statusEffects.find(x => x.id == key)
            if(ef){
                cumulativeConditions.push({
                    icon: ef.icon,
                    id: key,
                    name: game.i18n.localize(ef.name),
                    value: target.system.condition[key]
                  })
            }
          }
        }
        data.cumulativeConditions = cumulativeConditions
    }

    static async addCondition(target, effect, value = 1, absolute = false, auto = true) {
        if (!target.isOwner) return "Not owned"
        if (target.compendium) return "Can not add in compendium"
        if (absolute && value < 1) return this.removeCondition(target, effect, value, auto, absolute)
        if (typeof(effect) === "string") effect = duplicate(CONFIG.statusEffects.find(e => e.id == effect))
        if (!effect) return "No Effect Found"

        let existing = this.hasCondition(target, effect.id)

        if (existing && existing.flags.dsa5.value == null)
            return existing
        else if (existing)
            return await DSA5StatusEffects.updateEffect(target, existing, value, absolute, auto, effect)

        return await DSA5StatusEffects.createEffect(target, effect, value, auto)
    }

    static hasCondition(target, conditionKey) {
        if (target != undefined && conditionKey) {
            if (!target.effects) return false

            return target.effects.find(i => i.statuses.has(conditionKey))
        }
        return false
    }

    static async removeCondition(target, effect, value = 1, auto = true, absolute = false) {
        if (!target.isOwner) return "Not owned"
        if (typeof(effect) === "string") effect = duplicate(CONFIG.statusEffects.find(e => e.id == effect))
        if (!effect) return "No Effect Found"

        let existing = this.hasCondition(target, effect.id)

        if (existing && existing.flags.dsa5.value == null) {
            if (target.token) target = target.token.actor
            const res = await target.deleteEmbeddedDocuments("ActiveEffect", [existing.id])
                //Hooks.call("deleteActorActiveEffect", target, existing)
            return res
        } else if (existing)
            return await DSA5StatusEffects.removeEffect(target, existing, value, absolute, auto)
    }

    static immuneToEffect(target, effect, silent = true) {     
        if(!effect.id || !hasProperty(effect, "flags.dsa5.max")) return

        const immunities = getProperty(target, "system.immunities") || []
        let res
        if (immunities.includes(effect.id)) {
            res = { name: target.name, condition: game.i18n.localize(`CONDITION.${effect.id}`) }
        }
        if(!res && target.documentName == "Actor"){
            const types = CreatureType.detectCreatureType(target)
            for (let type of types) {
                if(type.ignoredCondition(effect.id)) {
                    res = { name: `${target.name} (${type.getName()})`, condition: game.i18n.localize(`CONDITION.${effect.id}`) }
                    break
                }
            }
        }
        if(!res || !(ui.notifications && !silent)) return

        const msg = game.i18n.format("DSAError.conditionInvalidToCreature", { name: res.name, condition: res.condition })
        ui.notifications.warn(msg)
    }

    static resistantToEffect(target, effect) {
        const effectId = [...effect.statuses][0]
        if (!effectId) return 0

        const resistances = getProperty(target, "system.resistances.effects") || []
        return resistances.reduce((res, val) => {
            if (val.target == effectId) res += Number(val.value)
            return res
        }, 0)
    }

    static async createEffect(actor, effect, value, auto) {
        //const immune = this.immuneToEffect(actor, effect)
        effect.name = game.i18n.localize(effect.name);
        this.immuneToEffect(actor, effect, false)
        //if (immune) return immune
        
        if (auto) {
            effect.flags.dsa5.auto = Math.min(effect.flags.dsa5.max, value);
            effect.flags.dsa5.manual = 0
        } else {
            effect.flags.dsa5.manual = Math.min(effect.flags.dsa5.max, value);
            effect.flags.dsa5.auto = 0
        }

        effect.flags.dsa5.value = Math.min(4, effect.flags.dsa5.manual + effect.flags.dsa5.auto)

        if(effect.id)
            effect.statuses = [effect.id] 
        
        if (effect.id == "dead")
            effect["flags.core.overlay"] = true;

        const update = duplicate(effect);

        (game.dsa5.config.statusEffectClasses[effect.id] || DSA5StatusEffects).levelDependentEffects(effect, update)

        let result = await actor.createEmbeddedDocuments("ActiveEffect", [update])
        delete effect.id
        return result
    }
    
    static async removeEffect(actor, existing, value, absolute, autoMode) {
        const auto = autoMode ? (absolute ? value : Math.max(0, existing.flags.dsa5.auto - value)) : existing.flags.dsa5.auto
        const manual = autoMode ? existing.flags.dsa5.manual : (absolute ? value : existing.flags.dsa5.manual - value)
        const update = {
            flags: {
                dsa5: {
                    auto,
                    manual,
                    value: Math.max(0, Math.min(existing.flags.dsa5.max, manual + auto))
                }
            }
        }
        if (update.flags.dsa5.auto < 1 && update.flags.dsa5.manual == 0)
            return await actor.deleteEmbeddedDocuments("ActiveEffect", [existing.id])
        else {
            (game.dsa5.config.statusEffectClasses[[...existing.statuses][0]] || DSA5StatusEffects).levelDependentEffects(existing, update)
            return await existing.update(update)
        }
            
    }

    static async levelDependentEffects(existing, update) { }

    static async updateEffect(actor, existing, value, absolute, auto, newEffect = undefined) {
        //const immune = this.immuneToEffect(actor, existing, true)
        this.immuneToEffect(actor, existing, true)
        //if (immune) return immune
        let delta, newValue
        let update
        if (auto) {
            newValue = Math.min(existing.flags.dsa5.max, absolute ? value : existing.flags.dsa5.auto + value)
            delta = newValue - existing.flags.dsa5.auto
            update = { flags: { dsa5: { auto: newValue, manual: existing.flags.dsa5.manual } } }
        } else {
            newValue = absolute ? value : existing.flags.dsa5.manual + value
            delta = newValue - existing.flags.dsa5.manual
            update = { flags: { dsa5: { manual: newValue, auto: existing.flags.dsa5.auto } } }
        }

        if (delta == 0)
            return existing

        update.flags.dsa5.value = Math.max(0, Math.min(existing.flags.dsa5.max, update.flags.dsa5.manual + update.flags.dsa5.auto))
        if (newEffect.duration) {
            update.duration = newEffect.duration
            update.duration.startTime = game.time.worldTime
        }

        (game.dsa5.config.statusEffectClasses[[...existing.statuses][0]] || DSA5StatusEffects).levelDependentEffects(existing, update)

        await existing.update(update)
        return existing
    }


    static calculateRollModifier(effect, actor, item, options = {}) {
        if (effect.flags.dsa5.value == null || item.type == "regenerate") return 0
        
        return DSA5StatusEffects.clampedCondition(actor, effect)
    }

    static clampedCondition(actor, effect){
        const statusesId = [...effect.statuses][0]
        if(!statusesId) return 0

        const max = Number(effect.flags.dsa5.max)
        const mod = Math.clamped(actor.system.condition[statusesId] || 0, 0, max) * -1
        const resist = this.resistantToEffect(actor, effect)
        return  Math.clamped(mod + resist, -1 * max, 0)
    }

    static ModifierIsSelected(item, options = {}, actor) {
        return options.mode != "damage"
    }

    static getDamageBonus() {
        return 0
    }

    static getRollModifiers(actor, item, options = {}) {
        //actor = actor.system ? actor.data : actor
        const source = game.i18n.localize('status') + "/" + game.i18n.localize('condition')
        const result = []
        const finishedCoreIds = []
        for(const ef of actor.effects){
            if(ef.disabled) continue

            const coreId = [...ef.statuses][0]
            const effectClass = game.dsa5.config.statusEffectClasses[coreId] || DSA5StatusEffects
            const value = effectClass.calculateRollModifier(ef, actor, item, options)

            if(coreId) finishedCoreIds.push(coreId)

            if(value != 0){
                result.push({
                    name: ef.name,
                    value,
                    selected: effectClass.ModifierIsSelected(item, options, actor),
                    source
                })
            }
        }
        for(let [key, val] of Object.entries(actor.system.condition)){
            if(val && !finishedCoreIds.includes(key)){
                const ef = duplicate(DSA5.statusEffects.find(x => x.id == key))

                if(!ef) continue

                const effectClass = game.dsa5.config.statusEffectClasses[key] || DSA5StatusEffects
                ef.flags.dsa5.value = val

                ef.statuses = [key]
                const value = effectClass.calculateRollModifier(ef, actor, item, options)

                if(value != 0){
                    result.push({
                        name: ef.name,
                        value,
                        selected: effectClass.ModifierIsSelected(item, options, actor),
                        source
                    })
                }
            }
        }
        for(let ef of Object.values((game.settings.get("dsa5", "masterSettings").globalMods || {}))) {
            if(!ef.enabled || !ef.target[item.type]) continue

            result.push({
                name: ef.name,
                value: ef.value,
                selected: true,
                source: game.i18n.localize("MASTER.globalMods")
            })
        }
        return result
    }
}

class EncumberedEffect extends DSA5StatusEffects {
    static ModifierIsSelected(item, options = {}, actor) {
        const burdenedSkill = item.type == "skill" && item.system.burden.value == "yes"
        const rangeWeaponEnabled = ["rangeweapon"].includes(item.type) && options.mode != "damage" && game.settings.get("dsa5", "encumbranceForRange")
        const attack = !["skill", "spell", "ritual", "ceremony", "liturgy", "rangeweapon"].includes(item.type) && options.mode != "damage"
        return burdenedSkill || attack || rangeWeaponEnabled
    }

    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate") return 0
        return (item.type == "skill" && item.system.burden.value == "no") ? 0 : super.calculateRollModifier(effect, actor, item, options)
    }
}

class ProneEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate") return 0
        else if (item.type == "dodge") return -2
        return options.mode ? (options.mode == "attack" ? -4 : -2) : 0
    }
}

class RaptureEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        const regex = new RegExp(`${game.i18n.localize('combatskill')} `, 'gi')
        const happyTalents = actor.system.happyTalents.value.split(/;|,/).map(x => x.replace(regex, '').trim())
        if ((happyTalents.includes(item.name) && ["skill", "combatskill"].includes(item.type)) ||
            (["rangeweapon", "meleeweapon"].includes(item.type) && happyTalents.includes(item.system.combatskill.value)) || ["ceremony", "liturgy"].includes(item.type)) {
            return this.clampedCondition(actor, effect) * -1 - 1
        }

        if (["ritual", "spell", "skill", "combatskill"].includes(item.type))
            return this.clampedCondition(actor, effect)

        if (item.type == "regenerate") return 0
        return 0
    }
}

class DeafEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate") return 0
        return (item.type == "skill" && item.name == game.i18n.localize("LocalizedIDs.perception")) ? -3 : 0
    }
}

class BloodrushEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate") return 0
        if (item.type == "skill")
            return item.name == game.i18n.localize("LocalizedIDs.featOfStrength") ? 2 : 0

        return options.mode == "attack" ? 4 : 0
    }
}

//todo improve array from
class PainEffect extends DSA5StatusEffects {
    static ModifierIsSelected(item, options = {}, actor) {
        return actor.effects.find(x => Array.from(x.statuses).includes("bloodrush")) == undefined
    }
}

class TranceEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate") return 0
        switch (Number(this.clampedCondition(actor, effect))) {
            case -2:
                const regex = new RegExp(`${game.i18n.localize('combatskill')} `, 'gi')
                const happyTalents = actor.system.happyTalents.value.split(/;|,/).map(x => x.replace(regex, '').trim())
                if ((happyTalents.includes(item.name) && ["skill", "combatskill"].includes(item.type)) ||
                    (["rangeweapon", "meleeweapon"].includes(item.type) && happyTalents.includes(item.system.combatskill.value)) || ["ceremony", "liturgy"].includes(item.type)) {
                    return -2
                }
            case -3:
                return -3
        }
        return 0
    }
}

class DrunkenEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate") return 0
        if (item.type == "skill" && item.name == game.i18n.localize("LocalizedIDs.gambling"))
            return Math.clamped(this.clampedCondition(actor, effect), -3, 0)

        return 0
    }
}

class BurningEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate") return 0
        if (item.type == "skill" && item.name == game.i18n.localize("LocalizedIDs.bodyControl"))
            return Math.clamped(this.clampedCondition(actor, effect) + 1, -2, 0)

        return 0
    }
}

class ArousalEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        //TODO this should be TPMs
        return 0
    }
}

class SikaryanlossEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "skill" && item.name == game.i18n.localize("LocalizedIDs.willpower"))
            return (this.clampedCondition(actor, effect) + 1) * 2
        else if (item.type == "regenerate")
            return this.clampedCondition(actor, effect)

        return 0
    }
}

class DesireEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "skill" && item.name == game.i18n.localize("LocalizedIDs.willpower"))
            return Math.clamped(this.clampedCondition(actor, effect), -3, 0)

        return 0
    }
}

class TheriakEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate")
            return this.clampedCondition(actor, effect) * -1

        return 0
    }
}

class SunkenEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "skill" && item.system.group.value == "body")
            return Math.clamped(this.clampedCondition(actor, effect) -1, 3, 0) * -1

        return 0
    }
}

class HungerEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate")
            return Math.pow(2, this.clampedCondition(actor, effect) * -1 - 1) * -1

        return 0
    }
}

class ThirstEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        const stat = this.clampedCondition(actor, effect)
        if (item.type == "regenerate")
            return stat == 1 ? -1 : stat * -5

        return Math.clamped(stat -1, 0, 3)
    }

    static levelDependentEffects(existing, update) {
        update.changes = {
            1: [],
            2: [{ "key": "system.condition.stunned", "mode": 2, "value": 1/2 }],
            3: [{ "key": "system.condition.stunned", "mode": 2, "value": 2/3 }],
            4: [{ "key": "system.condition.stunned", "mode": 2, "value": 3/4 }]
        }[update.flags.dsa5.value]
    }
}

class HeatEffect extends DSA5StatusEffects {
    static levelDependentEffects(existing, update) {
        update.changes = {
            1: [{key: "system.condition.stunned", mode: 2, value: 1}, {key: "system.condition.confused", mode: 2, value: 1}],
            2: [{key: "system.condition.stunned", mode: 2, value: 1}, {key: "system.condition.confused", mode: 2, value: 1/2}],
            3: [{key: "system.condition.stunned", mode: 2, value: 1}, {key: "system.condition.confused", mode: 2, value: 2/3}],
            4: [{key: "system.condition.stunned", mode: 2, value: 1}, {key: "system.condition.confused", mode: 2, value: 1/2}]
        }[update.flags.dsa5.value]
    }
}

class ColdEffect extends DSA5StatusEffects {
    static levelDependentEffects(existing, update) {
        update.changes = {
            1: [{key: "system.condition.confused", mode: 2, value: 1}, {key: "system.condition.paralysed", mode: 2, value: 1}],
            2: [{key: "system.condition.confused", mode: 2, value: 1}, {key: "system.condition.paralysed", mode: 2, value: 1/2}],
            3: [{key: "system.condition.confused", mode: 2, value: 1}, {key: "system.condition.paralysed", mode: 2, value: 2/3}],
            4: [{key: "system.condition.confused", mode: 2, value: 1}, {key: "system.condition.paralysed", mode: 2, value: 1/2}]
        }[update.flags.dsa5.value]
    }
}

class NoModifierEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        return 0
    }
}

DSA5.statusEffectClasses = {
    inpain: PainEffect,
    heat: HeatEffect,
    cold: ColdEffect,
    encumbered: EncumberedEffect,
    stunned: DSA5StatusEffects,
    raptured: RaptureEffect,
    feared: DSA5StatusEffects,
    paralysed: DSA5StatusEffects,
    confused: DSA5StatusEffects,
    prone: ProneEffect,
    deaf: DeafEffect,
    bloodrush: BloodrushEffect,
    trance: TranceEffect,
    drunken: DrunkenEffect,
    arousal: ArousalEffect,
    burning: BurningEffect,
    sikaryanloss: SikaryanlossEffect,
    desire: DesireEffect,
    theriak: TheriakEffect,
    services: NoModifierEffect,
    sunken: SunkenEffect,
    hunger: HungerEffect,
    thirst: ThirstEffect
}