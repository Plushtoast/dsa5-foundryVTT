import RuleChaos from "../system/rule_chaos.js"

export default class DialogShared extends Dialog {
    static roman = ['', ' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX']

    recallSettings(speaker, source, mode) {
        this.recallData = game.dsa5.memory.recall(speaker, source, mode)
        this.dialogData = {
            mode,
            speaker,
            source
        }
        return this
    }

    async _render(force, options) {
        await super._render(force, options)
        this.prepareFormRecall($(this._element))
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('.quantity-click').mousedown(ev => {
            const val = { val: Number($(ev.currentTarget).val()) }
            RuleChaos.increment(ev, val, "val")
            $(ev.currentTarget).val(val.val)
        });
    }

    prepareFormRecall(html) {
        if (this.recallData) {
            for (const key in this.recallData) {
                if (key == "specAbs") {
                    for (const spec of this.recallData[key]) {
                        const elem = html.find(`.specAbs[data-id="${spec.id}"]`)
                        elem.addClass('active')
                            .attr("data-step", spec.step)

                        elem.find('.step').text(DialogShared.roman[spec.step])
                    }
                } else {
                    const elem = html.find(`[name="${key}"]`)
                    if (Array.isArray(this.recallData[key])) {
                        const options = elem.find('option')
                        for (let opt of options) {
                            let mod = this.recallData[key].find(x => x.name == $(opt).text().trim())
                            if (mod) opt.selected = mod.selected
                        }
                    } else {
                        if (elem.attr("type") == "checkbox") elem[0].checked = this.recallData[key]
                        else elem.val(this.recallData[key])
                    }
                }
            }
        }

    }
}