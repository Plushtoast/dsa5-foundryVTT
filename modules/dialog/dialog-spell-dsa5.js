import Actordsa5 from '../actor/actor-dsa5.js';
import DiceDSA5 from '../system/dice-dsa5.js';
import RuleChaos from '../system/rule_chaos.js';
import DSA5_Utility from '../system/utility-dsa5.js';
import DSA5Dialog from './dialog-dsa5.js';
import DialogShared from './dialog-shared.js';
const { mergeObject, duplicate } = foundry.utils;

export default class DSA5SpellDialog extends DialogShared {
  static rollChanges = ['defenseMalus'];

  static rollModifiers = {
    forceSpell: { mod: 1 },
    reduceCostSpell: { mod: -1 },
    increaseRangeSpell: { mod: -1 },
    increaseCastingTime: { mod: 1 },
    decreaseCastingTime: { mod: -1 },
    removeGesture: { mod: -2 },
    removeFormula: { mod: -2 },
    extensionModifier: { mod: 0 },
  };

  static get defaultOptions() {
    const options = super.defaultOptions;
    mergeObject(options, {
      width: 700,
      resizable: true,
    });
    return options;
  }

  static bigTimes = [5, 30, 120, 480, 960, 1920];

  async prepareFormRecall(html) {
    await super.prepareFormRecall(html);
    html.find('.spellModifier').trigger('change');
  }

  static getRollButtons(testData, dialogOptions, resolve, reject) {
    let buttons = DSA5Dialog.getRollButtons(
      testData,
      dialogOptions,
      resolve,
      reject,
    );
    if (['spell', 'liturgy'].includes(testData.source.type)) {
      const LZ = Number(testData.source.system.castingTime.value);
      const progress = testData.source.system.castingTime.progress;
      let modified = testData.source.system.castingTime.modified;
      if (LZ && testData.extra.speaker.token != 'emptyActor') {
        const progressLabel = modified > 0 ? ` (${progress}/${modified})` : '';
        mergeObject(buttons, {
          reloadButton: {
            label: `${game.i18n.localize('SPELL.reload')}${progressLabel}`,
            callback: async (dlg) => {
              const actor = await DSA5_Utility.getSpeaker(
                testData.extra.speaker,
              );
              let reloadUpdate = {
                _id: testData.source._id,
                'system.castingTime.progress': progress + 1,
              };
              if (modified == 0) {
                modified = Number(dlg.find('.castingTime').text()) - 1;
                reloadUpdate['system.castingTime.modified'] = modified;
              }
              await actor.updateEmbeddedDocuments('Item', [reloadUpdate]);
              const infoMsg = game.i18n.format('SPELL.isReloading', {
                actor: actor.token?.name || actor.prototypeToken.name,
                item: testData.source.name,
                status: `${progress + 1}/${modified}`,
              });
              await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
            },
          },
        });
      }
    }
    return buttons;
  }

  async applyTransformations(source, parent) {
    const sit = parent.find('[name="situationalModifiers"]');
    sit.find('option[data-extension="1"]').remove();
    const mods = [];
    const rollModifierKeys = Object.keys(DSA5SpellDialog.rollModifiers).map(
      (x) => `${x}.mod`,
    );
    this.dialogData.renderData.rollModifiersPrepared = duplicate(
      this.dialogData.renderData.rollModifiers,
    );
    for (let k of parent.find('.specAbs.active')) {
      const item = await fromUuid(k.dataset.uuid);
      if (!item) continue;

      for (let ef of item.effects) {
        for (let change of ef.changes) {
          if (DSA5SpellDialog.rollChanges.includes(change.key)) {
            let name = item.name.split(' - ');
            const typeName = game.i18n.localize(`MODS.${change.key}`);
            name = `${name[1] || name[0]}`;
            const tooltip = `${typeName}: ${change.value}<br/>${game.i18n.localize('spellextension')}: ${name}`;
            mods.push(
              `<option data-extension="1" selected="" data-tooltip="${tooltip}" data-type="${change.key}" value="${change.value}">${name} - ${typeName}</option>`,
            );
          } else if (change.key == 'macro.transform') {
            await DSA5_Utility.callItemTransformationMacro(
              change.value,
              source,
              ef,
            );
          } else if (rollModifierKeys.includes(change.key)) {
            ef.apply(this.dialogData.renderData.rollModifiersPrepared, change);
          } else {
            ef.apply(source, change);
          }
        }
      }
    }
    const extensionMod =
      this.dialogData.renderData.rollModifiersPrepared.extensionModifier.mod;
    if (extensionMod) {
      const typeName = game.i18n.localize(`ABBR.modifiers`);
      const ext = game.i18n.localize('spellextension');
      const tooltip = `${typeName}: ${extensionMod}<br/>${ext}`;
      mods.push(
        `<option data-extension="1" selected="" data-tooltip="${tooltip}" data-type="" value="${extensionMod}">${ext} - ${typeName}</option>`,
      );
    }
    sit.append(mods.join(''));
  }

