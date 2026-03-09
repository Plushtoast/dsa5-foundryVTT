import DSA5_Utility from '../helpers/utility-dsa5.js';

export default class DSA5Tutorial {
  static async firstTimeMessage() {
    if (!game.settings.get('dsa5', 'firstTimeStart')) {
      await DSA5Tutorial.setupDefaultOptions();
      const welcomeMsg = game.i18n.localize('WELCOME');
      ChatMessage.create(DSA5_Utility.chatDataSetup(welcomeMsg));
      DSA5Tutorial.firstTimeLanguage();
      await game.settings.set('dsa5', 'firstTimeStart', true);
    }
  }

  static firstTimeLanguage() {
    const languages = ['de', 'en'];
    new foundry.applications.api.DialogV2({
      window: { title: 'DIALOG.firstTime' },
      position: { width: 400 },
      content: `<p>${game.i18n.localize('DIALOG.firstTimeWarning')}</p>`,
      buttons: languages.map((lang) => ({
        action: lang,
        label: game.i18n.localize(lang),
        callback: () => DSA5Tutorial.setLanguage(lang),
      })),
    }).render(true);
  }

  static async setLanguage(lang) {
    await game.settings.set('dsa5', 'firstTimeStart', true);
    await game.settings.set('dsa5', 'forceLanguage', lang);
    await game.settings.set('core', 'language', lang);
    foundry.utils.debouncedReload();
  }

  static async setupDefaultOptions() {
    const settings = game.settings.get('core', Combat.CONFIG_SETTING);
    settings.skipDefeated = true;
    foundry.utils.mergeObject(settings, { turnMarker: { src: 'systems/dsa5/icons/backgrounds/turnMarker.webp', animation: 'spin' } });
    await game.settings.set('core', Combat.CONFIG_SETTING, settings);
    await game.settings.set('core', 'leftClickRelease', true);
  }
}
