import RuleChaos from '../system/rules/rule_chaos.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';

import { AddTargetDialog } from './addTargetDialog.js';
import { RollDialogExtensions } from './roll-dialog-extensions.js';
const { renderTemplate } = foundry.applications.handlebars;

export default class DialogShared extends foundry.applications.api.DialogV2 {
  static roman = ['', ' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

  recallSettings(speaker, source, mode, renderData) {
    this.recallData = game.dsa5.memory.recall(speaker, source, mode);
    this.dialogData = {
      mode,
      speaker,
      source,
      renderData,
    };
    return this;
  }

  setRollButtonWarning() {
    if (this.dialogData.mode !== 'attack') return '';

    const noTarget = _loc('DIALOG.noTarget');
    return `<span class="missingTarget"><i class="fas fa-exclamation-circle"></i> ${noTarget}</span>`;
  }

  setMultipleTargetsWarning() {
    if (this.dialogData.mode !== 'attack') return '';

    const noTarget = _loc('DIALOG.multipleTarget');
    return `<span class="multipleTarget"><i class="fas fa-exclamation-circle"></i> ${noTarget}</span>`;
  }

  renderRollValueDie(multiplier = 1) {
    if (!this.dialogData.rollValue || this.dialogData.mode === 'damage') return '';

    const isAttackOrCounterAttack = this.dialogData.mode === 'attack' || this.dialogData.counterAttack;
    const dieClass = isAttackOrCounterAttack ? 'die-mu' : 'die-in';
    const modifier = this.dialogData.modifier || 0;
    const clampedValue = Math.clamp(Math.round((this.dialogData.rollValue + modifier) * multiplier), 1, 20);

    return `<span class="rollValue ${dieClass} d20">${clampedValue}</span>`;
  }

  async updateRollButton(targets, multiplier = 1) {
    let rollTag = this.renderRollValueDie(multiplier) + _loc('Roll');

    if (targets.length === 0) {
      rollTag += this.setRollButtonWarning();
    } else if (targets.length > 1) {
      rollTag += this.setMultipleTargetsWarning();
    }

    $(this.element).find('.form-footer [data-action="rollButton"]').html(rollTag);
  }

  async updateTargets(html, targets) {
    const template = await renderTemplate('systems/dsa5/templates/dialog/parts/targets.hbs', { targets });
    html.find('.targets').html(template);
    this.updateRollButton(targets);
    this.rotateToTarget();
  }

  rotateToTarget() {
    if (this.dialogData?.mode == 'parry' || this.dialogData?.renderData?.isDodge) return;
    const targets = Array.from(game.user?.targets || []);

    if (targets.length === 0) return;
    if (!game.canvas.ready) return;
    if (!this.dialogData?.speaker?.token) return;

    const sourceToken = canvas.tokens.get(this.dialogData.speaker.token);
    if (!sourceToken) return;

    const targetAngleActivated = game.settings.get('dsa5', 'attackFromBehindAngle');
    const dpsEnabled = game.settings.get('dsa5', 'enableDPS');

    if (!targetAngleActivated || !dpsEnabled) return;

    const targetToken = targets[0];
    const angle = Math.atan2(
      targetToken.center.y - sourceToken.center.y,
      targetToken.center.x - sourceToken.center.x
    ) * (180 / Math.PI);
    const adjustedAngle = (angle + 360) % 360 - 90;

    sourceToken.document.update({ rotation: adjustedAngle });
  }

  removeTarget(ev) {
    const id = ev.currentTarget.dataset.id;
    $(ev.currentTarget).remove();

    const newIds = Array.from(game.user.targets)
      .filter(target => id !== target.id)
      .map(target => target.id);

    if (game.canvas.ready) {
      game.user._onUpdateTokenTargets(newIds);
    }
  }

  calculateProbability(actor, item, mod, fw) {
    if (!DSA5_Utility.moduleEnabled('dsa5-core')) return;

    const config = game.settings.get('dsa5-core', 'showProbability');
    if (!(config === 1 || (config === 2 && game.user.isGM))) return;

    const possibilities = [];
    for (let i = 0; i < 6; i++) {
      const qs = 1 + i;
      const probability = game.dsa5.apps.DSACharacterCalculator.rollSuccessCalculation(actor, item, mod, qs, fw);

      if (probability <= 1) break;

      const formattedProbability = `${probability}`.padStart(2, '0');
      possibilities.push(`${_loc('CHARAbbrev.QS')} ${qs}: ${formattedProbability}%`);
    }

    $(this.element)
      .find('[data-action="nonOpposedButton"],[data-action="rollButton"]')
      .attr('data-tooltip', possibilities.join('<br>'));
  }

  readTargets() {
    return Array.from(game.user.targets)
      .filter(target => target.actor)
      .map(target => ({
        name: target.actor.name,
        img: target.actor.img,
        id: target.id
      }));
  }

  compareTargets(html, targets) {
    const newTargets = this.readTargets();

    if (JSON.stringify(targets) === JSON.stringify(newTargets)) {
      return targets;
    }

    this.updateTargets(html, newTargets);
    return newTargets;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);

    await this.prepareFormRecall($(this.element));
    html.find('.quantity-click').on('mousedown', (ev) => RuleChaos.quantityClick(ev));
    html.find('.modifiers option').on('mousedown', (ev) => {
      ev.preventDefault();
      $(ev.currentTarget).prop('selected', !$(ev.currentTarget).prop('selected'));
      return false;
    });
    html.on('click', '.rollTarget', (ev) => this.removeTarget(ev));
    html.on('click', '.addTarget', (ev) => this.addTarget(ev));
    html.find('.window-content form').addClass('scrollable');

    this.rotateToTarget();

    // Ability/extension burger menu (hidden by default)
    await RollDialogExtensions.bindBurgerMenu(this);
  }

  async addTarget(ev) {
    (await AddTargetDialog.getDialog(this.dialogData.speaker)).render(true);
  }

  _tearDown(options) {
    if (this.checkTargets) {
      clearInterval(this.checkTargets);
      this.checkTargets = null;
    }
    return super._tearDown(options);
  }

  async prepareFormRecall(html) {
    if (!this.recallData) return;

    for (const [key, value] of Object.entries(this.recallData)) {
      if (key === 'specAbs') {
        for (const spec of value) {
          const elem = html.find(`.specAbs[data-id="${spec.id}"]`);
          elem.addClass('active').attr('data-step', spec.step);
          elem.find('.step').text(DialogShared.roman[spec.step]);
        }
      } else {
        const elem = html.find(`[name="${key}"]`);

        if (Array.isArray(value)) {
          const options = elem.find('option');
          for (const opt of options) {
            const mod = value.find(x => x.name === $(opt).text().trim());
            if (mod) opt.selected = mod.selected;
          }
        } else {
          if (elem.attr('type') === 'checkbox') {
            elem[0].checked = value;
          } else {
            elem.val(value);
          }
        }
      }
    }
  }
}
