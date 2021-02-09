import ItemRulesDSA5 from "./item-rules-dsa5.js";

export default class TraitRulesDSA5 extends ItemRulesDSA5 {
    static async traitAdded(actor, item) {
        switch (item.name) {
            case game.i18n.localize('LocalizedIDs.familiar'):

                await actor.update({
                    "data.status.wounds.initial": Number(actor.data.data.status.wounds.initial) + 10,
                    "data.status.soulpower.value": Number(actor.data.data.status.soulpower.value) + 1,
                    "data.status.toughness.value": Number(actor.data.data.status.toughness.value) + 1,
                    "data.status.astralenergy.initial": Number(actor.data.data.status.astralenergy.initial) + 15,
                    "data.guidevalue.magical": "ch"
                });
                let armor = actor.items.find(x => x.type == "trait" && x.name == game.i18n.localize("LocalizedIDs.naturalArmor"))
                if (armor) {
                    armor = duplicate(armor)
                    armor.data.at.value = Number(armor.data.at.value) + 1
                    actor.updateEmbeddedEntity("OwnedItem", armor)
                } else {
                    //TODO generate armor
                }
                break
        }
    }

    static async traitRemoved(actor, item) {
        switch (item.name) {
            case game.i18n.localize('LocalizedIDs.familiar'):

                await actor.update({
                    "data.status.wounds.initial": Number(actor.data.data.status.wounds.initial) - 10,
                    "data.status.soulpower.value": Number(actor.data.data.status.soulpower.value) - 1,
                    "data.status.toughness.value": Number(actor.data.data.status.toughness.value) - 1,
                    "data.status.astralenergy.initial": Number(actor.data.data.status.astralenergy.initial) - 15,
                    "data.guidevalue.magical": "-"
                });
                let armor = actor.items.find(x => x.type == "trait" && x.name == game.i18n.localize("LocalizedIDs.naturalArmor"))
                if (armor) {
                    armor = duplicate(armor)
                    armor.data.at.value = Number(armor.data.at.value) - 1
                    actor.updateEmbeddedEntity("OwnedItem", armor)
                }
                break
        }
    }

    static hasTrait(actor, talent) {
        return super.hasItem(actor, talent, ["trait"])
    }
}