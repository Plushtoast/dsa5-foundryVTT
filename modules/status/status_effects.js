import DSA5 from '../system/config-dsa5.js'

export default class DSA5StatusEffects {
    static bindButtons(html) {
        html.find('.chat-condition').each(function(i, cond) {
            cond.setAttribute("draggable", true);
            cond.addEventListener("dragstart", ev => {
                let dataTransfer = {
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

    static createCustomEffect(owner, description = "") {
        const label = game.i18n.localize("CONDITION.custom")
        if (description == "") description = label
        owner.addCondition({
            label: label,
            icon: "icons/svg/aura.svg",
            origin: owner.uuid,
            flags: {
                dsa5: {
                    value: null,
                    editable: true,
                    customizable: true,
                    description: description,
                    custom: true
                }
            },
            id: `${Math.random()}`
        })
    }

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

    static async removeEffect(actor, existing, value, absolute, auto) {
        if (auto) {
            existing.flags.dsa5.auto = absolute ? value : Math.max(0, existing.flags.dsa5.auto - value)
        } else {
            existing.flags.dsa5.manual = absolute ? value : existing.flags.dsa5.manual - value
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


    static calculateRollModifier(effect, actor, item, options = {}) {
        if (effect.flags.dsa5.value == null)
            return 0
        return effect.flags.dsa5.value * -1
    }

    static ModifierIsSelected(item, options = {}, actor) {
        return options.mode != "damage"
    }

    static getDamageBonus() {
        return 0
    }

    static getRollModifiers(actor, item, options = {}) {
        actor = actor.data.data ? actor.data : actor
        return actor.effects.map(effect => {
            let effectClass = game.dsa5.config.statusEffectClasses[effect.flags.core.statusId] || DSA5StatusEffects
            return {
                name: effect.label,
                value: effectClass.calculateRollModifier(effect, actor, item, options),
                selected: effectClass.ModifierIsSelected(item, options, actor)
            }
        }).filter(x => x.value != 0)
    }
}

class EncumberedEffect extends DSA5StatusEffects {
    static ModifierIsSelected(item, options = {}, actor) {
        return (item.type == "skill" && item.data.burden.value == "yes") || (!["skill", "spell", "ritual", "ceremony", "liturgy"].includes(item.type) && options.mode != "damage")
    }

    static calculateRollModifier(effect, actor, item, options = {}) {
        return (item.type == "skill" && item.data.burden.value == "no") ? 0 : super.calculateRollModifier(effect, actor, item, options)
    }
}

class ProneEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        return options.mode ? (options.mode == "attack" ? -4 : -2) : 0
    }
}

class RaptureEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        let happyTalents = actor.data.happyTalents.value.split(/;|,/).map(x => x.trim())
        if ((happyTalents.includes(item.name) && ["skill", "combatskill"].includes(item.type)) ||
            (["rangeweapon", "meleeweapon"].includes(item.type) && happyTalents.includes(item.data.data.combatskill.value)) || ["ceremony", "liturgy"].includes(item.type)) {
            return effect.flags.dsa5.value - 1
        }
        if (["ritual", "spell", "skill", "combatskill"].includes(item.type))
            return effect.flags.dsa5.value * -1
        return 0
    }
}

class DeafEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        return (item.type == "skill" && item.name == game.i18n.localize("LocalizedIDs.perception")) ? -3 : 0
    }
}

class BloodrushEffect extends DSA5StatusEffects {
    static calculateRollModifier(effect, actor, item, options = {}) {
        if (item.type == "skill")
            return item.name == game.i18n.localize("LocalizedIDs.featOfStrength") ? 2 : 0

        return options.mode == "attack" ? 4 : 0
    }
}

class PainEffect extends DSA5StatusEffects {
    static ModifierIsSelected(item, options = {}, actor) {
        return actor.effects.find(x => x.flags.core.statusId == "bloodrush") == undefined
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
    bloodrush: BloodrushEffect
}


/*Macro Example

const actor = game.actors.getName("Delgado Rochas");
console.log(actor);
actor.addCondition({
    label: "Zustandsname",
    icon: "icons/svg/aura.svg",
    origin: actor.uuid,
    changes: [
        { key: "data.characteristics.ge.gearmodifier", mode: 2, value: 1 },
        { key: "data.status.speed.gearmodifier", mode: 2, value: -1 }
    ],

    flags: {
        dsa5: {
            value: null,
            editable: true,
            customizable: true,
            description: "Beschreibung des Effekts",
            custom: true
        }
    },
    id: `${Math.random()}`
});
*/