import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import { DefaultAppv2 } from '../actor/baseapp.js';
import { FormAppv2 } from '../actor/formapp.js';

export default function () {
  Hooks.once('init', () => {
    game.dsa5.apps.DiceSoNiceCustomization = new DiceSoNiceCustomization();
  });

  Hooks.once('diceSoNiceReady', (dice3d) => {
    dice3d.addColorset({
      name: 'mu',
      description: 'DSA5.mu',
      category: 'DSA5.dies',
      foreground: '#FFFFFF',
      background: '#b3241a',
      edge: '#b3241a',
      outline: '#FFFFFF',
      texture: 'none',
    });
    dice3d.addColorset({
      name: 'kl',
      description: 'DSA5.kl',
      category: 'DSA5.dies',
      foreground: '#FFFFFF',
      background: '#8259a3',
      edge: '#8259a3',
      outline: '#FFFFFF',
      texture: 'none',
    });
    dice3d.addColorset({
      name: 'in',
      description: 'DSA5.in',
      category: 'DSA5.dies',
      foreground: '#FFFFFF',
      background: '#388834',
      edge: '#388834',
      outline: '#FFFFFF',
      texture: 'none',
    });
    dice3d.addColorset({
      name: 'ch',
      description: 'DSA5.ch',
      category: 'DSA5.dies',
      foreground: '#FFFFFF',
      background: '#0d0d0d',
      edge: '#0d0d0d',
      outline: '#FFFFFF',
      texture: 'none',
    });
    dice3d.addColorset({
      name: 'ff',
      description: 'DSA5.ff',
      category: 'DSA5.dies',
      foreground: '#000000',
      background: '#d5b467',
      edge: '#d5b467',
      outline: '#FFFFFF',
      texture: 'none',
    });
    dice3d.addColorset({
      name: 'ge',
      description: 'DSA5.ge',
      category: 'DSA5.dies',
      foreground: '#000000',
      background: '#688ec4',
      edge: '#688ec4',
      outline: '#FFFFFF',
      texture: 'none',
    });
    dice3d.addColorset({
      name: 'ko',
      description: 'DSA5.ko',
      category: 'DSA5.dies',
      foreground: '#000000',
      background: '#a3a3a3',
      edge: '#a3a3a3',
      outline: '#FFFFFF',
      texture: 'none',
    });
    dice3d.addColorset({
      name: 'kk',
      description: 'DSA5.kk',
      category: 'DSA5.dies',
      foreground: '#000000',
      background: '#d6a878',
      edge: '#d6a878',
      outline: '#FFFFFF',
      texture: 'none',
    });
    dice3d.addColorset({
      name: 'attack',
      description: 'DSA5.attack',
      category: 'DSA5.dies',
      foreground: '#FFFFFF',
      background: '#b3241a',
      edge: '#b3241a',
      outline: '#b3241a',
      texture: 'none',
    });
    dice3d.addColorset({
      name: 'dodge',
      description: 'DSA5.dodge',
      category: 'DSA5.dies',
      foreground: '#FFFFFF',
      background: '#388834',
      edge: '#388834',
      outline: '#FFFFFF',
      texture: 'none',
    });
    dice3d.addColorset({
      name: 'parry',
      description: 'DSA5.parry',
      category: 'DSA5.dies',
      foreground: '#FFFFFF',
      background: '#388834',
      edge: '#388834',
      outline: '#FFFFFF',
      texture: 'none',
    });

    game.dsa5.apps.DiceSoNiceCustomization.initConfigs();
    DiceSoNiceCustomization.healInvalidSettings();
    DiceSoNiceCustomization.onConnect();
  });
}

export class DiceSoNiceCustomization extends DefaultAppv2 {
  static unloadedModels = [];
  static retries = 0;
  static retrying = false;
  static attrs = ['mu', 'kl', 'in', 'ch', 'ff', 'ge', 'ko', 'kk', 'attack', 'dodge', 'parry', 'damage'];
  static DEFAULT_SYSTEM = 'standard';

