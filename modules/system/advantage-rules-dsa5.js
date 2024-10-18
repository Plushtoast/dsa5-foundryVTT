import DSA5 from './config-dsa5.js';
import ItemRulesDSA5 from './item-rules-dsa5.js';
import Select2Dialog from '../dialog/select2Dialog.js';
import APTracker from './ap-tracker.js';
const { duplicate } = foundry.utils;

export default class AdvantageRulesDSA5 extends ItemRulesDSA5 {
  static setupFunctions() {}
  static async vantageAdded(actor, item) {
    if (game.dsa5.config.addvantageRules[item.name]) game.dsa5.config.addvantageRules[item.name](actor, item);
  }

  static async vantageRemoved(actor, item, render = true) {
    if (game.dsa5.config.removevantageRules[item.name]) game.dsa5.config.removevantageRules[item.name](actor, item);

    let xpCost = AdvantageRulesDSA5.calcAPCostSum(item);
    xpCost = (await AdvantageRulesDSA5.removeSingularVantages(actor, item, xpCost)) * -1;
    await actor._updateAPs(xpCost, {}, { render });
    await APTracker.track(actor, { type: 'item', item, state: -1 }, xpCost);
  }

  /** APValue formatting: / for Stf steps starting with A         */
  /** APValue formatting: , for first, second .. variant of element  */
  /** APValue formatting: ; for first second .. step */
  /**  */

  static async _vantageReturnFunction(actor, item, typeClass, adoption) {
    if (item == null) return;
    item = duplicate(item);

    //Different Apval for multiple same vantages
    if (/,/.test(item.system.APValue.value)) {
      const name = item.name.replace(' ()', '');
      item.system.APValue.value = item.system.APValue.value.split(',')[actor.items.filter((x) => x.type == item.type && x.name.includes(name)).length].trim();
    }

    if (adoption != null) {
      AdvantageRulesDSA5.simpleAdoption(item, adoption, item.name, DSA5.vantagesNeedingAdaption);
      item.name = `${item.name.replace(' ()', '')} (${adoption.name})`;
      if (adoption.system) item.system.APValue.value = item.system.APValue.value.split('/')[adoption.system.StF.value.charCodeAt(0) - 65].trim();
    }
    const res = actor.items.find((i) => i.type == typeClass && i.name == item.name);
    let xpCost;
    if (res) {
      const vantage = duplicate(res);
      xpCost = Number(
        /;/.test(vantage.system.APValue.value) ? vantage.system.APValue.value.split(';').map((x) => Number(x.trim()))[vantage.system.step.value] : vantage.system.APValue.value,
      );

      if (vantage.system.step.value + 1 <= vantage.system.max.value && (await actor.checkEnoughXP(xpCost))) {
        vantage.system.step.value += 1;
        xpCost = this.addSingularVantages(actor, vantage, xpCost);
        await actor._updateAPs(xpCost, {}, { render: false });
        await actor.updateEmbeddedDocuments('Item', [vantage]);
        await AdvantageRulesDSA5.vantageAdded(actor, vantage);
        await APTracker.track(
          actor,
          {
            type: 'item',
            item: res,
            previous: vantage.system.step.value - 1,
            next: vantage.system.step.value,
          },
          xpCost,
        );
      }
    } else if (await actor.checkEnoughXP((xpCost = Number(item.system.APValue.value.split(';').map((x) => x.trim())[0])))) {
      await AdvantageRulesDSA5.vantageAdded(actor, item);
      xpCost = this.addSingularVantages(actor, item, xpCost);
      await actor._updateAPs(xpCost, {}, { render: false });
      const createdItem = (await actor.createEmbeddedDocuments('Item', [item]))[0];
      await APTracker.track(actor, { type: 'item', item: createdItem, state: 1 }, xpCost);
    }
  }

