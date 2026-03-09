import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSATriggers from '../system/automation/triggers.js';
/**
 * Provides a burger-menu for roll dialogs and a hook/trigger-based way to add actions.
 */
export class RollDialogExtensions {
  static BURGER_SELECTOR = '.dsa5-roll-ability-menu';

  static #getFormData(dialog) {
    try {
      const form = dialog?.element?.querySelector?.('form');
      if (!form) return {};
      return new foundry.applications.ux.FormDataExtended(form).object;
    } catch {
      return {};
    }
  }
  static async getDialogState(dialog) {
    const dialogData = dialog?.dialogData ?? {};
    const speaker = dialogData.speaker ?? dialogData.renderData?.speaker ?? null;
    const actor = speaker ? DSA5_Utility.getSpeaker(speaker) : null;
    return {
      dialog,
      actor,
      speaker,
      source: dialogData.source,
      mode: dialogData.mode,
      testData: dialog?.testData,
      renderData: dialogData.renderData,
      html: $(dialog.element),
      formData: this.#getFormData(dialog),
    };
  }
  static async getContextOptions(dialog) {
    const dialogState = await this.getDialogState(dialog);
    const actor = dialogState.actor;
    const menuItems = [];
    if (actor?.dsatriggers?.[DSATriggers.EVENTS.ROLL_DIALOG_RENDER]) {
      const data = { dialogState, menuItems: [] };
      const fromTriggers = await DSATriggers.collectMacros(actor, dialogState.testData, DSATriggers.EVENTS.ROLL_DIALOG_RENDER, data);
      for (const item of fromTriggers) menuItems.push(item);
    }
    Hooks.call('dsa5.getRollDialogContextOptions', dialogState, menuItems);
    const normalized = [];
    for (const item of menuItems) {
      if (!item || typeof item !== 'object') continue;
      if (typeof item.callback !== 'function') continue;
      const wrappedCondition =
        typeof item.condition === 'function'
          ? (...args) => {
              try {
                return item.condition(dialogState, ...args);
              } catch (err) {
                console.error(err);
                return false;
              }
            }
          : item.condition;
      normalized.push({
        ...item,
        condition: wrappedCondition,
        callback: async (...args) => {
          try {
            console.debug('DSA5 roll-dialog action invoked', { name: item.name });
            return await item.callback(dialogState, ...args);
          } catch (err) {
            ui.notifications.error('There was an error in your roll-dialog action. See the console (F12) for details');
            console.error(err);
          }
        },
      });
    }
    return { dialogState, menuItems: normalized };
  }
  static async bindBurgerMenu(dialog) {
    const root = dialog?.element;
    if (!root) return;
    const footer = root.querySelector('.form-footer');
    if (!footer) return;

    let buttonEl = root.querySelector(this.BURGER_SELECTOR);
    if (!buttonEl) {
      const referenceButton = footer.querySelector('button');
      buttonEl = document.createElement('button');
      buttonEl.type = 'button';
      buttonEl.className = referenceButton?.className || 'dialog-button';
      buttonEl.classList.add('dsa5-roll-ability-menu');
      buttonEl.innerText = '☰';
      footer.appendChild(buttonEl);
    }
    footer.appendChild(buttonEl);
    buttonEl.style.flex = '0 0 auto';
    buttonEl.classList.add('dsahidden');
    const updateCacheAndVisibility = async () => {
      try {
        const { menuItems, dialogState } = await this.getContextOptions(dialog);
        dialog._dsa5RollDialogMenuItems = menuItems;
        dialog._dsa5RollDialogState = dialogState;
        buttonEl.classList.toggle('dsahidden', menuItems.length === 0);
      } catch (err) {
        console.error(err);
        dialog._dsa5RollDialogMenuItems = [];
        dialog._dsa5RollDialogState = null;
        buttonEl.classList.add('dsahidden');
      }
    };
    await updateCacheAndVisibility();
    new foundry.applications.ux.ContextMenu(root, this.BURGER_SELECTOR, [], {
      onOpen: () => {
        ui.context.menuItems = dialog._dsa5RollDialogMenuItems || [];
      },
      jQuery: false,
      fixed: true,
      eventName: 'click',
    });
    root.addEventListener(
      'change',
      () => {
        updateCacheAndVisibility();
      },
      { capture: true }
    );
  }
}
