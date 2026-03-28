import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import OnUseEffect from './onUseEffects.js';
import RuleChaos from '../rules/rule_chaos.js';
import DSA5SoundEffect from '../helpers/dsa-soundeffect.js';

export default class DSATriggers {
  static EVENTS = {
    ARMOR_TRANSFORMATION: 4,
    DAMAGE_TRANSFORMATION: 5,
    POST_ROLL: 6,
    POST_OPPOSED: 7,
    ROLL_DIALOG_RENDER: 8,
  };

  //static cachedEvents = { 6: {}, 7: {} }

  static async postOpposed(data) {
    const actor = DSA5_Utility.getSpeaker(data.attacker.speaker);

    if (!actor) return;

    await this.runMacro(actor, data.attacker.testResult, DSATriggers.EVENTS.POST_OPPOSED, data);
  }

  static async postRoll(data) {
    const actor = DSA5_Utility.getSpeaker(data.testData.speaker);

    if (!actor) return;

    await this.runMacro(actor, data.testData, DSATriggers.EVENTS.POST_ROLL, data);
  }

  static async callMacro(item, packName, name, args = {}) {
    const onUseEffect = new OnUseEffect(item);
    return await onUseEffect.callMacro(packName, name, args);
  }

  static async runMacro(actor, testData, type, data) {
    if (!game.user.can('MACRO_SCRIPT')) {
      ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
    } else {
      for (let [key, value] of Object.entries(actor.dsatriggers[type])) {
        const source = actor.items.get(key);
        const ef = source.effects.get(value);
        const macro = ef.system.macroArgs.macro;

        try {
          const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
          const fn = new AsyncFunction('actor', 'testData', 'type', 'data', 'source', 'ef', macro);
          return await fn.call(this, actor, testData, type, data, source, ef);
        } catch (err) {
          ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
          console.error(err);
        }
      }
    }
  }

  /**
   * Collect menu items from all trigger macros for the given type.
   *
   * Expected return value of a macro:
   * - a single ContextMenu item object, or
   * - an array of ContextMenu item objects
   *
   * Macros may also mutate `data.menuItems` directly.
   */
  static async collectMacros(actor, testData, type, data) {
    if (!game.user.can('MACRO_SCRIPT')) {
      ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
      return [];
    }

    const collected = [];
    const triggerMap = actor?.dsatriggers?.[type];
    if (!triggerMap) return collected;

    for (let [key, value] of Object.entries(triggerMap)) {
      const source = actor.items.get(key);
      const ef = source?.effects?.get(value);
      const macro = ef?.system?.macroArgs?.macro;
      if (!source || !ef || !macro) continue;

      try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const fn = new AsyncFunction('actor', 'testData', 'type', 'data', 'source', 'ef', macro);
        const result = await fn.call(this, actor, testData, type, data, source, ef);

        if (Array.isArray(result)) collected.push(...result);
        else if (result) collected.push(result);
      } catch (err) {
        ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
        console.error(err);
      }
    }

    if (Array.isArray(data?.menuItems)) collected.push(...data.menuItems);
    return collected;
  }
}
