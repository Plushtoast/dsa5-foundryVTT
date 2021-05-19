export default class Migrakel {

    static async showDialog(content) {
        let [result] = await new Promise((resolve, reject) => {
            new Dialog({
                title: game.i18n.localize("Migrakel.Migration"),
                content,
                default: 'yes',
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("yes"),
                        callback: () => {
                            resolve([true])
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel"),
                        callback: () => {
                            resolve([false])
                        }
                    }
                }
            }).render(true)
        })
        return result
    }

    static notBefore08() {
        return /^0\.8/.test(game.data.version)
    }

    static async updateSpellsAndLiturgies(actor) {
        if (!this.notBefore08()) {
            ui.notifications.warn("Migration will be available in v0.8 of Foundry")
            return
        }
        if (await this.showDialog(game.i18n.localize('Migrakel.spells'))) {
            const itemLibrary = game.dsa5.itemLibrary

            for (let item of actor.items.filter(x => ["spell", "liturgy", "ritual", "ceremony"].includes(x.type))) {
                let find = await itemLibrary.findCompendiumItem(item.name, item.type)
                if (find) {
                    find = find[0].document
                    await item.update({ "data.effectFormula.value": find.data.data.effectFormula.value })
                    for (const id of item.effects.map(x => x.id)) {
                        await item.deleteEmbeddedDocuments("ActiveEffect", [id])
                    }
                    for (const ef of find.effects) {
                        await item.createEmbeddedDocuments("ActiveEffect", [ef])
                    }
                }
            }
            ui.notifications.notify(game.i18n.localize("Migrakel.migrationDone"))
        }
    }
}