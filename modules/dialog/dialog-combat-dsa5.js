import Actordsa5 from '../actor/actor-dsa5.js';
import Itemdsa5 from '../item/item-dsa5.js';
import DSA5 from '../config/config-dsa5.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import Riding from '../system/automation/riding.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5Dialog from './dialog-dsa5.js';
import DialogShared from './dialog-shared.js';
import DSA5StatusEffects from '../status/status_effects.js';
import DPS from '../system/automation/derepositioningsystem.js';
import CombatskillData from '../data/item/combatskill.js';
import { ModifierCalculator } from '../item/concerns/modifier-calculator.js';
import { ItemFactory } from '../item/item-factory.js';
import { CombatSpecialAbilities } from '../item/concerns/combat-special-abilities.js';
import SpecialabilityData from '../data/item/specialability.js';
const { mergeObject, duplicate, getProperty } = foundry.utils;

export default class DSA5CombatDialog extends DialogShared {
  static meleeweaponRollModifiers = {
    wrongHand: { mod: -4 },
    advantageousPosition: { mod: 2 },
    attackFromBehind: { mod: -4 },
    opportunityAttack: { mod: -4 },
    doubleAttack: { mod: -2 },
    narrowSpace: { mod: 0 },
    waterOptions: {
      0: { mod: 0 },
      1: { mod: -2 },
      2: { mod: -4 },
      3: { mod: -6 }
    }
  };

  static rangeweaponRollModifiers = {
    combatTurmoil: { mod: -2 },
    quickChange: { mod: -4 },
    narrowSpace: { mod: 0 },
    targetMovement: { mod: 0 },
    shooterMovement: { mod: 0 },
    RangeMod: {
      short: {
        damage: 1,
        attack: 2,
      },
      medium: {
        damage: 0,
        attack: 0,
      },
      long: {
        damage: -1,
        attack: -2,
      },
      rangesense: {
        damage: -1,
        attack: -1,
      },
      extreme: {
        damage: -2,
        attack: -4,
      },
    },
    RangeSize: {
      tiny: { mod: -8 },
      small: { mod: -4 },
      average: { mod: 0 },
      big: { mod: 4 },
      giant: { mod: 8 },
    },
    aimOptions: {
      0: { mod: 0 },
      1: { mod: 2 },
      2: { mod: 4 },
    },
    waterOptions: {
      0: { mod: 0 },
      1: { mod: -2 },
      2: { mod: -5000 },
      3: { mod: -5000 }
    }
  };

  static DEFAULT_OPTIONS = {
    position: {
      width: 740,
    },
    window: {
      resizable: true,
    },
  };

  static setData(actor, type, testData, renderData) {
    let rollModifiers = duplicate(DSA5CombatDialog.isMelee(testData.source) ? DSA5CombatDialog.meleeweaponRollModifiers : DSA5CombatDialog.rangeweaponRollModifiers);
    rollModifiers.narrowSpace.mod = this.getNarrowSpaceModifier(testData, testData.mode);
    if (renderData.rangeOptions) {
      for (let key of Object.keys(rollModifiers.RangeMod)) if (!renderData.rangeOptions.has(key)) delete rollModifiers.RangeMod[key];
    }

    const flattendRollModifiers = foundry.utils.flattenObject(rollModifiers);
    const tt = `${type}RollModifiers`;

    if (actor.system[tt]) {
      const flattenedActorData = foundry.utils.flattenObject(foundry.utils.duplicate(actor.system[tt]));

      for (let key of Object.keys(flattendRollModifiers)) flattendRollModifiers[key] += Number(flattenedActorData[key]) || 0;
    }

    for (const effect of testData.source.effects || []) {
      if (effect.disabled) continue;

      for (const change of effect.changes) {
        if (!change.key.startsWith('self.')) continue;

        for (let key of Object.keys(flattendRollModifiers)) if (change.key == `self.${key}`) flattendRollModifiers[key] += Number(change.value) || 0;
      }
    }

    return foundry.utils.expandObject(flattendRollModifiers);
  }

