export default class Migrakel {
  static async showDialog(content) {
    let [result] = await new Promise((resolve, reject) => {
      new Dialog({
        title: game.i18n.localize("Migrakel.Migration"),
        content,
        default: "yes",
        buttons: {
          Yes: {
            icon: '<i class="fa fa-check"></i>',
            label: game.i18n.localize("yes"),
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
        },
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
      if (i.data.origin) {
        let sourceItem = await fromUuid(i.data.origin);
        if (!sourceItem) {
          removeEffects.push(i.id);
        }
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
          x.type == "equipment" && x.data.data.equipmentType.value == "bags"
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
        !(x.type == "equipment" && x.data.data.equipmentType.value == "bags")
    )) {
      let find = await itemLibrary.findCompendiumItem(item.name, item.type);
      if (find.length > 0) {
        find = find.find((x) => x.name == item.name && x.type == item.type);
        if (!find) continue;

        console.log(`MIGRATION - Updated ${item.name}`);
        const newData = mergeObject(item.toObject(), updater(find));
        if (newData.data.parent_id && containersIDs.has(newData.data.parent_id))
          newData.data.parent_id = containersIDs.get(newData.data.parent_id);

        itemsToCreate.push(newData);
        itemsToDelete.push(item.id);
      }
    }
    await actor.createEmbeddedDocuments("Item", itemsToCreate);
    await actor.deleteEmbeddedDocuments("Item", itemsToDelete);
    ui.notifications.notify(game.i18n.localize("Migrakel.migrationDone"));
  }

  static async updateSpellsAndLiturgies(actor) {
    if (await this.showDialog(game.i18n.localize("Migrakel.spells"))) {
      const condition = (x) => {
        return ["spell", "liturgy", "ritual", "ceremony"].includes(x.type);
      };
      const updator = (find) => {
        return {
          data: {
            effectFormula: { value: find.data.data.effectFormula.value },
          },
          effects: find.effects.toObject(),
        };
      };
      await this.updateVals(actor, condition, updator);
    }
  }

  static async updateSpecialAbilities(actor) {
    if (await this.showDialog(game.i18n.localize("Migrakel.abilities"))) {
      const updator = (find) => {
        let update = {
          data: { effect: { value: find.data.data.effect.value } },
          effects: find.effects.toObject(),
        };
        if (find.type == "specialability") {
          mergeObject(update, {
            data: {
              category: { sub: find.data.data.category.sub || 0 },
              list: { value: find.data.data.list.value },
            },
          });
          if (find.data.data.category.value == "staff") {
            mergeObject(update, {
              data: {
                feature: getProperty(find.data, "data.feature") || "",
                AsPCost: getProperty(find.data, "data.AsPCost") || "",
                volume: Number(getProperty(find.data, "data.volume")) || 0,
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
        ].includes(x.type);
      };
      await this.updateVals(actor, condition, updator);
    }
  }

  static async updateCombatskills(actor) {
    if (await this.showDialog(game.i18n.localize("Migrakel.cskills"))) {
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
  }

  static async updateSkills(actor) {
    if (await this.showDialog(game.i18n.localize("Migrakel.skills"))) {
      const condition = (x) => {
        return ["skill"].includes(x.type);
      };
      const updator = (find) => {
        return {
          img: find.img,
        };
      };
      await this.updateVals(actor, condition, updator);
    }
  }

  static updateMacro(update, find) {
    const onUseEffect = find.getFlag("dsa5", "onUseEffect");
    if (onUseEffect) {
      mergeObject(update, {
        flags: { dsa5: { onUseEffect } },
      });
    }
  }

  static async updateGear(actor) {
    if (await this.showDialog(game.i18n.localize("Migrakel.gear"))) {
      let condition = (x) => {
        return [
          "meleeweapon",
          "armor",
          "rangeweapon",
          "equipment",
          "poison",
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
            data: { effect: { value: find.data.data.effect.value } },
          });
        }
        if (["armor"].includes(find.type)) {
          mergeObject(update, {
            data: {
              subcategory: find.data.data.subcategory,
            },
          });
        }
        if (["meleeweapon", "rangeweapon", "armor"].includes(find.type)) {
          mergeObject(update, {
            data: {
              structure: {
                max: find.data.data.structure.max,
                value: find.data.data.structure.value,
              },
            },
          });
        }
        this.updateMacro(update, find);
        return update;
      };
      await this.updateVals(actor, condition, updator);
    }
  }
}
