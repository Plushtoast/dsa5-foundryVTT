const { mergeObject, getProperty, deepClone, diffObject, isEmpty } = foundry.utils;

export default class Migrakel {
  static async showDialog(content, migrateAll = false) {
    let result = false;
    const buttons = [
      {
        action: 'yes',
        icon: 'fa fa-check',
        label: 'update',
        default: true,
        callback: () => true,
      },
      {
        action: 'cancel',
        icon: 'fas fa-times',
        label: 'cancel',
        callback: () => false,
      },
    ];
    if (migrateAll) {
      buttons.push({
        action: 'migrateAll',
        icon: 'fas fa-exclamation-triangle ',
        label: 'replace',
        callback: () => 2,
      });
    }

    try {
      result = await foundry.applications.api.DialogV2.wait({
        window: {
          title: 'Migrakel.Migration',
        },
        content: `<p>${content}</p>`,
        buttons,
      });
    } catch (e) {
      /* empty */
    }
    return result;
  }

  static async refreshStatusEffects(actor) {
    const removeEffects = [];
    for (const i of actor.effects) {
      if (i.origin) {
        removeEffects.push(i.id);
      }
    }
    await actor.deleteEmbeddedDocuments('ActiveEffect', removeEffects);
  }

  static itemTypeLabel(type) {
    const key = `TYPES.Item.${type}`;
    return game.i18n.has(key) ? _loc(key) : type;
  }

  static hasChanges(current, updated) {
    return !isEmpty(diffObject(current, updated));
  }

  static async buildUpdateCandidate(item, itemLibrary, updater) {
    let find = await itemLibrary.findCompendiumItem(item.name, item.type);
    if (find.length === 0) return null;

    find = find.find((x) => x.name == item.name && x.type == item.type);
    if (!find) return null;

    const currentData = item.toObject();
    const newData = mergeObject(deepClone(currentData), updater(find));
    if (!this.hasChanges(currentData, newData)) return null;

    return {
      id: item.id,
      item,
      name: item.name,
      type: item.type,
      typeLabel: this.itemTypeLabel(item.type),
      newData,
    };
  }

