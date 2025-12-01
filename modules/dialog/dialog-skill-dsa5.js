import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5Dialog from './dialog-dsa5.js';
import DialogShared from './dialog-shared.js';
import DSA5 from '../config/config-dsa5.js';
import Actordsa5 from '../actor/actor-dsa5.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import DPS from '../system/automation/derepositioningsystem.js';
import { RollDialogBuilder } from './dialog-builder.js';
import { ModifierCalculator } from '../item/concerns/modifier-calculator.js';
import { ValueWidget } from '../system/helpers/valuewidget.js';
const { mergeObject } = foundry.utils;

export default class DSA5SkillDialog extends DialogShared {
  #toggleSection(ev, target) {
    const section = target.dataset.toggle;
    this.element.querySelector(`[data-section='${section}']`).classList.toggle('dsahidden');
  }


  static getRollButtons(testData, dialogOptions, resolve, reject) {
    const buttons = DSA5Dialog.getRollButtons(testData, dialogOptions, resolve, reject);
    buttons.find(x => x.action == 'rollButton').label = 'Opposed';
    buttons.unshift(
      {
        action: 'nonOpposedButton',
        label: 'Roll',
        callback: (event, button, dialog) => {
          const html = $(button.form);
          game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html);
          testData.opposable = false;
          resolve(dialogOptions.callback(html));
        },
      },
      {
        action: 'routineRoll',
        label: 'ROLL.routine',
        callback: (event, button, dialog) => {
          const html = $(button.form);
          game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html);
          testData.routine = true;
          mergeObject(testData.extra.options, {
            cheat: true,
            predefinedResult: [
              { val: 2, index: 0 },
              { val: 2, index: 1 },
              { val: 2, index: 2 },
            ],
          });
          resolve(dialogOptions.callback(html));
        },
      
      });
    return buttons;
  }

  async prepareFormRecall(html) {
      await super.prepareFormRecall(html);
      const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
      DPS.lightLevel(actor, html);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    
  	const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
      if(actor) { 
          const currentSkillName = this.dialogData.source.name;
          const sfName = game.i18n.localize('LOCAL.praxisbezugAbility');
          const hasPraxisbezug = actor.items.some(x => x.type == "specialability" && x.name == sfName);
          const talentsString = game.i18n.localize('LOCAL.knowledgeTalentsList');
          const knowledgeTalents = talentsString.split(',').map(t => t.trim());
          const isKnowledge = knowledgeTalents.includes(currentSkillName) || (this.dialogData.source.system.group && this.dialogData.source.system.group.value == "knowledge");
  
          if (hasPraxisbezug && !isKnowledge && !this.praxisbezugUsed) {
              const modInput = html.find('[name="testModifier"]');
              const iconHtml = $(`<i class="fas fa-lightbulb praxisbezug-icon" style="cursor: pointer; position: absolute; left: 19px; transform: translateX(-50%); top: -25px; color: #ffeb3b; text-shadow: 0 0 2px black;" data-tooltip="${game.i18n.localize('DIALOG.Praxisbezug')}"></i>`);
              modInput.parent().css("position", "relative");
              modInput.before(iconHtml);
              iconHtml.on('click', async (ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  new PraxisbezugDialog(actor, this).render(true);
              });
          }
      }
    
    html.on('change', 'input,select', (ev) => this.rememberFormData(ev));

    let targets = this.readTargets();
    // not great
    const that = this;
    this.checkTargets = setInterval(function () {
      targets = that.compareTargets(html, targets);
    }, 500);

    this.rememberFormData();
    html.on('mousedown', '.quantity-click', (ev) => this.rememberFormData(ev));

    html.find('.modifiers option').on('mousedown', (ev) => {
      this.rememberFormData(ev);
    });

    html.find('.vwidget').each((i, elem) => {
      new ValueWidget(elem)
    });

    html.find('[data-action="toggleSection"]').on('click', (ev) => {
      this.#toggleSection(ev, ev.currentTarget);
    });
  }

  rememberFormData(ev) {
    const html = $(this.element);
    const data = new foundry.applications.ux.FormDataExtended(html.find('form')[0]).object;
    data.situationalModifiers = ModifierCalculator._parseModifiers(html);
    this.calculateRoutine(data);
  }

  async calculateRoutine(data) {
    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    const routineButton = $(this.element).find('[data-action="routineRoll"]');
    if (!actor) {
      routineButton.prop('disabled', true);
      return;
    }

    const routineAllowed = [0, 1, 2].every(i => {
      const charKey = data[`characteristics${i}`];
      const chKey = data[`ch${i}`];
      return actor.system.characteristics[charKey].value + chKey >= 13;
    });

    const fwBase = Number(this.dialogData.source.system.talentValue.value);
    const fwMod = data.fw + (await DiceDSA5._situationalModifiers(data, 'FW'));
    const fw = fwBase + fwMod;

    const modBase = DSA5.skillDifficultyModifiers[data.testDifficulty];
    const mod = modBase + (await DiceDSA5._situationalModifiers(data));

    const requiredFw = Math.clamp(10 - mod * 3, 1, 19);
    const enoughFw = fw >= requiredFw;
    const canRoutine = routineAllowed && enoughFw;

    const routineLabel = game.i18n.localize('ROLL.routine');
    routineButton.prop('disabled', !canRoutine);
    routineButton.html(
      canRoutine
        ? `${routineLabel} (${game.i18n.localize('CHARAbbrev.FW')} ${Math.round(fw / 2)})`
        : routineLabel
    );

    this.calculateProbability(actor, this.dialogData.source, mod, fw);
  }

  static DEFAULT_OPTIONS = {
    window: {
      resizable: true,
    },
    position: {
      width: 700,
    },
  };
}

