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
                    "data.guidevalue.magical": "ch",
                    "data.characteristics.mu.initial": Number(actor.data.data.characteristics.mu.initial) + 1,
                    "data.characteristics.kl.initial": Number(actor.data.data.characteristics.kl.initial) + 1,
                    "data.characteristics.in.initial": Number(actor.data.data.characteristics.in.initial) + 1,
                    "data.characteristics.ch.initial": Number(actor.data.data.characteristics.ch.initial) + 1,
                    "data.characteristics.ff.initial": Number(actor.data.data.characteristics.ff.initial) + 1,
                    "data.characteristics.ge.initial": Number(actor.data.data.characteristics.ge.initial) + 1,
                    "data.characteristics.ko.initial": Number(actor.data.data.characteristics.ko.initial) + 1,
                    "data.characteristics.kk.initial": Number(actor.data.data.characteristics.kk.initial) + 1
                });
                let armor = actor.items.find(x => x.type == "trait" && x.name == game.i18n.localize("LocalizedIDs.naturalArmor"))
                if (armor) {
                    armor = duplicate(armor)
                    armor.data.at.value = Number(armor.data.at.value) + 1
                    actor.updateEmbeddedDocuments("Item", [armor])
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
                    "data.guidevalue.magical": "-",
                    "data.characteristics.mu.initial": Number(actor.data.data.characteristics.mu.initial) - 1,
                    "data.characteristics.kl.initial": Number(actor.data.data.characteristics.kl.initial) - 1,
                    "data.characteristics.in.initial": Number(actor.data.data.characteristics.in.initial) - 1,
                    "data.characteristics.ch.initial": Number(actor.data.data.characteristics.ch.initial) - 1,
                    "data.characteristics.ff.initial": Number(actor.data.data.characteristics.ff.initial) - 1,
                    "data.characteristics.ge.initial": Number(actor.data.data.characteristics.ge.initial) - 1,
                    "data.characteristics.ko.initial": Number(actor.data.data.characteristics.ko.initial) - 1,
                    "data.characteristics.kk.initial": Number(actor.data.data.characteristics.kk.initial) - 1
                });
                let armor = actor.items.find(x => x.type == "trait" && x.name == game.i18n.localize("LocalizedIDs.naturalArmor"))
                if (armor) {
                    armor = duplicate(armor)
                    armor.data.at.value = Number(armor.data.at.value) - 1
                    actor.updateEmbeddedDocuments("Item", [armor])
                }
                break
        }
    }

    static hasTrait(actor, talent) {
        return super.hasItem(actor, talent, ["trait"])
    }
}