  setCombatSpecTooltip(el) {
    const dataset = el.dataset;
    const step = Number(dataset.step) || 0;

    const tooltipParts = [];

    if (step > 1) {
      tooltipParts.push(`<li class="flexrow center"><div>${step} <i class="fas fa-xmark"></i></div></li>`);
    }

    const bonusTypes = [
      { key: 'pabonus', icon: 'fas fa-shield-alt', label: 'LocalizedAbilityModifiers.pa' },
      { key: 'atbonus', icon: 'fas fa-swords', label: 'LocalizedAbilityModifiers.at' },
      { key: 'tpbonus', icon: 'fas fa-heart', label: 'LocalizedAbilityModifiers.tp' },
      { key: 'dmmalus', icon: 'fas fa-balance-scale', label: 'LocalizedAbilityModifiers.dm' }
    ];

    for (const { key, icon, label } of bonusTypes) {
      let value;
      try {
        value = Roll.safeEval(dataset[key]) || 0;
      } catch {
        value = dataset[key] || 0;
      }
      if (!value) continue;

      const localizedLabel = _loc(label).toUpperCase();
      let tooltipText = `<i class="${icon}"></i> ${localizedLabel}: ${value}`;

      const flatKey = `${key}Flat`;
      if (dataset[flatKey]) {
        const flatSum = dataset[flatKey]
          .split(',')
          .reduce((sum, x) => sum + (Roll.safeEval(x) || 0), 0);

        const sign = flatSum < 0 ? '' : '+';
        if (flatSum !== 0) {
          tooltipText += ` (${sign}${flatSum})`;
        }
      }

      tooltipParts.push(tooltipText);
    }

    if (tooltipParts.length === 0) return;

    const tooltip = `<ul class="effects-tooltip plain"><li>${tooltipParts.join('</li><li>')}</li></ul>`;
    game.tooltip.activate(el, { html: tooltip });
    el.dataset.tooltip = tooltip;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    let specAbs = html.find('.specAbs');
    specAbs.on('mouseenter', (ev) => {
      const el = ev.currentTarget;
      this.setCombatSpecTooltip(el);
      if (el.getElementsByClassName('hovermenu').length == 0) {
        let div = document.createElement('div');
        div.classList.add('hovermenu');
        let post = document.createElement('i');
        post.classList.add('fas', 'fa-comment');
        post.dataset.tooltip = 'SHEET.PostItem';
        post.addEventListener('mousedown', this._postItem, false);
        div.appendChild(post);
        el.appendChild(div);
      }
    });
    specAbs.on('mouseleave', (ev) => {
      let e = ev.toElement || ev.relatedTarget;
      if (e.parentNode == this || e == this) return;

      ev.currentTarget.querySelectorAll('.hovermenu').forEach((e) => e.remove());
    });

    html.find('.variantChange').on('mousedown', (ev) => this.changeSpecAbVariant(ev));

    html.on('mousedown', '.specAbs', (ev) => {
      if (html.find('.opportunityAttack').is(':checked')) {
        ui.notifications.error('DSAError.opposedAttackNoSpecAbs', {
          localize: true,
        });
        return;
      }
      const elem = $(ev.currentTarget);
      const dataset = ev.currentTarget.dataset;
      let step = Number(dataset.step);
      const maxStep = Number(dataset.maxStep);
      const subcategory = Number(dataset.category);
      const cTypes = SpecialabilityData.COMBAT_SKILL_TYPES;

      if (ev.button == 0) {
        step = Math.min(maxStep, step + 1);
        if (game.settings.get('dsa5', 'limitCombatSpecAbs')) {
          const singularCombatSkillCategories = {
            [cTypes.BASEMANEUVER]: [cTypes.BASEMANEUVER, cTypes.COMBATSTYLE_EXTENDED_BASE],
            [cTypes.COMBATSTYLE_EXTENDED_BASE]: [cTypes.BASEMANEUVER, cTypes.COMBATSTYLE_EXTENDED_BASE],
            [cTypes.SPECIALMANEUVER]: [cTypes.SPECIALMANEUVER, cTypes.COMBATSTYLE_EXTENDED],
            [cTypes.COMBATSTYLE_EXTENDED]: [cTypes.SPECIALMANEUVER, cTypes.COMBATSTYLE_EXTENDED],
          }[subcategory] || [];

          if (singularCombatSkillCategories.length) {
            const selector = singularCombatSkillCategories.map(c => `[data-category="${c}"]`).join(',');
            const siblings = elem.siblings(selector);
            siblings.removeClass('active').attr('data-step', 0);
            siblings.find('.step').text(DialogShared.roman[0]);
          }
        }

      } else if (ev.button == 2) {
        step = Math.clamp(maxStep, 0, step - 1);
      }
      dataset.step = step;
      elem.toggleClass('active', step > 0);

      elem.find('.step').text(DialogShared.roman[step]);
      this.checkCounterAttack(ev);
      this.calculateModifier();
      this.setCombatSpecTooltip(ev.currentTarget);
    });
    html.find('.opportunityAttack').on('change', (ev) => {
      if ($(ev.currentTarget).is(':checked')) {
        for (let k of html.find('.specAbs')) {
          $(k).removeClass('active').attr('data-step', 0).find('.step').text('');
        }
      }
    });
    html.on('change', 'input,select', (ev) => this.calculateModifier(ev));
    html.find('.modifiers option').on('mousedown', (ev) => this.calculateModifier(ev));
    html.find('.quantity-click').on('mousedown', (ev) => this.calculateModifier(ev));

    let targets = this.readTargets();
    // not great
    const that = this;
    this.checkTargets = setInterval(function () {
      targets = that.compareTargets(html, targets);
    }, 500);
  }

