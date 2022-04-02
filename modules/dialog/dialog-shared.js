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

    setRollButtonWarning() {
        if (this.dialogData.mode == "attack") {
            const noTarget = game.i18n.localize("DIALOG.noTarget")
            $(this._element).find(".dialog-buttons .rollButton").html(
                `${game.i18n.localize('Roll')}<span class="missingTarget"><i class="fas fa-exclamation-circle"></i> ${noTarget}</span>`
                )
        }
    }

    setMultipleTargetsWarning() {
        if (this.dialogData.mode == "attack") {
            const noTarget = game.i18n.localize("DIALOG.multipleTarget")
            $(this._element).find(".dialog-buttons .rollButton").html(
                `${game.i18n.localize('Roll')}<span class="multipleTarget"><i class="fas fa-exclamation-circle"></i> ${noTarget}</span>`
                )
        }
    }

    async updateTargets(html, targets) {
        const template = await renderTemplate('systems/dsa5/templates/dialog/parts/targets.html', {targets})
        html.find(".targets").html(template);
        if (targets.length > 0) {
            $(this._element).find('.dialog-buttons .missingTarget').remove()
            if(targets.length > 1){
                this.setMultipleTargetsWarning()
            }else{
                $(this._element).find('.dialog-buttons .multipleTarget').remove()
            }
        } else {
            this.setRollButtonWarning()
        }
    }

    removeTarget(ev){
        const id = ev.currentTarget.dataset.id
        $(ev.currentTarget).remove()
        const newIds = []
        game.user.targets.forEach((x) => {
            if (id != x.id) newIds.push(x.id);
        });
        game.user.updateTokenTargets(newIds)
    }

    readTargets() {
        let targets = [];
        game.user.targets.forEach((x) => {
            if (x.actor) targets.push({ name: x.actor.name, img: x.actor.img, id: x.id });
        });
        return targets;
    }

    compareTargets(html, targets) {
        let newTargets = this.readTargets();
        if (JSON.stringify(targets) != JSON.stringify(newTargets)) {
            targets = newTargets;
            this.updateTargets(html, targets);
        }
        return targets
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('.quantity-click').mousedown(ev => {
            const val = { val: Number($(ev.currentTarget).val()) }
            RuleChaos.increment(ev, val, "val")
            $(ev.currentTarget).val(val.val)
        });
        html.find(".modifiers option").mousedown((ev) => {
            ev.preventDefault();
            $(ev.currentTarget).prop("selected", !$(ev.currentTarget).prop("selected"));
            return false;
        });
        html.on('click', '.rollTarget', (ev) => this.removeTarget(ev))
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