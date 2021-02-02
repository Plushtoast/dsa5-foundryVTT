import DSA5 from '../system/config-dsa5.js'

export default class DSA5StatusEffects {
    static async createEffect(actor, effect, value, auto) {
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

        let result = await actor.createEmbeddedEntity("ActiveEffect", effect)
        await actor._dependentEffects(effect.id, effect, 1)
        delete effect.id
        return result
    }
    static async removeEffect(actor, existing, value, auto) {
        if (auto) {
            existing.flags.dsa5.auto = Math.max(0, existing.flags.dsa5.auto - value)
        } else {
            existing.flags.dsa5.manual = existing.flags.dsa5.manual - value
        }
        existing.flags.dsa5.value = Math.max(0, Math.min(4, existing.flags.dsa5.manual + existing.flags.dsa5.auto))

        if (existing.flags.dsa5.auto <= 0 && existing.flags.dsa5.manual == 0)
            return actor.deleteEmbeddedEntity("ActiveEffect", existing._id)
        else
            return actor.updateEmbeddedEntity("ActiveEffect", existing)
    }

    static async updateEffect(actor, existing, value, absolute, auto) {
        let delta, newValue

        if (auto) {
            newValue = Math.min(existing.flags.dsa5.max, absolute ? value : existing.flags.dsa5.auto + value)
            delta = newValue - existing.flags.dsa5.auto
            existing.flags.dsa5.auto = newValue;
        } else {
            newValue = absolute ? value : existing.flags.dsa5.manual + value
            delta = newValue - existing.flags.dsa5.manual
            existing.flags.dsa5.manual = newValue;
        }

        if (delta == 0)
            return existing

        existing.flags.dsa5.value = Math.max(0, Math.min(4, existing.flags.dsa5.manual + existing.flags.dsa5.auto))
        await actor._dependentEffects(existing.flags.core.statusId, existing, delta)
        return actor.updateEmbeddedEntity("ActiveEffect", existing)
    }


    static caluclateRollModifier(effect, actor, item) {
        if (effect.flags.dsa5.value == null)
            return 0
        return effect.flags.dsa5.value * -1
    }

    static ModifierIsSelected(item) {
        return true
    }

    static getRollModifiers(actor, item) {
        return actor.effects.map(effect => {
            let effectClass = game.dsa5.config.statusEffectClasses[effect.flags.core.statusId] || DSA5StatusEffects
            return {
                name: effect.label,
                value: effectClass.caluclateRollModifier(effect, actor, item),
                selected: effectClass.ModifierIsSelected(item)
            }
        }).filter(x => x.value != 0)
    }
}

class EncumberedEffect extends DSA5StatusEffects {
    static ModifierIsSelected(item) {
        return item.type == "skill" && item.data.burden.value == "yes"
    }

    static caluclateRollModifier(effect, actor, item) {
        return (item.type == "skill" && item.data.burden.value == "no") ? 0 : super.caluclateRollModifier(effect, actor, item)
    }
}

class RaptureEffect extends DSA5StatusEffects {
    static caluclateRollModifier(effect, actor, item) {
        let happyTalents = actor.data.happyTalents.value.split(",").map(x => x.trim())
        if ((happyTalents.includes(item.name) && item.type == "skill") || ["ceremony", "ritual"].includes(item.type))
            return effect.flags.dsa5.value - 1
        if (["ritual", "spell", "skill"].includes(item.type))
            return effect.flags.dsa5.value * -1
        return 0
    }
}

DSA5.statusEffectClasses = {
    inpain: DSA5StatusEffects,
    encumbered: EncumberedEffect,
    stunned: DSA5StatusEffects,
    raptured: RaptureEffect,
    feared: DSA5StatusEffects,
    paralysed: DSA5StatusEffects,
    confused: DSA5StatusEffects
}