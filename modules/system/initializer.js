import Itemdsa5 from '../item/item-dsa5.js';
import DSA5_Utility from './utility-dsa5.js';
const { getProperty } = foundry.utils;

export default class DSA5Initializer extends foundry.applications.api.DialogV2 {
  constructor(title, content, module, lang = '', options = {}) {
    let data = {
      window: {
        title,
      },
      position: {
        width: 500,
      },
      content,
      buttons: [
        {
          action: 'initialize',
          label: 'initialize',
          callback: () => {
            if (this.lock) return;

            this.initialize();
          },
        },
        {
          action: 'cancel',
          label: 'cancel',
          callback: () => {
            if (this.lock) return;

            this.dontInitialize();
          },
        },
      ],
    };
    super(data);
    this.module = module;
    this.lang = lang;
    this.folders = {};
    this.journals = {};
    this.scenes = {};
    this.actors = {};
    this.lock = false;
    this.scopeOptions = options;
  }

  async initNotes(entry, journs, finishedIds) {
    let journHead = await this.getFolderForType('JournalEntry');
    for (let n of entry.notes) {
      try {
        let journ = journs.find((x) => x.flags.dsa5.initId == n.entryId);
        if (!finishedIds.has(journ._id)) {
          const parent = getProperty(journ, 'flags.dsa5.parent');
          let parenthead = journHead;
          if (this.folders[parent]) {
            parenthead = this.folders[parent];
          } else if (parent) {
            parenthead = await this.getFolderForType('JournalEntry', journHead.id, parent, 0, getProperty(journ, 'flags.dsa5.foldercolor') || '');
          }

          journ.folder = parenthead.id;

          let existingJourn = game.journal.find((x) => x.name == journ.name && x.folder?.id == parenthead.id && x.flags.dsa5.initId == n.entryId);
          if (existingJourn) {
            await existingJourn.update(journ);
            finishedIds.set(journ._id, existingJourn.id);
          } else {
            let createdEntries = await JournalEntry.create(journ);
            finishedIds.set(journ._id, createdEntries.id);
          }
        }

        n.entryId = finishedIds.get(journ._id);
      } catch (e) {
        console.warn(`Could not initialize Scene Notes for scene :${entry.name}` + e);
      }
    }
  }

  async initScenes(json, onlyScenes = undefined) {
    let head = await this.getFolderForType('Scene');
    let scene = game.packs.get(json.scenes);
    let entries = (await scene.getDocuments()).map((x) => x.toObject());
    let journal = game.packs.get(json.journal);
    let journs = (await journal.getDocuments()).map((x) => x.toObject());
    let scenesToCreate = [];
    let scenesToUpdate = [];
    let finishedIds = new Map();
    let resetAll = false;

    if (onlyScenes) {
      entries = entries.filter((x) => onlyScenes.includes(x.name));
    }

    for (let entry of entries) {
      let resetScene = resetAll;
      let found = game.scenes.find((x) => x.name == entry.name && x.folder?.id == head.id);
      if (!resetAll && found) {
        try {
          [resetScene, resetAll] = await foundry.applications.api.DialogV2.wait({
            window: {
              title: 'Book.sceneReset',
            },
            content: `<p>${game.i18n.format('Book.sceneResetDescription', { name: entry.name })}</p>`,
            buttons: [
              {
                action: 'yes',
                icon: 'fa fa-check',
                label: 'yes',
                callback: () => [true, false],
              },
              {
                action: 'all',
                icon: 'fa fa-check',
                label: 'LocalizedIDs.all',
                callback: () => [true, true],
              },
              {
                action: 'no',
                icon: 'fas fa-times',
                label: 'cancel',
                default: true,
                callback: () => [false, false],
              },
            ],
          });
        } catch (err) {
          resetScene = false;
          resetAll = false;
        }
      }
      if (found && !resetScene) {
        this.scenes[found.name] = found;
        continue;
      }

      entry.folder = head.id;
      await this.initNotes(entry, journs, finishedIds);
      if (!found) scenesToCreate.push(entry);
      else {
        entry._id = found.id;
        scenesToUpdate.push(entry);
      }
    }
    let createdEntries = await Scene.create(scenesToCreate, {
      dsaInit: true,
      keepId: true,
    });
    for (let entry of createdEntries) {
      this.scenes[entry.name] = entry;
      const thumb = await entry.createThumbnail();
      await entry.update({ thumb: thumb.thumb });
    }
    //await Scene.update(scenesToUpdate)
    //TODO this does not properly update walls?
    for (let entry of scenesToUpdate) {
      let scene = game.scenes.get(entry._id);
      await scene.update(entry);
      this.scenes[entry.name] = game.scenes.get(entry._id);
    }

    if (json.initialScene) {
      const initialScene = this.scenes[json.initialScene];
      if (initialScene) {
        await game.settings.set('core', NotesLayer.TOGGLE_SETTING, true);
        await initialScene.activate();
        await initialScene.update({ navigation: true });
      }
    }
  }

