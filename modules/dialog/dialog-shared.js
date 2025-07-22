import RuleChaos from '../system/rules/rule_chaos.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import { AddTargetDialog } from './addTargetDialog.js';
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
    if (this.dialogData.mode == 'attack') {
      const noTarget = game.i18n.localize('DIALOG.noTarget');
      return `<span class="missingTarget"><i class="fas fa-exclamation-circle"></i> ${noTarget}</span>`;
    }
    return '';
  }

  setMultipleTargetsWarning() {
    if (this.dialogData.mode == 'attack') {
      const noTarget = game.i18n.localize('DIALOG.multipleTarget');
      return `<span class="multipleTarget"><i class="fas fa-exclamation-circle"></i> ${noTarget}</span>`;
    }
    return '';
  }

  renderRollValueDie(multiplier = 1) {
    if (this.dialogData.rollValue && this.dialogData.mode != 'damage') {
      const dieClass = this.dialogData.mode == 'attack' || this.dialogData.counterAttack ? 'die-mu' : 'die-in';
      const modifier = this.dialogData.modifier || 0;
      return `<span class="rollValue ${dieClass} d20">${Math.clamp(Math.round((this.dialogData.rollValue + modifier) * multiplier), 1, 20)}</span>`;
    } else {
      return '';
    }
  }

  async updateRollButton(targets, multiplier = 1) {
    let rollTag = this.renderRollValueDie(multiplier) + game.i18n.localize('Roll');
    if (targets.length > 0) {
      if (targets.length > 1) {
        rollTag += this.setMultipleTargetsWarning();
      }
    } else {
      rollTag += this.setRollButtonWarning();
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
    const targets = Array.from(game.user?.targets || []);
    if (targets.length > 0 && game.canvas.ready) {
      const sourceToken = canvas.tokens.get(this.dialogData.speaker.token);

      if(!sourceToken) return;

      const targetAngleActivated = game.settings.get('dsa5', 'attackFromBehindAngle');
      const dpsEnabled = game.settings.get('dsa5', 'enableDPS')

      if (!targetAngleActivated || !dpsEnabled) return;

      const targetToken = targets[0];

      const angle = Math.atan2(targetToken.center.y - sourceToken.center.y, targetToken.center.x - sourceToken.center.x) * (180 / Math.PI);
      const adjustedAngle = (angle + 360) % 360 - 90;

      sourceToken.document.update({rotation: adjustedAngle});
    }
  }

  removeTarget(ev) {
    const id = ev.currentTarget.dataset.id;
    $(ev.currentTarget).remove();
    const newIds = [];
    game.user.targets.forEach((x) => {
      if (id != x.id) newIds.push(x.id);
    });

    if (game.canvas.ready) game.user._onUpdateTokenTargets(newIds);
  }

  calculateProbability(actor, item, mod, fw) {
    if (DSA5_Utility.moduleEnabled('dsa5-core')) {
      const config = game.settings.get('dsa5-core', 'showProbability');

      if (config == 1 || (config == 2 && game.user.isGM)) {
        const possibilities = [];
        for (let i = 0; i < 6; i++) {
          const qs = 1 + i;
          let probability = game.dsa5.apps.DSACharacterCalculator.rollSuccessCalculation(actor, item, mod, qs, fw);
          if (probability > 1) {
            probability = `${probability}`.padStart(2, '0');
            possibilities.push(`${game.i18n.localize('CHARAbbrev.QS')} ${qs}: ${probability}%`);
          } else {
            break;
          }
        }
        $(this.element).find('.nonOpposedButton,.rollButton').attr('data-tooltip', possibilities.join('<br>'));
      }
    }
  }

  readTargets() {
    let targets = [];
    game.user.targets.forEach((x) => {
      if (x.actor) targets.push({ name: x.actor.name, img: x.actor.img, id: x.id });
    });
    return targets;
  }

  compareTargets(html, targets) {
    let newTargets = this.readTargets();
    if (JSON.stringify(targets) != JSON.stringify(newTargets)) {
      targets = newTargets;
      this.updateTargets(html, targets);
    }
    return targets;
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
  }

  async addTarget(ev) {
    (await AddTargetDialog.getDialog(this.dialogData.speaker)).render(true);
  }

  async prepareFormRecall(html) {
    if (this.recallData) {
      for (const key in this.recallData) {
        if (key == 'specAbs') {
          for (const spec of this.recallData[key]) {
            const elem = html.find(`.specAbs[data-id="${spec.id}"]`);
            elem.addClass('active').attr('data-step', spec.step);

            elem.find('.step').text(DialogShared.roman[spec.step]);
          }
        } else {
          const elem = html.find(`[name="${key}"]`);
          if (Array.isArray(this.recallData[key])) {
            const options = elem.find('option');
            for (let opt of options) {
              let mod = this.recallData[key].find((x) => x.name == $(opt).text().trim());
              if (mod) opt.selected = mod.selected;
            }
          } else {
            if (elem.attr('type') == 'checkbox') elem[0].checked = this.recallData[key];
            else elem.val(this.recallData[key]);
          }
        }
      }
    }
  }
}