  static setData(actor, type, renderData) {
    const rollModifiers = duplicate(DSA5SpellDialog.rollModifiers);
    const tt = `${type}RollModifiers`;
    if (actor.system[tt]) {
      for (let key of Object.keys(actor.system[tt])) {
        rollModifiers[key].mod += Number(actor.system[tt][key]?.mod ?? 0);
      }
    }
    return rollModifiers;
  }

  async recalcSpellModifiers(html, event) {
    const parent = html;
    const source = duplicate(this.dialogData.source);
    RuleChaos.ensureNumber(source);
    let castingTime = parent.find('.castingTime');
    let aspcost = parent.find('.aspcost');
    let reach = parent.find('.reach');
    let maintainCost = parent.find('.maintainCost');

    let bigCasts = parent.find('.ritual').length > 0;
    await this.applyTransformations(source, parent);

    let maxMods = parent.find('.maxMods');
    if (parent.find('.spellModifier:checked').length > Number(maxMods.text())) {
      if (event) event.currentTarget.checked = false;
      maxMods.addClass('emphasize');
      setTimeout(function () {
        maxMods.removeClass('emphasize');
      }, 600);
      return;
    }

    for (let key of Object.keys(
      this.dialogData.renderData.rollModifiersPrepared,
    )) {
      const val = this.dialogData.renderData.rollModifiersPrepared[key].mod;
      html.find(`.${key}Label`).text(`(${val})`);
      html.find(`#${key}`).val(val);
    }

    const changeCast = html.find('.canChangeCastingTime');
    if (source.system.canChangeCastingTime.value == 'true') {
      if (changeCast.is(':empty')) {
        changeCast.html(
          await renderTemplate(
            'systems/dsa5/templates/dialog/parts/canChangeCastingTime.html',
            { rollModifiers: this.dialogData.renderData.rollModifiers },
          ),
        );
        this.setPosition({ height: 'auto' });
      }
    } else {
      if (!changeCast.is(':empty')) {
        changeCast.html('');
        this.setPosition({ height: 'auto' });
      }
    }

    let baseAsp = source.system.AsPCost.value;
    let baseReach = source.system.range.value;
    let baseCastingTime = source.system.castingTime.value;

    let newPosition = baseAsp;
    let newMaintainCost = source.system.maintainCost.value;

    parent
      .find('.variableBaseCost')
      [source.system.variableBaseCost == 'true' ? 'show' : 'hide']();
    let mod = 0;
    parent
      .find('.spellModifier[data-cost]:checked')
      .each(function (index, element) {
        newPosition = newPosition * (element.value < 0 ? 0.5 : 2);
        if (newMaintainCost != '' && newMaintainCost != undefined) {
          let maintains = String(newMaintainCost).split(' ');
          maintains[0] = Math.max(
            Number(maintains[0]) * (element.value < 0 ? 0.5 : 2),
          );
          newMaintainCost = maintains.join(' ');
        }
        mod += Number(element.value);
      });
    if (newPosition < 1) {
      if (event) event.currentTarget.checked = false;
    } else {
      aspcost.text(newPosition);
      maintainCost.text(newMaintainCost);
      aspcost.attr('data-mod', mod);
    }

    mod = 0;
    newPosition = baseCastingTime;
    parent
      .find('.spellModifier[data-castingTime]:checked')
      .each(function (index, element) {
        if (bigCasts) {
          let ind = DSA5SpellDialog.bigTimes.indexOf(Number(newPosition));
          if (ind != undefined) {
            let newIndex = ind + (element.value > 0 ? 1 : -1);
            if (newIndex < DSA5SpellDialog.bigTimes.length && newIndex >= 0) {
              newPosition = DSA5SpellDialog.bigTimes[newIndex];
            } else {
              ui.notifications.error('DSAError.CastingTimeLimit', {
                localize: true,
              });
            }
          } else {
            ui.notifications.error('DSAError.TimeCannotBeParsed', {
              localize: true,
            });
          }
        } else {
          newPosition = newPosition * (element.value > 0 ? 2 : 0.5);
        }

        mod += Number(element.value);
      });
    if (newPosition < 1) {
      if (event) event.currentTarget.checked = false;
    } else {
      castingTime.text(newPosition);
      castingTime.attr('data-mod', mod);
    }

    mod = 0;
    let newReach = game.i18n.localize('ReverseSpellRanges.' + baseReach);
    reach.text(baseReach);
    parent
      .find('.spellModifier[data-reach]:checked')
      .each(function (index, element) {
        if (newReach == 'self') {
          element.checked = false;
        } else if (newReach == 'touch') {
          reach.text('4 ' + game.i18n.localize('step'));
          mod += Number(element.value);
        } else {
          let val = baseReach.split(' ');
          newReach = Number(val[0]);
          if (isNaN(newReach)) {
            if (event) event.currentTarget.checked = false;
            ui.notifications.error('DSAError.RangeCannotBeParsed', {
              localize: true,
            });
          } else {
            reach.text(newReach * 2 + ' ' + game.i18n.localize('step'));
            mod += Number(element.value);
          }
        }
      });
    reach.attr('data-mod', mod);
    html
      .find('.reloadButton')
      .prop('disabled', Number(html.find('.castingTime').text()) < 2);

    this.calculateProbability();
  }

