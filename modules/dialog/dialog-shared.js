import RuleChaos from "../system/rule_chaos.js"
import { AddTargetDialog } from "./addTargetDialog.js"

export default class DialogShared extends Dialog {
    static roman = ['', ' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX',' X']

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
            return `<span class="missingTarget"><i class="fas fa-exclamation-circle"></i> ${noTarget}</span>`
        }
        return ""
    }

    setMultipleTargetsWarning() {
        if (this.dialogData.mode == "attack") {
            const noTarget = game.i18n.localize("DIALOG.multipleTarget")
            return `<span class="multipleTarget"><i class="fas fa-exclamation-circle"></i> ${noTarget}</span>`
        }
        return ""
    }

    renderRollValueDie(){
        if(this.dialogData.rollValue && this.dialogData.mode != "damage"){
            const dieClass = this.dialogData.mode == "attack" ? "die-mu" : "die-in"
            const modifier = this.dialogData.modifier || 0
            return `<span class="rollValue ${dieClass} d20">${this.dialogData.rollValue + modifier}</span>`
        }else{
            return ""
        }
    }

    async updateRollButton(targets){
        let rollTag = this.renderRollValueDie() + game.i18n.localize('Roll')
        if (targets.length > 0) {
            if(targets.length > 1){
                rollTag += this.setMultipleTargetsWarning()
            }
        } else {
            rollTag += this.setRollButtonWarning()
        }
        $(this._element).find(".dialog-buttons .rollButton").html(rollTag)
    }

    async updateTargets(html, targets) {
        const template = await renderTemplate('systems/dsa5/templates/dialog/parts/targets.html', {targets})
        html.find(".targets").html(template);
        this.updateRollButton(targets)
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
            const quantityFocus = ev.currentTarget.dataset.quantityfocus
            const target = $(ev.currentTarget)
            if(quantityFocus && !(target.is(":focus"))){
                setTimeout(function() {target.select(), 100})
                return
            }
            const val = { val: Number(target.val()) }
            RuleChaos.increment(ev, val, "val")
            target.val(val.val)
        });
        html.find(".modifiers option").mousedown((ev) => {
            ev.preventDefault();
            $(ev.currentTarget).prop("selected", !$(ev.currentTarget).prop("selected"));
            return false;
        });
        html.on('click', '.rollTarget', (ev) => this.removeTarget(ev))
        html.on('click', '.addTarget', (ev) => this.addTarget(ev))
    }

    async addTarget(ev){
         (await AddTargetDialog.getDialog(this.dialogData.speaker)).render(true)
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

