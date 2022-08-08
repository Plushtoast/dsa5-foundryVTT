import DSA5 from '../system/config-dsa5.js'

export default class DSA5StatusEffects {
    static bindButtons(html) {
        html.find('.chat-condition').each(function(i, cond) {
            cond.setAttribute("draggable", true);
            cond.addEventListener("dragstart", ev => {
                const dataTransfer = {
                    data: {
                        type: "condition",
                        payload: {
                            id: $(ev.currentTarget).attr("data-id")
                        }
                    }
                }
                ev.dataTransfer.setData("text/plain", JSON.stringify(dataTransfer));
            });
        })
    }

    static createCustomEffect(owner, description = "", label) {
        label = label || game.i18n.localize("CONDITION.custom")
        if (description == "") description = label

        owner.addCondition({
            label,
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
        for (let condition of target.effects.filter(e => { return game.user.isGM || target.documentName == "Item" || !e.getFlag("dsa5", "hidePlayers") })) {
            condition.disabled = condition.disabled
            condition.boolean = condition.getFlag("dsa5", "value") == null
            condition.label = condition.label
            condition.icon = condition.icon
            const statusId = condition.getFlag("core", "statusId")
            if (statusId) {
                condition.value = condition.getFlag("dsa5", "value")
                condition.editable = condition.getFlag("dsa5", "editable")
                condition.descriptor = statusId
                condition.manual = condition.getFlag("dsa5", "manual")
                appliedSystemConditions.push(statusId)
            }
            if ((condition.origin == target.uuid || !condition.origin) && !condition.notApplicable)
                data.conditions.push(condition)
            else if (!condition.notApplicable) {
                data.transferedConditions.push(condition)
            }
        }
        data.manualConditions = systemConditions.filter(x => !appliedSystemConditions.includes(x.id))
    }

    static async addCondition(target, effect, value = 1, absolute = false, auto = true) {
        if (!target.isOwner) return "Not owned"
        if (target.compendium) return "Can not add in compendium"
        if (absolute && value <= 0) return this.removeCondition(target, effect, value, auto, absolute)
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

            return target.effects.find(i => getProperty(i, "flags.core.statusId") == conditionKey)
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
        //TODO add this to effect dropdown
        const immunities = getProperty(target, "system.immunities") || []
        if (immunities.includes(effect.id)) {
            const msg = game.i18n.format("DSAError.immuneTo", { name: target.name, condition: game.i18n.localize(`CONDITION.${effect.id}`) })
            if (ui.notifications && !silent) ui.notifications.warn(msg)
            return msg
        }
        return false
    }

    static resistantToEffect(target, effect) {
        const effectId = getProperty(effect, "flags.core.statusId")
        if (!effectId) return 0

        const resistances = getProperty(target, "system.resistances.effects") || []
        return resistances.reduce((res, val) => {
            if (val.target == effectId) res += Number(val.value)
            return res
        }, 0)
    }

    static async createEffect(actor, effect, value, auto) {
        const immune = this.immuneToEffect(actor, effect)
        if (immune) return immune
        effect.label = game.i18n.localize(effect.label);
        if (auto) {
            effect.flags.dsa5.auto = Math.min(effect.flags.dsa5.max, value);
            effect.flags.dsa5.manual = 0
        } else {
            effect.flags.dsa5.manual = Math.min(effect.flags.dsa5.max, value);
            effect.flags.dsa5.auto = 0
        }

        effect.flags.dsa5.value = Math.min(4, effect.flags.dsa5.manual + effect.flags.dsa5.auto)

        effect["flags.core.statusId"] = effect.id;
        if (effect.id == "dead")
            effect["flags.core.overlay"] = true;

        let result = await actor.createEmbeddedDocuments("ActiveEffect", [duplicate(effect)])
        await actor._dependentEffects(effect.id, effect, 1)
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
        if (update.flags.dsa5.auto <= 0 && update.flags.dsa5.manual == 0)
            return await actor.deleteEmbeddedDocuments("ActiveEffect", [existing.id])
        else
            return await existing.update(update)
    }

    static async updateEffect(actor, existing, value, absolute, auto, newEffect = undefined) {
        const immune = this.immuneToEffect(actor, existing, true)
        if (immune) return immune
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

        await existing.update(update)
        await actor._dependentEffects(existing.flags.core.statusId, existing, delta)
        return existing
    }


    static calculateRollModifier(effect, actor, item, options = {}) {
        if (effect.flags.dsa5.value == null || item.type == "regenerate") return 0

        return Math.max(-1 * effect.flags.dsa5.max, Math.min(0, effect.flags.dsa5.value * -1 + this.resistantToEffect(actor, effect)))
    }

    static ModifierIsSelected(item, options = {}, actor) {
        return options.mode != "damage"
    }

    static getDamageBonus() {
        return 0
    }

    static getRollModifiers(actor, item, options = {}) {
        //actor = actor.system ? actor.data : actor
        return actor.effects.filter(x => !x.disabled).map(ef => {
            const effect = duplicate(ef)
            let effectClass = game.dsa5.config.statusEffectClasses[getProperty(effect, "flags.core.statusId")] || DSA5StatusEffects
            return {
                name: effect.label,
                value: effectClass.calculateRollModifier(effect, actor, item, options),
                selected: effectClass.ModifierIsSelected(item, options, actor),
                source: game.i18n.localize('status') + "/" + game.i18n.localize('condition')
            }
        }).filter(x => x.value != 0)
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
            return effect.flags.dsa5.value - 1
        }
        if (["ritual", "spell", "skill", "combatskill"].includes(item.type))
            return effect.flags.dsa5.value * -1
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

class PainEffect extends DSA5StatusEffects {
    static ModifierIsSelected(item, options = {}, actor) {
        return actor.effects.find(x => getProperty(x, "flags.core.statusId") == "bloodrush") == undefined
    }
}

class TranceEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate") return 0
        switch (Number(effect.flags.dsa5.value)) {
            case 2:
                const regex = new RegExp(`${game.i18n.localize('combatskill')} `, 'gi')
                const happyTalents = actor.system.happyTalents.value.split(/;|,/).map(x => x.replace(regex, '').trim())
                if ((happyTalents.includes(item.name) && ["skill", "combatskill"].includes(item.type)) ||
                    (["rangeweapon", "meleeweapon"].includes(item.type) && happyTalents.includes(item.system.combatskill.value)) || ["ceremony", "liturgy"].includes(item.type)) {
                    return -2
                }
            case 3:
                return -3
        }
        return 0
    }
}

class DrunkenEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate") return 0
        if (item.type == "skill" && item.name == game.i18n.localize("LocalizedIDs.gambling"))
            return Math.max(-3, Math.min(effect.flags.dsa5.value * -1 + this.resistantToEffect(actor, effect)))

        return 0
    }
}

class BurningEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate") return 0
        if (item.type == "skill" && item.name == game.i18n.localize("LocalizedIDs.bodyControl"))
            return Math.max(-2, Math.min(0, (effect.flags.dsa5.value - 1) * -1 + this.resistantToEffect(actor, effect)))

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
            return (effect.flags.dsa5.value - 1) * -2
        else if (item.type == "regenerate")
            return effect.flags.dsa5.value * -1

        return 0
    }
}

class DesireEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "skill" && item.name == game.i18n.localize("LocalizedIDs.willpower"))
            return Math.max(-3, Math.min(0, effect.flags.dsa5.value * -1 + this.resistantToEffect(actor, effect)))

        return 0
    }
}

class TheriakEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "regenerate")
            return effect.flags.dsa5.value * 1

        return 0
    }
}

class NoModifierEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        return 0
    }
}

DSA5.statusEffectClasses = {
    inpain: PainEffect,
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
    services: NoModifierEffect
}