  checkCounterAttack(ev) {
    if (this.dialogData.mode !== 'parry') return;

    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    if (!actor) return;

    const isCounterAttack = actor.items.get(ev.currentTarget.dataset.id)?.name === _loc('LocalizedIDs.counterAttack');
    if (!isCounterAttack) return;

    this.dialogData.counterAttack = ev.button === 0;
    this.prepareWeapon();

    const mode = ev.button === 0 ? 'attack' : 'parry';
    const item = actor.items.get(this.dialogData.source._id);
    const html = $(this.element);
    const htmlMods = html.find('[name=situationalModifiers]');

    let situationalModifiers = DSA5StatusEffects.getRollModifiers(actor, item, { mode });
    const cls = ItemFactory.getSubClass(item.type);
    cls.getSituationalModifiers(situationalModifiers, actor, { mode }, item);

    if (mode === 'attack') {
      situationalModifiers = situationalModifiers.filter(x => x.type !== 'defenseMalus');

      const attackStatIndex = situationalModifiers.findIndex(x => x.name === _loc('statuseffects'));
      const attackStatEffect = attackStatIndex >= 0 ? situationalModifiers.splice(attackStatIndex, 1)[0] : null;

      const defenseModifiers = [];
      cls.getSituationalModifiers(defenseModifiers, actor, { mode: 'parry' }, item);

      const defenseStatIndex = defenseModifiers.findIndex(x => x.name === _loc('statuseffects'));
      const defenseStatEffect = defenseStatIndex >= 0 ? defenseModifiers.splice(defenseStatIndex, 1)[0] : null;

      situationalModifiers.unshift(...defenseModifiers);

      if (attackStatEffect || defenseStatEffect) {
        const combinedStatusEffect = attackStatEffect || { ...defenseStatEffect };
        if (attackStatEffect && defenseStatEffect) {
          combinedStatusEffect.value += defenseStatEffect.value;
        }
        situationalModifiers.push(combinedStatusEffect);
      }
    }

    if (situationalModifiers.length > 0) {
      if (htmlMods.length === 0) {
        const modBox = `<div class="modifiers form-group">
          <label>${_loc('DIALOG.SituationalModifiers')}</label>
          <select name="situationalModifiers" multiple />
        </div>`;
        html.find('[name=rollMode]').parent().after(modBox);
        this.position.height += 86;
        this.setPosition(this.position);
      }

      const options = situationalModifiers.map(mod =>
        `<option value="${mod.value}" 
           data-tooltip="${Handlebars.helpers.situationalTooltip(mod)}"
           ${mod.type ? ` data-type="${mod.type}"` : ''}
           ${mod.specAbId ? ` data-spec-ab-id="${mod.specAbId}"` : ''}
           ${mod.armorPen ? ` data-armor-pen="${mod.armorPen}"` : ''}
           ${mod.effectId ? ` data-effect-id="${mod.effectId}"` : ''}
           ${mod.effectUuid ? ` data-effect-uuid="${mod.effectUuid}"` : ''}
           ${mod.selected ? ' selected' : ''}>
           ${mod.name} [${mod.value}]
        </option>`
      ).join('');

      html.find('.modifiers select').html(options);
    } else if (htmlMods.length > 0) {
      htmlMods.parent().remove();
      this.position.height -= 86;
      this.setPosition(this.position);
    }
  }

  changeSpecAbVariant(ev) {
    ev.stopPropagation();
    ev.preventDefault();

    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);

