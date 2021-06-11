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
                },
                close: () => {
                    resolve([false])
                }
            }).render(true)
        })
        return result
    }

    static async updateSpellsAndLiturgies(actor) {
        if (await this.showDialog(game.i18n.localize('Migrakel.spells'))) {
            const itemLibrary = game.dsa5.itemLibrary
            let itemsToDelete = []
            let itemsToCreate = []
            for (let item of actor.items.filter(x => ["spell", "liturgy", "ritual", "ceremony"].includes(x.type))) {
                let find = await itemLibrary.findCompendiumItem(item.name, item.type)
                if (find.length > 0) {
                    find = find.find(x => x.name == item.name && x.type == item.type)
                    if (!find) continue

                    const update = {
                        data: { effectFormula: { value: find.data.data.effectFormula.value } },
                        effects: find.effects.toObject(),
                    }
                    console.log(`MIGRATION - Updated ${item.name}`)
                    const newData = mergeObject(item.toObject(), update)
                    itemsToCreate.push(newData)
                    itemsToDelete.push(item.id)
                }
            }

            await actor.deleteEmbeddedDocuments("Item", itemsToDelete)
            await actor.createEmbeddedDocuments("Item", itemsToCreate)
            ui.notifications.notify(game.i18n.localize("Migrakel.migrationDone"))
        }
    }

    static async updateSpecialAbilities(actor) {
        if (await this.showDialog(game.i18n.localize('Migrakel.abilities'))) {
            const itemLibrary = game.dsa5.itemLibrary
            let itemsToDelete = []
            let itemsToCreate = []
            for (let item of actor.items.filter(x => ["specialability", "advantage", "disadvantage"].includes(x.type))) {
                let find = await itemLibrary.findCompendiumItem(item.name, item.type)

                if (find.length > 0) {
                    find = find.find(x => x.name == item.name && x.type == item.type)
                    if (!find) continue

                    let update = {
                        data: { effect: { value: find.data.data.effect.value } },
                        effects: find.effects.toObject()
                    }
                    if (item.type == "specialability") {
                        mergeObject(update, {
                            data: {
                                category: { sub: find.data.data.category.sub || 0 },
                                list: { value: find.data.data.list.value }
                            }
                        })
                    }
                    console.log(`MIGRATION - Updated ${item.name}`)
                    const newData = mergeObject(item.toObject(), update)
                    itemsToCreate.push(newData)
                    itemsToDelete.push(item.id)
                }
            }
            await actor.deleteEmbeddedDocuments("Item", itemsToDelete)
            await actor.createEmbeddedDocuments("Item", itemsToCreate)
            ui.notifications.notify(game.i18n.localize("Migrakel.migrationDone"))
        }
    }

    static async updateCombatskills(actor) {
        if (await this.showDialog(game.i18n.localize('Migrakel.cskills'))) {
            const itemLibrary = game.dsa5.itemLibrary
            let itemsToDelete = []
            let itemsToCreate = []
            for (let item of actor.items.filter(x => ["combatskill"].includes(x.type))) {
                let find = await itemLibrary.findCompendiumItem(item.name, item.type)
                if (find.length > 0) {
                    find = find.find(x => x.name == item.name && x.type == item.type)
                    if (!find) continue

                    const update = {
                        effects: find.effects.toObject()
                    }
                    console.log(`MIGRATION - Updated ${item.name}`)
                    const newData = mergeObject(item.toObject(), update)
                    itemsToCreate.push(newData)
                    itemsToDelete.push(item.id)
                }
            }
            await actor.deleteEmbeddedDocuments("Item", itemsToDelete)
            await actor.createEmbeddedDocuments("Item", itemsToCreate)
            ui.notifications.notify(game.i18n.localize("Migrakel.migrationDone"))
        }
    }

    static async updateSkills(actor) {
        if (await this.showDialog(game.i18n.localize('Migrakel.skills'))) {
            const itemLibrary = game.dsa5.itemLibrary
            let itemsToDelete = []
            let itemsToCreate = []
            for (let item of actor.items.filter(x => ["skill"].includes(x.type))) {
                let find = await itemLibrary.findCompendiumItem(item.name, item.type)
                if (find.length > 0) {
                    find = find.find(x => x.name == item.name && x.type == item.type)
                    if (!find) continue

                    const update = {
                        img: find.img
                    }
                    console.log(`MIGRATION - Updated ${item.name}`)
                    const newData = mergeObject(item.toObject(), update)
                    itemsToCreate.push(newData)
                    itemsToDelete.push(item.id)
                }
            }
            await actor.deleteEmbeddedDocuments("Item", itemsToDelete)
            await actor.createEmbeddedDocuments("Item", itemsToCreate)
            ui.notifications.notify(game.i18n.localize("Migrakel.migrationDone"))
        }
    }
}