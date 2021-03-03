import ItemSheetdsa5 from "../item-sheet.js";
import DSA5 from "../../system/config-dsa5.js"
import SpecialabilityRulesDSA5 from "../../system/specialability-rules-dsa5.js";

export default class SpecialAbilitySheetDSA5 extends ItemSheetdsa5 {
    async _refundStep() {
        let xpCost, steps
        if (this.item.data.data.step.value > 1) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value - 1]
            }
            xpCost = await SpecialabilityRulesDSA5.refundFreelanguage(this.item.data, this.item.options.actor, xpCost)
            await this.item.options.actor._updateAPs(xpCost * -1)
            await this.item.update({ "data.step.value": this.item.data.data.step.value - 1 })
        }
    }

    async _advanceStep() {
        let xpCost, steps
        if (this.item.data.data.step.value < this.item.data.data.maxRank.value) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value]
            }
            xpCost = await SpecialabilityRulesDSA5.isFreeLanguage(this.item.data, this.item.options.actor, xpCost)
            if (await this.item.options.actor.checkEnoughXP(xpCost)) {
                await this.item.options.actor._updateAPs(xpCost)
                await this.item.update({ "data.step.value": this.item.data.data.step.value + 1 })
            }
        }
    }

    _advancable() {
        return this.item.data.data.maxRank.value > 0
    }

    async getData() {
        const data = await super.getData()
        data['categories'] = DSA5.specialAbilityCategories;
        return data
    }
}