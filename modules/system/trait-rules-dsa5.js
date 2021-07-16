import ItemRulesDSA5 from "./item-rules-dsa5.js";

export default class TraitRulesDSA5 extends ItemRulesDSA5 {
    static async traitAdded(actor, item) {
        console.log(item)
        const familiar = game.i18n.localize('LocalizedIDs.familiar')
        switch (item.name) {
            case familiar:
                if (item.effects.length == 0) {
                    item.effects = [{
                        "changes": [
                            { "key": "data.status.wounds.gearmodifier", "mode": 2, "value": 10 },
                            { "key": "data.status.soulpower.gearmodifier", "mode": 2, "value": 1 },
                            { "key": "data.status.toughness.gearmodifier", "mode": 2, "value": 1 },
                            { "key": "data.status.astralenergy.gearmodifier", "mode": 2, "value": 15 },
                            { "key": "data.guidevalue.magical", "mode": 5, "value": "ch" },
                            { "key": "data.characteristics.mu.gearmodifier", "mode": 2, "value": 1 },
                            { "key": "data.characteristics.kl.gearmodifier", "mode": 2, "value": 1 },
                            { "key": "data.characteristics.in.gearmodifier", "mode": 2, "value": 1 },
                            { "key": "data.characteristics.ch.gearmodifier", "mode": 2, "value": 1 },
                            { "key": "data.characteristics.ff.gearmodifier", "mode": 2, "value": 1 },
                            { "key": "data.characteristics.ge.gearmodifier", "mode": 2, "value": 1 },
                            { "key": "data.characteristics.ko.gearmodifier", "mode": 2, "value": 1 },
                            { "key": "data.characteristics.kk.gearmodifier", "mode": 2, "value": 1 },
                            { "key": "data.totalArmor", "mode": 2, "value": 1 },
                        ],
                        "duration": {},
                        "icon": "icons/svg/aura.svg",
                        "label": familiar,
                        "transfer": true,
                        "flags": {
                            "dsa5": {
                                "value": null,
                                "editable": true,
                                "description": familiar,
                                "custom": true,
                                "auto": null,
                                "manual": 0,
                                "hideOnToken": true,
                                "hidePlayers": false
                            }
                        },
                    }]
                }
                break
        }
    }

    static hasTrait(actor, talent) {
        return super.hasItem(actor, talent, ["trait"])
    }
}