  async calculateProbability() {
    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    const data = new FormDataExtended(this.element.find('form')[0]).object;
    data.situationalModifiers = Actordsa5._parseModifiers(this._element);
    const fw =
      this.dialogData.source.system.talentValue.value +
      data.fw +
      (await DiceDSA5._situationalModifiers(data, 'FW'));
    let mod =
      (await DiceDSA5._situationalModifiers(data)) +
      $(this.element)
        .find('input.spellModifier:checked')
        .map((i, x) => Number(x.value))
        .get()
        .reduce((a, b) => a + b, 0) +
      $(this.element).find('[name=maintainedSpells]')[0].value * -1;

    super.calculateProbability(actor, this.dialogData.source, mod, fw);
  }

  activateListeners(html) {
    super.activateListeners(html);
    html
      .find('.reloadButton')
      .prop('disabled', Number(html.find('.castingTime').text()) < 2);

    html.find('.specAbs').mousedown((ev) => {
      $(ev.currentTarget).toggleClass('active');
      this.recalcSpellModifiers(html);
    });

    html.find('.variableBaseCost').change((ev) => {
      let parent = $(ev.currentTarget).parents('.skill-test');
      let oldVal = parent.find('.aspcost').attr('data-base');
      let newVal = $(ev.currentTarget).val();
      parent.find('.aspcost').attr('data-base', newVal);
      parent
        .find('.aspcost')
        .text((Number(parent.find('.aspcost').text()) * newVal) / oldVal);
    });

    html.on('change', '.spellModifier', (event) =>
      this.recalcSpellModifiers(html, event),
    );
    html.on('change', 'input,select', () => this.calculateProbability());
    html.on('mousedown', '.quantity-click', () => this.calculateProbability());

    let targets = this.readTargets();

    if (targets.length == 0) {
      this.setRollButtonWarning();
    }
    // not great
    const that = this;
    this.checkTargets = setInterval(function () {
      targets = that.compareTargets(html, targets);
    }, 500);
  }
}
