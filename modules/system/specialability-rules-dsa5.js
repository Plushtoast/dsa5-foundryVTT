import DSA5 from './config-dsa5.js';
import ItemRulesDSA5 from './item-rules-dsa5.js';
import Select2Dialog from '../dialog/select2Dialog.js';
import APTracker from './ap-tracker.js';
const { duplicate } = foundry.utils;

export default class SpecialabilityRulesDSA5 extends ItemRulesDSA5 {
  static setupFunctions() {}

  static async abilityAdded(actor, item) {
    if (DSA5.addAbilityRules[item.name])
      DSA5.addAbilityRules[item.name](actor, item);
  }

  static async abilityRemoved(actor, item, render = true) {
    if (DSA5.removeAbilityRules[item.name]) {
      DSA5.removeAbilityRules[item.name](actor, item);
    }
    let xpCost = SpecialabilityRulesDSA5.calcAPCostSum(item);
    xpCost =
      (await SpecialabilityRulesDSA5.refundFreelanguage(
        item,
        actor,
        xpCost,
        render,
      )) * -1;
    await actor._updateAPs(xpCost, {}, { render });
    await APTracker.track(actor, { type: 'item', item, state: -1 }, xpCost);
  }

  static async _specialabilityReturnFunction(actor, item, typeClass, adoption) {
    if (item == null) return;

    item = duplicate(item);

    if (adoption != null) {
      //Different Apval for multiple same vantages
      if (/,/.test(item.system.APValue.value)) {
        let name = `${item.name.replace(' ()', '')} (${adoption.name}`;
        item.system.APValue.value = item.system.APValue.value
          .split(',')
          [
            actor.items.filter(
              (x) => x.type == item.type && x.name.includes(name),
            ).length
          ].trim();
      }
      SpecialabilityRulesDSA5.simpleAdoption(
        item,
        adoption,
        item.name,
        DSA5.AbilitiesNeedingAdaption,
      );

      item.name = `${item.name.replace(' ()', '')} (${adoption.name}${adoption.customEntry ? ', ' + adoption.customEntry : ''})`;

      if (
        adoption.system &&
        adoption.system.StF?.value &&
        /\//.test(item.system.APValue.value)
      )
        item.system.APValue.value = item.system.APValue.value
          .split('/')
          [adoption.system.StF.value.charCodeAt(0) - 65].trim();
    }
    let res = actor.items.find((i) => {
      return i.type == typeClass && i.name == item.name;
    });
    if (res) {
      let vantage = duplicate(res);
      let xpCost = await SpecialabilityRulesDSA5.isFreeLanguage(
        item,
        actor,
        /;/.test(vantage.system.APValue.value)
          ? vantage.system.APValue.value
              .split(';')
              .map((x) => Number(x.trim()))[vantage.system.step.value]
          : vantage.system.APValue.value,
        false,
      );
      if (
        vantage.system.step.value + 1 <= vantage.system.maxRank.value &&
        (await actor.checkEnoughXP(xpCost))
      ) {
        vantage.system.step.value += 1;
        await actor._updateAPs(xpCost, {}, { render: false });
        await actor.updateEmbeddedDocuments('Item', [vantage]);
        await SpecialabilityRulesDSA5.abilityAdded(actor, vantage);
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
    } else {
      let xpCost = await SpecialabilityRulesDSA5.isFreeLanguage(
        item,
        actor,
        item.system.APValue.value.split(';').map((x) => x.trim())[0],
        false,
      );
      if (await actor.checkEnoughXP(xpCost)) {
        await SpecialabilityRulesDSA5.abilityAdded(actor, item);
        await actor._updateAPs(xpCost, {}, { render: false });
        const createdItem = (
          await actor.createEmbeddedDocuments('Item', [item])
        )[0];
        await APTracker.track(
          actor,
          { type: 'item', item: createdItem, state: 1 },
          xpCost,
        );
      }
    }
  }

  static async refundFreelanguage(item, actor, xpCost, render = true) {
    if (
      item.system.category.value == 'language' &&
      actor.system.freeLanguagePoints
    ) {
      let freePoints = Number(actor.system.freeLanguagePoints.value);
      let languageCost = actor.items
        .filter(
          (x) =>
            x.type == 'specialability' && x.system.category.value == 'language',
        )
        .reduce((a, b) => {
          return (
            a + Number(b.system.step.value) * Number(b.system.APValue.value)
          );
        }, 0);
      let usedPoints = Math.min(freePoints, languageCost - Number(xpCost));
      let remainingFreepoints = Math.max(0, freePoints - usedPoints);
      await actor.update(
        {
          'system.freeLanguagePoints.used': Math.min(
            freePoints,
            Number(usedPoints),
          ),
        },
        { render },
      );
      xpCost = Math.max(0, xpCost - remainingFreepoints);
    }
    return xpCost;
  }

  static async isFreeLanguage(item, actor, xpCost, render = true) {
    if (
      item.system.category.value == 'language' &&
      actor.system.freeLanguagePoints
    ) {
      let freePoints = Number(actor.system.freeLanguagePoints.value);
      let languageCost = actor.items
        .filter(
          (x) =>
            x.type == 'specialability' && x.system.category.value == 'language',
        )
        .reduce((a, b) => {
          return (
            a + Number(b.system.step.value) * Number(b.system.APValue.value)
          );
        }, 0);
      let usedPoints = Math.min(freePoints, languageCost);
      let remainingFreepoints = Math.max(0, freePoints - usedPoints);
      await actor.update(
        {
          'system.freeLanguagePoints.used': Math.min(
            freePoints,
            Number(usedPoints) + Number(xpCost),
          ),
        },
        { render },
      );
      xpCost = Math.max(0, xpCost - remainingFreepoints);
    }
    return xpCost;
  }

  static async needsAdoption(actor, item, typeClass) {
    let rule = DSA5.AbilitiesNeedingAdaption[item.name];
    if (rule) {
      let template;
      let callback;
      if (rule.items == 'text') {
        template = await renderTemplate(
          'systems/dsa5/templates/dialog/requires-adoption-string-dialog.html',
          { original: item },
        );
        callback = function (dlg) {
          const value = dlg.entryselection.value;
          const adoption = { name: value };
          SpecialabilityRulesDSA5._specialabilityReturnFunction(
            actor,
            item,
            typeClass,
            adoption,
          );
        };
      } else {
        if (rule.items == 'array') {
          let items = rule.elems.map((x) => {
            return { name: x };
          });
          template = await renderTemplate(
            'systems/dsa5/templates/dialog/requires-adoption-dialog.html',
            { items: items, original: item, area: rule.area },
          );
          callback = function (dlg) {
            const value = dlg.entryselection.value;
            const adoption = items.find((x) => x.name == value);
            SpecialabilityRulesDSA5._specialabilityReturnFunction(
              actor,
              item,
              typeClass,
              adoption,
            );
          };
        } else {
          let items = actor.items
            .filter((x) => rule.items.includes(x.type))
            .sort((a, b) => a.name.localeCompare(b.name));
          template = await renderTemplate(
            'systems/dsa5/templates/dialog/requires-adoption-dialog.html',
            { items: items, original: item, area: rule.area },
          );
          callback = function (dlg) {
            const value = dlg.entryselection.value;
            let adoption = items.find((x) => x.name == value);
            adoption.customEntry = dlg.custom?.value || '';
            SpecialabilityRulesDSA5._specialabilityReturnFunction(
              actor,
              item,
              typeClass,
              adoption,
            );
          };
        }
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
      SpecialabilityRulesDSA5._specialabilityReturnFunction(
        actor,
        item,
        typeClass,
        null,
      );
    }
  }

  static hasAbility(actorData, talent) {
    return super.hasItem(actorData, talent, ['specialability']);
  }

  static abilityStep(actorData, talent) {
    return super.itemStep(actorData, talent, ['specialability']);
  }

  static abilityAsModifier(actor, talent, factor = 1, startsWith = false) {
    return super.itemAsModifier(
      actor,
      talent,
      factor,
      ['specialability'],
      startsWith,
    );
  }
}

ItemRulesDSA5.children['SpecialabilityRulesDSA5'] = SpecialabilityRulesDSA5;
