import DSA5_Utility from "./utility-dsa5.js"

Hooks.once('ready', async() => {
    if (!CreatureType.creatureData) {
        const r = await fetch(`systems/dsa5/lazy/creaturetype/${game.i18n.lang}.json`)
        CreatureType.creatureData = await r.json()
        CreatureType.magical = game.i18n.localize('WEAPON.magical')
        CreatureType.clerical = game.i18n.localize('WEAPON.clerical')
    }
})

const isNotEmpty = (str) => {
    return !(!str || str.length === 0)
}

export default class CreatureType {
    static creatureData
    static magical
    static clerical

    constructor(creatureClass) {
        this.creatureClass = creatureClass
        this.spellImmunities = []
        this.poisonImmunity = false
        this.diseaseImmunity = false
    }

    static detectCreatureType(actor) {
        if (actor.type == "creature") {
            const creatureClass = actor.data.creatureClass.value
            const types = Object.keys(CreatureType.creatureData.types).filter(x => creatureClass.indexOf(x) >= 0)
            return types.map(x => eval(`new ${CreatureType.creatureData.types[x]}(creatureClass)`))
        }
        return []
    }

    ignoredCondition(condition) {
        return false
    }
    damageModifier(attackItem) {
        return []
    }
    spellImmunity(spell) {
        return this.spellImmunities.some(x => spell.includes(x))
    }
    spellArmorModifier(actorData) {
        return 0
    }
    poisonImmunity() {
        return this.poisonImmunity
    }
    diseaseImmunity() {
        return this.diseaseImmunity
    }
    spellResistanceModifier(actorData) {
        return 0
    }
    buildDamageMod(name, value, selected = true) {
        return [{
            name,
            value: value,
            selected,
            type: "dmg"
        }]
    }

    getTypeByClass(className) {
        return Object.keys(CreatureType.creatureData.types).find(key => CreatureType.creatureData.types[key] === className)
    }


    isAttackItem(attackItem) {
        console.log(attackItem)
        return ["meleeweapon", "trait", "rangeweapon"].includes(attackItem.type) && isNotEmpty(attackItem.data.effect.attributes)
    }

    attributesRegex(attackItem) {
        return new RegExp(`(${attackItem.data.effect.attributes.split(',').map(x => DSA5_Utility.escapeRegex(x.split('(')[0].trim())).join("|")})`, "i")
    }
}

class VulnerableToLifeGods extends CreatureType {
    damageModifier(attackItem) {
        if (this.isAttackItem(att)) {
            const regex = this.attributesRegex(attackItem)
            for (const god of CreatureType.creatureData.godOfLife) {
                const name = `${CreatureType.clerical} (${god})`
                if (regex.test(name)) return this.buildDamageMod(name, "*2")
            }
        }
        return super.damageModifier(attackItem)
    }
}

class ChimeraType extends VulnerableToLifeGods {

}

class DaimonidType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ['Influence', 'Transformation'].map(x => game.i18n.localize(`Features.${x}`))
    }
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            const regex = this.attributesRegex(attackItem)
            if (regex.test(CreatureType.clerical)) return this.buildDamageMod(CreatureType.clerical, "*2")
        }
        return super.damageModifier(attackItem)
    }
}

class DragonType extends CreatureType {

}

class DemonType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ['Influence', 'Transformation', 'Healing', 'Illusion'].map(x => game.i18n.localize(`Features.${x}`))
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            const regex = this.attributesRegex(attackItem)
            if (regex.test(CreatureType.clerical)) return this.buildDamageMod(`${CreatureType.clerical} (${CreatureType.creatureData.opposingGod})`, "*2", false)

            if (regex.test(CreatureType.magical)) return super.damageModifier(attackItem)
        } else if (["spell", "ceremony", "liturgy", "ritual"].includes(attackItem.type)) {
            return this.buildDamageMod(this.getTypeByClass("DemonType"), "*1")
        }
        return this.buildDamageMod(this.getTypeByClass("DemonType"), "*0.5")
    }
    spellArmorModifier(actorData) {
        return Number(actorData.data.status.soulpower.max)
    }
    spellResistanceModifier(actorData) {
        return Number(actorData.data.status.soulpower.max)
    }
    ignoredCondition(condition) {
        return true
    }
}

