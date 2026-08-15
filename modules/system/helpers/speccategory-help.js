/**
 * Category help tooltips for Vorteile / Nachteile / Sonderfertigkeiten.
 * Rich Regelwiki HTML lives in dsa5-core (`SpecCategoryHelp.*`); the system only ships `_fallback`.
 */
export default class SpecCategoryHelp {
  /**
   * @param {string} categoryKey
   * @returns {string} Localized HTML (or plain fallback)
   */
  static getText(categoryKey) {
    const key = String(categoryKey || '').trim();
    const i18nKey = `SpecCategoryHelp.${key}`;
    const fallbackKey = 'SpecCategoryHelp._fallback';
    if (game.i18n.has(i18nKey)) return game.i18n.localize(i18nKey);
    if (game.i18n.has(fallbackKey)) return game.i18n.localize(fallbackKey);
    return '';
  }
}
