import Actordsa5 from '../../actor/actor-dsa5.js';
import { DICE_CONSTANTS } from '../../config/dice-constants.js';
import { conditionsMatcher } from '../../hooks/texteditor.js';
import DSA5 from '../../config/config-dsa5.js';
import { ItemFactory } from '../../item/item-factory.js';
const { mergeObject, duplicate, getProperty } = foundry.utils;

export default class DSA5_Utility {
  static EXPERIENCE_GRADES = [
    { threshold: 2100, label: 'EXP.legendary' },
    { threshold: 1700, label: 'EXP.brillant' },
    { threshold: 1400, label: 'EXP.masterful' },
    { threshold: 1200, label: 'EXP.competent' },
    { threshold: 1100, label: 'EXP.experienced' },
    { threshold: 1000, label: 'EXP.average' },
  ];

  static WEAPON_TYPES = {
    melee: 0,
    range: 1,
  };

  static DICE_REGEX = /( |^)(\d{1,2})?[wWdD][0-9]+((\+|-|–)[0-9]+)?(\[[a-zA-ZäöüÄÖÜ ]+\])?(( )?[+-]( )?(\d{1,2})?[wWdD][0-9]+((\+|-|–)[0-9]+)?(\[[a-zA-ZäöüÄÖÜ ]+\])?)+?/g;

  static async skillByName(name) {
    const pack = game.packs.get(this.getLanguagePack());
    await pack.getIndex();
    const entry = pack.index.find((i) => i.name === name);
    if (!entry) return null;
    return await pack.getDocument(entry._id);
  }

  static async allSkills() {
    return await this.getCompendiumEntries(this.getLanguagePack(), 'skill');
  }

  static async allCombatSkills() {
    return await this.getCompendiumEntries(this.getLanguagePack(), 'combatskill');
  }

  static async allMoneyItems() {
    const customPack = game.settings.get('dsa5', 'moneyKompendium');
    const moneyPack = game.packs.get(customPack) ? customPack : this.getLanguagePack();
    const items = await this.getCompendiumEntries(moneyPack, 'money');

    return items
      .sort((a, b) => a.system.price.value - b.system.price.value)
      .map(item => ({ ...item, system: { ...item.system, quantity: { value: 0 } } }));
  }

  static getLanguagePack() {
    return game.i18n.lang === 'de' ? 'dsa5.skills' : 'dsa5.skillsen';
  }

  static actorCapabilities(actor) {
    const type = actor?.type ?? 'character';
    return DSA5.actorCapabilities[type] ?? DSA5.actorCapabilities.character;
  }

  static async getCompendiumEntries(compendium, itemType) {
    const pack = await game.packs.get(compendium);
    if (!pack) {
      ui.notifications.error('No content found');
      return [];
    }

    const searchTypes = Array.isArray(itemType) ? itemType : [itemType];
    const documents = await pack.getDocuments();
    return documents
      .filter(doc => searchTypes.includes(doc.type))
      .map(doc => doc.toObject());
  }

  static async collectIndexedCompendiumEntries({
    documentName,
    fields = [],
    packFilter = () => true,
    filterEntry = () => true,
    mapEntry = entry => entry,
  }) {
    const packs = game.packs.filter(pack => pack.documentName === documentName && packFilter(pack));
    const results = await Promise.all(packs.map(async (pack) => {
      const index = await pack.getIndex({ fields });
      const documentCache = new Map();
      const getDocument = async (id) => {
        if (!documentCache.has(id)) documentCache.set(id, pack.getDocument(id));
        return await documentCache.get(id);
      };

      const entries = await Promise.all(index.map(async (entry) => {
        const context = { pack, getDocument };
        if (!(await filterEntry(entry, context))) return null;
        return await mapEntry(entry, context);
      }));

      return entries.filter(Boolean);
    }));

    return results.flat();
  }

  static async getEnhancementEffects({ enhancementType, targetType } = {}) {
    return this.collectIndexedCompendiumEntries({
      documentName: 'ActiveEffect',
      fields: ['type', 'system.enhancementType', 'system.targetType'],
      filterEntry: (entry) => {
        if (entry.type !== 'enhancement') return false;
        if (enhancementType && entry.system?.enhancementType !== enhancementType) return false;
        if (targetType && entry.system?.targetType !== targetType) return false;
        return true;
      },
      mapEntry: (entry, { pack }) => ({ ...entry, pack: pack.collection }),
    });
  }

  static moduleEnabled(id) {
    const module = game.modules.get(id);
    return module?.active ?? false;
  }

