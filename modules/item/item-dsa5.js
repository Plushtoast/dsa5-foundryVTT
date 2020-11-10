import DSA5_Utility from "../system/utility-dsa5.js";
import DSA from "../system/config-dsa5.js"

export default class Itemdsa5 extends Item {
    static async create(data, options) {
        if (!data.img)
            data.img = "systems/dsa5/icons/blank.png";
        super.create(data, options);
    }

    prepareData() {
        super.prepareData();
        const data = this.data;

        if (this.data.type == "skill")
            this.prepareSkill()

    }

    prepareSkill() {
        if (this.data.type != "skill")
            return

        const data = this.data;

        /*if (!hasProperty(data, "data.modifier.value"))
            setProperty(data, "data.modifier.value", 0)

        if (this.isOwned) {
            if (!data.data.total)
                data.data.total = {};
            data.data.total.value = data.data.modifier.value + data.data.advances.value + this.actor.data.data.characteristics[data.data.characteristic.value].value
        }*/
    }


    
}

CONFIG.Item.entityClass = Itemdsa5;