    if (actor) {
      const current = Number(ev.currentTarget.dataset.current);
      let next = current + 1;
      if (next >= Number(ev.currentTarget.dataset.variantcount)) next = 0;

      ev.currentTarget.dataset.current = next;
      $(ev.currentTarget).text(['A', 'B', 'C'][next]);

      const parent = $(ev.currentTarget).closest('.specAbs')[0];
      const specAb = actor.items.get(parent.dataset.id);
      const path = `effect.value${['', '2', '3'][next]}`;

      const res = CombatSpecialAbilities.buildDataset([specAb], actor, this.dialogData.mode, path)[0];

      parent.dataset.dmmalus = res.dmmalus || 0;
      parent.dataset.atbonus = res.atbonus || 0;
      parent.dataset.tpbonus = res.tpbonus || 0;
      parent.dataset.pabonus = res.pabonus || 0;

      this.setCombatSpecTooltip(parent);
      this.calculateModifier();
    }
  }

  _postItem(ev) {
    ev.stopPropagation();
    const elem = $(ev.currentTarget).closest('.specAbs');
    const actorId = elem.attr('data-actor');
    const id = elem.attr('data-id');

    const actor = game.actors.get(actorId);
    actor.items.get(id).postItem();

    return false;
  }

  recallSettings(speaker, source, mode, renderData) {
    super.recallSettings(speaker, source, mode, renderData);
    this.prepareWeapon();
    return this;
  }

  syncSituationalModifiers(testData, filter = '') {
    let result = 0;
    for (const val of testData.situationalModifiers) {
      if (val.value == undefined) continue;

      result += val.type == filter || (filter == '' && val.type == undefined) ? Number(val.value) : 0;
    }
    return result;
  }

  updateTargets(html, targets) {
    super.updateTargets(html, targets);
    this.setMovement(html, targets);
  }

  setMovement(html, targets) {
    if (!DPS.isEnabled) return;
    if (game.canvas.grid.units != _loc('gridUnits')) return;
    if (this.dialogData.source.type != 'rangeweapon') return;

    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    const token = actor.getActiveTokens()[0] || actor.token;
    if (!token) return;

    const move = token.movementType();
    if (html) {
      const moveOptions = html.find('[name="shooterMovement"] option');
      if (moveOptions.length) moveOptions[move].selected = true;
    }
    this.dialogData.renderData.rollModifiers.shooterMovement.mod = Object.keys(DSA5.shooterMovementOptions)[move]

    if (targets.length === 0) return;

    const targetMovementType = game.user.targets.first().movementType()
    const targetMove = [1, 0, 2][targetMovementType];
    if (html) {
      const targetMoveOptions = html.find('[name="targetMovement"] option');
      if (targetMoveOptions.length) targetMoveOptions[targetMove].selected = true;
    }
    this.dialogData.renderData.rollModifiers.targetMovement.mod = Object.keys(DSA5.targetMovementOptions)[targetMove];
  }

  setParryModifier(actor, jhtml) {
    if (!DPS.isEnabled || !actor) return;

    const attackFromBehindAngle = game.settings.get('dsa5', 'attackFromBehindAngle');

    if (!attackFromBehindAngle) return;

    const opposeFlags = actor.flags.oppose;
    if (opposeFlags) {
      const message = game.messages.get(opposeFlags.messageId);
      const preData = message.flags.data.preData;
      const attackActor = DSA5_Utility.getSpeaker(preData.extra.speaker);

      if (!attackActor) return;

      const attackerToken = attackActor.getActiveTokens()[0]?.document
      const defenderToken = actor.getActiveTokens()[0]?.document

      if (!attackerToken || !defenderToken) return;

      const { x: attackerX, y: attackerY } = attackerToken;
      const { x: defenderX, y: defenderY, rotation: defenderRotation } = defenderToken;

      const dx = attackerX - defenderX;
      const dy = attackerY - defenderY;

      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      angle = (angle + 270) % 360;
      const backAngle = (defenderRotation + 180) % 360;
      const delta = ((angle - backAngle + 540) % 360) - 180;
      const isBehind = Math.abs(delta) <= attackFromBehindAngle / 2;

      jhtml.find('[name="attackFromBehind"]').prop('checked', isBehind);
    }
  }

  prepareWeapon(testData = undefined) {
    testData = testData || this.dialogData.renderData;
    const source = this.dialogData.source;
    let actor;

    if (this.dialogData.mode == 'parry' || source.type == 'dodge') {
      if (!actor) actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);

      this.setParryModifier(actor, $(this.element));
    }

    if (['meleeweapon', 'rangeweapon'].includes(source.type)) {
      if (!actor) actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);

      if (actor) {
        const combatskill = source.system.combatskill.value;
        let weapon;
        let skill = CombatskillData._calculateCombatSkillValues(actor.items.find((x) => x.type == 'combatskill' && x.name == combatskill).toObject(), actor.system, {
          step: this.syncSituationalModifiers(testData, 'step'),
          [this.dialogData.mode]: this.syncSituationalModifiers(testData, this.dialogData.mode),
        });
        switch (source.type) {
          case 'meleeweapon':
            weapon = Actordsa5._prepareMeleeWeapon(source, [skill], actor);
            break;
          case 'rangeweapon':
            weapon = Actordsa5._prepareRangeWeapon(source, [], [skill], actor);
            this.setMovement($(this.element), this.readTargets());
            break;
        }

        if (this.dialogData.mode == 'attack' || this.dialogData.counterAttack) {
          this.dialogData.rollValue = weapon.attack;
        } else if (this.dialogData.mode == 'parry') {
          this.dialogData.rollValue = weapon.parry;
        }
      }
    } else if (source.type == 'dodge') {
      this.dialogData.rollValue = source.system.value;
    } else {
      if (this.dialogData.mode == 'attack' || this.dialogData.counterAttack) {
        this.dialogData.rollValue = Number(source.system.at.value);
      } else if (this.dialogData.mode == 'parry') {
        this.dialogData.rollValue = Number(source.system.pa);
      }
    }
  }

  async prepareFormRecall(html) {
    await super.prepareFormRecall(html);

    if (
      this.dialogData?.source?.type === 'rangeweapon' ||
      (this.dialogData?.source?.type === 'trait' && this.dialogData.source.system.traitType.value === 'rangeAttack')
    ) {
      const aimProgress = Math.clamp(Number(getProperty(this.dialogData.source, 'system.aimTime.progress')) || 0, 0, 2);
      html.find('[name="aim"]').prop('selectedIndex', aimProgress);
    }

    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    DPS.lightLevel(actor, html);
    const isRider = Riding.isRiding(actor);

    const advantageousPosition = html.find('[name="advantageousPosition"]')[0];
    if (this.dialogData.mode == 'attack') {
      const targetIsRider = Array.from(game.user.targets).some((x) => Riding.isRiding(x.actor));
      if (advantageousPosition && (targetIsRider || isRider)) advantageousPosition.checked = isRider && !targetIsRider;

      const mountedOptions = html.find('[name="mountedOptions"]')[0];
      if (isRider && mountedOptions) {
        const horse = Riding.getHorse(actor);
        if (horse) {
          mountedOptions.selectedIndex = Riding.horseSpeedModifier(horse);
        }
      }
    } else if (this.dialogData.mode == 'parry' && actor.flags.oppose) {
      const attacker = DSA5_Utility.getSpeaker(actor.flags.oppose.speaker);
      const attackerIsRider = Riding.isRiding(attacker);
      if (advantageousPosition && (attackerIsRider || isRider)) advantageousPosition.checked = isRider && !attackerIsRider;
    }
    await this.calculateModifier();
  }

  static assassinationModifiersRanged(testData, formData) {
    const mode = formData.assassinate;
    if (!mode || mode == '-') return [];

    const aimingMod = Math.min(Number(formData.aim) || 0, 4);
    const sizeMod = Number(formData.size) || 0;
    const modeTranslated = _loc(`DIALOG.${mode}`);
    const result = [
      {
        name: modeTranslated,
        value: -8 - sizeMod + 4 - aimingMod,
      },
    ];
    const dices = DSA5CombatDialog.countDices(testData) - 1;
    const tpMod = dices * -2;
    const multiplier = Math.max(1, 4 - dices);
    result.push(
      {
        name: modeTranslated + ' (' + _loc('CHARAbbrev.damage') + ')',
        damageBonus: tpMod,
        value: 0,
        step: 1,
        baseBonus: true
      },
      {
        name: modeTranslated + ' (*)',
        damageBonus: `*${multiplier}`,
        value: 0,
        step: 1,
        baseBonus: true
      },
    );
    return result;
  }

  static countDices(testData) {
    return Math.max(
      1,
      new Roll(testData.source.system.damage.value.replace(/[DWw]/g, 'd')).terms.reduce((prev, cur) => {
        return prev + (cur.faces ? cur.number : 0);
      }, 0),
    );
  }

  static assassinationModifiers(testData, formData) {
    const mode = formData.assassinate;
    if (!mode || mode === '-') return [];

    const opposingWeaponSizeIndex = Math.max(0, DSA5.meleeRangesArray.indexOf(formData.weaponsize));
    testData.opposingWeaponSize = opposingWeaponSizeIndex;

    const advantageousPositionMod = formData.advantageousPosition ? 2 : 0;
    const modeTranslated = _loc(`DIALOG.${mode}`);

    const baseValue = 10 - advantageousPositionMod - opposingWeaponSizeIndex;
    const result = [{ name: modeTranslated, value: baseValue }];

    if (mode === 'assassinate') {
      let weaponSize = Math.max(
        0,
        DSA5.meleeRangesArray.indexOf(getProperty(testData, 'source.system.reach.value'))
      );

      if (!RuleChaos.isWieldedTwohanded(testData.source) && getProperty(testData, 'source.system.worn.wrongGrip')) {
        weaponSize = Math.min(weaponSize, 1);
      }

      const dices = DSA5CombatDialog.countDices(testData) - 1;
      const tpMod = [2, 0, -2, -4][weaponSize] - dices * 2;
      const multiplier = Math.max(1, 5 - weaponSize - dices);

      result.push(
        {
          name: `${modeTranslated} (${_loc('CHARAbbrev.damage')})`,
          damageBonus: tpMod,
          value: 0,
          step: 1,
          baseBonus: true
        },
        {
          name: `${modeTranslated} (*)`,
          damageBonus: `*${multiplier}`,
          value: 0,
          step: 1,
          baseBonus: true
        }
      );
    } else {
      testData.source.effects = testData.source.effects || [];
      const exists = testData.source.effects.some((e) => e._id === modeTranslated);
      if (!exists) {
        testData.source.effects.push({
          _id: modeTranslated,
          changes: [],
          disabled: false,
          duration: {},
          icon: 'icons/svg/aura.svg',
          name: modeTranslated,
          transfer: true,
          flags: {
            dsa5: {
              description: modeTranslated,
              resistRoll: `${_loc('LocalizedIDs.selfControl')} -3`,
              hideOnToken: false,
              hidePlayers: false,
              customDuration: '',
              advancedFunction: 1,
              args0: 'unconscious',
              args1: '',
            },
          },
        });
      }
    }

    return result;
  }

  static combatInWaterModifiers(testData, formData, html, actor) {
    let waterOptions = Number(formData.waterOptions) || 0;

    const token = actor.getActiveTokens()[0] || actor.token;
    if (token) {
      const moveAction = token.document.movementAction;
      if (moveAction === 'swim' && !waterOptions) {
        const waterElement = html.find('[name="waterOptions"]');
        waterElement.prop('selectedIndex', 2);
        waterOptions = waterElement.val();
      } else if (moveAction === 'fly') {
        html.find('[name="waterOptions"]').val(0);
        html.find('.waterblock').hide();
        waterOptions = 0;
      } else {
        html.find('.waterblock').show();
      }
    }

    const waterIndex = html.find('[name="waterOptions"]').prop('selectedIndex');

    if (!waterOptions) return [];

    const result = [{
      name: `${_loc('MODS.combatInWater')} - ${this._getSelectedText('waterOptions', html)}`,
      value: waterOptions,
    }];

    const source = testData.source;
    if (source.type === 'trait' || waterIndex < 2) return result;

    const combatInWater = _loc('LocalizedIDs.combatInWater');
    const weaponMadeForWater = getProperty(source, 'system.effect.attributes')?.includes(combatInWater);

    if (weaponMadeForWater) return result;

    const combatskill = source.system.combatskill?.value;
    const reverseCombatskill = _loc(`LocalizedCTs.${combatskill}`);

    if (DSA5.impossibleWeaponsForWater.has(reverseCombatskill)) {
      result.push({
        name: `${_loc('MODS.combatInWater')} - ${_loc('MODS.impossibleWeapon', { weapon: combatskill })}`,
        value: -5000,
      });
      return result;
    }

    const isGoodWeapon = DSA5.goodWeaponsForWater.has(reverseCombatskill);
    const isDeepWater = waterOptions == 4;

    let damageBonus = 1;
    if (!isGoodWeapon) {
      damageBonus = isDeepWater ? 0.25 : 0.5;
    } else if (isDeepWater) {
      damageBonus = 0.5;
    }

    if (damageBonus < 1) {
      result.push({
        name: `${_loc('MODS.combatInWater')} - ${_loc('MODS.notSuitableWeapon', { weapon: combatskill })}`,
        damageBonus: `*${damageBonus}`,
        value: 0,
        step: 1,
      });
    }

    return result;
  }

  static isMelee(source) {
    return source.type == 'meleeweapon' || source.type == 'dodge' || (source.type == 'trait' && getProperty(source, 'system.traitType.value') == 'meleeAttack');
  }

  async calculateModifier() {
    if (this.dialogData.mode == 'damage') return;

    const source = this.dialogData.source;
    const testData = { source: this.dialogData.source, extra: { options: {} } };
    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    DSA5CombatDialog.isMelee(source)
      ? DSA5CombatDialog.resolveMeleeDialog(testData, {}, $(this.element), actor, {}, this.dialogData.renderData.multipleDefenseValue ?? -3, this.dialogData.mode)
      : DSA5CombatDialog.resolveRangeDialog(testData, {}, $(this.element), actor, {}, this.dialogData.mode);

    this.prepareWeapon(testData);
    this.dialogData.modifier = await DiceDSA5._situationalModifiers(testData);
    const multiplier = DiceDSA5._situationalMultipliers(testData);
    this.updateRollButton(this.readTargets(), multiplier);
  }

  static getNarrowSpaceModifier(testData, mode) {
    if (!mode) return 0;

    if (RuleChaos.isShield(testData.source)) return getProperty(DSA5.narrowSpaceModifiers, `shield${testData.source.system.reach.shieldSize}.${mode}`) || 0;

    return getProperty(DSA5.narrowSpaceModifiers, `weapon${testData.source.system.reach.value}.${mode}`) || 0;
  }

  static resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, mode) {
    this._resolveDefault(testData, cardOptions, html, options);

    const form = html[0].tagName == 'FORM' ? html[0] : html.find('form')[0];
    const data = new foundry.applications.ux.FormDataExtended(form).object;

    const targetIsSwarm = DSA5CombatDialog.targetIsSwarm(testData);
    const attackerIsSwarm = actor.isSwarm();

    testData.opposingWeaponSize = attackerIsSwarm ? 0 : data.weaponsize;
    testData.attackOfOpportunity = this.attackOfOpportunity(testData.situationalModifiers, data);
    testData.extra.attackFromBehind = Number(data.attackFromBehind) || 0;

    const modifiers = [
      ModifierCalculator.parseValueType(_loc('sight'), data.vision || 0),
      {
        name: _loc('MODS.attackFromBehind'),
        value: testData.extra.attackFromBehind,
      },
      {
        name: _loc('MODS.damage'),
        damageBonus: data.damageModifier,
        value: 0,
        step: 1,
      },
      {
        name: _loc('defenseCount', { malus: multipleDefenseValue }),
        value: (Number(data.defenseCount) || 0) * multipleDefenseValue,
      },
      {
        name: _loc('MODS.wrongHand'),
        value: Number(data.wrongHand) || 0,
      },
      {
        name: _loc('MODS.advantageousPosition'),
        value: Number(data.advantageousPosition) || 0,
      },
      {
        name: _loc('sizeCategory'),
        value: targetIsSwarm ? 0 : DSA5.meleeSizeModifier[data.size] || 0,
      },
      {
        name: _loc('MODS.narrowSpace'),
        value: Number(data.narrowSpace) || 0,
      },
      {
        name: _loc('MODS.doubleAttack'),
        value: Number(data.doubleAttack) || 0,
      },
      ...Itemdsa5.getSpecAbModifiers(html, mode),
      ...this.assassinationModifiers(testData, data),
      ...this.combatInWaterModifiers(testData, data, html, actor)
    ];

    testData.situationalModifiers.push(...modifiers);

    if (testData.situationalModifiers.some(x => x.name === _loc('LocalizedIDs.counterAttack'))) {
      testData.mode = 'attack';
      testData.extra.counterAttack = true;
    }
  }

  static _getSelectedText(selector, html) {
    return html.find(`[name="${selector}"] option:selected`).text() || '';
  }

  static resolveRangeDialog(testData, cardOptions, html, actor, options) {
    this._resolveDefault(testData, cardOptions, html, options);

    const form = html[0].tagName == 'FORM' ? html[0] : html.find('form')[0];
    const data = new foundry.applications.ux.FormDataExtended(form).object;

    const quickChange = Number(data.quickChange) || 0;
    const sizeMod = Number(data.size) || 0;
    const rangeMod = html.find('[name="distance"] option:selected')[0]?.dataset || {};
    const targetMovement = Number(data.targetMovement) || 0;
    const shooterMovement = Number(data.shooterMovement) || 0;
    const mountedOptions = Number(data.mountedOptions) || 0;
    const aim = Math.min(Number(data.aim) || 0, 4);

    const modifiers = [
      {
        name: `${_loc('MODS.targetMovement')} ${this._getSelectedText('targetMovement', html)}`,
        value: targetMovement,
      },
      {
        name: `${_loc('shooter')} ${this._getSelectedText('shooterMovement', html)}`,
        value: shooterMovement,
      },
      {
        name: `${_loc('mount')} ${this._getSelectedText('mountedOptions', html)}`,
        value: mountedOptions,
      },
      {
        name: _loc('MODS.quickChange'),
        value: quickChange,
      },
      {
        name: _loc('MODS.combatTurmoil'),
        value: Number(data.combatTurmoil) || 0,
      },
      {
        name: _loc('MODS.aim'),
        value: aim,
      },
      {
        name: _loc('MODS.damage'),
        damageBonus: data.damageModifier,
        value: 0,
        step: 1,
      },
      {
        name: _loc('sight'),
        value: Number(data.vision) || 0,
      },
      {
        name: _loc('sizeCategory'),
        value: sizeMod,
      },
      {
        name: _loc('distance'),
        value: Number(rangeMod.attack) || 0,
        damageBonus: Number(rangeMod.damage) || 0,
      },
      ...Itemdsa5.getSpecAbModifiers(html, 'attack'),
      ...this.assassinationModifiersRanged(testData, data),
      ...this.combatInWaterModifiers(testData, data, html, actor)
    ];

    testData.situationalModifiers.push(...modifiers);

    this._applySharpshooterBonus(testData, actor, data, {
      targetMovement,
      shooterMovement,
      mountedOptions,
      quickChange,
      sizeMod,
      rangeMod
    });
  }

  static _applySharpshooterBonus(testData, actor, formData, modValues) {
    const sharpshooter = actor.items.find(
      item => item.type === 'specialability' &&
        item.name === _loc('LocalizedIDs.sharpshooter')
    );

    if (!sharpshooter) return;

    const combatSkill = getProperty(testData.source, 'system.combatskill.value')?.toLowerCase();
    if (!combatSkill) return;

    const allowedSkills = sharpshooter.system.list.value
      .split(/[;,]/)
      .map(skill => skill.trim().toLowerCase());

    if (!allowedSkills.includes(combatSkill)) return;

    const negativeModifiers = [
      modValues.targetMovement,
      modValues.shooterMovement,
      modValues.mountedOptions,
      modValues.quickChange,
      modValues.sizeMod,
      Number(modValues.rangeMod.attack) || 0
    ];

    const totalNegativeMods = Math.abs(
      negativeModifiers.reduce((sum, mod) => {
        return Number(mod) < 0 ? sum + Number(mod) : sum;
      }, 0)
    );

    const maxSharpshooterBonus = Number(sharpshooter.system.step.value) * 2;
    const sharpshooterBonus = Math.min(maxSharpshooterBonus, totalNegativeMods);

    if (sharpshooterBonus > 0) {
      testData.situationalModifiers.push({
        name: _loc('LocalizedIDs.sharpshooter'),
        value: sharpshooterBonus,
      });
    }
  }

  static _resolveDefault(testData, cardOptions, html, options) {
    cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
    testData.situationalModifiers = ModifierCalculator._parseModifiers(html);
    mergeObject(testData.extra.options, options);
  }

  static targetIsSwarm() {
    let res = false;
    game.user.targets.forEach((target) => {
      if (target.actor?.isSwarm()) {
        res = true;
        return;
      }
    });
    return res;
  }

  static attackOfOpportunity(situationalModifiers, formData) {
    let value = Number(formData.opportunityAttack) || 0;
    if (value) {
      situationalModifiers.push({
        name: _loc('MODS.opportunityAttack'),
        value,
      });
      const enemySense = _loc('LocalizedIDs.enemySense');
      const winhallStyle = _loc('LocalizedIDs.winhallStyle');
      game.user.targets.forEach((target) => {
        for (const item of target.actor?.items || []) {
          if (item.type == 'specialability') {
            if (item.name == enemySense) {
              situationalModifiers.push({
                name: enemySense,
                value: -4,
              });
            } else if (item.name == winhallStyle) {
              situationalModifiers.push({
                name: winhallStyle,
                value: -2,
              });
            }
          }
        }
      });
    }
    return value != 0;
  }

  static getRollButtons(testData, dialogOptions, resolve, reject) {
    const buttons = DSA5Dialog.getRollButtons(testData, dialogOptions, resolve, reject);
    if (testData.source.type == 'rangeweapon' || (testData.source.type == 'trait' && testData.source.system.traitType.value == 'rangeAttack')) {
      const actor = DSA5_Utility.getSpeaker(testData.extra.speaker);
      const LZ = testData.source.type == 'trait' ? Number(testData.source.system.reloadTime.value) : Actordsa5.calcLZ(testData.source, actor);
      const progress = testData.source.system.reloadTime.progress;
      if (progress < LZ) {
        buttons.push({
          action: 'reloadButton',
          label: `${_loc('WEAPON.reload')} (${progress}/${LZ})`,
          callback: async () => {
            const actor = await DSA5_Utility.getSpeaker(testData.extra.speaker);
            await actor.updateEmbeddedDocuments('Item', [
              {
                _id: testData.source._id,
                'system.reloadTime.progress': progress + 1,
              },
            ]);
            const infoMsg = _loc('WEAPON.isReloading', {
              actor: actor.token?.name || actor.prototypeToken.name,
              item: testData.source.name,
              status: `${progress + 1}/${LZ}`,
            });
            await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
          },
        });
      }

      const loaded = LZ === 0 || progress >= LZ;
      const aimProgress = Math.clamp(Number(getProperty(testData.source, 'system.aimTime.progress')) || 0, 0, 2);
      if (loaded && aimProgress < 2) {
        buttons.push({
          action: 'aimButton',
          label: `${_loc('WEAPON.aim')} (${aimProgress}/2)`,
          callback: async () => {
            const actor = await DSA5_Utility.getSpeaker(testData.extra.speaker);
            const weapon = actor?.items?.get(testData.source._id);
            if (!weapon) return;

            const lz = weapon.type === 'trait' ? Number(weapon.system.reloadTime?.value) || 0 : Actordsa5.calcLZ(weapon, actor);
            const reloadProgress = Number(weapon.system.reloadTime?.progress) || 0;
            const loaded = lz === 0 || reloadProgress >= lz;
            if (!loaded) return;

            const aimProgress = Math.clamp(Number(weapon.system?.aimTime?.progress) || 0, 0, 2);
            if (aimProgress >= 2) return;

            const newProgress = Math.min(aimProgress + 1, 2);
            await actor.updateEmbeddedDocuments('Item', [
              {
                _id: weapon.id,
                'system.aimTime.progress': newProgress,
              },
            ]);

            const infoMsg = _loc('WEAPON.isAiming', {
              actor: actor.token?.name || actor.prototypeToken.name,
              item: weapon.name,
              status: `${newProgress}/2`,
            });
            await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
          },
        });
      }      
    }
    return buttons;
  }
}