class PraxisbezugDialog extends Dialog {
    constructor(actor, parentDialog) {
        super({
            title: game.i18n.localize('DIALOG.PraxisbezugTitle'), 
            content: "", 
            buttons: {}
        });
        this.actor = actor;
        this.parentDialog = parentDialog;
        this.qs = 0;
        this.rolled = false;
        
        this.data.content = this._buildInitialContent();
        
        this.data.buttons = {
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("DIALOG.cancel"),
                callback: () => this.close()
            }
        };
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            width: 500,
            classes: ["dsa5", "dialog"],
            resizable: true
        });
    }

    _buildInitialContent() {
        let html = `<p>${game.i18n.localize("DIALOG.PraxisbezugDescription")}</p><hr>`;
        html += `<div class="form-group knowledge-buttons" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">`;
        
        const talentsString = game.i18n.localize('LOCAL.knowledgeTalentsList');
        const knowledgeTalents = talentsString.split(',').map(t => t.trim());

        const skills = this.actor.items.filter(i => 
            i.type == "skill" && knowledgeTalents.includes(i.name)
        ).sort((a, b) => a.name.localeCompare(b.name));

        for (let skill of skills) {
            html += `<button class="knowledge-roll-btn" data-id="${skill.id}">${skill.name}</button>`;
        }
        html += `</div>`;
        return html;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.knowledge-roll-btn').click(async (ev) => {
            ev.preventDefault(); 
            
            const skillId = ev.currentTarget.dataset.id;
            const skill = this.actor.items.get(skillId);
            
            // Hook registrieren
            const hookId = Hooks.once("postProcessDSARoll", (chatOptions, testData) => {
                 
                 let source = testData.source;
                 // Fallback für Source Suche
                 if (!source && testData.preData && testData.preData.source) {
                     source = testData.preData.source;
                 }

                 if (!source) return;

                 const rolledId = source._id || source.id;
                 
                 if (String(rolledId) === String(skillId)) {
                     // Flag setzen: Praxisbezug wurde verwendet
                     this.parentDialog.praxisbezugUsed = true;
                     
                     // Parent neu rendern, damit Lampe verschwindet
                     this.parentDialog.render(true);

                     // Erfolg prüfen
                     const success = testData.successLevel > 0;

                     if (success) {
                         this.qs = testData.qualityStep || 0;
                         this.rolled = true;
                         setTimeout(() => this._updateToDistributionMode(), 50);
                     } else {
                         // Bei Misserfolg: Dialog schließen
                         this.close();
                     }
                 }
            });

            this.actor.setupSkill(skill, { }, "roll").then(setupData => {
                 if(setupData) {
                    this.actor.basicTest(setupData);
                 }
            });
        });

        if (this.rolled) {
            const inputs = html.find('.praxis-input');
            inputs.on('contextmenu', (ev) => {
                ev.preventDefault();
                this._changeValue(ev.currentTarget, -1);
            });
            inputs.on('click', (ev) => {
                this._changeValue(ev.currentTarget, 1);
            });
            inputs.on('keydown', (ev) => {
                if (ev.key === "Enter") ev.preventDefault();
            });
        }
    }

    _changeValue(input, delta) {
        let currentVal = parseInt(input.value) || 0;
        let newVal = Math.clamp(currentVal + delta, 0, 2);
        
        const inputs = $(this.element).find('.praxis-input');
        let totalUsed = 0;
        inputs.each((i, el) => {
            if (el !== input) totalUsed += (parseInt(el.value) || 0);
        });

        if (totalUsed + newVal <= this.qs) {
            input.value = newVal;
        } else {
            if (delta < 0) input.value = newVal; 
            else {
                ui.notifications.warn(game.i18n.format("DIALOG.PraxisbezugMaxQS", {qs: this.qs}));
            }
        }
    }

    _updateToDistributionMode() {
        const parentSource = this.parentDialog.dialogData.source;
        const c1 = parentSource.system.characteristic1 ? parentSource.system.characteristic1.value : "mu";
        const c2 = parentSource.system.characteristic2 ? parentSource.system.characteristic2.value : "kl";
        const c3 = parentSource.system.characteristic3 ? parentSource.system.characteristic3.value : "in";

        const attrs = [c1, c2, c3];
        
        let content = `
            <div style="margin-bottom: 5px; text-align: center;">
                <p style="margin: 0;">${game.i18n.format("DIALOG.PraxisbezugInstruction", {qs: this.qs})}</p>
                <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #555;">${game.i18n.localize("DIALOG.PraxisbezugLimit")}</p>
            </div>
        `;
        
        content += `<div style="display: flex; justify-content: space-around; margin: 10px 0 25px 0;">`;
        attrs.forEach((attr, idx) => {
            const label = game.i18n.localize(`CHARAbbrev.${attr.toUpperCase()}`);
            content += `
                <div style="text-align: center;">
                    <label style="font-weight: bold; font-size: 0.9em;">${label}</label><br>
                    
                    <input type="number" class="praxis-input" data-idx="${idx}" value="0" min="0" max="2" 
                           readonly style="width: 40px; text-align: center; cursor: pointer; height: 25px;" 
                           data-tooltip="Links-<i class='fas fa-mouse'></i>+1<br>Rechts-<i class='fas fa-mouse'></i>-1">
                </div>
            `;
        });
        content += `</div>`;

        const newButtons = {
            confirm: {
                icon: '<i class="fas fa-check"></i>',
                label: game.i18n.localize("DIALOG.confirm"),
                callback: (html) => this._applyBonuses(html)
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("DIALOG.cancel"),
                callback: () => this.close()
            }
        };

        this.data.content = content;
        this.data.buttons = newButtons;
        
        this.render(true);

        setTimeout(() => {
            this.setPosition({ height: "auto" });
        }, 50);
    }

    _applyBonuses(html) {
        const inputs = html.find('.praxis-input');
        const bonuses = [0, 0, 0];
        
        inputs.each((i, el) => {
            bonuses[parseInt(el.dataset.idx)] = parseInt(el.value) || 0;
        });

        const parentHtml = $(this.parentDialog.element);
        parentHtml.find('[name="ch0"]').val(bonuses[0]);
        parentHtml.find('[name="ch1"]').val(bonuses[1]);
        parentHtml.find('[name="ch2"]').val(bonuses[2]);
        parentHtml.find('[name="ch0"]').trigger('change');
    }
}
