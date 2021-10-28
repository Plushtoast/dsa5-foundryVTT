export default class CreatureType {
    static creatureTypes

    async detectCreatureType(actor) {
        if (!creatureTypes) {
            await fetch(`system/dsa5/lazy/creaturetype/${game.i18n.lang}.json`).then(async r => r.json()).then(async json => {
                creatureTypes = json
            })
        }
    }

    ignoredCondition(condition) {
        return false
    }
    damageModifier(attackTypes) {
        return 1
    }
    spellImmunity(property) {
        return false
    }
    spellArmorModifier() {
        return 0
    }
    spellResitanceModifier() {
        return 0
    }
}

class ChimeraType extends CreatureType {

}

class DaimonidType extends CreatureType {

}

class DragonType extends CreatureType {

}

class DemonType extends CreatureType {

}

class ElementalType extends CreatureType {

}

class FairyType extends CreatureType {

}

class GhostType extends CreatureType {

}

class GolemType extends CreatureType {

}

class HomunculiType extends CreatureType {

}

class IntelligentCreatureType extends CreatureType {

}

class PlantType extends CreatureType {

}

class AnimalType extends CreatureType {

}

class UndeadType extends CreatureType {

}

class SupernaturalType extends CreatureType {

}