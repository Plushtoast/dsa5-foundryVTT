import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import MaintainedEffects from '../system/maintenance/maintained-effects.js';
import DSAActiveEffectDataModel from '../data/activeeffect/dsaeffect.js';
import DSABaseEffectConfig from './base_effect_config.js';

const { mergeObject, getProperty, duplicate, isPlainObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

async function callMacro(packName, name, actor, item, qs, args = {}) {
  const result = isPlainObject(args.result) ? args.result : {};
  if (!game.user.can('MACRO_SCRIPT')) {
    ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
  } else {
    const pack = game.packs.get(packName);
    let documents = await pack?.getDocuments({ name });
    if (!documents || !documents.length) {
      for (const pack of game.packs.filter((x) => x.documentName == 'Macro' && /\(internal\)/.test(x.metadata.label))) {
        documents = await pack.getDocuments({ name });
        if (documents.length) break;
      }
    }

    if (documents.length) {
      const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
      const fn = new AsyncFunction('actor', 'item', 'source', 'qs', 'args', documents[0].command);
      const that = new OnUseEffect(item);
      const previousArgs = that.currentOnUseArgs;
      that.currentOnUseArgs = args;
      try {
        args.result = result;
        await fn.call(that, actor, item, item, qs, args);
      } catch (err) {
        ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
        console.error(err);
        result.error = true;
      } finally {
        that.currentOnUseArgs = previousArgs;
      }
    } else {
      ui.notifications.error('DSAError.macroNotFound', { format: { name }, localize: true });
    }
  }
  if (isPlainObject(args.result) && args.result !== result) mergeObject(result, args.result);
  return result;
}

function collectResultMessage(result) {
  return result?.msg ?? result?.msgOut ?? '';
}

Hooks.once('i18nInit', () => {
  DSAActiveEffectConfig.effectDurationRegexes = [
    {
      regEx: new RegExp(_loc('DSAREGEX.combatRounds'), 'i'),
      seconds: 5,
    },
    {
      regEx: new RegExp(_loc('DSAREGEX.minutes'), 'i'),
      seconds: 60,
    },
    {
      regEx: new RegExp(_loc('DSAREGEX.hours'), 'i'),
      seconds: 3600,
    },
    {
      regEx: new RegExp(_loc('DSAREGEX.days'), 'i'),
      seconds: 3600 * 24,
    },
    {
      regEx: new RegExp(_loc('DSAREGEX.weeks'), 'i'),
      seconds: 3600 * 24 * 7,
    },
    {
      regEx: new RegExp(_loc('DSAREGEX.months'), 'i'),
      seconds: 3600 * 24 * 30,
    },
    {
      regEx: new RegExp(_loc('DSAREGEX.years'), 'i'),
      seconds: 3600 * 24 * 350,
    },
  ];
});

export default class DSAActiveEffectConfig extends DSABaseEffectConfig {
  static AdvantageRuleItems = new Set(['armor', 'meleeweapon', 'rangeweapon']);
  static macroIndexes = [
    DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.MACRO,
    DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.POST_ROLL,
    DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.POST_OPPOSED,
    DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.ROLL_DIALOG_RENDER,
  ];

  static buildAdvancedFunctions(effectConfigs) {
    const allowed = new Set();

    if (effectConfigs.hasSpellEffects || effectConfigs.hasDamageTransformation || effectConfigs.hasTriggerEffects) {
      allowed.add(DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.NONE);
    }
    if (effectConfigs.hasSpellEffects) {
      allowed.add(DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.SYSTEM_EFFECT);
      allowed.add(DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.MACRO);
      allowed.add(DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.CREATURE);
    }
    if (effectConfigs.hasDamageTransformation) {
      allowed.add(DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.DAMAGE_TRANSFORMATION);
    }
    if (effectConfigs.hasArmorTransformation) {
      allowed.add(DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.ARMOR_TRANSFORMATION);
    }
    if (effectConfigs.hasTriggerEffects) {
      allowed.add(DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.POST_ROLL);
      allowed.add(DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.POST_OPPOSED);
      allowed.add(DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.ROLL_DIALOG_RENDER);
    }

    return Object.entries(DSAActiveEffectDataModel.ADVANCED_FUNCTION_TYPES)
      .map(([index, name]) => ({ index: Number(index), name }))
      .filter((entry) => allowed.has(entry.index))
      .sort((a, b) => a.index - b.index);
  }

  static PARTS = {
    header: super.PARTS.header,
    tabs: super.PARTS.tabs,
    details: super.PARTS.details,
    duration: foundry.applications.sheets.ActiveEffectConfig.PARTS.duration,
    changes: super.PARTS.changes,
    advanced: { template: 'systems/dsa5/templates/status/advanced_effect.hbs' },
    actions: super.PARTS.actions,
    footer: super.PARTS.footer,
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'details', icon: 'fa-solid fa-book' },
        { id: 'duration', icon: 'fa-solid fa-clock' },
        { id: 'changes', icon: 'fa-solid fa-cogs' },
        { id: 'advanced', icon: 'fa-solid fa-shield-alt', label: 'advanced' },
        { id: 'actions', icon: 'fa-solid fa-bolt' },
      ],
      initial: 'details',
      labelPrefix: 'EFFECT.TABS',
    },
  };

  get #showAdvancedTab() {
    return true;
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (group === 'sheet' && !this.#showAdvancedTab) {
      delete tabs.advanced;
      const tabKeys = Object.keys(tabs);
      if (!tabKeys.some((k) => tabs[k].active) && tabKeys.length) {
        tabs[tabKeys[0]].active = true;
        tabs[tabKeys[0]].cssClass = 'active';
      }
    }
    return tabs;
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!this.#showAdvancedTab) delete parts.advanced;
    return parts;
  }

  static async callMacro(packName, name, actor, item, qs, args = {}) {
    return await callMacro(packName, name, actor, item, qs, args);
  }

  static async registerMaintainedParentEffect(messageId, parentEffectUuid) {
    return await MaintainedEffects.registerOnMessage(messageId, { parentUuid: parentEffectUuid });
  }

  static async registerMaintainedTargetEffects(messageId, targetEffectUuids = []) {
    return await MaintainedEffects.registerOnMessage(messageId, { targetUuids: targetEffectUuids });
  }

  static async startDelayedEffect({ duration, start }, effect) {
    effect.update({
      'system.delayed.enabled': false,
      duration,
      start,
      'system.macroArgs.onDelayed': '',
    });
  }

  static onDelayedEffect(actor, effect) {
    let continueDeletion = true;
    const delayedData = effect.system?.delayed;
    const isDelayed = !!delayedData?.enabled;
    if (isDelayed) {
      const orig = delayedData?.originalDuration || {};
      const duration = {
        value: orig.value ?? orig.seconds ?? orig.rounds ?? null,
        units: orig.units ?? (orig.rounds ? 'rounds' : 'seconds'),
      };
      const start = ActiveEffect.getEffectStart();
      const updateData = { duration, start };
      if (effect.system.changes.length || effect.statuses.size) {
        this.startDelayedEffect(updateData, effect);
        continueDeletion = false;
      }

      if (delayedData?.macroEffect) {
        const testData = delayedData.initialTestData;
        const sourceActor = game.actors.get(delayedData.sourceActor);
        const source = delayedData.source;

        const macroEffect = duplicate(delayedData.macroEffect);
        macroEffect.system ||= {};
        macroEffect.system.macroArgs ||= {};
        delete macroEffect.system?.macroArgs?.onDelayed;
        macroEffect.system.delayed = { enabled: false };
        macroEffect.duration = duration;
        macroEffect.start = start;
        this.applyAdvancedFunction(actor, [macroEffect], source, testData, sourceActor);
      }
    }
    return continueDeletion;
  }

  static async onEffectRemove(actor, effect) {
    const onRemoveMacro = effect.system?.macroArgs?.onRemove;
    if (onRemoveMacro) {
      if (!game.user.can('MACRO_SCRIPT')) {
        ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
      } else {
        try {
          const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
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


  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);
    const document = this.document;
    switch (partId) {
      case 'advanced': {
        const isItemEffect = document.parent?.documentName === 'Item';
        const messageReceivers = ['players', 'player', 'playergm', 'gm'].reduce((obj, e) => {
          obj[e] = `ActiveEffects.messageReceivers.${e}`;
          return obj;
        }, {});

        if (isItemEffect) {
          const itemType = document.parent.type;
          const item = document.parent;
          const isWeapon = ['meleeweapon', 'rangeweapon'].includes(itemType) || (itemType == 'trait' && ['meleeAttack', 'rangeAttack'].includes(item.system.traitType.value));
          const isCombatSpecAb = ['specialability'].includes(itemType) && item.system.category.value == 'Combat';
          const hasVantages = ['ammunition', 'meleeweapon', 'rangeweapon'].includes(itemType);
          const effectConfigs = {
            hasSpellEffects: isWeapon || isCombatSpecAb || ['spell', 'liturgy', 'ritual', 'skill', 'ceremony', 'consumable', 'poison', 'disease', 'ammunition'].includes(itemType),
            hasDamageTransformation: hasVantages || (isCombatSpecAb && item.system.category.sub != 4),
            hasArmorTransformation: hasVantages,
            hasTriggerEffects: ['specialability'].includes(itemType),
            hasSuccessEffects: ['poison', 'disease'].includes(itemType),
          };
          const advancedFunctions = DSAActiveEffectConfig.buildAdvancedFunctions(effectConfigs);
          const advancedFunctionChoices = advancedFunctions.reduce((obj, e) => {
            obj[e.index] = e.name;
            return obj;
          }, {});

          const canWeaponAdvantages = DSAActiveEffectConfig.AdvantageRuleItems.has(itemType);
          const enableWeaponAdvantages = game.settings.get('dsa5', 'enableWeaponAdvantages');

          mergeObject(partContext, {
            advancedFunctions,
            advancedFunctionChoices,
            effectConfigs,
            macroIndexes: DSAActiveEffectConfig.macroIndexes,
            canWeaponAdvantages,
            enableWeaponAdvantages,
            equipmentAdvantageOptions: {
              1: `AdvantageRuleItems.${itemType}.1`,
              2: `AdvantageRuleItems.${itemType}.2`,
            },
            isWeapon,
          });
        } else if (document.parent?.documentName === 'Actor') {
          const effectConfigs = {
            hasSpellEffects: true,
            hasDamageTransformation: false,
            hasArmorTransformation: false,
            hasTriggerEffects: false,
            hasSuccessEffects: false,
          };
          const advancedFunctions = DSAActiveEffectConfig.buildAdvancedFunctions(effectConfigs);
          const advancedFunctionChoices = advancedFunctions.reduce((obj, e) => {
            obj[e.index] = e.name;
            return obj;
          }, {});
          mergeObject(partContext, {
            advancedFunctions,
            advancedFunctionChoices,
            effectConfigs,
            macroIndexes: DSAActiveEffectConfig.macroIndexes,
          });
        }

        mergeObject(partContext, {
          isItemEffect,
          messageReceivers,
          config: this.getConfig(),
        });
        break;
      }
    }
    return partContext;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    html.find('[name="system.advancedFunction"]').on('change', (ev) => {
      const effect = this.document;
      effect.system.advancedFunction = Number($(ev.currentTarget).val());

      renderTemplate('systems/dsa5/templates/status/advanced_functions.hbs', {
        document: this.document,
        config: this.getConfig(),
        macroIndexes: DSAActiveEffectConfig.macroIndexes,
      }).then((template) => {
        html.find('.advancedFunctions').html(template);
      });
    });
    html.find('[name="system.aura.isAura"]').on('change', (ev) => {
      html.find('.auraDetails').toggleClass('dsahidden', !ev.currentTarget.checked);
      html.find('.auraBox').toggleClass('groupbox', ev.currentTarget.checked);
    });
    if (this.document.statuses.size && game.i18n.has(this.document.description)) {
      html.find('[data-tab="details"] .editor').replaceWith(`<p>${_loc(this.document.description)}</p>`);
    }
  }

  static applyRollTransformation(actor, options, functionID) {
    const msg = '';
    const source = options.origin;
    for (const ef of source.effects) {
      if (ef.type === 'enhancement') continue;
      try {
        if (Number(ef.system.advancedFunction) == functionID) {
          if (!game.user.can('MACRO_SCRIPT')) {
            ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
          } else {
            try {
              const syncFunction = Object.getPrototypeOf(function () { }).constructor;
              const fn = new syncFunction('ef', 'callMacro', 'actor', 'msg', 'source', 'options', ef.system.macroArgs.macro);
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
    const { skipResistRolls = true, origin } = options;
    let msg = '';
    const resistRolls = [];
    let effectApplied = false;
    const effectsWithChanges = [];
    const effectNames = new Set();

    for (const ef of effects) {
      if (ef.origin) delete ef.origin;
      if (origin) ef.origin = origin;

      const effectSystem = (ef.system ??= {});
      effectSystem.aura ??= {};
      effectSystem.macroArgs ??= {};
      effectSystem.changes ??= [];

      const specStep = Number(effectSystem.specStep) || 0;
      try {
        const advancedFunctionIndexes = DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES;
        const customEf = Number(effectSystem.advancedFunction);
        const qs = Math.min(testData?.qualityStep || 0, 6);
        const resistRoll = effectSystem.resistRoll;
        const isAura = !!effectSystem.aura.isAura;

        if (isAura) {
          const radius = `${effectSystem.aura.auraRadius || 1}`.replace(/q(l|s)/i, qs);
          const evaluatedRadius = (await new Roll(radius).evaluate()).total;
          effectSystem.aura.auraRadius = evaluatedRadius;
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

          const onDelayed = effectSystem.macroArgs.onDelayed;

          const delayedData = {
            duration: {
              value: parseInt(onDelayed) || 0,
              units: 'seconds',
            },
            system: {
              delayed: {
                enabled: true,
                originalDuration: ef.duration,
              },
            },
          };

          let isEffectWithChange = effectSystem.changes.length > 0 || (isAura && !customEf);

          if (customEf) {
            switch (customEf) {
              case advancedFunctionIndexes.SYSTEM_EFFECT:
                {
                  let value = `${effectSystem.macroArgs.conditionValue}` || '1';
                  if (/,/.test(value)) {
                    value = Number(value.split(',')[qs - 1]);
                  } else {
                    value = Number(value.replace(_loc('CHARAbbrev.QS'), qs));
                  }
                  const effectId = effectSystem.macroArgs.conditionId;
                  const effectName = _loc(`CONDITION.${effectId}`);
                  const effectData = {
                    name: `${source.name} (${effectName})`,
                    duration: ef.duration,
                  };
                  if (origin) effectData.origin = origin;
                  if (onDelayed) mergeObject(effectData, delayedData);

                  await actor.addTimedCondition(effectId, value, false, false, effectData);
                }
                break;
              case advancedFunctionIndexes.MACRO:
                if (!game.user.can('MACRO_SCRIPT')) {
                  ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
                } else {
                  if (onDelayed) {
                    const copy = duplicate(ef);
                    copy.system ||= {};
                    copy.system.changes = [];
                    isEffectWithChange = true;
                    mergeObject(ef, {
                      system: {
                        delayed: {
                          macroEffect: copy,
                          sourceActor: sourceActor?.id,
                          source: source,
                          initialTestData: {
                            qualityStep: testData?.qualityStep || 0,
                          },
                        },
                      },
                    });
                  } else {
                    //try {
                    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
                    const command = effectSystem.macroArgs.macro;
                    options.maintenance ??= {};
                    options.maintenance.createdEffectUuids = DSA5_Utility.dedup(
                      options.maintenance.createdEffectUuids || [],
                    );
                    const macroCallResults = [];
                    const callMacroProxy = (packName, name, macroActor, macroItem, macroQs, args = {}) => {
                      const macroArgs = args || {};
                      if (options.maintenance.parentEffectUuid) {
                        macroArgs.maintenance ??= { effectUuid: options.maintenance.parentEffectUuid };
                      }
                      const resultPromise = callMacro(packName, name, macroActor, macroItem, macroQs, macroArgs);
                      macroCallResults.push(resultPromise);
                      return resultPromise;
                    };
                    const fn = new AsyncFunction('effect', 'actor', 'callMacro', 'msg', 'source', 'sourceActor', 'testData', 'qs', 'options', command);
                    await fn.call(this, ef, actor, callMacroProxy, msg, source, sourceActor, testData, qs, options);
                    const macroResults = await Promise.all(macroCallResults);
                    msg += macroResults.map((result) => collectResultMessage(result)).join('');
                    const maintainedTargetUuids = MaintainedEffects.collectTargetUuids(
                      macroResults,
                      options.maintenance.createdEffectUuids || [],
                    );
                    options.maintenance.createdEffectUuids = maintainedTargetUuids;
                    if (options.messageId && maintainedTargetUuids.length) {
                      await MaintainedEffects.registerOnMessage(options.messageId, { targetUuids: maintainedTargetUuids });
                    }
                    /*} catch (err) {
                      ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                      console.error(err);
                      console.warn(err.stack);
                    }*/
                  }
                }
                break;
              case advancedFunctionIndexes.CREATURE:
                {
                  const links = (effectSystem.macroArgs.creatureLinks || '').split(',').filter(Boolean);
                  const creatures = links
                    .map((x) => `@Compendium[${x.trim().replace(/@Compendium\[|\]/g, '')}]`)
                    .join(' ');
                  msg += `<p><b>${_loc('ActiveEffects.advancedFunctions.creature')}</b>:</p><p>${creatures}</p>`;
                }
                break;
            }
          }

          if (isEffectWithChange) {
            if (onDelayed) {
              delete ef.system?.macroArgs?.onDelayed;
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
      const options = {
        modifier: data.mod,
        postFunction: {
          functionName: 'game.dsa5.apps.DSAActiveEffectConfig.postResistEffect',
          token: data.token,
          actorId: data.actor,
          scene: canvas.id,
          systemEffect: data.systemEffect,
          SystemEffect: data.SystemEffect,
          message: data.message,
          mode: data.mode,
          effect: data.effect,
        },
      };
      actor.setupSkill(skill, options, data.token).then(async (setupData) => {
        setupData.testData.opposable = false;
        const res = await actor.basicTest(setupData);
        DSAActiveEffectConfig.applyResistResult(res, data, target, actor);
      });
    } else {
      console.warn('Actor not found for resist roll.');
    }
  }

  static async applyResistResult(res, data, target, actor) {
    const availableQs = res.result.qualityStep || 0;
    if (availableQs < 1) {
      if (data.systemEffect) {
        const level = / \d$/.test(data.SystemEffect) ? Number(data.SystemEffect.slice(-1)) : 1;
        const actualEffect = data.systemEffect.replace(/ \d$/, '');
        await actor.addCondition(actualEffect, level);
      } else {
        await DSAActiveEffectConfig.applyEffect(data.message, data.mode, [target], {
          effectIds: [data.effect],
          skipResistRolls: true,
        });
      }
    }
  }

  static async postResistEffect(postFunction, result) {
    const target = { token: postFunction.token, actor: postFunction.actorId, scene: postFunction.scene };
    const actor = DSA5_Utility.getSpeaker(target);
    if (!actor) return;

    const availableQs = result.result.qualityStep || 0;
    if (postFunction.systemEffect) {
      const actualEffect = postFunction.systemEffect.replace(/ \d$/, '');
      const level = / \d$/.test(postFunction.SystemEffect) ? Number(postFunction.SystemEffect.slice(-1)) : 1;
      // Remove the first-pass condition before re-evaluating
      await actor.removeCondition(actualEffect, level);
      if (availableQs < 1) {
        await actor.addCondition(actualEffect, level);
      }
    }
    // Non-systemEffect active effects cannot be cleanly reversed;
    // first-pass effects remain and are not duplicated on reroll.
  }

  static async applyEffect(id, mode, targets, options = {}) {
    const message = game.messages.get(id);
    const source = message.flags.data.preData.source;
    const testData = message.flags.data.postData;
    const speaker = message.speaker;
    const maintenanceParentEffectUuid = MaintainedEffects.getParentUuid(message);

    const hasSuccessEffects = ['poison', 'disease'].includes(source.type);

    if (hasSuccessEffects) testData.qualityStep = testData.successLevel > 0 ? 1 : 2;

    const attacker = DSA5_Utility.getSpeaker(speaker) || DSA5_Utility.getSpeaker(getProperty(message.flags, 'data.preData.extra.speaker'));
    let parent_source_attacker;
    if (attacker?.emptyActor?.parent_source_uuid) {
      parent_source_attacker = await fromUuid(attacker.emptyActor.parent_source_uuid);
    }

    const sourceActor = attacker;
    let effects = (await this._parseEffectDuration(source, testData, message.flags.data.preData, attacker)).filter(
      (effect) => {
        if (effect.disabled) return false;
        if (effect.type === 'enhancement') return false;
        if (effect.system.applyToOwner) return false;
        if (!game.settings.get('dsa5', 'enableWeaponAdvantages') && effect.system.equipmentAdvantage) return false;
        return true;
      },
    );

    if (hasSuccessEffects) effects = effects.filter((x) => x.system.successEffect == testData.qualityStep || !x.system.successEffect);
    if (options.effectIds) effects = effects.filter((x) => options.effectIds.includes(x._id));
    let actors = [];
    if (mode == 'self') {
      if (attacker) actors.push(parent_source_attacker || attacker);
    } else {
      if (targets) actors = targets.map((x) => DSA5_Utility.getSpeaker(x));
      else if (game.user.targets.size) {
        game.user.targets.forEach((target) => {
          if (target.actor) actors.push(target.actor);
        });
      }
    }
    if (game.user.isGM) {
      for (const actor of actors) {
        const { msg, resistRolls, effectApplied, effectNames } = await DSAActiveEffectConfig.applyAdvancedFunction(
          actor,
          effects,
          source,
          testData,
          sourceActor,
          {
            ...options,
            messageId: id,
            skipResistRolls: options.skipResistRolls || false,
            maintenance: {
              parentEffectUuid: maintenanceParentEffectUuid,
              createdEffectUuids: [],
            },
          },
        );
        if (effectApplied) {
          const appliedEffect = _loc('ActiveEffects.appliedEffect', {
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
      const id = s.ref?.id;
      if (id && s.step !== undefined) acc[id] = s.step;
      return acc;
    }, {});
    const specKeys = new Set(Object.keys(specAbIds));
    const specAbs = attacker ? attacker.items.filter((x) => specKeys.has(x.id)) : [];

    const effects = source.effects ? duplicate(source.effects) : [];
    for (const spec of specAbs) {
      const specEffects = duplicate(spec).effects || [];
      specEffects.forEach((ef) => {
        ef.system ??= {};
        ef.system.specStep = specAbIds[spec.id];
      });
      effects.push(...specEffects);
    }

    const durationValue = testData.duration ?? source.system?.duration?.value;
    const parsed = await DSAActiveEffectConfig.parseDurationValue(durationValue, testData.qualityStep);
    if (parsed.value !== undefined) {
      for (const ef of effects) {
        let calcTime = parsed.value;
        const customDuration = ef.system.customDuration;
        if (customDuration) {
          const parts = String(customDuration).split(',').map((p) => p.trim());
          const qsDuration = parts[testData.qualityStep - 1];
          if (qsDuration && qsDuration !== '-') calcTime = Number(qsDuration);
        }
        ef.duration = ef.duration || {};
        ef.duration.value = Math.round(calcTime);
        ef.duration.units = 'seconds';
      }
    }
    return effects;
  }

  /**
   * Parse a duration string (e.g. "3 rounds", "QS x 5 minutes") into Foundry duration data.
   * @param {string} durationStr - The raw duration string from item.system.duration.value
   * @param {number} qualityStep - The QS to substitute
   * @returns {Promise<{value?: number, units?: string}>}
   */
  static async parseDurationValue(durationStr, qualityStep = 0) {
    if (!durationStr) return {};
    const duration = durationStr.replace(/ x /g, ' * ').replaceAll(_loc('CHARAbbrev.QS'), `${qualityStep}`);
    try {
      for (const { regEx, seconds } of DSAActiveEffectConfig.effectDurationRegexes) {
        if (!regEx.test(duration)) continue;
        const dur = duration.replace(regEx, '').trim();
        const time = await DiceDSA5._stringToRoll(dur);
        if (isNaN(time)) break;
        return { value: Math.round(time * seconds), units: 'seconds' };
      }
    } catch (e) {
      console.error(`Could not parse duration '${duration}'`, e);
    }
    return {};
  }
}
