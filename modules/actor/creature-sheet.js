import DSA5 from "../system/config-dsa5.js"
import ActorSheetDsa5 from "./actor-sheet.js";
import TraitRulesDSA5 from "../system/trait-rules-dsa5.js"

export default class ActorSheetdsa5Creature extends ActorSheetDsa5 {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, { classes: options.classes.concat(["dsa5", "actor", "creature-sheet"]) });
        return options;
    }

    get template() {
        if (this.showLimited()) return "systems/dsa5/templates/actors/creature-limited.html";
        return "systems/dsa5/templates/actors/creature-sheet.html";
    }

    async getData(options) {
        const data = await super.getData(options);        
        data.enrichedDescription = await TextEditor.enrichHTML(getProperty(this.actor.system, "description.value"), {secrets: true, async: true})
        data.enrichedBehaviour = await TextEditor.enrichHTML(getProperty(this.actor.system, "behaviour.value"), {secrets: true, async: true})
        data.enrichedFlight = await TextEditor.enrichHTML(getProperty(this.actor.system, "flight.value"), {secrets: true, async: true})
        data.enrichedSpecialrules = await TextEditor.enrichHTML(getProperty(this.actor.system, "specialRules.value"), {secrets: true, async: true})
        return data;
    }

    async _cleverDeleteItem(itemId) {
        let item = this.actor.items.find(x => x.id == itemId)
        switch (item.type) {
            case "trait":
                await this._updateAPs(item.system.APValue.value * -1)
                break;
        }
        await super._cleverDeleteItem(itemId)
    }

    async _addTrait(item) {
        let res = this.actor.items.find(i => i.type == "trait" && i.name == item.name);
        if (!res) {
            await this._updateAPs(item.system.APValue.value)
            await TraitRulesDSA5.traitAdded(this.actor, item)
            await this.actor.createEmbeddedDocuments("Item", [item]);
        }
    }

    async _onDropItemCreate(itemData) {
        if(itemData.type == "trait") return this._addTrait(itemData)

        return super._onDropItemCreate(itemData)
    }
}