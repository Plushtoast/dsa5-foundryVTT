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
         if (await this.showDialog(game.i18n.localize('Migrakel.spells'))) {
            const itemLibrary = game.dsa5.itemLibrary

            for (let item of actor.items.filter(x => ["spell", "liturgy", "ritual", "ceremony"].includes(x.type))) {
                let find = await itemLibrary.findCompendiumItem(item.name, item.type)
                if (find.length > 0) {
                    find = find[0].document
                    const update = {
                        "data.effectFormula.value": find.data.data.effectFormula.value,
                        effects: find.effects.toObject()
                    }
                    await item.update(update)
                }
            }
            ui.notifications.notify(game.i18n.localize("Migrakel.migrationDone"))
        }
    }

    static async updateSpecialAbilities(actor){
        if (await this.showDialog(game.i18n.localize('Migrakel.abilities'))) {
            const itemLibrary = game.dsa5.itemLibrary

            for (let item of actor.items.filter(x => ["specialability","advantage","disadvantage"].includes(x.type))) {
                let find = await itemLibrary.findCompendiumItem(item.name, item.type)
                if (find.length > 0) {
                    find = find[0].document
                    const update = {
                        "data.effect.value": find.data.data.effect.value,
                        effects: find.effects.toObject()
                    }
                    await item.update(update)
                }
            }
            ui.notifications.notify(game.i18n.localize("Migrakel.migrationDone"))
        }
    }

    static async updateCombatskills(actor) {
        if (await this.showDialog(game.i18n.localize('Migrakel.skills'))) {
            const itemLibrary = game.dsa5.itemLibrary

            for (let item of actor.items.filter(x => ["combatskill"].includes(x.type))) {
                let find = await itemLibrary.findCompendiumItem(item.name, item.type)
                if (find.length > 0) {
                    find = find[0].document
                    const update = {
                        effects: find.effects.toObject()
                    }
                    await item.update(update)
                }
            }
            ui.notifications.notify(game.i18n.localize("Migrakel.migrationDone"))
        }
    }
}