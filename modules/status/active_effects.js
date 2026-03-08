import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import DSATriggers from '../system/automation/triggers.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import EffectDropdownBuilder from './effect-dropdown-builder.js';
import { localize } from '../system/helpers/localizer.js';
const { mergeObject, getProperty, duplicate, setProperty } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

async function callMacro(packName, name, actor, item, qs, args = {}) {
  let result = {};
  if (!game.user.can('MACRO_SCRIPT')) {
    ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
  } else {
    const pack = game.packs.get(packName);
    let documents = await pack?.getDocuments({ name });
    if (!documents || !documents.length) {
      for (let pack of game.packs.filter((x) => x.documentName == 'Macro' && /\(internal\)/.test(x.metadata.label))) {
        documents = await pack.getDocuments({ name });
        if (documents.length) break;
      }
    }

    if (documents.length) {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction('actor', 'item', 'source', 'qs', 'args', documents[0].command);
      try {
        args.result = result;
        const that = new OnUseEffect(item);
        await fn.call(that, actor, item, item, qs, args);
      } catch (err) {
        ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
        console.error(err);
        result.error = true;
      }
    } else {
      ui.notifications.error('DSAError.macroNotFound', { format: { name }, localize: true });
    }
  }
  return result;
}

Hooks.once('i18nInit', () => {
  DSAActiveEffectConfig.effectDurationRegexes = [
    {
      regEx: new RegExp(localize('DSAREGEX.combatRounds'), 'i'),
      seconds: 5,
    },
    {
      regEx: new RegExp(localize('DSAREGEX.minutes'), 'i'),
      seconds: 60,
    },
    {
      regEx: new RegExp(localize('DSAREGEX.hours'), 'i'),
      seconds: 3600,
    },
    {
      regEx: new RegExp(localize('DSAREGEX.days'), 'i'),
      seconds: 3600 * 24,
    },
    {
      regEx: new RegExp(localize('DSAREGEX.weeks'), 'i'),
      seconds: 3600 * 24 * 7,
    },
    {
      regEx: new RegExp(localize('DSAREGEX.months'), 'i'),
      seconds: 3600 * 24 * 30,
    },
    {
      regEx: new RegExp(localize('DSAREGEX.years'), 'i'),
      seconds: 3600 * 24 * 350,
    },
  ];
});

export default class DSAActiveEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {
  static AdvantageRuleItems = new Set(['armor', 'meleeweapon', 'rangeweapon']);
  static macroIndexes = [2, 6, 7, 8];

  static DEFAULT_OPTIONS = {
    window: {
      resizable: true,
    },
    position: {
      width: 600,
    },
  };

