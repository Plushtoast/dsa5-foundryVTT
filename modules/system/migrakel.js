const { mergeObject, getProperty } = foundry.utils

export default class Migrakel {
    static async showDialog(content, migrateAll = false) {
        let [result] = await new Promise((resolve, reject) => {
            const buttons = {
                Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("update"),
                    callback: () => {
                        resolve([true]);
                    },
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel"),
                    callback: () => {
                        resolve([false]);
                    },
                },
            }
            if(migrateAll){
                buttons["migrateAll"] = {
                    icon: '<i class="fas fa-exclamation-triangle "></i>',
                    label: game.i18n.localize("replace"),
                    callback: () => {
                        resolve([2]);
                    },
                }
            }


            new Dialog({
                title: game.i18n.localize("Migrakel.Migration"),
                content,
                default: "Yes",
                buttons,
                close: () => {
                    resolve([false]);
                },
            }).render(true);
        });
        return result;
    }

    static async refreshStatusEffects(actor) {
        let removeEffects = [];
        for (let i of actor.effects) {
            if (i.origin) {
                removeEffects.push(i.id);
            }
        }
        await actor.deleteEmbeddedDocuments("ActiveEffect", removeEffects);
    }

    static async updateVals(actor, condition, updater) {
        const itemLibrary = game.dsa5.itemLibrary;
        let itemsToDelete = [];
        let itemsToCreate = [];
        let containersIDs = new Map();
        await this.refreshStatusEffects(actor);
        if (condition({ type: "equipment" })) {
            const bagsToDelete = [];
            const bagsToCreate = [];
            for (let item of actor.items.filter(
                    (x) =>
                    x.type == "equipment" && x.system.equipmentType.value == "bags"
                )) {
                let find = await itemLibrary.findCompendiumItem(item.name, item.type);
                if (find.length > 0) {
                    find = find.find((x) => x.name == item.name && x.type == item.type);
                    if (!find) continue;

                    console.log(`MIGRATION - Updated ${item.name}`);
                    const newData = mergeObject(item.toObject(), updater(find));
                    bagsToCreate.push(newData);
                    bagsToDelete.push(item.id);
                }
            }

            const result = await actor.createEmbeddedDocuments("Item", bagsToCreate);
            for (let k = 0; k < result.length; k++) {
                containersIDs.set(bagsToDelete[k], result[k].id);
            }

            await actor.deleteEmbeddedDocuments("Item", bagsToDelete);
        }

        for (let item of actor.items.filter(
                (x) =>
                condition(x) &&
                !(x.type == "equipment" && x.system.equipmentType.value == "bags")
            )) {
            let find = await itemLibrary.findCompendiumItem(item.name, item.type);
            if (find.length > 0) {
                find = find.find((x) => x.name == item.name && x.type == item.type);
                if (!find) continue;

                console.log(`MIGRATION - Updated ${item.name}`);
                const newData = mergeObject(item.toObject(), updater(find));
                if (newData.system.parent_id && containersIDs.has(newData.system.parent_id))
                    newData.system.parent_id = containersIDs.get(newData.system.parent_id);

                itemsToCreate.push(newData);
                itemsToDelete.push(item.id);
            }
        }
        await actor.createEmbeddedDocuments("Item", itemsToCreate);
        await actor.deleteEmbeddedDocuments("Item", itemsToDelete);

        if(!Migrakel.silent)
            ui.notifications.info("Migrakel.migrationDone", { localize: true });
    }

    static async updateSpellsAndLiturgies(actor, preChoice = undefined) {
        const res = preChoice ?? await this.showDialog(game.i18n.localize("Migrakel.spells"), true)
        const condition = (x) => {
            return ["spell", "liturgy", "ritual", "ceremony", "spellextension"].includes(x.type);
        };
        if(res == 2){
            const updator = (find) => {
                const upd = find.toObject()
                delete upd.system.talentValue

                return upd
            };
            await this.updateVals(actor, condition, updator);
        }
        else if (res) {

            const updator = (find) => {
                const upd = {
                    effects: find.effects.toObject()
                }
                if(find.type != "spellextension")
                    upd.system = { effectFormula: { value: find.system.effectFormula.value } }

                return upd
            };
            await this.updateVals(actor, condition, updator);
        }
        return res
    }

    static async updateSpecialAbilities(actor, preChoice = undefined) {
        const res = preChoice ?? await this.showDialog(game.i18n.localize("Migrakel.abilities"))
        if (res) {
            const updator = (find) => {
                let update = {
                    effects: find.effects.toObject(),
                };
                if(["specialability", "advantage", "disadvantage", "trait",].includes(find.type)){
                    mergeObject(update, {
                        system: { effect: { value: find.system.effect.value } }
                    })
                }
                if (find.type == "specialability") {
                    mergeObject(update, {
                        system: {
                            category: { sub: find.system.category.sub || 0 },
                            list: { value: find.system.list.value },
                            effect: {
                                value2: getProperty(find, "system.effect.value2") || "",
                                value3: getProperty(find, "system.effect.value3") || ""
                            }
                        },
                    });
                    if (find.system.category.value == "staff") {
                        mergeObject(update, {
                            system: {
                                feature: getProperty(find, "system.feature") || "",
                                AsPCost: getProperty(find, "system.AsPCost") || "",
                                volume: Number(getProperty(find, "system.volume")) || 0,
                                artifact: getProperty(find, "system.artifact") || "",
                                permanentEffects: getProperty(find, "system.permanentEffects") || false
                            },
                        });
                    }
                }
                this.updateMacro(update, find);
                return update;
            };

            const condition = (x) => {
                return [
                    "specialability",
                    "advantage",
                    "disadvantage",
                    "trait",
                    "essence",
                    "imprint"
                ].includes(x.type);
            };
            await this.updateVals(actor, condition, updator);
        }
        return res
    }

    static async updateCombatskills(actor, preChoice = undefined) {
        const res = preChoice ?? await this.showDialog(game.i18n.localize("Migrakel.cskills"))
        if (res) {
            const updator = (find) => {
                return {
                    effects: find.effects.toObject(),
                };
            };
            const condition = (x) => {
                return ["combatskill"].includes(x.type);
            };
            await this.updateVals(actor, condition, updator);
        }
        return res
    }

    static async updateSkills(actor, preChoice = undefined) {
        const res = preChoice ?? await this.showDialog(game.i18n.localize("Migrakel.skills"))
        if (res) {
            const condition = (x) => {
                return ["skill"].includes(x.type);
            };
            const updator = (find) => {
                return {
                    img: find.img,
                    effects: find.effects.toObject(),
                };
            };
            await this.updateVals(actor, condition, updator);
        }
        return res
    }

    static updateMacro(update, find) {
        const onUseEffect = find.getFlag("dsa5", "onUseEffect");
        if (onUseEffect) {
            mergeObject(update, {
                flags: { dsa5: { onUseEffect } },
            });
        }
    }

    static async updateGear(actor, preChoice = undefined) {
        const choice = preChoice ?? await this.showDialog(game.i18n.localize("Migrakel.gear"))
        if (choice) {
            let condition = (x) => {
                return [
                    "meleeweapon",
                    "armor",
                    "rangeweapon",
                    "equipment",
                    "poison",
                    "disease",
                    "consumable",
                    "ammunition",
                ].includes(x.type);
            };
            let updator = (find) => {
                let update = {
                    img: find.img,
                    effects: find.effects.toObject(),
                };
                if (!["poison", "consumable"].includes(find.type)) {
                    mergeObject(update, {
                        system: { effect: { value: find.system.effect.value } },
                    });
                }
                if (["armor"].includes(find.type)) {
                    mergeObject(update, {
                        system: {
                            subcategory: find.system.subcategory,
                        },
                    });
                }
                if (["meleeweapon", "rangeweapon", "armor"].includes(find.type)) {
                    mergeObject(update, {
                        system: {
                            structure: {
                                max: find.system.structure.max,
                                value: find.system.structure.value,
                            },
                        },
                    });
                }
                this.updateMacro(update, find);
                return update;
            };
            await this.updateVals(actor, condition, updator);

            await actor.updateEmbeddedDocuments("Item", actor.items.filter((x) => x.type == "money")
                .map(x => { return { _id: x.id, name: game.i18n.localize(x.name) } }))
        }
        return choice
    }
}