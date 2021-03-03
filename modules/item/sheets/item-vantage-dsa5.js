import ItemSheetdsa5 from "../item-sheet.js";

export default class VantageSheetDSA5 extends ItemSheetdsa5 {
    _advancable() {
        return this.item.data.data.max.value > 0
    }

    async _refundStep() {
        let xpCost, steps
        if (this.item.data.data.step.value > 1) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value - 1]
            }
            await this.item.options.actor._updateAPs(xpCost * -1)
            await this.item.update({ "data.step.value": this.item.data.data.step.value - 1 })
        }
    }

    async _advanceStep() {
        let xpCost, steps
        if (this.item.data.data.step.value < this.item.data.data.max.value) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value]
            }
            if (await this.item.options.actor.checkEnoughXP(xpCost)) {
                await this.item.options.actor._updateAPs(xpCost)
                await this.item.update({ "data.step.value": this.item.data.data.step.value + 1 })
            }
        }
    }
}