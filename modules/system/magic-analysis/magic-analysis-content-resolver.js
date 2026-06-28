import MagicAnalysisDefaults from './magic-analysis-defaults.js';

const { duplicate } = foundry.utils;

export default class MagicAnalysisContentResolver {
  static plainText(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent?.trim() || '';
  }

  static mergeField(defaultHtml, customHtml) {
    const custom = customHtml?.trim() || '';
    const defaults = defaultHtml?.trim() || '';
    if (defaults && custom) return `${defaults}${custom}`;
    return custom || defaults;
  }

  static async resolveRollContent(infoSystem, { parentItem } = {}) {
    if (infoSystem.subType !== 'magicalAnalysis') return duplicate(infoSystem);

    const defaults = await MagicAnalysisDefaults.generate(parentItem);
    const merged = { ...duplicate(infoSystem) };

    for (const key of ['qs1', 'qs2', 'qs3', 'qs4', 'qs5', 'qs6', 'crit', 'botch', 'fail']) {
      merged[key] = this.mergeField(defaults[key], infoSystem[key]);
    }

    merged.skill = infoSystem.skill || defaults.skill;
    merged.modifier = infoSystem.modifier ?? defaults.modifier;
    return merged;
  }

  static async placeholders(parentItem) {
    const defaults = await MagicAnalysisDefaults.generate(parentItem);
    const placeholders = {};

    for (const key of ['qs1', 'qs2', 'qs3', 'qs4', 'qs5', 'qs6', 'crit', 'botch', 'fail']) {
      placeholders[`placeholder${key.charAt(0).toUpperCase()}${key.slice(1)}`] = this.plainText(defaults[key]);
    }

    return placeholders;
  }
}
