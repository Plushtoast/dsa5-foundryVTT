import DSA5_Utility from '../helpers/utility-dsa5.js';
import DSA5ChatAutoCompletion from '../sidebar/chat_autocompletion.js';
import InformationQueryService from '../queries/information-query.js';

const { renderTemplate } = foundry.applications.handlebars;
const { duplicate, getProperty } = foundry.utils;

export default class MagicAnalysisService {
  static FLAG_SESSION = 'magicAnalysisSessionId';

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

  static _listAvailableHelpers(actor) {
    const helpers = [];
    for (const [key, config] of Object.entries(this.HELPER_SPELLS)) {
      const name = _loc(`LocalizedIDs.${config.localizedId}`);
      const item = actor.items.find(
        (i) => i.name === name && ['spell', 'liturgy', 'ceremony', 'ritual'].includes(i.type),
      );
      if (item) helpers.push({ key, config, item });
    }
    return helpers;
  }

  static _systemEffectValue(actor, systemPath) {
    return Number(getProperty(actor.system, systemPath) ?? getProperty(actor, `overrides.system.${systemPath}`)) || 0;
  }

  static _computeTotalMaxQS(progress) {
    if (progress.useAnalysCap) {
      return (progress.analysArkanstrukturQS ?? 0) + (progress.stackBonus || 0);
    }
    return Math.max(progress.spellsMaxQS || 0, progress.passiveMaxQS || 0) + (progress.stackBonus || 0);
  }

  static async _getEnchantmentDocument(enchantment) {
    const pack = game.packs.get(enchantment.pack);
    if (!pack) return null;
    let item = await pack.getDocument(enchantment.itemId);
    if (!item) {
      const idx = pack.index.getName(enchantment.name);
      if (idx) item = await pack.getDocument(idx._id);
    }
    return item;
  }

  static _systemFromDocument(document, displayName) {
    const system = document.system?.toObject?.() ?? duplicate(document.system);
    return {
      ...system,
      name: displayName || document.name,
      skill: system.skill || this._magiekundeSkill(),
    };
  }

  static async generateDefaults(item) {
    const enchantments = item.getFlag('dsa5', 'enchantments') || [];
    const primary = enchantments[0];
    const fw = primary?.fw ?? 0;

    let qs1 = '';
    if (fw) {
      const key = fw >= 10 ? 'moreThan10' : 'lessThan10';
      qs1 = `<p>${_loc(`MAGICANALYSIS.defaultQs1.${key}`, { fw })}</p>`;
    }

    let qs2 = '';
    if (fw) {
      qs2 = `<p>${_loc('MAGICANALYSIS.defaultQs2', { min: Math.max(0, fw - 3), max: fw + 3, fw })}</p>`;
    }

    let qs3 = '';
    if (primary) {
      if (primary.talisman) qs3 = `<p>${_loc('MAGICANALYSIS.defaultQs3.talisman')}</p>`;
      else if (primary.permanent) qs3 = `<p>${_loc('MAGICANALYSIS.defaultQs3.permanent')}</p>`;
      else if (enchantments.length > 1 || !primary.charged) qs3 = `<p>${_loc('MAGICANALYSIS.defaultQs3.storage')}</p>`;
      else qs3 = `<p>${_loc('MAGICANALYSIS.defaultQs3.selfCharging')}</p>`;
    }

    let qs4 = '';
    if (primary?.actorId) {
      const actor = game.actors.get(primary.actorId);
      const tradition = actor?.system?.details?.tradition?.value || actor?.system?.tradition?.value;
      qs4 = tradition
        ? `<p>${_loc('MAGICANALYSIS.defaultQs4.tradition', { tradition })}</p>`
        : `<p>${_loc('MAGICANALYSIS.defaultQs4.unknown')}</p>`;
    }

    const qs5parts = [];
    for (const ench of enchantments) {
      const spell = await this._getEnchantmentDocument(ench);
      qs5parts.push(spell
        ? `<p><b>${spell.name}</b></p>${spell.system?.description?.value || ''}`
        : `<p><b>${ench.name}</b></p>`);
    }

    return {
      qs1, qs2, qs3, qs4, qs5: qs5parts.join(''), qs6: '',
      crit: '', botch: '', fail: _loc('MAGICANALYSIS.defaultFail'),
      skill: this._magiekundeSkill(), modifier: 0,
    };
  }