  static async showDryRunDialog(actor, candidates) {
    const grouped = candidates.reduce((groups, candidate) => {
      groups[candidate.typeLabel] ??= [];
      groups[candidate.typeLabel].push(candidate);
      return groups;
    }, {});
    const groups = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b, game.i18n.lang))
      .map(([label, entries]) => ({
        label,
        count: entries.length,
        entries: entries.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang)),
      }));
    const content = await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/dialog/migrakel-dry-run.hbs', {
      hint: _loc('Migrakel.dryRunHint', { name: actor.name, count: candidates.length }),
      groups,
    });

    try {
      return await foundry.applications.api.DialogV2.wait({
        window: { title: 'Migrakel.dryRun', resizable: true },
        content,
        position: {
          width: 600,
        },
        buttons: [
          {
            action: 'yes',
            icon: 'fa fa-check',
            label: 'update',
            default: true,
            callback: (event, button) => Array.from(button.form.querySelectorAll('input[name="migrakelItems"]:checked')).map((input) => input.value),
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'cancel',
            callback: () => null,
          },
        ],
      });
    } catch (e) {
      return null;
    }
  }

  static async updateVals(actor, condition, updater, options = {}) {
    const itemLibrary = game.dsa5.itemLibrary;
    const itemsToDelete = [];
    const itemsToCreate = [];
    const candidates = [];
    const bagCandidates = [];
    const itemCandidates = [];
    const containersIDs = new Map();
    if (condition({ type: 'equipment' })) {
      for (const item of actor.items.filter((x) => x.type == 'equipment' && x.system.equipmentType.value == 'bags')) {
        const candidate = await this.buildUpdateCandidate(item, itemLibrary, updater);
        if (!candidate) continue;
        candidates.push(candidate);
        bagCandidates.push(candidate);
      }
    }

    for (const item of actor.items.filter((x) => condition(x) && !(x.type == 'equipment' && x.system.equipmentType.value == 'bags'))) {
      const candidate = await this.buildUpdateCandidate(item, itemLibrary, updater);
      if (!candidate) continue;
      candidates.push(candidate);
      itemCandidates.push(candidate);
    }

    if (!candidates.length) {
      if (!Migrakel.silent) ui.notifications.info('Migrakel.noChanges', { localize: true });
      return true;
    }

    const selectedIds = options.skipDryRun ? candidates.map((candidate) => candidate.id) : await this.showDryRunDialog(actor, candidates);
    if (!selectedIds) return false;

    const selected = new Set(selectedIds);
    if (!selected.size) return false;

    await this.refreshStatusEffects(actor);

    const selectedBags = bagCandidates.filter((candidate) => selected.has(candidate.id));
    const bagsToDelete = selectedBags.map((candidate) => candidate.id);
    if (selectedBags.length) {
      const result = await actor.createEmbeddedDocuments('Item', selectedBags.map((candidate) => candidate.newData));
      for (let k = 0; k < result.length; k++) {
        containersIDs.set(selectedBags[k].id, result[k].id);
        console.log(`MIGRATION - Updated ${selectedBags[k].name}`);
      }
      await actor.deleteEmbeddedDocuments('Item', bagsToDelete);
    }

    for (const candidate of itemCandidates.filter((entry) => selected.has(entry.id))) {
      const newData = candidate.newData;
      if (newData.system.parent_id && containersIDs.has(newData.system.parent_id)) newData.system.parent_id = containersIDs.get(newData.system.parent_id);

      console.log(`MIGRATION - Updated ${candidate.name}`);
      itemsToCreate.push(newData);
      itemsToDelete.push(candidate.id);
    }

    if (containersIDs.size) {
      const selectedItems = new Set(itemsToDelete);
      const parentUpdates = actor.items
        .filter((item) => !selectedItems.has(item.id) && containersIDs.has(item.system?.parent_id))
        .map((item) => ({ _id: item.id, 'system.parent_id': containersIDs.get(item.system.parent_id) }));
      if (parentUpdates.length) await actor.updateEmbeddedDocuments('Item', parentUpdates);
    }

    if (itemsToCreate.length) await actor.createEmbeddedDocuments('Item', itemsToCreate);
    if (itemsToDelete.length) await actor.deleteEmbeddedDocuments('Item', itemsToDelete);

    if (!Migrakel.silent) ui.notifications.info('Migrakel.migrationDone', { localize: true });
    return true;
  }

  static async updateSpellsAndLiturgies(actor, preChoice = undefined, options = {}) {
    const res = preChoice ?? (await this.showDialog(_loc('Migrakel.spells'), true));
    const condition = (x) => {
      return ['spell', 'liturgy', 'ritual', 'ceremony', 'spellextension', 'blessing'].includes(x.type);
    };
    if (res == 2) {
      const updator = (find) => {
        const upd = find.toObject();
        delete upd.system.talentValue;

        return upd;
      };
      await this.updateVals(actor, condition, updator, options);
    } else if (res) {
      const updator = (find) => {
        const upd = {
          effects: find.effects.toObject(),
        };
        if (!['spellextension', 'blessing'].includes(find.type))
          upd.system = {
            effectFormula: { value: find.system.effectFormula.value },
          };

        if (find.type == 'blessing')  {
          this.updateMacro(upd, find); 
        }
        return upd;
      };
      await this.updateVals(actor, condition, updator, options);
    }
    return res;
  }

  static async updateSpecialAbilities(actor, preChoice = undefined, options = {}) {
    const res = preChoice ?? (await this.showDialog(_loc('Migrakel.abilities')));
    if (res) {
      const updator = (find) => {
        const update = {
          effects: find.effects.toObject(),
        };
        if (['specialability', 'advantage', 'disadvantage', 'trait'].includes(find.type)) {
          mergeObject(update, {
            system: { effect: { value: find.system.effect.value } },
          });
        }
        if (find.type == 'specialability') {
          mergeObject(update, {
            system: {
              category: {
                value: find.system.category.value,
                sub: find.system.category.sub || 0
              },
              list: { value: find.system.list.value },
              effect: {
                value2: getProperty(find, 'system.effect.value2') || '',
                value3: getProperty(find, 'system.effect.value3') || '',
              },
            },
          });
          if (find.system.category.value == 'staff') {
            mergeObject(update, {
              system: {
                feature: getProperty(find, 'system.feature') || '',
                AsPCost: getProperty(find, 'system.AsPCost') || '',
                volume: Number(getProperty(find, 'system.volume')) || 0,
                artifact: getProperty(find, 'system.artifact') || '',
                permanentEffects: getProperty(find, 'system.permanentEffects') || false,
              },
            });
          }
        }
        this.updateMacro(update, find);
        return update;
      };

      const condition = (x) => {
        return ['specialability', 'advantage', 'disadvantage', 'trait', 'essence', 'imprint'].includes(x.type);
      };
      await this.updateVals(actor, condition, updator, options);
    }
    return res;
  }

  static async updateCombatskills(actor, preChoice = undefined, options = {}) {
    const res = preChoice ?? (await this.showDialog(_loc('Migrakel.cskills')));
    if (res) {
      const updator = (find) => {
        return {
          effects: find.effects.toObject(),
        };
      };
      const condition = (x) => {
        return ['combatskill'].includes(x.type);
      };
      await this.updateVals(actor, condition, updator, options);
    }
    return res;
  }

  static async updateSkills(actor, preChoice = undefined, options = {}) {
    const res = preChoice ?? (await this.showDialog(_loc('Migrakel.skills')));
    if (res) {
      const condition = (x) => {
        return ['skill'].includes(x.type);
      };
      const updator = (find) => {
        return {
          img: find.img,
          effects: find.effects.toObject(),
        };
      };
      await this.updateVals(actor, condition, updator, options);
    }
    return res;
  }

  static updateMacro(update, find) {
    const onUseActions = foundry.utils.deepClone(find.system.onUseActions || {});
    if (Object.keys(onUseActions).length > 0) {
      mergeObject(update, {
        system: { onUseActions },
      });
    }
  }

  static async updateGear(actor, preChoice = undefined, options = {}) {
    const choice = preChoice ?? (await this.showDialog(_loc('Migrakel.gear')));
    if (choice) {
      const condition = (x) => {
        return ['meleeweapon', 'armor', 'rangeweapon', 'equipment', 'poison', 'disease', 'consumable', 'ammunition'].includes(x.type);
      };
      const updator = (find) => {
        const update = {
          img: find.img,
          effects: find.effects.toObject(),
        };
        if (!['poison', 'consumable', 'disease'].includes(find.type)) {
          mergeObject(update, {
            system: { effect: { value: find.system.effect.value } },
          });
        }
        if (['armor'].includes(find.type)) {
          mergeObject(update, {
            system: {
              subcategory: find.system.subcategory,
            },
          });
        }
        if (['meleeweapon', 'rangeweapon', 'armor'].includes(find.type)) {
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
      await this.updateVals(actor, condition, updator, options);

      await actor.updateEmbeddedDocuments(
        'Item',
        actor.items
          .filter((x) => x.type == 'money')
          .map((x) => {
            return { _id: x.id, name: _loc(x.name) };
          }),
      );
    }
    return choice;
  }
}
