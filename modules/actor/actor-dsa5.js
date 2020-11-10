import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"


export default class Actordsa5 extends Actor {
    static async create(data, options) {
        if (data instanceof Array)
            return super.create(data, options);

        if (data.items)
            return super.create(data, options);

        // Initialize empty items
        data.items = [];

        data.flags =
        {

        }

        let skills = await DSA5_Utility.allSkills() || [];

        if (data.type == "character") {
            data.items = data.items.concat(skills);


            super.create(data, options); // Follow through the the rest of the Actor creation process upstream
        }
    }

    prepareBaseData() {
        for (let ch of Object.values(this.data.data.characteristics)) {
            ch.value = ch.initial + ch.advances + (ch.modifier || 0);
            ch.bonus = Math.floor(ch.value / 10)
            ch.cost = DSA5_Utility._calculateAdvCost(ch.advances, "characteristic")
        }
    }

    //prepare calculated attributes
    prepareData() {
        try {
            super.prepareData();
            const data = this.data;

            if (this.data.type == "character")
                this.prepareCharacter();
            
            

        }
        catch (error) {
            console.error("Something went wrong with preparing actor data: " + error)
            ui.notifications.error(game.i18n.localize("ACTOR.PreparationError") + error)
        }
    }

    prepareCharacter() {
        if (this.data.type != "character")
            return;

        //calculate some attributes
    }

}