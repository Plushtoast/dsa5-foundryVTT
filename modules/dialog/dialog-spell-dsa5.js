import DPS from '../system/automation/derepositioningsystem.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5Dialog from './dialog-dsa5.js';
import DialogShared from './dialog-shared.js';

import { SituationalModifiersWidget } from '../system/helpers/situational-modifiers-widget.js';
const { duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

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

  static DEFAULT_OPTIONS = {
    position: {
      width: 700
    },
    window: {
      resizable: true,
    },
  };

  static bigTimes = [5, 30, 120, 480, 960, 1920];

  async prepareFormRecall(html) {
    await super.prepareFormRecall(html);
    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    DPS.lightLevel(actor, html);
    html.find('.spellModifier').trigger('change');
  }

  static getRollButtons(testData, dialogOptions, resolve, reject) {
    const buttons = DSA5Dialog.getRollButtons(testData, dialogOptions, resolve, reject);
    if (['spell', 'liturgy'].includes(testData.source.type)) {
      const LZ = Number(testData.source.system.castingTime.value);
      const progress = testData.source.system.castingTime.progress;
      let modified = testData.source.system.castingTime.modified;
      if (LZ && testData.extra.speaker.token != 'emptyActor') {
        const progressLabel = modified > 0 ? ` (${progress}/${modified})` : '';
        buttons.push(
          {
            action: 'reloadButton',
            label: `${_loc('SPELL.reload')}${progressLabel}`,
            callback: async (event, button, dialog) => {
              const dlg = $(button.form);
              const actor = await DSA5_Utility.getSpeaker(testData.extra.speaker);
              const reloadUpdate = {
                'system.castingTime.progress': progress + 1,
              };
              if (modified == 0) {
                modified = Number(dlg.find('.castingTime').text()) - 1;
                reloadUpdate['system.castingTime.modified'] = modified;
              }
              await actor.items.get(testData.source._id).update(reloadUpdate);
              const infoMsg = _loc('SPELL.isReloading', {
                actor: actor.token?.name || actor.prototypeToken.name,
                item: testData.source.name,
                status: `${progress + 1}/${modified}`,
              });
              await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
            },
          },
        );
      }
    }
    return buttons;
  }

  async applyTransformations(source, parent) {
    const widget = this.getSituationalModifiersWidget(parent);
    const baseModifiers = widget?.getModifiers().filter((modifier) => !modifier.extension) || [];
    const mods = [];
    const rollModifierKeys = Object.keys(DSA5SpellDialog.rollModifiers).map((x) => `${x}.mod`);
    this.dialogData.renderData.rollModifiersPrepared = duplicate(this.dialogData.renderData.rollModifiers);
    for (const k of parent.find('.specAbs.active')) {
      const item = await fromUuid(k.dataset.uuid);
      if (!item) continue;

      for (const ef of item.effects) {
        for (const change of ef.system.changes) {
          if (DSA5SpellDialog.rollChanges.includes(change.key)) {
            let name = item.name.split(' - ');
            const typeName = _loc(`MODS.${change.key}`);
            name = `${name[1] || name[0]}`;
            mods.push({
              extension: true,
              selected: true,
              name: `${name} - ${typeName}`,
              source: _loc('spellextension'),
              type: change.key,
              value: /^-?\d+(?:\.\d+)?$/.test(String(change.value)) ? Number(change.value) : change.value,
            });
          } else if (change.key == 'macro.transform') {
            await DSA5_Utility.callItemTransformationMacro(change.value, source, ef);
          } else if (rollModifierKeys.includes(change.key)) {
            ef.apply(this.dialogData.renderData.rollModifiersPrepared, change);
          } else if (change.key == 'system.effectFormula.value' && change.type === 'add') {
            source.system.effectFormula.value = source.system.effectFormula.value.split(',').map(x => {
              return x + change.value
            }).join(',');
          } else {
            ef.apply(source, change);
          }
        }
      }
    }
    const extensionMod = this.dialogData.renderData.rollModifiersPrepared.extensionModifier.mod;
    if (extensionMod) {
      const typeName = _loc(`ABBR.modifiers`);
      const ext = _loc('spellextension');
      mods.push({
        extension: true,
        selected: true,
        name: `${ext} - ${typeName}`,
        source: ext,
        value: extensionMod,
      });
    }
    widget?.setModifiers([...baseModifiers, ...mods]);
  }

  static setData(actor, type, renderData) {
    const rollModifiers = duplicate(DSA5SpellDialog.rollModifiers);
    const tt = `${type}RollModifiers`;
    if (actor.system[tt]) {
      for (const key of Object.keys(actor.system[tt])) {
        rollModifiers[key].mod += Number(actor.system[tt][key]?.mod ?? 0);
      }
    }
    return rollModifiers;
  }

  async recalcSpellModifiers(html, event) {
    const parent = html;
    const source = duplicate(this.dialogData.source);
    RuleChaos.ensureNumber(source);
    const castingTime = parent.find('.castingTime');
    const aspcost = parent.find('.aspcost');
    const reach = parent.find('.reach');
    const maintainCost = parent.find('.maintainCost');

    const bigCasts = parent.find('.ritual').length > 0;
    await this.applyTransformations(source, parent);

    const maxMods = parent.find('.maxMods');
    if (parent.find('.spellModifier:checked').length > Number(maxMods.text())) {
      if (event) event.currentTarget.checked = false;
      maxMods.addClass('emphasize');
      setTimeout(function () {
        maxMods.removeClass('emphasize');
      }, 600);
      return;
    }

    for (const key of Object.keys(this.dialogData.renderData.rollModifiersPrepared)) {
      const val = this.dialogData.renderData.rollModifiersPrepared[key].mod;
      html.find(`.${key}Label`).text(`(${val})`);
      html.find(`#${key}`).val(val);
    }

    const changeCast = html.find('.canChangeCastingTime');
    if (source.system.canChangeCastingTime.value) {
      if (changeCast.is(':empty')) {
        changeCast.html(await renderTemplate('systems/dsa5/templates/dialog/parts/canChangeCastingTime.hbs', { rollModifiers: this.dialogData.renderData.rollModifiers }));
        this.setPosition({ height: 'auto' });
      }
    } else {
      if (!changeCast.is(':empty')) {
        changeCast.html('');
        this.setPosition({ height: 'auto' });
      }
    }

    const baseAsp = source.system.AsPCost.value;
    const baseReach = source.system.range.value;
    const baseCastingTime = source.system.castingTime.value;

    let newPosition = baseAsp;
    let newMaintainCost = source.system.maintainCost.value;

    parent.find('.variableBaseCost')[source.system.variableBaseCost ? 'show' : 'hide']();
    let mod = 0;
    parent.find('.spellModifier[data-cost]:checked').each(function (index, element) {
      const factor = element.dataset.cost < 0 ? 0.5 : 2;
      newPosition = newPosition * factor;
      if (newMaintainCost != '' && newMaintainCost != undefined) {
        const maintains = String(newMaintainCost).split(' ');
        maintains[0] = Math.max(Number(maintains[0]) * factor);
        newMaintainCost = maintains.join(' ');
      }
      mod += Number(element.value);
    });
    if (newPosition < 1) {
      if (event) event.currentTarget.checked = false;
    } else {
      aspcost.text(Math.round(newPosition));
      maintainCost.text(newMaintainCost);
      aspcost.attr('data-mod', mod);
    }

    mod = 0;
    newPosition = baseCastingTime;
    parent.find('.spellModifier[data-casting-time]:checked').each(function (index, element) {
      if (bigCasts) {
        const ind = DSA5SpellDialog.bigTimes.indexOf(Number(newPosition));
        if (ind != undefined) {
          const newIndex = ind + (element.value > 0 ? 1 : -1);
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
    let newReach = _loc('ReverseSpellRanges.' + baseReach);
    reach.text(baseReach);
    parent.find('.spellModifier[data-reach]:checked').each(function (index, element) {
      if (newReach == 'self') {
        element.checked = false;
      } else if (newReach == 'touch') {
        reach.text('4 ' + _loc('step'));
        mod += Number(element.value);
      } else {
        const val = baseReach.split(' ');
        newReach = Number(val[0]);
        if (isNaN(newReach)) {
          if (event) event.currentTarget.checked = false;
          ui.notifications.error('DSAError.RangeCannotBeParsed', {
            localize: true,
          });
        } else {
          reach.text(newReach * 2 + ' ' + _loc('step'));
          mod += Number(element.value);
        }
      }
    });
    reach.attr('data-mod', mod);
    html.find('.reloadButton').prop('disabled', Number(html.find('.castingTime').text()) < 2);

    this.calculateProbability();
  }

  async calculateProbability() {
    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    if (!actor) return;

    const html = $(this.element);
    const data = new foundry.applications.ux.FormDataExtended(html.find('form')[0]).object;
    data.situationalModifiers = SituationalModifiersWidget.collectFormModifiers(html);

    const fwBase = Number(this.dialogData.source.system.talentValue.value) || 0;
    const fwDialog = Number(data.fw) || 0;
    const fw = fwBase + fwDialog + (await DiceDSA5._situationalModifiers(data, 'FW'));

    const maintainedSpells = Number(html.find('[name=maintainedSpells]').val()) || 0;
    const mod =
      (await DiceDSA5._situationalModifiers(data)) +
      html
        .find('input.spellModifier:checked')
        .map((i, x) => Number(x.value))
        .get()
        .reduce((a, b) => a + b, 0) +
      maintainedSpells * -1;

    super.calculateProbability(actor, this.dialogData.source, mod, fw);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element)
    html.find('.reloadButton').prop('disabled', Number(html.find('.castingTime').text()) < 2);

    html.find('.specAbs').on('mousedown', (ev) => {
      $(ev.currentTarget).toggleClass('active');
      this.recalcSpellModifiers(html);
    });

    html.find('.variableBaseCost').on('change', (ev) => {
      const parent = $(ev.currentTarget).parents('.skill-test');
      const oldVal = parent.find('.aspcost').attr('data-base');
      const newVal = $(ev.currentTarget).val();
      parent.find('.aspcost').attr('data-base', newVal);
      parent.find('.aspcost').text((Number(parent.find('.aspcost').text()) * newVal) / oldVal);
    });

    html.on('change', '.spellModifier', (event) => this.recalcSpellModifiers(html, event));
    html.on('change', 'input,select', () => this.calculateProbability());
    html.on('mousedown', '.quantity-click', () => this.calculateProbability());

    const targets = this.currentTargets ?? this.readTargets();

    if (targets.length == 0) {
      this.setRollButtonWarning();
    }

    this.calculateProbability();
  }
}