  static defaultColorset(attr) {
    return attr === 'damage' ? 'black' : attr;
  }

  static get systems() {
    return game.dice3d?.DiceFactory?.systems;
  }

  static get colorsets() {
    return game.dice3d?.exports?.COLORSETS;
  }

  /**
   * DSN v6 keeps systems in a Map — fall back to standard when the id is missing.
   * @param {string} systemId
   * @returns {string}
   */
  static resolveSystem(systemId) {
    const systems = this.systems;
    if (systemId && systems?.has?.(systemId)) return systemId;
    return this.DEFAULT_SYSTEM;
  }

  /**
   * Fall back to the DSA default colorset when the configured set was removed.
   * @param {string} colorset
   * @param {string} attr
   * @returns {string}
   */
  static resolveColorset(colorset, attr) {
    const fallback = this.defaultColorset(attr);
    if (!colorset) return fallback;

    const colorsets = this.colorsets;
    if (colorsets && colorset !== 'custom' && !colorsets[colorset]) return fallback;

    return colorset;
  }

  /**
   * Persist defaults for any stored system/colorset that no longer exists.
   */
  static healInvalidSettings() {
    if (!DSA5_Utility.moduleEnabled('dice-so-nice') || !game.dice3d) return;

    for (const attr of this.attrs) {
      const colorKey = `dice3d_${attr}`;
      const systemKey = `dice3d_system_${attr}`;
      const storedColor = game.settings.get('dsa5', colorKey);
      const storedSystem = game.settings.get('dsa5', systemKey);
      const colorset = this.resolveColorset(storedColor, attr);
      const system = this.resolveSystem(storedSystem);

      if (colorset !== storedColor) void game.settings.set('dsa5', colorKey, colorset);
      if (system !== storedSystem) void game.settings.set('dsa5', systemKey, system);
    }
  }

  initConfigs() {
    game.settings.registerMenu('dsa5', 'dicesonicesettings', {
      name: 'DiceSoNiceSettings',
      label: 'DiceSoNice Settings',
      hint: _loc('DSASETTINGS.dicesonicesettings'),
      type: DiceSoNiceForm,
      restricted: false,
    });
    for (const attr of DiceSoNiceCustomization.attrs) {
      game.settings.register('dsa5', `dice3d_${attr}`, {
        name: `CHAR.${attr.toUpperCase()}`,
        scope: 'client',
        config: false,
        default: DiceSoNiceCustomization.defaultColorset(attr),
        type: String,
      });
      game.settings.register('dsa5', `dice3d_system_${attr}`, {
        name: `CHAR.${attr.toUpperCase()}`,
        scope: 'client',
        config: false,
        default: DiceSoNiceCustomization.DEFAULT_SYSTEM,
        type: String,
      });
    }
  }

  getAttributeConfiguration(value) {
    if (DSA5_Utility.moduleEnabled('dice-so-nice') && game.dice3d) {
      let storedColor;
      let storedSystem;
      try {
        storedColor = game.settings.get('dsa5', `dice3d_${value}`);
        storedSystem = game.settings.get('dsa5', `dice3d_system_${value}`);
      } catch {
        storedColor = DiceSoNiceCustomization.defaultColorset(value);
        storedSystem = DiceSoNiceCustomization.DEFAULT_SYSTEM;
      }

      const colorset = DiceSoNiceCustomization.resolveColorset(storedColor, value);
      const system = DiceSoNiceCustomization.resolveSystem(storedSystem);

      return {
        colorset,
        appearance: {
          colorset,
          system,
        },
      };
    }
    return { colorset: value };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    html.find('[name="entryselection"]').on('change', async (ev) => {
      await game.settings.set('dsa5', `dice3d_${ev.currentTarget.dataset.attr}`, ev.currentTarget.value);
    });
    html.find('[name="systemselection"]').on('change', async (ev) => {
      await game.settings.set('dsa5', `dice3d_system_${ev.currentTarget.dataset.attr}`, ev.currentTarget.value);
      DiceSoNiceCustomization.preloadDiceAssets([ev.currentTarget.value]);
      game.socket.emit('system.dsa5', {
        type: 'preloadDice3d',
        payload: [ev.currentTarget.value],
      });
    });
  }