  static renderToggle(elem) {
    if (!elem.rendered) {
      elem.render(true);
      return;
    }

    if (elem._minimized) {
      elem.maximize();
    } else {
      elem.close();
    }
  }

  static calcTokenSize(actorData, data) {
    const sizeValue = actorData.system.status?.size?.value;
    if (sizeValue == null) return;

    const tokenSize = game.dsa5.config.tokenSizeCategories[sizeValue];
    if (!tokenSize) return;

    if (tokenSize < 1) {
      this._applyTokenScale(data, tokenSize, 1, 1);
    } else {
      const size = Math.floor(tokenSize);
      const scale = Math.max(tokenSize / size, 0.25);
      this._applyTokenScale(data, scale, size, size);
    }
  }

  static _applyTokenScale(data, scale, width, height) {
    mergeObject(data, {
      texture: { scaleX: scale, scaleY: scale },
      width,
      height,
    });
  }

  static async allSkillsList() {
    const skills = await this.allSkills();
    return skills?.map(skill => skill.name).sort((a, b) => a.localeCompare(b)) ?? [];
  }

  static async allCombatSkillsList(weapontype) {
    const weaponId = this.WEAPON_TYPES[weapontype];
    if (weaponId === undefined) return [];

    const skills = await this.allCombatSkills();
    return skills
      .filter(skill => skill.system.weapontype.value === weaponId)
      .map(skill => skill.name)
      .sort((a, b) => a.localeCompare(b));
  }

  static parseAbilityString(ability) {
    const bonusMatch = ability.match(/[+-]?\d{1,2}$/);
    const specialMatch = ability.match(/\(([^()]+)\)/);
    const typeMatch = ability.match(/ (FP|SP|FW|SR)[+-]?\d{1,2}/);
    const withoutBonus = ability.replace(/ (FP|SR|FW|SP)?[+-]?\d{1,2}$/, '').trim();

    return {
      original: withoutBonus,
      name: withoutBonus.replace(/\((.+?)\)/g, '()'),
      step: bonusMatch ? Number(bonusMatch[0]) : 1,
      special: specialMatch?.[1] || '',
      type: typeMatch ? (typeMatch[1] === 'FP' || typeMatch[1] === 'SP' ? 'FP' : 'FW') : '',
      bonus: bonusMatch !== null,
    };
  }

  static experienceDescription(experience) {
    const numericExperience = Number(experience);
    const grade = this.EXPERIENCE_GRADES.find(g => numericExperience >= g.threshold);
    return grade?.label ?? 'EXP.inexperienced';
  }

  static categoryLocalization(category, docName = 'Item') {
    return _loc(`TYPES.${docName}.${category}`);
  }

  static attributeLocalization(attribute) {
    return _loc(`CHAR.${attribute.toUpperCase()}`);
  }

  static attributeAbbrLocalization(attribute) {
    return _loc(`CHARAbbrev.${attribute.toUpperCase()}`);
  }

  static replaceDies(content, inlineRoll = false) {
    const rollPrefix = inlineRoll ? '' : '/r ';
    return content.replaceAll(this.DICE_REGEX, str => {
      const normalizedDice = str.replace(/[DwW]/, 'd').replace(/–/, '-');
      return ` [[${rollPrefix}${normalizedDice}]]`;
    });
  }

  static replaceConditions(content) {
    return content?.replace(DSA5.statusRegex.regex, str => conditionsMatcher([str])) ?? content;
  }

