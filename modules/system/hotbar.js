export default class DSA5Hotbar extends Hotbar {
    async _render(force = false, options = {}) {
        await super._render(force, options);
        //$(this._element).append($('<div class="tokenQuickHot"></div>'))
        this.addContextColor()
    }

    addContextColor() {
        const parry = new RegExp(` ${game.i18n.localize('CHAR.PARRY')}$`)
        const attack = new RegExp(` ${game.i18n.localize('CHAR.ATTACK')}$`)
        const macroList = $(this._element).find('#macro-list')
        for (const macro of this.macros) {
            if (!macro.macro) continue

            if (parry.test(macro.macro.data.name)) {
                macroList.find(`[data-macro-id="${macro.macro.data._id}"]`).addClass("parry")
            } else if (attack.test(macro.macro.data.name)) {
                macroList.find(`[data-macro-id="${macro.macro.data._id}"]`).addClass("attack")
            }
        }
    }
}