  static onConnect() {
    game.socket.on('system.dsa5', (data) => {
      switch (data.type) {
        case 'preloadDice3d':
          console.warn('Preloading forced DSA dice assets');
          DiceSoNiceCustomization.preloadDiceAssets(data.payload);
          break;
        case 'getPreloadDice3d':
          DiceSoNiceCustomization.requestDicePreloads();
          break;
      }
    });

    this.collectPreloads();
    game.socket.emit('system.dsa5', {
      type: 'getPreloadDice3d',
    });
  }

  static collectPreloads(loadSelf = true) {
    const payload = [];
    for (const attr of DiceSoNiceCustomization.attrs) {
      payload.push(this.resolveSystem(game.settings.get('dsa5', `dice3d_system_${attr}`)));
    }
    const systems = [...new Set(payload)];

    if (loadSelf) this.preloadDiceAssets(systems);

    game.socket.emit('system.dsa5', {
      type: 'preloadDice3d',
      payload: systems,
    });
  }

  static requestDicePreloads() {
    this.collectPreloads(false);
  }

  static #normalizeSystemNames(names) {
    if (!names) return [];
    if (Array.isArray(names) || names instanceof Set) return [...names];
    if (names.toPreload) return this.#normalizeSystemNames(names.toPreload);
    return [names];
  }

  static #diceModels(system) {
    const dice = system?.dice;
    if (!dice) return [];
    if (typeof dice.values === 'function') return [...dice.values()];
    if (Array.isArray(dice)) return dice;
    return Object.values(dice);
  }

  static async preloadDiceAssets(names, types = []) {
    const systemNames = this.#normalizeSystemNames(names);
    console.warn('loading', systemNames);

    for (const name of systemNames) {
      const systemId = this.resolveSystem(name);
      const dieModel = this.systems?.get?.(systemId);
      if (!dieModel) {
        this.unloadedModels.push(name);
        continue;
      }

      const dieModelsToLoad = this.#diceModels(dieModel).filter(
        (el) => types.length === 0 || types.includes(el.type) || types.includes(el.id),
      );
      for (const model of dieModelsToLoad) {
        try {
          if (model.modelFile) {
            await model.loadModel(game.dice3d.DiceFactory.loaderGLTF);
          } else {
            await model.loadTextures();
          }
        } catch (error) {
          console.warn('Unable to load dice model', name, model);
        }
      }
    }
    if (this.unloadedModels.length && this.retries < 6 && !this.retrying) {
      this.retrying = true;
      setTimeout(() => {
        this.retries += 1;
        const preload = new Set(this.unloadedModels);
        this.unloadedModels = [];
        this.retrying = false;
        this.preloadDiceAssets(preload);
      }, 10000);
    }
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    DiceSoNiceCustomization.healInvalidSettings();
    data.choices = game.dice3d.exports.Utils.prepareColorsetList();
    delete data.choices.custom;
    data.systems = game.dice3d.exports.Utils.prepareSystemList();
    data.selections = {};
    for (const attr of DiceSoNiceCustomization.attrs) {
      data.selections[attr] = {
        color: DiceSoNiceCustomization.resolveColorset(game.settings.get('dsa5', `dice3d_${attr}`), attr),
        system: DiceSoNiceCustomization.resolveSystem(game.settings.get('dsa5', `dice3d_system_${attr}`)),
      };
    }
    return data;
  }

  static DEFAULT_OPTIONS = {
    position: {
      width: 600,
    },
    window: {
      title: 'DSASETTINGS.dicesonicesettings',
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/wizard/dicesonice-configuration.hbs',
    },
  };
}

class DiceSoNiceForm extends FormAppv2 {
  render() {
    game.dsa5.apps.DiceSoNiceCustomization.render(true);
  }
}
