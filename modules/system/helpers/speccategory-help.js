/**
 * Category help tooltips. Rich Regelwiki HTML lives in dsa5-core; the system only ships `_fallback`.
 * - `SpecCategoryHelp.*` — Vorteile / Nachteile / Sonderfertigkeiten
 * - `SpellCategoryHelp.*` — spells, rituals, liturgies, ceremonies, magical actions, tricks, blessings, signs, patrons, demon marks
 */
export default class SpecCategoryHelp {
  /**
   * @param {string} categoryKey
   * @param {string} [namespace='SpecCategoryHelp']
   * @returns {string} Localized HTML (or plain fallback)
   */
  static getText(categoryKey, namespace = 'SpecCategoryHelp') {
    const key = String(categoryKey || '').trim();
    const i18nKey = `${namespace}.${key}`;
    const fallbackKey = `${namespace}._fallback`;
    if (game.i18n.has(i18nKey)) return _loc(i18nKey);
    if (game.i18n.has(fallbackKey)) return _loc(fallbackKey);
    return '';
  }
}