  static async needsAdoption(actor, item, typeClass) {
    if (DSA5.vantagesNeedingAdaption[item.name]) {
      let template;
      let callback;
      if (DSA5.vantagesNeedingAdaption[item.name].items == 'text') {
        template = await renderTemplate('systems/dsa5/templates/dialog/requires-adoption-string-dialog.html', { original: item });
        callback = function (dlg) {
          const adoption = { name: dlg.entryselection.value };
          AdvantageRulesDSA5._vantageReturnFunction(actor, item, typeClass, adoption);
        };
      } else {
        let items = actor.items.filter((x) => DSA5.vantagesNeedingAdaption[item.name].items.includes(x.type));
        template = await renderTemplate('systems/dsa5/templates/dialog/requires-adoption-dialog.html', { items: items, original: item });
        callback = function (dlg) {
          const value = dlg.entryselection.value;
          const adoption = items.find((x) => x.name == value);
          AdvantageRulesDSA5._vantageReturnFunction(actor, item, typeClass, adoption);
        };
      }
      new Select2Dialog({
        window: {
          title: 'DIALOG.ItemRequiresAdoption',
        },
        content: template,
        buttons: [
          {
            action: 'yes',
            icon: 'fa fa-check',
            label: 'yes',
            callback: (event, button, dialog) => callback(button.form.elements),
          },
          {
            action: 'no',
            icon: 'fas fa-times',
            label: 'cancel',
          },
        ],
      }).render(true);
    } else {
      AdvantageRulesDSA5._vantageReturnFunction(actor, item, typeClass, null);
    }
  }

  static addSingularVantages(actor, item, xpCost) {
    const filter = (i, reg, item) => i.type == 'disadvantage' && reg.test(i.name);
    return AdvantageRulesDSA5._calculateSingularVantages(item, actor, xpCost, filter);
  }

  static removeSingularVantages(actor, item, xpCost) {
    const filter = (i, reg, item) => i.type == 'disadvantage' && reg.test(i.name) && i.name != item.name;
    return AdvantageRulesDSA5._calculateSingularVantages(item, actor, xpCost, filter);
  }

  static _calculateSingularVantages(item, actor, xpCost, filter, result = (itemXPCostSum, maxPaid) => Math.min(0, itemXPCostSum - maxPaid)) {
    if (item.type != 'disadvantage') return xpCost;

    for (const id of ['principles', 'obligations']) {
      const reg = new RegExp(`^${game.i18n.localize('LocalizedIDs.' + id)} \\\(`);
      if (reg.test(item.name)) {
        const shouldBeSingular = actor.items.filter((i) => filter(i, reg, item));
        const maxPaid = Math.min(0, ...shouldBeSingular.map((x) => AdvantageRulesDSA5.calcAPCostSum(x)));
        const itemXPCostSum = AdvantageRulesDSA5.calcAPCostSum(item);
        xpCost = result(itemXPCostSum, maxPaid);
      }
    }
    return xpCost;
  }

  static reduceSingularVantages(actor, item, xpCost) {
    const filter = (i, reg, item) => i.type == 'disadvantage' && reg.test(i.name) && i.name != item.name;
    const result = (itemXPCostSum, maxPaid) => {
      return itemXPCostSum < maxPaid ? xpCost : 0;
    };
    return AdvantageRulesDSA5._calculateSingularVantages(item, actor, xpCost, filter, result);
  }

  static hasVantage(actor, talent) {
    return super.hasItem(actor, talent, ['advantage', 'disadvantage']);
  }

  static vantageStep(actor, talent) {
    return super.itemStep(actor, talent, ['advantage', 'disadvantage']);
  }

  static getVantageAsModifier(actor, talent, factor = 1, startsWith = false, selected = false) {
    return super.itemAsModifier(actor, talent, factor, ['advantage', 'disadvantage'], startsWith, selected);
  }
}

ItemRulesDSA5.children['AdvantageRulesDSA5'] = AdvantageRulesDSA5;
