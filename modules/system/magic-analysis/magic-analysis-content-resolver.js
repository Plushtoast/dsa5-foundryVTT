import MagicAnalysisDefaults from './magic-analysis-defaults.js';

const { duplicate } = foundry.utils;

const CONTENT_KEYS = ['qs1', 'qs2', 'qs3', 'qs4', 'qs5', 'qs6', 'crit', 'botch', 'fail'];

export default class MagicAnalysisContentResolver {
  static plainText(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent?.trim() || '';
  }

  static async resolveRollContent(infoSystem, { parentItem } = {}) {
    if (infoSystem.subType !== 'magicalAnalysis') return duplicate(infoSystem);

    const defaults = await MagicAnalysisDefaults.generate(parentItem);
    const merged = { ...duplicate(infoSystem) };
    const rulesSummary = {};

    for (const key of CONTENT_KEYS) {
      merged[key] = infoSystem[key]?.trim() || '';
      rulesSummary[key] = defaults[key]?.trim() || '';
    }

    merged.rulesSummary = rulesSummary;
    merged.skill = infoSystem.skill || defaults.skill;
    merged.modifier = infoSystem.modifier ?? defaults.modifier;
    return merged;
  }

  static async placeholders(parentItem) {
    const defaults = await MagicAnalysisDefaults.generate(parentItem);
    const hints = {};

    for (const key of CONTENT_KEYS) {
      hints[`default${key.charAt(0).toUpperCase()}${key.slice(1)}`] = this.plainText(defaults[key]);
    }

    return hints;
  }
}
