import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import ActorSheetDsa5 from "./actor-sheet.js";
import TraitRulesDSA5 from "../system/trait-rules-dsa5.js"

export default class ActorSheetdsa5Creature extends ActorSheetDsa5 {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "actor", "creature-sheet"]),
            width: 770,
            height: 740,
        });
        return options;
    }

    get template() {
        if (!game.user.isGM && this.actor.limited) return "systems/dsa5/templates/actors/creature-limited.html";
        return "systems/dsa5/templates/actors/creature-sheet.html";
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.ch-rollCombatTrait').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const item = this.actor.items.find(i => i.data._id == itemId)
            this.actor.setupWeaponTrait(item, "attack", event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        html.find('.ch-rollDamageTrait').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const item = this.actor.items.find(i => i.data._id == itemId)
            this.actor.setupWeaponTrait(item, "damage", event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });
    }

    async getData() {
        const data = super.getData();
        data["sizeCategories"] = DSA5.sizeCategories
        return data;
    }

    async _cleverDeleteItem(itemId) {
        let item = this.actor.data.items.find(x => x._id == itemId)
        switch (item.type) {
            case "trait":
                await this._updateAPs(item.data.APValue.value * -1)
                TraitRulesDSA5.traitRemoved(this.actor, item)
                break;
        }
        super._cleverDeleteItem(itemId)
    }

    async _addTrait(item) {
        let res = this.actor.data.items.find(i => {
            return i.type == "trait" && i.name == item.name
        });
        if (!res) {
            await this._updateAPs(item.data.data.APValue.value)
            await this.actor.createEmbeddedEntity("OwnedItem", item);
            await TraitRulesDSA5.traitAdded(this.actor, item)
        }
    }

    async _onDrop(event) {
        let dragData = JSON.parse(event.dataTransfer.getData("text/plain"));
        let item
        let typeClass
        let selfTarget = dragData.actorId && dragData.actorId == this.actor.data._id

        if (selfTarget && !event.ctrlKey) {
            return
        } else if (dragData.id && dragData.pack) {
            item = await DSA5_Utility.findItembyIdAndPack(dragData.id, dragData.pack);
            typeClass = item.data.type
        } else if (dragData.id && dragData.type == "Actor") {
            item = DSA5_Utility.findActorbyId(dragData.id);
            typeClass = item.data.type
        } else if (dragData.id) {
            item = DSA5_Utility.findItembyId(dragData.id);
            typeClass = item.data.type
        } else {
            item = dragData.data
            typeClass = item.type
        }

        if (selfTarget && event.ctrlKey) {
            super.handleItemCopy(item, typeClass)
        } else {
            switch (typeClass) {
                case "trait":
                    await this._addTrait(item)
                    break;
                case "npc":
                case "creature":
                case "character":
                    if (DSA5.hooks.shapeshift) {
                        DSA5.hooks.shapeshift(item, this.actor)
                        break
                    }
                default:
                    super._handleDragData(dragData, event)
            }
        }


    }

}