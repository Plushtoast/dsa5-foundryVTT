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
            this.prepareSkill(data)
        if (this.data.type == "species")
            this.prepareSpecies(data)
    }

    prepareSpecies(data) {}

    prepareSkill(data) {
        if (this.data.type != "skill")
            return

        /*if (!hasProperty(data, "data.modifier.value"))
            setProperty(data, "data.modifier.value", 0)

        if (this.isOwned) {
            if (!data.data.total)
                data.data.total = {};
            data.data.total.value = data.data.modifier.value + data.data.advances.value + this.actor.data.data.characteristics[data.data.characteristic.value].value
        }*/
    }

    prepare() {
        let preparedData = duplicate(this.data)


        preparedData.img = preparedData.img || DEFAULT_TOKEN;


        return preparedData;
    }

}

CONFIG.Item.entityClass = Itemdsa5;