  async loadJson() {
    const initializer = this.scopeOptions.initializer || `initialization${this.lang}`;
    const file = await fetch(`modules/${this.module}/${initializer}.json`);
    return await file.json();
  }

  async initialize() {
    this.lock = true;
    let initButton = $(this.element).find('[data-action="initialize"]');
    initButton.prepend('<i class="fas fa-spinner fa-spin"></i>');
    let bookData = {};
    try {
      if (game.settings.settings.has(`${this.moduleScope}.initialized`)) await game.settings.set(this.moduleScope, 'initialized', true);
    } catch {
      /* empty */
    }

    if (this.scopeOptions.scope) {
      await fetch(`modules/${this.module}/${this.scopeOptions.scope}.json`)
        .then(async (r) => r.json())
        .then(async (json) => {
          bookData = json;
        });
    } else {
      try {
        await fetch(`modules/${this.module}/adventure${this.lang}.json`)
          .then(async (r) => r.json())
          .then(async (json) => {
            bookData = json;
          });
      } catch {
        try {
          await fetch(`modules/${this.module}/adventure.json`)
            .then(async (r) => r.json())
            .then(async (json) => {
              bookData = json;
            });
        } catch {
          console.warn(`Could not find book data for ${this.moduleScope} import.`);
        }
      }
    }

    const json = await this.loadJson();
    let foldersToCreate = json.folders;
    if (foldersToCreate) {
      let head = await this.getFolderForType('JournalEntry');
      let headReplace = json.folders[0].name;
      if (head) {
        this.folders[head.data.name] = head;
        json.folders.shift();
      }
      let createdFolders = await Folder.create(foldersToCreate);
      if (!Array.isArray(createdFolders)) createdFolders = [createdFolders];
      for (let folder of createdFolders) this.folders[folder.data.name] = folder;

      const updates = [];
      for (let folder in this.folders) {
        const flag = this.folders[folder].getFlag('dsa5', 'parent');
        let parent = flag == headReplace ? game.i18n.localize(`${this.moduleScope}.name`) : flag;
        if (parent) {
          updates.push({
            _id: this.folders[folder].id,
            parent: this.folders[parent].id,
          });
        }
      }
      await Folder.updateDocuments(updates);
    }
    if (json.items && json.items.length > 0) {
      let head = await this.getFolderForType('Item');
      let itemsToCreate = [];
      let itemsToUpdate = [];
      for (let k of json.items) {
        k.folder = head.id;
        let existingItem = game.items.find((x) => x.name == k.name && x.folder?.id == head.id);
        if (existingItem) {
          k._id = existingItem.id;
          itemsToUpdate.push(k);
        } else {
          itemsToCreate.push(k);
        }
      }
      await Itemdsa5.create(itemsToCreate);
      await Itemdsa5.updateDocuments(itemsToUpdate);
    }
    if (json.playlists) {
      let head = await this.getFolderForType('Playlist');
      let itemsToCreate = [];
      let itemsToUpdate = [];
      let playlist = game.packs.get(json.playlists);
      let entries = (await playlist.getDocuments()).map((x) => x.toObject());
      for (let k of entries) {
        k.folder = head.id;
        let existingItem = game.playlists.find((x) => x.name == k.name && x.folder?.id == head.id);
        if (existingItem) {
          k._id = existingItem._id;
          itemsToUpdate.push(k);
        } else {
          itemsToCreate.push(k);
        }
      }

      await Playlist.create(itemsToCreate, { keepId: true });
      await Playlist.updateDocuments(itemsToUpdate);
    }
    if (json.scenes) {
      await this.initScenes(json);
    }
    if (json.actors) {
      let head = await this.getFolderForType('Actor');
      let actor = game.packs.get(json.actors);
      let entries = (await actor.getDocuments()).map((x) => x.toObject());
      let entriesToCreate = [];
      let entriesToUpdate = [];
      let actorFolders = new Map();
      let sort = 0;
      if (getProperty(bookData, 'chapters')) {
        for (const chapter of bookData.chapters) {
          for (const subChapter of chapter.content) {
            if (subChapter.actors) {
              let subChapterHasActors = false;
              for (const act of subChapter.actors) {
                if (!actorFolders.has(act)) {
                  actorFolders.set(act, subChapter.name);
                  subChapterHasActors = true;
                }
              }
              if (subChapterHasActors) {
                await this.getFolderForType('Actor', head.id, subChapter.name, sort);
                sort += 1;
              }
            }
          }
        }
      }
      for (let entry of entries) {
        const parentFolder = actorFolders.has(entry.name) ? await this.getFolderForType('Actor', head.id, actorFolders.get(entry.name)) : head;

        entry.folder = parentFolder.id;
        if (entry._id) delete entry._id;

        let existingActor = game.actors.find((x) => x.name == entry.name && [head.id, parentFolder.id].includes(x.folder?.id));
        if (existingActor) {
          entry._id = existingActor.id;
          await existingActor.deleteEmbeddedDocuments(
            'Item',
            existingActor.items.map((x) => x.id),
          );
          entriesToUpdate.push(entry);
        } else {
          entriesToCreate.push(entry);
        }
      }
      let createdEntries = await Actor.create(entriesToCreate);

      await Actor.updateDocuments(entriesToUpdate);
      for (let entry of createdEntries) {
        this.actors[entry.name] = entry;
      }
    }
    if (json.macro) {
      Hooks.once('renderCompendium', (app, html, data) => {
        const compendiumUi = html.find(`[data-pack="${json.macro}"] header`);
        compendiumUi.append($(`<p>${game.i18n.localize('Book.macroHint')}</p>`));
      });
      await game.packs.get(json.macro).render(true);
    }

    this.lock = false;
    initButton.find('i').remove();
    ui.notifications.info('initComplete', { localize: true });
    await this.close();
  }

  async dontInitialize() {
    if (game.settings.settings.has(`${this.moduleScope}.initialized`)) await game.settings.set(this.moduleScope, 'initialized', true);

    ui.notifications.info('initSkipped', { localize: true });
    await this.close();
  }

  submit(button) {
    try {
      if (button.callback) button.callback(this.options.jQuery ? this.element : this.element[0]);
    } catch (err) {
      ui.notifications.error(err);
      throw new Error(err);
    }
  }

  get moduleScope() {
    return this.scopeOptions.scope || this.module;
  }

  async getFolderForType(documentType, parent = null, folderName = null, sort = 0, color = '') {
    if (!folderName) folderName = game.i18n.localize(`${this.moduleScope}.name`);

    return DSA5_Utility.getFolderForType(documentType, parent, folderName, sort, color);
  }
}
