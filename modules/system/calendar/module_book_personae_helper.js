import DSA5_Utility from '../helpers/utility-dsa5.js';
import { DSAPersonaEntry } from '../../data/journal/dsapersonaedramatis.js';
import { JournalEntryTargetHelper } from './journalentrytargethelper.js';

export class ModuleBookPersonaeHelper {
  static FLAG = 'modulePersonae';
  static PAGE_FACTION_FLAG = 'modulePersonaeFaction';
  static ACTOR_TYPES = Object.freeze(['character', 'npc', 'creature', 'vehicle']);
  static PACK_INDEX_FIELDS = Object.freeze([
    'type',
    'img',
    'system.creatureClass.value',
    'system.details.career.value',
    'system.merchant.garadan',
  ]);

  static bookDisplayName(book) {
    return book?.displayName || book?.title || book?.id || '';
  }

  static journalName(bookName) {
    return _loc('PERSONAE.moduleSetup.journalName', { book: bookName });
  }

  static folderName() {
    return _loc('PERSONAE.moduleSetup.folder');
  }

  static factionForActor(actor, bookName) {
    const unknownFaction = _loc('PERSONAE.UnknownFaction');
    if (actor?.type === 'creature') {
      const creatureData = DSAPersonaEntry.splitOutsideCommas(actor.system?.creatureClass?.value || '');
      return creatureData[0] || unknownFaction;
    }
    return bookName || unknownFaction;
  }

  static moduleIdFromBook(book) {
    const path = String(book?.path || '');
    const fromPath = path.match(/(?:^|\/)modules\/([^/]+)\//)?.[1];
    if (fromPath && game.modules.get(fromPath)) return fromPath;

    if (book?.moduleName && game.modules.get(book.moduleName)) return book.moduleName;

    const journal = book?.journal;
    if (typeof journal === 'string' && journal.includes('.')) {
      const fromJournal = journal.split('.')[0];
      if (game.modules.get(fromJournal)) return fromJournal;
    }

    return null;
  }

  static collectActorPacks(book) {
    const moduleId = this.moduleIdFromBook(book);
    if (!moduleId) return [];

    const lang = game.i18n.lang;
    const packs = [];
    const seen = new Set();

    for (const pack of game.packs) {
      if (pack.documentName !== 'Actor') continue;
      const packModule = pack.metadata?.packageName || pack.metadata?.package;
      const belongsToModule = packModule === moduleId || pack.collection?.startsWith(`${moduleId}.`);
      if (!belongsToModule) continue;

      const packLang = foundry.utils.getProperty(pack.metadata, 'flags.dsalang');
      if (packLang && packLang !== lang) continue;
      if (seen.has(pack.collection)) continue;
      seen.add(pack.collection);

      packs.push({
        id: pack.collection,
        label: pack.metadata?.label || pack.title || pack.collection,
      });
    }

    return packs;
  }

  static enrichBooksWithPacks(books) {
    for (const book of books || []) {
      book.hasActorPacks = this.collectActorPacks(book).length > 0;
    }
  }

  static findJournal(bookId, bookType) {
    return game.journal.contents.find((journal) => {
      const flag = journal.getFlag('dsa5', this.FLAG);
      return flag?.bookId === bookId && flag?.bookType === bookType;
    }) ?? null;
  }

  static collectPersonaActorUuids(scopeJournal = null) {
    const uuids = new Set();
    for (const { journal, page } of JournalEntryTargetHelper.collectTargets('dsapersonaedramatis').pages) {
      if (scopeJournal && journal.id !== scopeJournal.id) continue;
      for (const entry of Object.values(page.system?.personae || {})) {
        if (entry?.actor_uuid) uuids.add(entry.actor_uuid);
      }
    }
    return uuids;
  }

  static async collectPackActors(packIds, actorTypes) {
    const typeSet = new Set(actorTypes);
    const actors = [];

    for (const packId of packIds) {
      const pack = game.packs.get(packId);
      if (!pack) continue;

      const index = await pack.getIndex({ fields: [...this.PACK_INDEX_FIELDS] });
      for (const entry of index) {
        if (!DSAPersonaEntry.isValidActor(entry)) continue;
        if (!typeSet.has(entry.type)) continue;
        actors.push({
          uuid: entry.uuid || `Compendium.${pack.collection}.${entry._id}`,
          name: entry.name,
          type: entry.type,
          img: entry.img,
          system: entry.system || {},
          pack: pack.collection,
        });
      }
    }

    return actors;
  }

  static buildEntry(actor, faction) {
    const entry = DSAPersonaEntry.createEntryData({
      actor,
      visible: false,
      showActorDescription: true,
      faction,
      img: actor.img,
    });

    if (actor.type === 'creature') {
      const creatureData = DSAPersonaEntry.splitOutsideCommas(actor.system?.creatureClass?.value || '');
      entry.subtitle = creatureData[1] || '';
    } else {
      entry.subtitle = actor.system?.details?.career?.value || '';
    }

    return entry;
  }

  static #pageUpdateOptions() {
    return { dsaSkipPersonaFill: true, dsaSkipPersonaRefresh: true, dsaSkipPersonaSync: true };
  }

