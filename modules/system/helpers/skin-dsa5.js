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
    return this.isDarkColorScheme() ? this.SKIN_NAKED : this.SKIN_IMMERSIVE;
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
    if (this.isDarkColorScheme()) {
      return { [this.SKIN_NAKED]: styles[this.SKIN_NAKED] };
    }
    return styles;
  }

  static async promptFixCombination() {
    const dsaSkin = game.settings.get('dsa5', 'globalStyle');
    if (this.isValidCombination(dsaSkin)) return false;

    const isDark = this.isDarkColorScheme();
    const messageKey = isDark ? 'DSAError.invalidSkinCombinationDark' : 'DSAError.invalidSkinCombination';

    const proceed = await foundry.applications.api.DialogV2.confirm({
      content: `<p>${_loc(messageKey)}</p>`,
      rejectClose: false,
      modal: true,
    });
    if (!proceed) return false;

    const recommended = this.getRecommended();
    await game.settings.set('dsa5', 'globalStyle', recommended);
    this.applyBodyClasses(recommended);

    if (!isDark) {
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

    return true;
  }

  static registerHooks() {
    this.applyFromSettings();

    Hooks.on('changeSetting', (module, key) => {
      if (module === 'core' && key === 'uiConfig') void this.promptFixCombination();
    });
  }
}