  static async _resolveContent(sourceItem, { informationItem } = {}) {
    if (informationItem) {
      const base = this._systemFromDocument(informationItem, sourceItem?.name || informationItem.name);
      const hasCustomQs = [1, 2, 3, 4, 5, 6].some((i) => base[`qs${i}`]);
      if (hasCustomQs) return base;

      const generated = await this.generateDefaults(sourceItem || informationItem);
      return {
        ...generated,
        name: sourceItem?.name || informationItem.name,
        crit: base.crit || generated.crit,
        botch: base.botch || generated.botch,
        fail: base.fail || generated.fail,
      };
    }

    const flag = sourceItem.getFlag('dsa5', 'magicAnalysis') || { mode: 'default' };

    if (flag.mode === 'linked' && flag.linkedUuid) {
      const linked = await fromUuid(flag.linkedUuid);
      if (linked?.type === 'information') return this._systemFromDocument(linked, sourceItem.name);
    }

    if (flag.mode === 'custom' && flag.custom) {
      return { ...flag.custom, name: sourceItem.name, skill: flag.custom.skill || this._magiekundeSkill() };
    }

    return { ...(await this.generateDefaults(sourceItem)), name: sourceItem.name };
  }

  static _magicalAnalysisParentItem(informationItem) {
    const parent = informationItem.parent;
    if (!parent || parent.documentName !== 'Item' || parent.type === 'information') return null;
    return parent;
  }