  static PARTS = {
    header: super.PARTS.header,
    tabs: super.PARTS.tabs,
    details: super.PARTS.details,
    duration: super.PARTS.duration,
    changes: { template: 'systems/dsa5/templates/status/changes.hbs', scrollable: [''] },
    advanced: { template: 'systems/dsa5/templates/status/advanced_effect.hbs' },
    footer: super.PARTS.footer,
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'details', icon: 'fa-solid fa-book' },
        { id: 'duration', icon: 'fa-solid fa-clock' },
        { id: 'changes', icon: 'fa-solid fa-cogs' },
        { id: 'advanced', icon: 'fa-solid fa-shield-alt', label: 'advanced' },
      ],
      initial: 'details',
      labelPrefix: 'EFFECT.TABS',
    },
  };

  static async callMacro(packName, name, actor, item, qs, args = {}) {
    return await callMacro(packName, name, actor, item, qs, args);
  }

  static async startDelayedEffect(duration, effect) {
    effect.update({
      'system.delayed': false,
      duration,
      'flags.dsa5.-=onDelayed': null,
    });
  }

  static onDelayedEffect(actor, effect) {
    let continueDeletion = true;
    if (effect.system.delayed) {
      const duration = effect.system?.originalDuration || {
        seconds: '',
        rounds: '',
      };
      mergeObject(duration, {
        startRound: game.combat?.round,
        startTurn: game.combat?.turn,
        startTime: game.time.worldTime,
      });
      if (!duration.rounds && duration.seconds) {
        duration.rounds = Number(duration.seconds) / 5;
      }
      if (effect.changes.length || effect.statuses.size) {
        this.startDelayedEffect(duration, effect);
        continueDeletion = false;
      }

      if (effect.system.macroEffect) {
        const testData = effect.system.initialTestData;
        const sourceActor = game.actors.get(effect.system.sourceActor);
        const source = effect.system.source;

        const macroEffect = duplicate(effect.system.macroEffect);
        delete macroEffect.flags.dsa5?.onDelayed;
        macroEffect.system.delayed = false;
        macroEffect.duration = duration;
        this.applyAdvancedFunction(actor, [macroEffect], source, testData, sourceActor);
      }
    }
    return continueDeletion;
  }

  static async onEffectRemove(actor, effect) {
    const onRemoveMacro = getProperty(effect, 'flags.dsa5.onRemove');
    if (onRemoveMacro) {
      if (!game.user.can('MACRO_SCRIPT')) {
        ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
      } else {
        try {
          const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
          const fn = new AsyncFunction('effect', 'actor', onRemoveMacro);
          await fn.call(this, effect, actor);
        } catch (err) {
          ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
          console.error(err);
          console.warn(err.stack);
        }
      }
    }
  }

  async checkTimesUpInstalled() {
    const isInstalled = DSA5_Utility.moduleEnabled('times-up');
    if (!isInstalled && game.user.isGM) ui.notifications.warn('DSAError.shouldTimesUp', { localize: true });
    return isInstalled;
  }

  async _updateObject(event, formData) {
    // If the charges inputs are left empty, Foundry often persists them as empty strings.
    // Number("") === 0 would incorrectly mark the effect as depleted and prevent it from applying.
    const valueRaw = formData?.['flags.dsa5.charges.value'];
    const maxRaw = formData?.['flags.dsa5.charges.max'];

    const isEmpty = (v) => v === '' || v === null || v === undefined;

    // If current charges are empty, we consider charges "not configured" and remove the flag entirely.
    // (Max without a current value is not meaningful for depletion, and would still cause gating.)
    if (isEmpty(valueRaw)) {
      delete formData['flags.dsa5.charges.value'];
      delete formData['flags.dsa5.charges.max'];
      formData['flags.dsa5.-=charges'] = null;
    } else if (isEmpty(maxRaw)) {
      // Allow "current" without "max".
      delete formData['flags.dsa5.charges.max'];
    }

    return super._updateObject(event, formData);
  }

  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);
    if (partId in partContext.tabs) partContext.tab = partContext.tabs[partId];
    const document = this.document;
    switch (partId) {
      case 'advanced':
        let index = 0;

        const itemType = document.parent.type;
        const item = document.parent;
        const isWeapon = ['meleeweapon', 'rangeweapon'].includes(itemType) || (itemType == 'trait' && ['meleeAttack', 'rangeAttack'].includes(item.system.traitType.value));
        const isCombatSpecAb = ['specialability'].includes(itemType) && item.system.category.value == 'Combat';
        const hasVantages = ['ammunition', 'meleeweapon', 'rangeweapon'].includes(itemType);
        const effectConfigs = {
          hasSpellEffects: isWeapon || isCombatSpecAb || ['spell', 'liturgy', 'ritual', 'skill', 'ceremony', 'consumable', 'poison', 'disease', 'ammunition', 'plant'].includes(itemType),
          hasDamageTransformation: hasVantages || (isCombatSpecAb && item.system.category.sub != 4),
          hasArmorTransformation: hasVantages,
          hasTriggerEffects: ['specialability'].includes(itemType),
          hasSuccessEffects: ['poison', 'disease'].includes(itemType),
        };

        let advancedFunctions = [];

        if (effectConfigs.hasSpellEffects || effectConfigs.hasDamageTransformation || effectConfigs.hasTriggerEffects) {
          advancedFunctions.push({ name: `ActiveEffects.advancedFunctions.none`, index: 0 });
        }

        if (effectConfigs.hasSpellEffects) {
          for (let x of ['systemEffect', 'macro', 'creature']) {
            advancedFunctions.push({ name: `ActiveEffects.advancedFunctions.${x}`, index: (index += 1) });
          }
        }

        if (effectConfigs.hasDamageTransformation) {
          advancedFunctions.push({ name: 'ActiveEffects.advancedFunctions.damagePostprocess', index: DSATriggers.EVENTS.DAMAGE_TRANSFORMATION });
        }

        if (effectConfigs.hasArmorTransformation) {
          advancedFunctions.push({ name: 'ActiveEffects.advancedFunctions.armorPostprocess', index: DSATriggers.EVENTS.ARMOR_TRANSFORMATION });
        }
        if (effectConfigs.hasTriggerEffects) {
          advancedFunctions.push(
            { name: 'ActiveEffects.advancedFunctions.postRoll', index: DSATriggers.EVENTS.POST_ROLL },
            { name: 'ActiveEffects.advancedFunctions.postOpposed', index: DSATriggers.EVENTS.POST_OPPOSED },
            { name: 'ActiveEffects.advancedFunctions.rollDialogRender', index: DSATriggers.EVENTS.ROLL_DIALOG_RENDER },
          );
        }
        const messageReceivers = ['players', 'player', 'playergm', 'gm'].reduce((obj, e) => {
          obj[e] = localize(`ActiveEffects.messageReceivers.${e}`);
          return obj;
        }, {});

        const applySuccessConditions = {
          1: 'ActiveEffects.onSuccess',
          2: 'ActiveEffects.onFailure',
        };

        const canWeaponAdvantages = DSAActiveEffectConfig.AdvantageRuleItems.has(itemType);

        mergeObject(partContext, {
          advancedFunctions,
          effectConfigs,
          macroIndexes: DSAActiveEffectConfig.macroIndexes,
          messageReceivers,
          canWeaponAdvantages,
          equipmentAdvantageOptions: {
            1: localize(`AdvantageRuleItems.${itemType}.1`),
            2: localize(`AdvantageRuleItems.${itemType}.2`),
          },
          applySuccessConditions,
          config: this.getConfig(),
          isWeapon,
          dispositions: Object.entries(CONST.TOKEN_DISPOSITIONS).reduce(
            (obj, e) => {
              obj[e[1]] = `TOKEN.DISPOSITION.${e[0]}`;
              return obj;
            },
            { 2: localize('all') },
          ),
        });
        break;
    }
    return partContext;
  }

  getConfig() {
    return {
      systemEffects: this.getStatusEffects(),
      canEditMacros: game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro'),
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    html.find('.advancedSelector').on('change', (ev) => {
      let effect = this.document;
      effect.flags.dsa5.advancedFunction = Number($(ev.currentTarget).val());

      renderTemplate('systems/dsa5/templates/status/advanced_functions.hbs', {
        document: this.document,
        config: this.getConfig(),
        macroIndexes: DSAActiveEffectConfig.macroIndexes,
      }).then((template) => {
        html.find('.advancedFunctions').html(template);
      });
    });
    html.find('.auraSelector').on('change', (ev) => {
      html.find('.auraDetails').toggleClass('dsahidden', !ev.currentTarget.checked);
      html.find('.auraBox').toggleClass('groupbox', ev.currentTarget.checked);
    });
    if (this.document.statuses.size && game.i18n.has(this.document.description)) {
      html.find('[data-tab="details"] .editor').replaceWith(`<p>${localize(this.document.description)}</p>`);
    }

    const dropDown = EffectDropdownBuilder.buildDropdownMenu(this.document);
    html.find('.changes .ol .key').append(dropDown);
    html
      .find('.selMenu')
      .select2({ width: 'element' })
      .on('change', (ev) => {
        const elem = $(ev.currentTarget);
        elem.siblings('input').val(elem.val());
        const parent = elem.closest('.row-section');
        const data = elem.find('option:selected');
        parent.find('.mode select').val(data.attr('data-mode'));
        parent.find('.value input').attr('placeholder', data.attr('data-ph'));
        elem.trigger('blur');
      });
    html.find('.select2').each((i, el) => {
      $(el)[0].style.removeProperty('width');
    });
    this.checkTimesUpInstalled();
  }

  getStatusEffects() {
    return CONFIG.statusEffects
      .map((x) => {
        return { id: x.id, name: localize(x.name) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  static applyRollTransformation(actor, options, functionID) {
    let msg = '';
    let source = options.origin;
    for (const ef of source.effects) {
      try {
        if (Number(getProperty(ef, 'flags.dsa5.advancedFunction')) == functionID) {
          if (!game.user.can('MACRO_SCRIPT')) {
            ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
          } else {
            try {
              const syncFunction = Object.getPrototypeOf(function () {}).constructor;
              const fn = new syncFunction('ef', 'callMacro', 'actor', 'msg', 'source', 'options', getProperty(ef, 'flags.dsa5.args3'));
              fn.call(this, ef, callMacro, actor, msg, source, options);
            } catch (err) {
              ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
              console.error(err);
              console.warn(err.stack);
            }
          }
        }
      } catch (exception) {
        console.warn('Unable to apply advanced effect', exception, ef);
      }
    }
    options.origin = source;
    return { msg, options };
  }

  static async applyAdvancedFunction(actor, effects, source, testData, sourceActor, options = {}) {
    const { skipResistRolls = true } = options;
    let msg = '';
    const resistRolls = [];
    let effectApplied = false;
    const effectsWithChanges = [];
    const effectNames = new Set();

    for (const ef of effects) {
      if (ef.origin) delete ef.origin;

      const specStep = Number(getProperty(ef, 'flags.dsa5.specStep')) || 0;
      try {
        const customEf = Number(getProperty(ef, 'flags.dsa5.advancedFunction'));
        const qs = Math.min(testData.qualityStep || 0, 6);
        const resistRoll = getProperty(ef, 'flags.dsa5.resistRoll');
        const isAura = getProperty(ef, 'flags.dsa5.isAura');

        if (isAura) {
          const radius = `${getProperty(ef, 'flags.dsa5.auraRadius') || 1}`.replace(/q(l|s)/i, qs);
          const evaluatedRadius = (await new Roll(radius).evaluate()).total;
          setProperty(ef, 'flags.dsa5.auraRadius', evaluatedRadius);
        }

        if (resistRoll && !skipResistRolls) {
          const skills = resistRoll.split(' ');
          const mod = `${skills.pop()}`;
          resistRolls.push({
            skill: skills.join(' '),
            mod: Math.round(Roll.safeEval(`${mod}`.replace(/q(l|s)/i, qs).replaceAll('step', specStep))) || 0,
            effect: ef,
            target: actor,
            token: actor.token?.id,
          });
        } else {
          effectApplied = true;
          if (!effectNames.has(ef.name)) effectNames.add(ef.name);

          const onDelayed = getProperty(ef, 'flags.dsa5.onDelayed');

          const delayedData = {
            duration: {
              seconds: onDelayed,
            },
            system: {
              delayed: true,
              originalDuration: ef.duration,
            },
          };

          let isEffectWithChange = (ef.changes && ef.changes.length > 0) || (isAura && !customEf);

          if (customEf) {
            switch (customEf) {
              case 1: //Systemeffekt
                {
                  let value = `${getProperty(ef, 'flags.dsa5.args1')}` || '1';
                  if (/,/.test(value)) {
                    value = Number(value.split(',')[qs - 1]);
                  } else {
                    value = Number(value.replace(localize('CHARAbbrev.QS'), qs));
                  }
                  const effectId = getProperty(ef, 'flags.dsa5.args0');
                  const effectName = localize(`CONDITION.${effectId}`);
                  const effectData = {
                    name: `${source.name} (${effectName})`,
                    duration: ef.duration,
                  };
                  if (onDelayed) mergeObject(effectData, delayedData);

                  await actor.addTimedCondition(effectId, value, false, false, effectData);
                }
                break;
              case 2: //Macro
                if (!game.user.can('MACRO_SCRIPT')) {
                  ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
                } else {
                  if (onDelayed) {
                    const copy = duplicate(ef);
                    copy.changes = [];
                    isEffectWithChange = true;
                    mergeObject(ef, {
                      system: {
                        macroEffect: copy,
                        sourceActor: sourceActor?.id,
                        source: source,
                        initialTestData: {
                          qualityStep: testData.qualityStep,
                        },
                      },
                    });
                  } else {
                    //try {
                      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
                      const command = getProperty(ef, 'flags.dsa5.args3');
                      const fn = new AsyncFunction('effect', 'actor', 'callMacro', 'msg', 'source', 'sourceActor', 'testData', 'qs', 'options', command);
                      await fn.call(this, ef, actor, callMacro, msg, source, sourceActor, testData, qs, options);
                    /*} catch (err) {
                      ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                      console.error(err);
                      console.warn(err.stack);
                    }*/
                  }
                }
                break;
              case 3: // Creature Link
                {
                  const creatures = (getProperty(ef, 'flags.dsa5.args4') || '')
                    .split(',')
                    .map((x) => `@Compendium[${x.trim().replace(/@Compendium\[|\]/g, '')}]`)
                    .join(' ');
                  msg += `<p><b>${localize('ActiveEffects.advancedFunctions.creature')}</b>:</p><p>${creatures}</p>`;
                }
                break;
            }
          }

          if (isEffectWithChange) {
            if (onDelayed) {
              delete ef.flags.dsa5.onDelayed;
              mergeObject(ef, delayedData);
            }

            effectsWithChanges.push(ef);
          }
        }
      } catch (exception) {
        console.warn('Unable to apply advanced effect');
        console.warn(exception);
        console.warn(ef);
      }
    }
    if (effectsWithChanges.length) await actor.createEmbeddedDocuments('ActiveEffect', effectsWithChanges);
    return {
      msg,
      resistRolls,
      effectApplied,
      effectNames: Array.from(effectNames),
    };
  }

  static async resistEffect(ev) {
    const data = ev.currentTarget.dataset;
    const target = { token: data.token, actor: data.actor, scene: canvas.id };
    const actor = DSA5_Utility.getSpeaker(target);
    if (actor) {
      const skill = actor.items.find((x) => x.type == 'skill' && x.name == data.skill);
      actor.setupSkill(skill, { modifier: data.mod }, data.token).then(async (setupData) => {
        setupData.testData.opposable = false;
        const res = await actor.basicTest(setupData);
        const availableQs = res.result.qualityStep || 0;
        //this.automatedAnimation(res.result.successLevel);

        if (availableQs < 1) {
          if (data.systemEffect) {
            const level = / \d$/.test(data.SystemEffect) ? Number(data.SystemEffect.slice(-1)) : 1;
            const actualEffect = data.systemEffect.replace(/ \d$/, '');
            await actor.addCondition(actualEffect, level);
          } else {
            await this.applyEffect(data.message, data.mode, [target], {
              effectIds: [data.effect],
              skipResistRolls: true,
            });
          }
        }
      });
    } else {
      console.warn('Actor not found for resist roll.');
    }
  }

  static async applyEffect(id, mode, targets, options = {}) {
    const message = game.messages.get(id);
    const source = message.flags.data.preData.source;
    const testData = message.flags.data.postData;
    const speaker = message.speaker;

    const hasSuccessEffects = ['poison', 'disease'].includes(source.type);

    if (hasSuccessEffects) testData.qualityStep = testData.successLevel > 0 ? 1 : 2;

    const attacker = DSA5_Utility.getSpeaker(speaker) || DSA5_Utility.getSpeaker(getProperty(message.flags, 'data.preData.extra.speaker'));
    let parent_source_attacker;
    if (attacker?.emptyActor?.parent_source_uuid) {
      parent_source_attacker = await fromUuid(attacker.emptyActor.parent_source_uuid);
    }

    const sourceActor = attacker;
    let effects = (await this._parseEffectDuration(source, testData, message.flags.data.preData, attacker)).filter((x) => !getProperty(x, 'flags.dsa5.applyToOwner'));

    if (hasSuccessEffects) effects = effects.filter((x) => getProperty(x, 'flags.dsa5.successEffect') == testData.qualityStep || !getProperty(x, 'flags.dsa5.successEffect'));
    if (options.effectIds) effects = effects.filter((x) => options.effectIds.includes(x._id));
    let actors = [];
    if (mode == 'self') {
      if (attacker) actors.push(parent_source_attacker ||attacker);
    } else {
      if (targets) actors = targets.map((x) => DSA5_Utility.getSpeaker(x));
      else if (game.user.targets.size) {
        game.user.targets.forEach((target) => {
          if (target.actor) actors.push(target.actor);
        });
      }
    }
    if (game.user.isGM) {
      for (let actor of actors) {
        const { msg, resistRolls, effectApplied, effectNames } = await DSAActiveEffectConfig.applyAdvancedFunction(
          actor,
          effects,
          source,
          testData,
          sourceActor,
          { ...options, skipResistRolls: options.skipResistRolls || false },
        );
        if (effectApplied) {
          const appliedEffect = game.i18n.format('ActiveEffects.appliedEffect', {
            target: actor.token?.name || actor.name,
            source: effectNames.join(', '),
          });
          const infoMsg = `${appliedEffect}${msg || ''}`;
          await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        }
        if (resistRolls.length) {
          await this.createResistRollMessage(resistRolls, id, mode);
        }
      }
    } else {
      game.socket.emit('system.dsa5', {
        type: 'addEffect',
        payload: {
          mode,
          id,
          options: { ...options, user_id: game.user.id },
          actors: actors.map((x) => {
            return {
              token: x.token ? x.token.id : undefined,
              actor: x.id,
              scene: canvas.scene.id,
            };
          }),
        },
      });
    }
  }

  static async createResistRollMessage(resistRolls, id, mode) {
    for (const resist of resistRolls) {
      const template = await renderTemplate('systems/dsa5/templates/chat/roll/resist-roll.hbs', {
        resist,
        id,
        mode,
      });
      await ChatMessage.create(DSA5_Utility.chatDataSetup(template));
    }
  }

  static async _parseEffectDuration(source, testData, preData, attacker) {
    const specAbIds = (preData.situationalModifiers || []).reduce((acc, s) => {
      if (s.specAbId) acc[s.specAbId] = s.step;
      return acc;
    }, {});
    const specKeys = new Set(Object.keys(specAbIds));
    const specAbs = attacker ? attacker.items.filter((x) => specKeys.has(x.id)) : [];

    const effects = source.effects ? duplicate(source.effects) : [];
    for (const spec of specAbs) {
      const specEffects = duplicate(spec).effects || [];
      specEffects.forEach((ef) => setProperty(ef, 'flags.dsa5.specStep', specAbIds[spec.id]));
      effects.push(...specEffects);
    }

    let duration = getProperty(source, 'system.duration.value') || '';
    duration = duration.replace(/ x /g, ' * ').replaceAll(localize('CHARAbbrev.QS'), `${testData.qualityStep}`);

    try {
      for (const { regEx, seconds } of DSAActiveEffectConfig.effectDurationRegexes) {
        if (!regEx.test(duration)) continue;
        const dur = duration.replace(regEx, '').trim();
        const time = await DiceDSA5._stringToRoll(dur);
        if (isNaN(time)) break;

        for (const ef of effects) {
          let calcTime = time * seconds;
          const customDuration = getProperty(ef, 'flags.dsa5.customDuration');
          if (customDuration) {
            const parts = String(customDuration).split(',').map((p) => p.trim());
            const qsDuration = parts[testData.qualityStep - 1];
            if (qsDuration && qsDuration !== '-') calcTime = Number(qsDuration);
          }
          ef.duration = ef.duration || {};
          ef.duration.seconds = calcTime;
          ef.duration.rounds = calcTime / 5;
        }
        break;
      }
    } catch (e) {
      console.error(`Could not parse duration '${duration}' of '${source.name}'`, e);
    }
    return effects;
  }
}
