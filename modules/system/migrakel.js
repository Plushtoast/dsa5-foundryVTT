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

    static async updateVals(actor, condition, updater) {
        const itemLibrary = game.dsa5.itemLibrary
        let itemsToDelete = []
        let itemsToCreate = []
        for (let item of actor.items.filter(x => condition(x))) {
            let find = await itemLibrary.findCompendiumItem(item.name, item.type)
            if (find.length > 0) {
                find = find.find(x => x.name == item.name && x.type == item.type)
                if (!find) continue

                console.log(`MIGRATION - Updated ${item.name}`)
                const newData = mergeObject(item.toObject(), updater(find))
                itemsToCreate.push(newData)
                itemsToDelete.push(item.id)
            }
        }
        await actor.createEmbeddedDocuments("Item", itemsToCreate)
        await actor.deleteEmbeddedDocuments("Item", itemsToDelete)
        ui.notifications.notify(game.i18n.localize("Migrakel.migrationDone"))
    }

    static async updateSpellsAndLiturgies(actor) {
        if (await this.showDialog(game.i18n.localize('Migrakel.spells'))) {
            const condition = (x) => { return ["spell", "liturgy", "ritual", "ceremony"].includes(x.type) }
            const updator = (find) => {
                return {
                    data: { effectFormula: { value: find.data.data.effectFormula.value } },
                    effects: find.effects.toObject(),
                }
            }
            this.updateVals(actor, condition, updator)
        }
    }

    static async updateSpecialAbilities(actor) {
        if (await this.showDialog(game.i18n.localize('Migrakel.abilities'))) {
            const updator = (find) => {
                let update = {
                    data: { effect: { value: find.data.data.effect.value } },
                    effects: find.effects.toObject()
                }
                if (find.type == "specialability") {
                    mergeObject(update, {
                        data: {
                            category: { sub: find.data.data.category.sub || 0 },
                            list: { value: find.data.data.list.value }
                        }
                    })
                }
                return update
            }
            const condition = (x) => { return ["specialability", "advantage", "disadvantage"].includes(x.type) }
            this.updateVals(actor, condition, updator)
        }
    }

    static async updateCombatskills(actor) {
        if (await this.showDialog(game.i18n.localize('Migrakel.cskills'))) {
            const updator = (find) => {
                return {
                    effects: find.effects.toObject()
                }
            }
            const condition = (x) => {
                return ["combatskill"].includes(x.type)
            }
            this.updateVals(actor, condition, updator)
        }
    }

    static async updateSkills(actor) {
        if (await this.showDialog(game.i18n.localize('Migrakel.skills'))) {
            const condition = (x) => { return ["skill"].includes(x.type) }
            const updator = (find) => {
                return {
                    img: find.img
                }
            }
            this.updateVals(actor, condition, updator)
        }
    }
}