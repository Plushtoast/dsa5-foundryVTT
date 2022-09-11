import ActorSheetDsa5 from "./actor-sheet.js";
import CultureWizard from "../wizards/culture_wizard.js";
import CareerWizard from "../wizards/career_wizard.js"
import SpeciesWizard from "../wizards/species_wizard.js";

export default class ActorSheetdsa5Character extends ActorSheetDsa5 {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "actor", "character-sheet"]),
            width: 784,
        });
        return options;
    }

    get template() {
        if (this.showLimited()) return "systems/dsa5/templates/actors/npc-limited.html";
        return "systems/dsa5/templates/actors/actor-sheet.html";
    }

    async _manageDragItems(item, typeClass) {
        switch (typeClass) {
            case "aggregatedTest":
                await this.actor.createEmbeddedDocuments("Item", [item]);
                break;
            case "species":
                let spwizard = new SpeciesWizard()
                await spwizard.addSpecies(this.actor, item)
                spwizard.render(true)
                break;
            case "culture":
                let cuwizard = new CultureWizard()
                await cuwizard.addCulture(this.actor, item)
                cuwizard.render(true)
                break
            case "career":
                let cwizard = new CareerWizard()
                await cwizard.addCareer(this.actor, item)
                cwizard.render(true)
                break;
            default:
                return super._manageDragItems(item, typeClass)
        }
    }
}