  static #refreshCalendar() {
    return game.dsa5?.apps?.CalendarPicker?.refreshParts?.(DSAPersonaEntry.CREATION_CONFIG.refreshParts || [])
      ?? DSAPersonaEntry.refreshCalendarPicker();
  }

  static async #ensureFolder() {
    return DSA5_Utility.getFolderForType('JournalEntry', null, this.folderName());
  }

  static #findFactionPage(journal, faction) {
    return journal.pages.find((page) => {
      if (page.type !== 'dsapersonaedramatis') return false;
      if (page.getFlag('dsa5', this.PAGE_FACTION_FLAG) === faction) return true;
      return page.name === faction;
    }) ?? null;
  }

  static #groupActors(actors, bookName) {
    const groups = new Map();
    const collator = new Intl.Collator(game.i18n?.lang, { sensitivity: 'base', numeric: true });
    for (const actor of actors) {
      const faction = this.factionForActor(actor, bookName);
      if (!groups.has(faction)) groups.set(faction, []);
      groups.get(faction).push(actor);
    }

    return [...groups.entries()].sort(([left], [right]) => collator.compare(left, right));
  }

  static async upsertJournal({ bookId, bookType, bookName, actors, skipExisting = true }) {
    const folder = await this.#ensureFolder();
    let journal = this.findJournal(bookId, bookType);
    const created = !journal;
    const existingInJournal = this.collectPersonaActorUuids(journal);
    const existingAnywhere = skipExisting ? this.collectPersonaActorUuids() : existingInJournal;

    const toAdd = [];
    let skipped = 0;
    for (const actor of actors) {
      const uuid = actor.uuid;
      if (!uuid || !DSAPersonaEntry.isValidActor(actor)) {
        skipped += 1;
        continue;
      }
      if (existingInJournal.has(uuid) || existingAnywhere.has(uuid)) {
        skipped += 1;
        continue;
      }
      toAdd.push(actor);
      existingInJournal.add(uuid);
      existingAnywhere.add(uuid);
    }

    if (!toAdd.length) {
      if (!journal) return { journal: null, created: false, added: 0, skipped, pages: 0 };
      await JournalEntryTargetHelper.registerJournal(journal, {
        settingName: DSAPersonaEntry.SETTING_NAME,
        refresh: () => this.#refreshCalendar(),
      });
      return { journal, created: false, added: 0, skipped, pages: 0 };
    }

    if (!journal) {
      journal = await JournalEntry.create({
        name: this.journalName(bookName),
        folder: folder.id,
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
        flags: {
          dsa5: {
            [this.FLAG]: { bookId, bookType },
          },
        },
      });
    } else if (journal.folder?.id !== folder.id) {
      await journal.update({ folder: folder.id });
    }

    const grouped = this.#groupActors(toAdd, bookName);
    const pagesToCreate = [];
    const pageUpdates = [];

    for (const [faction, factionActors] of grouped) {
      const personae = {};
      for (const actor of factionActors) {
        personae[foundry.utils.randomID()] = this.buildEntry(actor, faction);
      }

      const page = this.#findFactionPage(journal, faction);
      if (!page) {
        pagesToCreate.push({
          name: faction,
          type: 'dsapersonaedramatis',
          flags: { dsa5: { [this.PAGE_FACTION_FLAG]: faction } },
          system: { personae },
        });
        continue;
      }

      const update = {};
      for (const [key, entry] of Object.entries(personae)) {
        update[`system.personae.${key}`] = entry;
      }
      pageUpdates.push({ page, update });
    }

    if (pagesToCreate.length) {
      await journal.createEmbeddedDocuments('JournalEntryPage', pagesToCreate, this.#pageUpdateOptions());
    }
    for (const { page, update } of pageUpdates) {
      await page.update(update, this.#pageUpdateOptions());
    }

    await JournalEntryTargetHelper.registerJournal(journal, {
      settingName: DSAPersonaEntry.SETTING_NAME,
      refresh: () => this.#refreshCalendar(),
    });
    await this.#refreshCalendar();

    return {
      journal,
      created,
      added: toAdd.length,
      skipped,
      pages: grouped.length,
    };
  }

  static async apply(book, bookType, { packIds = [], actorTypes = [], skipExisting = true } = {}) {
    const bookName = this.bookDisplayName(book);
    const actors = await this.collectPackActors(packIds, actorTypes);
    return this.upsertJournal({
      bookId: book.id,
      bookType,
      bookName,
      actors,
      skipExisting,
    });
  }

  static async remove(book, bookType) {
    const journal = this.findJournal(book?.id, bookType);
    if (!journal) return false;

    await JournalEntryTargetHelper.unregisterJournal(journal, {
      settingName: DSAPersonaEntry.SETTING_NAME,
      refresh: () => this.#refreshCalendar(),
    });
    await journal.delete();
    await this.#refreshCalendar();
    return true;
  }
}
