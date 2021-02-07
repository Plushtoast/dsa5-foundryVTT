import ItemSheetdsa5 from "../item-sheet.js";
import DSA5 from "../../system/config-dsa5.js"
import DSA5_Utility from "../../system/utility-dsa5.js";


export default class MeleeweaponSheetDSA5 extends ItemSheetdsa5 {
    async getData() {
        const data = await super.getData()
        let chars = DSA5.characteristics;
        chars["ge/kk"] = game.i18n.localize("CHAR.GEKK")
        chars["-"] = "-";
        data['characteristics'] = chars;
        data['twoHanded'] = /\(2H/.test(this.item.name)
        data['combatskills'] = await DSA5_Utility.allCombatSkillsList("melee")
        data['ranges'] = DSA5.meleeRanges;
        data['canBeOffHand'] = this.item.options.actor ? !(this.item.options.actor.data.items.find(x => x.type == "combatskill" && x.name == this.item.data.data.combatskill.value).data.weapontype.twoHanded) && this.item.data.data.worn.value : false
        return data
    }
}