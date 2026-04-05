import DSA5_Utility from '../helpers/utility-dsa5.js';
import RuleChaos from '../rules/rule_chaos.js';
import DSA5SoundEffect from '../helpers/dsa-soundeffect.js';
import { DICE_CONSTANTS } from '../../config/dice-constants.js';
const { duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

// TODO DEPRECATE the socketed actions to queries

export default class OnUseEffect {
  constructor(item) {
    this.item = item;
  }

  static buildExecutionOptions(event, options = {}) {
    const executionOptions = { ...options };

    if (event?.button === 2 && !executionOptions.messageMode) executionOptions.messageMode = DICE_CONSTANTS.CHAT_MODES.GM;
    if (!executionOptions.triggeredBy) executionOptions.triggeredBy = event ? 'click' : 'system';

    return executionOptions;
  }

  static normalizeExecutionOptions(actionOrOptions = undefined) {
    if (typeof actionOrOptions === 'string' || actionOrOptions === undefined) {
      return {
        actionId: actionOrOptions,
      };
    }

    return { ...actionOrOptions };
  }

  static buildMacroArgs(options = {}) {
    const args = {
      execution: {
        triggeredBy: options.triggeredBy || 'system',
        temporaryMessageMode: Boolean(options.messageMode),
      },
    };

    if (options.actionId) args.execution.actionId = options.actionId;
    if (options.messageMode) args.messageMode = options.messageMode;

    return args;
  }

  static chatDataSetup(content, args = {}) {
    return DSA5_Utility.chatDataSetup(content, args?.messageMode);
  }

  chatDataSetup(content, args = undefined) {
    return OnUseEffect.chatDataSetup(content, args || this.currentOnUseArgs || {});
  }

  async createChatMessage(content, args = undefined) {
    return await ChatMessage.create(this.chatDataSetup(content, args));
  }

  async callMacro(packName, name, args = undefined) {
    args = foundry.utils.deepClone(args || this.currentOnUseArgs || {});
    const pack = game.packs.get(packName);
    let documents = await pack?.getDocuments({ name });
    if (!documents || !documents.length) {
      for (const pack of game.packs.filter((x) => x.documentName == 'Macro' && /\(internal\)/.test(x.metadata.label))) {
        documents = await pack.getDocuments({ name });
        if (documents?.length) break;
      }
    }
    const result = {};
    if (documents?.length) {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      try {
        args.result = result;
        const fn = new AsyncFunction('args', 'actor', 'item', documents[0].command);
        result.ret = await fn.call(this, args, this.item.actor, this.item);
      } catch (err) {
        //Todo passing multiple scopes kind of fails
        try {
          const fn2 = new AsyncFunction('args', 'actor', 'item', ` const that = this;
              ${documents[0].command.replace(/(?=[ |(|{]+)?this\./g, 'that.')}
            `,
          );
          result.ret = await fn2.call(this, args, this.item.actor, this.item);
        } catch (err) {
          ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
          console.error(err);
          result.error = true;
        }
      }
    } else {
      ui.notifications.error('DSAError.macroNotFound', { format: { name }, localize: true });
    }
    return result;
  }

  async executeOnUseEffect(actionOrOptions = undefined) {
    if (!this.item.actor) return;

    if (!game.user.can('MACRO_SCRIPT')) {
      return ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
    }

    const options = OnUseEffect.normalizeExecutionOptions(actionOrOptions);
    const action = await this.resolveOnUseAction(options);
    if (!action) return;

    options.actionId = action.id;
    const args = OnUseEffect.buildMacroArgs(options);
    const macro = action.macro;
    const previousArgs = this.currentOnUseArgs;
    this.currentOnUseArgs = args;
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction('args', 'item', 'actor', macro);
      await fn.call(this, args, this.item, this.item.actor);
    } catch (err) {
      try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const fn2 = new AsyncFunction(
          'args',
          'item',
          'actor',
          ` const that = this;
              ${macro.replace(/(?=[ |(|{]+)?this\./g, 'that.')}
            `,
        );
        await fn2.call(this, args, this.item, this.item.actor);
      } catch (fallbackErr) {
        ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
        console.error(fallbackErr);
        console.warn(fallbackErr.stack);
      }
    } finally {
      this.currentOnUseArgs = previousArgs;
    }
  }

  async resolveOnUseAction(options = {}) {
    const actions = OnUseEffect.getExecutableActions(this.item);
    if (!actions.length) return null;
    if (options.actionId) return actions.find((action) => action.id === options.actionId) || null;
    if (actions.length === 1) return actions[0];

    const selection = await this.selectOnUseAction(actions, options);
    if (!selection) return null;

    if (selection.messageMode && !options.messageMode) options.messageMode = selection.messageMode;
    options.actionId = selection.actionId;
    return actions.find((action) => action.id === selection.actionId) || null;
  }

  async selectOnUseAction(actions, options = {}) {
    const content = await renderTemplate('systems/dsa5/templates/dialog/on-use-action-picker.hbs', {
      actions,
      item: this.item,
    });

    return foundry.applications.api.DialogV2.wait({
      window: {
        title: 'SHEET.onUseEffect'
      },
      content,
      buttons: [
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'cancel',
          default: true,
          callback: () => null,
        },
      ],
      render: (_event, dialog) => {
        for (const button of dialog.element.querySelectorAll('[data-action-id]')) {
          button.addEventListener('click', async (event) => {
            event.preventDefault();
            const selection = {
              actionId: button.dataset.actionId,
              messageMode: options.messageMode,
            };
            await dialog.options.submit?.(selection, dialog);
            await dialog.close({ submitted: true });
          });

          button.addEventListener('contextmenu', async (event) => {
            event.preventDefault();
            const selection = {
              actionId: button.dataset.actionId,
              messageMode: DICE_CONSTANTS.CHAT_MODES.GM,
            };
            await dialog.options.submit?.(selection, dialog);
            await dialog.close({ submitted: true });
          });
        }
      },
    });
  }

  static getOnUseActions(item) {
    if (!item?.system?.implementsOnUseEffect) return [];

    return Object.entries(foundry.utils.getProperty(item, 'system.onUseActions') || {}).map(([id, action]) => ({
      id,
      name: action?.name || item.name,
      img: action?.img || item.img,
      macro: action?.macro || '',
    }));
  }

  static getExecutableActions(item) {
    return this.getOnUseActions(item).filter((action) => action.macro.trim() !== '');
  }

  static hasOnUseEffect(item) {
    return this.getExecutableActions(item).length > 0;
  }

  static getOnUseEffect(item, actionId = undefined) {
    if (actionId) return this.getExecutableActions(item).find((action) => action.id === actionId)?.macro || '';
    return this.getExecutableActions(item)[0]?.macro || '';
  }

  async automatedAnimation(successLevel, options = {}) {
    if (DSA5_Utility.moduleEnabled('autoanimations')) {
      console.warn('Animations for on use effects not enabled yet');
    }
  }

  static effectBaseDummy(name, changes, duration) {
    return {
      name,
      icon: 'icons/svg/aura.svg',
      system: {
        changes,
      },
      duration,
      flags: {
        dsa5: {
          value: null,
          description: name,
        },
      },
    };
  }

  effectDummy(name, changes, duration) {
    return OnUseEffect.effectBaseDummy(name, changes, duration);
  }

  async socketedConditionAddActor(actors, data) {
    if (game.user.isGM) {
      const systemCon = typeof data === 'string';
      if (systemCon) {
        data = duplicate(CONFIG.statusEffects.find((e) => e.id == data));
        data.name = _loc(data.name);
      }

      const names = [];
      for (const actor of actors) {
        if (systemCon) await actor.addCondition(data, 1, false, false);
        else await actor.addCondition(data);

        names.push(actor.name);
      }
      await this.createInfoMessage(data, names);
    } else {
      const payload = {
        id: this.item.uuid,
        data,
        actors: actors.map((x) => x.id),
      };
      game.socket.emit('system.dsa5', {
        type: 'socketedConditionAddActor',
        payload,
      });
    }
  }

  async createInfoMessage(data, names, added = true) {
    if (names.length) {
      const format = added ? 'ActiveEffects.appliedEffect' : 'ActiveEffects.removedEffect';
      const infoMsg = _loc(format, {
        source: data.name,
        target: names.join(', '),
      });
      await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
    }
  }

  async socketedRemoveCondition(targets, coreId, amount = 1) {
    if (game.user.isGM) {
      const names = [];
      for (const target of targets) {
        const token = canvas.tokens.get(target);
        if (token.actor) {
          await token.actor.removeCondition(coreId, amount, false);
          names.push(token.name);
        }
      }
      const data = CONFIG.statusEffects.find((x) => x.id == coreId);
      data.name = _loc(data.name);
      await this.createInfoMessage(data, names, false);
    } else {
      const payload = {
        id: this.item.uuid,
        coreId,
        targets,
      };
      game.socket.emit('system.dsa5', {
        type: 'socketedRemoveCondition',
        payload,
      });
    }
  }

  async socketedActorTransformation(targets, update) {
    if (game.user.isGM) {
      for (const target of targets) {
        const token = canvas.tokens.get(target);
        if (token.actor) {
          await token.actor.update(update);
        }
      }
    } else {
      const payload = {
        id: this.item.uuid,
        targets,
        update,
      };
      game.socket.emit('system.dsa5', {
        type: 'socketedActorTransformation',
        payload,
      });
    }
  }

  async socketedConditionAdd(targets, data) {
    if (game.user.isGM) {
      const systemCon = typeof data === 'string';
      if (systemCon) {
        data = duplicate(CONFIG.statusEffects.find((e) => e.id == data));
        data.name = _loc(data.name);
      }

      const names = [];
      for (const target of targets) {
        const token = canvas.tokens.get(target);
        if (token.actor) {
          if (systemCon) await token.actor.addCondition(data, 1, false, false);
          else await token.actor.addCondition(data);

          names.push(token.name);
        }
      }
      await this.createInfoMessage(data, names);
    } else {
      const payload = {
        id: this.item.uuid,
        data,
        targets,
      };
      game.socket.emit('system.dsa5', {
        type: 'socketedConditionAdd',
        payload,
      });
    }
  }
}