  static async _resolveFromUuid(uuid) {
    const document = await fromUuid(uuid);
    if (!document) return null;

    if (document.type === 'information') {
      if (document.system.subType === 'magicalAnalysis') {
        const parentItem = this._magicalAnalysisParentItem(document);
        if (parentItem) return this._resolveContent(parentItem, { informationItem: document });
      }
      return this._systemFromDocument(document);
    }

    return this._resolveContent(document);
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

  static async postAnalysisRequest(item) {
    const html = await renderTemplate('systems/dsa5/templates/chat/information/magic-analysis-request.hbs', { item });
    await ChatMessage.create(DSA5_Utility.chatDataSetup(html));
  }

  static async startFromEnrichment(ev) {
    const uuid = ev.currentTarget.dataset.uuid;
    const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
    if (!actor) return;
    await this.performMagicAnalysis(actor.id, uuid, null, null, tokenId);
  }

  static async startMagicAnalysis(ev) {
    const uuid = ev.currentTarget.dataset.uuid;
    const actorId = ev.currentTarget.dataset.actor || canvas.tokens.controlled[0]?.actor?.id || game.user.character?.id;
    if (!actorId) {
      ui.notifications.warn(_loc('MAGICANALYSIS.noActor'), { localize: true });
      return;
    }
    await this.performMagicAnalysis(actorId, uuid);
  }

  static async performMagicAnalysis(actorId, itemUuid, progress = null, startMsgId = null, tokenId = null) {
    const actor = game.actors.get(actorId);
    const item = await fromUuid(itemUuid);
    if (!actor || !item) return;

    if (progress === null) progress = this.initProgress();
    if (startMsgId === null) startMsgId = foundry.utils.randomID(16);

    progress.passiveMaxQS = this._systemEffectValue(actor, 'skillModifiers.magicAnalysis.max');
    progress.stackBonus = this._systemEffectValue(actor, 'skillModifiers.magicAnalysis.stack');

    const helperRows = this._listAvailableHelpers(actor).map((helper) => {
      const progressKey = `${helper.key}QS`;
      const done = progress[progressKey] != null;
      return {
        key: helper.key,
        id: helper.item.id,
        name: helper.item.name,
        done,
        rolledQS: progress[progressKey],
        showButton: !done && (helper.config.type === 'spell' ? actor.system.isMage : actor.system.isPriest),
      };
    });

    progress.totalMaxQS = this._computeTotalMaxQS(progress);
    progress.notPossible = progress.totalMaxQS === 0 && !helperRows.some((h) => h.showButton);

    const html = await renderTemplate('systems/dsa5/templates/chat/information/magic-analysis-progress.hbs', {
      actor,
      item,
      uuid: itemUuid,
      helperRows,
      progress,
      progressJson: JSON.stringify(progress),
      startMsgId,
      tokenId: tokenId || canvas.tokens.placeables.find((t) => t.actor?.id === actorId)?.id,
    });

    await this._replaceSessionMessages(startMsgId);
    const msg = await ChatMessage.create(DSA5_Utility.chatDataSetup(html));
    await msg.setFlag('dsa5', this.FLAG_SESSION, startMsgId);
  }

  static async triggerHelperRoll(postFunction, result) {
    const { helperKey, progress, startMsgId, actorId, uuid } = postFunction;
    const config = this.HELPER_SPELLS[helperKey];
    const cap = this._computeSpellCap(config.rule, result.result.qualityStep);

    const progressKey = `${helperKey}QS`;
    if (config.rule === 'analys') {
      progress.useAnalysCap = true;
      progress.spellsMaxQS = 0;
    }
    progress[progressKey] = cap;
    if (config.rule !== 'analys' && cap > progress.spellsMaxQS) progress.spellsMaxQS = cap;

    await this.performMagicAnalysis(actorId, uuid, progress, startMsgId, postFunction.tokenId);
  }

  static async castHelper(ev) {
    const actor = game.actors.get(ev.currentTarget.dataset.actor);
    const spell = actor?.items.get(ev.currentTarget.dataset.spell);
    if (!actor || !spell) return;

    const options = {
      subtitle: ` (${_loc('MAGICANALYSIS.subtitle')})`,
      speaker: this._getSpeaker(actor.id),
      postFunction: {
        functionName: 'game.dsa5.apps.MagicAnalysisService.triggerHelperRoll',
        actorId: actor.id,
        uuid: ev.currentTarget.dataset.uuid,
        progress: JSON.parse(ev.currentTarget.dataset.progress),
        startMsgId: ev.currentTarget.dataset.startMsg,
        helperKey: ev.currentTarget.dataset.helper,
        tokenId: ev.currentTarget.dataset.token,
      },
    };

    await actor.basicTest(await actor.setupSpell(spell, options, options.postFunction.tokenId));
  }

  static async finishAnalysis(ev) {
    const actor = game.actors.get(ev.currentTarget.dataset.actor);
    if (!actor) return;

    const progress = JSON.parse(ev.currentTarget.dataset.progress);
    const skillName = this._magiekundeSkill();
    const skill = actor.items.find((i) => i.name === skillName && i.type === 'skill');
    if (!skill) {
      ui.notifications.error('DSAError.elementNotFound', { format: { element: skillName }, localize: true });
      return;
    }

    const infoContent = await this._resolveFromUuid(ev.currentTarget.dataset.uuid);
    const totalMaxQS = this._computeTotalMaxQS(progress);
    const postFunction = {
      functionName: 'game.dsa5.apps.MagicAnalysisService.magicAnalysisResult',
      uuid: ev.currentTarget.dataset.uuid,
      startMsgId: ev.currentTarget.dataset.startMsg,
      totalMaxQS,
      infoContent,
      actorId: actor.id,
    };

    const setupData = await actor.setupSkill(skill, {
      subtitle: ` (${_loc('MAGICANALYSIS.subtitle')})`,
      speaker: this._getSpeaker(actor.id),
      modifier: infoContent?.modifier || 0,
      postFunction,
    }, ev.currentTarget.dataset.token);

    setupData.testData.opposable = false;
    const result = await actor.basicTest(setupData);
    if (result.result.qualityStep > totalMaxQS) result.result.qualityStep = totalMaxQS;
    await this.magicAnalysisResult(postFunction, result);
  }

  static async magicAnalysisResult(postFunction, result) {
    const infoContent = postFunction.infoContent || (await this._resolveFromUuid(postFunction.uuid));
    if (!infoContent) return;

    await this._replaceSessionMessages(postFunction.startMsgId);
    await InformationQueryService.createInformationQuery(
      result,
      postFunction.uuid,
      { name: infoContent.name, system: infoContent },
      {
        actor: game.actors.get(postFunction.actorId),
        skill: { name: infoContent.skill || this._magiekundeSkill() },
        virtualInfo: infoContent,
      },
    );
  }

  static _getSpeaker(actorId) {
    return game.users.find((u) => u.character?.id === actorId) || game.user;
  }

  static async _replaceSessionMessages(startMsgId) {
    for (const message of game.messages.filter((m) => m.getFlag('dsa5', this.FLAG_SESSION) === startMsgId)) {
      await message.delete();
    }
  }

  static chatListeners(html) {
    html.on('click', '.startMagicAnalysis', (ev) => this.startMagicAnalysis(ev));
    html.on('click', '.magicAnalysisHelperRoll', (ev) => this.castHelper(ev));
    html.on('click', '.magicAnalysisFinish', (ev) => this.finishAnalysis(ev));
    html.on('click', '.magicAnalysisEnricherRoll', (ev) => this.startFromEnrichment(ev));
  }
}
