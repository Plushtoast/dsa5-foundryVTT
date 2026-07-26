import DSA5 from '../../config/config-dsa5.js';

/**
 * @typedef {Object} GameUIConfiguration
 * @property {number} uiScale
 * @property {number} fontScale
 * @property {{applications: ''|'dark'|'light', interface: ''|'dark'|'light'}} colorScheme
 * @property {'cards'|'pip'} chatNotifications
 * @property {{opacity: number, speed: number}} fade
 */

export default class DSA5Skin {
  static SKIN_IMMERSIVE = 'dsa5-immersive';

  static SKIN_LEGACY = 'dsa5-immersive dsa5-legacy';

  static SKIN_NAKED = 'dsa5-naked';
 
  static getUiConfig() {
    return game.settings.get('core', 'uiConfig');
  }

  static getApplicationsColorScheme() {
    const { applications = '' } = this.getUiConfig().colorScheme;
    if (applications === 'dark' || applications === 'light') return applications;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  static isDarkColorScheme() {
    return this.getApplicationsColorScheme() === 'dark';
  }

  static isLightColorScheme() {
    return this.getApplicationsColorScheme() === 'light';
  }

  static isValidCombination(dsaSkin) {
    if (!Object.hasOwn(DSA5.baseStyles ?? DSA5.styles, dsaSkin)) return true;
    if (this.isDarkColorScheme()) return dsaSkin === this.SKIN_NAKED;
    if (this.isLightColorScheme()) return dsaSkin === this.SKIN_IMMERSIVE;
    return false;
  }

  static getRecommended() {
    return this.SKIN_IMMERSIVE;
  }

  static resolveGlobalStyle(savedSkin = game.settings.get('dsa5', 'globalStyle')) {
    if (this.isValidCombination(savedSkin)) return savedSkin;
    return this.getRecommended();
  }

  static getAllSkinClassTokens() {
    const tokens = new Set();
    for (const key of Object.keys(DSA5.styles)) {
      for (const cls of key.split(' ')) tokens.add(cls);
    }
    return [...tokens];
  }

  static applyBodyClasses(styleClass) {
    document.body.classList.remove(...this.getAllSkinClassTokens());
    for (const cls of styleClass.split(' ')) document.body.classList.add(cls);
  }

  static applyFromSettings() {
    const saved = game.settings.get('dsa5', 'globalStyle');
    const style = Object.hasOwn(DSA5.styles, saved) ? saved : this.SKIN_IMMERSIVE;
    this.applyBodyClasses(style);
  }

  static getSettingChoices() {
    const styles = foundry.utils.duplicate(DSA5.styles);
    for (const key of Object.keys(styles)) {
      styles[key] = _loc(styles[key]);
    }
    return styles;
  }

  static async applyImmersiveLightCombination() {
    await game.settings.set('dsa5', 'globalStyle', this.SKIN_IMMERSIVE);
    this.applyBodyClasses(this.SKIN_IMMERSIVE);

    const uiConfig = this.getUiConfig();
    await game.settings.set('core', 'uiConfig', {
      ...uiConfig,
      colorScheme: {
        ...uiConfig.colorScheme,
        interface: 'light',
        applications: 'light',
      },
    });
  }

  static async applyNakedDarkCombination() {
    await game.settings.set('dsa5', 'globalStyle', this.SKIN_NAKED);
    this.applyBodyClasses(this.SKIN_NAKED);

    const uiConfig = this.getUiConfig();
    await game.settings.set('core', 'uiConfig', {
      ...uiConfig,
      colorScheme: {
        ...uiConfig.colorScheme,
        interface: 'dark',
        applications: 'dark',
      },
    });
  }

  static async promptFixCombination() {
    const dsaSkin = game.settings.get('dsa5', 'globalStyle');
    if (this.isValidCombination(dsaSkin)) return false;

    let choice;
    try {
      choice = await foundry.applications.api.DialogV2.wait({
        id: 'dsa5-skin-selection-dialog',
        classes: ['dialog', 'dsa5', 'dsa5-skin-selection-dialog'],
        window: { title: 'DSASETTINGS.globalStyle' },
        content: `<div class="dsa-skin-selection-dialog-content"><p>${_loc('DSAError.invalidSkinCombination')}</p></div>`,
        modal: true,
        buttons: [
          {
            action: 'immersive',
            icon: 'fa fa-sun',
            label: 'DSAError.invalidSkinCombinationImmersive',
            default: true,
            callback: () => 'immersive',
          },
          {
            action: 'naked',
            icon: 'fa fa-moon',
            label: 'DSAError.invalidSkinCombinationNaked',
            callback: () => 'naked',
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'cancel',
            callback: () => false,
          },
        ],
      });
    } catch {
      return false;
    }

    if (choice === 'immersive') {
      await this.applyImmersiveLightCombination();
      return true;
    }
    if (choice === 'naked') {
      await this.applyNakedDarkCombination();
      return true;
    }
    return false;
  }

  static registerHooks() {
    this.applyFromSettings();

    Hooks.on('changeSetting', (module, key) => {
      if (module === 'core' && key === 'uiConfig') void this.promptFixCombination();
    });
  }
}
