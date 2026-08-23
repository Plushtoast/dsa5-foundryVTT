import MagicAnalysisQueryService from '../queries/magic-analysis-query.js';
import InformableTemplate from '../../data/item/templates/informable.js';
import MagicAnalysisContentResolver from './magic-analysis-content-resolver.js';
import ItemEnchantment from '../../item/item-enchantment.js';

const { duplicate } = foundry.utils;

export default class MagicAnalysisService {
  static MAGIC_ANALYSIS_KEYS = {
    max: 'system.skillModifiers.magicAnalysis.max',
    stack: 'system.skillModifiers.magicAnalysis.stack',
  };

  static HELPER_SPELLS = {
    odemArcanum: { localizedId: 'odemArcanum', type: 'spell', rule: 'tiered' },
    analysArkanstruktur: { localizedId: 'analyzeArcaneStructure', type: 'spell', rule: 'analys' },
    magiesicht: { localizedId: 'seeMagic', type: 'liturgy', rule: 'tiered' },
    magieanalyse: { localizedId: 'magieanalyse', type: 'liturgy', rule: 'direct' },
    sichtAufHeshinjasWerk: { localizedId: 'sightOnHeshinjasWork', type: 'liturgy', rule: 'fixed' },
  };

  static get MAGIEKUNDE_SKILL() {
    return this._magiekundeSkill();
  }

  static _magiekundeSkill() {
    return _loc('LocalizedIDs.magicalLore');
  }

  static _computeSpellCap(rule, qualityStep) {
    switch (rule) {
      case 'tiered':
        if (qualityStep > 4) return 2;
        if (qualityStep > 1) return 1;
        return 0;
      case 'direct':
      case 'analys':
        return qualityStep || 0;
      case 'fixed':
        return qualityStep > 0 ? 2 : 0;
      default:
        return 0;
    }
  }

  static _helperNameByKey() {
    const names = {};
    for (const [key, config] of Object.entries(this.HELPER_SPELLS)) {
      names[_loc(`LocalizedIDs.${config.localizedId}`)] = { key, config };
    }
    return names;
  }

  static _listAvailableHelpers(actor) {
    const helpers = [];
    const nameMap = this._helperNameByKey();

    for (const [key, config] of Object.entries(this.HELPER_SPELLS)) {
      const name = _loc(`LocalizedIDs.${config.localizedId}`);
      const item = actor.items.find(
        (i) => i.name === name && ['spell', 'liturgy', 'ceremony', 'ritual'].includes(i.type),
      );
      if (item) helpers.push({ key, config, item, source: 'spell', name: item.name });
    }

    for (const { sourceItem, enchantment } of ItemEnchantment.listOnActor(actor)) {
      const match = nameMap[enchantment.name];
      if (!match) continue;
      helpers.push({
        key: match.key,
        config: match.config,
        source: 'enchantment',
        sourceItemId: sourceItem.id,
        enchantmentId: enchantment.id,
        charged: !!enchantment.charged,
        name: `${enchantment.name} (${sourceItem.name})`,
      });
    }

    return helpers;
  }

  static _systemEffectValue(actor, systemPath) {
    return Number(foundry.utils.getProperty(actor.system, systemPath) ?? foundry.utils.getProperty(actor, `overrides.system.${systemPath}`)) || 0;
  }

  static _computeTotalMaxQS(progress) {
    if (progress.useAnalysCap) {
      return (progress.analysArkanstrukturQS ?? 0) + (progress.stackBonus || 0);
    }
    return Math.max(progress.spellsMaxQS || 0, progress.passiveMaxQS || 0) + (progress.stackBonus || 0);
  }

  static _systemFromDocument(document, displayName) {
    const system = document.system?.toObject?.() ?? duplicate(document.system);
    const isMagicalAnalysis = system.subType === 'magicalAnalysis';

    return {
      ...system,
      name: displayName || document.name,
      skill: isMagicalAnalysis ? this._magiekundeSkill() : (system.skill || this._magiekundeSkill()),
    };
  }

  static async resolveAnalysisContext({ informationUuid, parentUuid, parentItem } = {}) {
    let parent = parentItem || null;
    if (!parent && parentUuid) parent = await fromUuid(parentUuid);

    let informationItem = null;
    if (informationUuid) {
      informationItem = await fromUuid(informationUuid);
    } else if (parent) {
      const refUuid = InformableTemplate.getInformationRefUuid(parent);
      if (refUuid) informationItem = await fromUuid(refUuid);
    }

    if (informationItem?.type !== 'information' || informationItem.system.subType !== 'magicalAnalysis') {
      return null;
    }

    const displayName = parent?.name || informationItem.name;
    const infoContent = await MagicAnalysisContentResolver.resolveRollContent(
      this._systemFromDocument(informationItem, displayName),
      { parentItem: parent },
    );

    return {
      informationUuid: informationItem.uuid,
      parentUuid: parent?.uuid || null,
      infoContent,
    };
  }

  static initProgress() {
    return {
      odemArcanumQS: null,
      analysArkanstrukturQS: null,
      magiesichtQS: null,
      magieanalyseQS: null,
      sichtAufHeshinjasWerkQS: null,
      spellsMaxQS: 0,
      passiveMaxQS: 0,
      stackBonus: 0,
      totalMaxQS: 0,
      useAnalysCap: false,
      notPossible: false,
      failed: false,
    };
  }

  static async startFromEnrichment(ev) {
    const target = ev.currentTarget;
    await MagicAnalysisQueryService.openStartDialog({
      informationUuid: target.dataset.uuid,
      parentUuid: target.dataset.parentUuid || undefined,
    });
  }

  static _getSpeaker(actorId) {
    return game.users.find((u) => u.character?.id === actorId) || game.user;
  }

  static handlePreviewClick(ev, root) {
    const target = ev.target.closest('.magicAnalysisEnricherRoll');
    if (!target || !root.contains(target)) return false;
    void this.startFromEnrichment(ev);
    return true;
  }
}