class ElementalType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            const regex = new RegExp(attackItem.data.effect.attributes.split(',').map(x => DSA5_Utility.escapeRegex(x.split('(')[0].trim())).join("|"), "i")
            if (regex.test(CreatureType.magical)) return super.damageModifier(attackItem)
        } else if (["spell", "ceremony", "liturgy", "ritual"].includes(attackItem.type)) {
            return this.buildDamageMod(this.getTypeByClass("ElementalType"), "*1")
        }
        return this.buildDamageMod(this.getTypeByClass("ElementalType"), "*0.5")
    }
    spellArmorModifier(actorData) {
        return Number(actorData.data.status.soulpower.max)
    }
    spellResistanceModifier(actorData) {
        return Number(actorData.data.status.soulpower.max)
    }
    ignoredCondition(condition) {
        return true
    }
}

class FairyType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ['Illusion'].map(x => game.i18n.localize(`Features.${x}`))
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
}

class GhostType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ['Illusion', 'Healing', 'Telekinesis', 'Transformation'].map(x => game.i18n.localize(`Features.${x}`))
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            let regex = new RegExp(attackItem.data.effect.attributes.split(',').map(x => DSA5_Utility.escapeRegex(x.trim())).join("|"), "i")
            for (const god of CreatureType.creatureData.godOfDeath) {
                const name = `${CreatureType.clerical} (${god})`
                if (regex.test(name)) return []
            }
            regex = new RegExp(attackItem.data.effect.attributes.split(',').map(x => DSA5_Utility.escapeRegex(x.split("(")[0].trim())).join("|"), "i")
            if (regex.test(CreatureType.clerical)) return this.buildDamageMod(CreatureType.clerical, "*0.5")
            if (regex.test(CreatureType.magical)) return this.buildDamageMod(CreatureType.magical, "*0.5")
        } else if (["spell", "ceremony", "liturgy", "ritual"].includes(attackItem.type)) {
            return this.buildDamageMod(CreatureType.magical, "*0.5")
        }
        return this.buildDamageMod(this.getTypeByClass("GhostType"), "*0")
    }
    ignoredCondition(condition) {
        return !(["feared", "inpain", "confused"].includes(condition))
    }
}

class GolemType extends VulnerableToLifeGods {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ['Transformation'].map(x => game.i18n.localize(`Features.${x}`))
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    ignoredCondition(condition) {
        return !["confused", "paralysed"].includes(condition)
    }
}

class HomunculiType extends VulnerableToLifeGods {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ['Healing'].map(x => game.i18n.localize(`Features.${x}`))
    }
    ignoredCondition(condition) {
        return !["inpain", "encumbered", "stunned", "feared", "paralysed", "confused"].includes(condition)
    }
}

class IntelligentCreatureType extends CreatureType {

}

class PlantType extends CreatureType {

}

class AnimalType extends CreatureType {

}

class UndeadType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ['Influence', 'Healing', 'Illusion'].map(x => game.i18n.localize(`Features.${x}`))
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            const regex = new RegExp(attackItem.data.effect.attributes.split(',').map(x => DSA5_Utility.escapeRegex(x.trim())).join("|"), "i")
            for (const god of CreatureType.creatureData.godOfDeath) {
                const name = `${CreatureType.clerical} (${god})`
                if (regex.test(name)) return this.buildDamageMod(name, "*2")
            }
        }
        return super.damageModifier(attackItem)
    }
    ignoredCondition(condition) {
        return !["paralysed"].includes(condition)
    }
}

class SupernaturalType extends CreatureType {

}

class MagicalConstructType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ['Transformation'].map(x => game.i18n.localize(`Features.${x}`))
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    ignoredCondition(condition) {
        return !["stunned", "feared", "paralysed", "confused"].includes(condition)
    }
}

//TODO where are the type descriptions for animals, intelligent creatures, supernatural and plants
//TODO spell immunity message
//TODO poison & disease immunity message

//TODO vampire, werewolf