  static escapeRegex(input) {
    const source = (typeof input === 'string' || input instanceof String) ? input : '';
    return source.replace(/[-[/\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  static cleanTraditionTokens(value = '', traditionLabel = _loc('tradition')) {
    const labelRegex = traditionLabel ? new RegExp(this.escapeRegex(traditionLabel), 'gi') : null;

    return value
      .toString()
      .replace(/[()]/g, '')
      .replace(labelRegex ?? /$^/, '')
      .split(/[,;]/)
      .map((entry) => entry.trim().toLowerCase().replace(/\s+/g, ' '))
      .filter(Boolean);
  }

  static traditionTokenVariants(token = '') {
    const normalized = token.toString().trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized) return new Set();

    const parts = normalized.split(' ');
    const lastWord = parts.pop();
    const baseParts = parts.length ? `${parts.join(' ')} ` : '';
    const variants = new Set([normalized]);
    const addVariant = (word) => {
      if (word && word.length >= 3) variants.add(`${baseParts}${word}`.trim());
    };

    addVariant(lastWord);

    if (lastWord.endsWith('ies') && lastWord.length > 4) addVariant(`${lastWord.slice(0, -3)}y`);
    if (/(ches|shes|sses|xes|zes|oes)$/i.test(lastWord) && lastWord.length > 4) addVariant(lastWord.slice(0, -2));
    if (lastWord.endsWith('es') && lastWord.length > 4) addVariant(lastWord.slice(0, -2));
    if (lastWord.endsWith('s') && lastWord.length > 4 && !lastWord.endsWith('ss')) addVariant(lastWord.slice(0, -1));
    if (lastWord.endsWith('n') && lastWord.length > 4) addVariant(lastWord.slice(0, -1));
    if (lastWord.endsWith('e') && lastWord.length > 4) addVariant(lastWord.slice(0, -1));

    return variants;
  }

  static hasMatchingTradition(leftTokens = [], rightTokens = []) {
    const rightVariants = new Set(rightTokens.flatMap((token) => [...this.traditionTokenVariants(token)]));

    return leftTokens.some((token) => {
      for (const variant of this.traditionTokenVariants(token)) {
        if (rightVariants.has(variant)) return true;
      }

      return false;
    });
  }

  static registerMasterTokens(file) {
    if (!this.moduleEnabled('dsa5-mastersworkshop')) return;
    DSA5.masterTokens.push(file);
  }

  static async callItemTransformationMacro(macroName, source, effect, args = {}) {
    const parts = macroName.split('.');
    const pack = game.packs.get(`${parts[0]}.${parts[1]}`);
    if (!pack) {
      console.warn(`Pack ${macroName} not found`);
      return {};
    }

    const documents = await pack.getDocuments({ name: parts[2] });
    if (!documents.length) {
      ui.notifications.error('DSAError.macroNotFound', { localize: true, format: { name: macroName } });
      return {};
    }

    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    const fn = new AsyncFunction('args', 'source', 'effect', documents[0].command);
    const result = {};

    try {
      args.result = result;
      await fn.call(this, args, source, effect);
    } catch (err) {
      ui.notifications.error('There was an error in your macro syntax. See the console (F12) for details');
      console.error(err);
      result.error = true;
    }

    return result;
  }

  static isActiveGM(suppress = false) {
    const activeGM = game.users.activeGM;

    if (!activeGM && !suppress) ui.notifications.warn('DSAError.requiresGM', { localize: true });

    return activeGM?.isSelf;
  }

  static async callAsyncHooks(hook, args) {
    for (const func of DSA5.asyncHooks[hook]) await func(...args);
  }

  static chatDataSetup(content, modeOverride, forceWhisper, forceWhisperIDs) {
    const chatData = {
      user: game.user.id,
      messageMode: modeOverride || game.settings.get('core', 'messageMode'),
      content,
    };
    const cModes = DICE_CONSTANTS.CHAT_MODES;

    if ([cModes.GM, cModes.BLIND].includes(chatData.messageMode)) chatData.whisper = ChatMessage.getWhisperRecipients('GM').map((u) => u.id);
    if (chatData.messageMode === cModes.BLIND) chatData.blind = true;
    else if (chatData.messageMode === cModes.SELF) chatData.whisper = [game.user.id];
    else if (chatData.messageMode === cModes.IC) chatData.speaker = ChatMessage.getSpeaker();

    if (forceWhisper) {
      chatData.speaker = ChatMessage.getSpeaker();
      chatData.whisper = ChatMessage.getWhisperRecipients(forceWhisper);
    }
    if (forceWhisperIDs) {
      chatData.speaker = ChatMessage.getSpeaker();
      chatData.whisper = forceWhisperIDs;
    }

    return chatData;
  }

  static getSpeaker(speaker) {
    if (!speaker) return null;

    let actor = ChatMessage.getSpeakerActor(speaker);
    if (speaker.emptyActor) return this.emptyActor(12, 'Alrik', speaker.emptyActor);

    if (!actor && canvas.tokens) {
      const token = canvas.tokens.get(speaker.token);
      if (token) actor = token.actor;
    }
    if (!actor) {
      const scene = game.scenes.get(speaker.scene);
      try {
        if (scene) actor = new foundry.canvas.placeables.Token(scene.getEmbeddedDocument('Token', speaker.token))?.actor;
      } catch (error) {
        /* empty */
      }
    }

    return actor;
  }

  static itemPrice(item) {
    return (
      Number(getProperty(item, 'flags.dsa5.customPriceTag')) ||
      (item.type == 'consumable' ? ItemFactory.getSubClass(item.type).consumablePrice(item) : Number(item.system.price.value))
    );
  }

  static fateAvailable(actor, group) {
    if (group)
      return (
        game.settings
          .get('dsa5', 'groupschips')
          .split('/')
          .map((x) => Number(x))[0] > 0
      );

    return actor.system.status.fatePoints.value > 0;
  }

  static _calculateAdvCost(currentAdvances, type, modifier = 1) {
    return DSA5.advancementCosts[type][Number(currentAdvances) + modifier];
  }

  static async getFolderForType(documentType, parent = null, folderName = null, sort = 0, color = '', sorting = undefined) {
    let folder = await game.folders.contents.find((x) => x.name == folderName && x.type == documentType && x.folder?.id == parent);
    if (!folder) {
      folder = await Folder.create({
        name: folderName,
        type: documentType,
        sorting: sorting || (documentType == 'JournalEntry' ? 'a' : 'm'),
        color,
        sort,
        folder: parent,
      });
    }
    return folder;
  }

  //todo this should go away
  static toObjectIfPossible(source) {
    return typeof source.toObject === 'function' ? source.toObject(false) : duplicate(source);
  }

  static async showArtwork({ img, name, uuid, isOwner }, hide = false) {
    return new foundry.applications.apps.ImagePopout({
      window: { title: hide ? (isOwner ? name : '-') : name },
      shareable: true,
      uuid,
      src: img,
    }).render(true);
  }

  static async findAnyItem(lookup) {
    const results = [];
    const names = lookup.map((x) => x.name);
    const types = lookup.map((x) => x.type);
    for (const k of game.items.contents) {
      const index = names.indexOf(k.name);
      if (index >= 0 && types[index] == k.type) {
        names.splice(index, 1);
        types.splice(index, 1);
        results.push(k.toObject());
      }
      if (names.length <= 0) break;
    }

    if (names.length > 0) {
      const regx = /^dsa5-core/;
      const sortedPacks = Array.from(game.packs.keys()).sort((a, b) => {
        if (regx.test(a) && regx.test(b)) a.localeCompare(b);
        if (regx.test(b)) return -1;
        if (regx.test(a)) return 1;
        return a.localeCompare(b);
      });

      for (const pack of sortedPacks) {
        const p = game.packs.get(pack);
        if (p.documentName == 'Item' && (game.user.isGM || p.visible)) {
          await p.getDocuments({ name__in: names, type__in: types }).then((content) => {
            for (const k of content) {
              const index = names.indexOf(k.name);
              if (index >= 0 && types[index] == k.type) {
                names.splice(index, 1);
                types.splice(index, 1);
                results.push(k.toObject());
              }
            }
          });
          if (names.length <= 0) break;
        }
      }
    }
    return results;
  }

  static pushOnlyIfUnique(array, object) {
    if (!array.find((x) => DSA5_Utility.shallowEquals(x, object))) array.push(object);
  }

  static shallowEquals(a, b) {
    return JSON.stringify(a) == JSON.stringify(b);
  }
  static emptyActor(attrs = 12, name = 'Alrik', data = {}) {
    let attrArray;
    if (!Array.isArray(attrs)) {
      attrArray = new Array(8).fill(attrs);
    } else {
      attrArray = attrs;
    }

    const createData = mergeObject(
      {
        name,
        type: 'npc',
        system: {
          status: { wounds: { value: 50 }, fatePoints: {} },
          characteristics: {
            mu: { initial: attrArray[0] },
            kl: { initial: attrArray[1] },
            in: { initial: attrArray[2] },
            ch: { initial: attrArray[3] },
            ff: { initial: attrArray[4] },
            ge: { initial: attrArray[5] },
            ko: { initial: attrArray[6] },
            kk: { initial: attrArray[7] },
          },
        },
      },
      data,
    );

    const actor = new Actordsa5(duplicate(createData), { noHook: true });
    actor.prepareData();
    actor.emptyActor = createData;
    return actor;
  }

  static dedup(arr) {
    return [...new Set((arr || []).filter(Boolean))];
  }

  static getKeybindingDisplay(actionId, namespace = 'dsa5') {
    if (!actionId || !game.keybindings?.actions?.has(`${namespace}.${actionId}`)) return '';

    try {
      const bindings = game.keybindings.get(namespace, actionId);
      const binding = bindings?.find((b) => b?.key);
      if (!binding) return '';
      return foundry.applications.sidebar.apps.ControlsConfig.humanizeBinding(binding);
    } catch {
      return '';
    }
  }

  static tooltipWithKeybinding(labelKey, actionId, namespace = 'dsa5') {
    const label = _loc(labelKey);
    const keyString = this.getKeybindingDisplay(actionId, namespace);
    return keyString ? `${label} (${keyString})` : label;
  }
}
