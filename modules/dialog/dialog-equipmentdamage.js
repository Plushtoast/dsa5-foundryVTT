import EquipmentDamage from "../system/equipment-damage.js";

export default class EquipmentDamageDialog extends Dialog {
    static async showDialog(items) {
        const dialog = new EquipmentDamageDialog({
            title: game.i18n.localize("WEAR.checkShort"),
            content: await this.getTemplate(items),
            buttons: {}
        })
        dialog.items = items
        dialog.render(true)
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.reactClick').click(ev => {
            this.callbackResult(ev)
            this.close()
        })
    }

    static async getTemplate(data) {
        const items = data.map(x => { return { name: x.name, id: x.id, img: x.img } })
        return await renderTemplate('systems/dsa5/templates/dialog/dialog-reaction-attack.html', { items, title: "WEAR.checkShort" })
    }
    
    callbackResult(ev) {
        EquipmentDamage.breakingTest(this.items.find(x => x.id == ev.currentTarget.dataset.value))
    }
}