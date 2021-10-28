import Itemdsa5 from "../item/item-dsa5.js"

export default class DSA5Initializer extends Dialog {
    constructor(title, content, module, lang = "") {
        let data = {
            title: title,
            content: content,
            buttons: {
                initialize: {
                    label: game.i18n.localize("initialize"),
                    callback: async() => {
                        if (this.lock) return
                        await this.initialize()
                    }
                },
                cancel: {
                    label: game.i18n.localize("cancel"),
                    callback: async() => {
                        if (this.lock) return
                        await this.dontInitialize()
                    }
                }
            }
        }
        super(data)
        this.module = module
        this.lang = lang
        this.folders = {}
        this.journals = {}
        this.scenes = {}
        this.actors = {}
        this.lock = false
    }

    async initialize() {
        this.lock = true
        let initButton = $(this._element).find('.initialize')
        initButton.prepend('<i class="fas fa-spinner fa-spin"></i>')
        let bookData = {}
        try {
            if (game.settings.settings.has(`${this.module}.initialized`))
                await game.settings.set(this.module, "initialized", true)
        } catch {}

        try {
            await fetch(`modules/${this.module}/adventure${this.lang}.json`).then(async r => r.json()).then(async json => {
                bookData = json
            })
        } catch {
            try {
                await fetch(`modules/${this.module}/adventure.json`).then(async r => r.json()).then(async json => {
                    bookData = json
                })
            } catch {
                console.warn(`Could not find book data for ${this.module} import.`)
            }
        }

        await fetch(`modules/${this.module}/initialization${this.lang}.json`).then(async r => r.json()).then(async json => {
            let foldersToCreate = json.folders
            if (foldersToCreate) {
                let head = game.folders.contents.find(x => x.name == foldersToCreate[0].name && x.type == "JournalEntry")
                if (head) {
                    this.folders[head.data.name] = head
                    json.folders.shift()
                }
                let createdFolders = await Folder.create(foldersToCreate)
                if (!Array.isArray(createdFolders))
                    createdFolders = [createdFolders]
                for (let folder of createdFolders)
                    this.folders[folder.data.name] = folder;

                for (let folder in this.folders) {
                    let parent = this.folders[folder].getFlag("dsa5", "parent")
                    if (parent) {
                        let parentId = this.folders[parent].data.id
                        this.folders[folder].update({ parent: parentId })
                    }
                }

                let journal = game.packs.get(json.journal)
                let entries = await journal.getDocuments()
                for (let entry of entries) {
                    let folder = entry.getFlag("dsa5", "parent")
                    let sort = entry.getFlag("dsa5", "sort")
                    if (folder) {
                        entry.data.folder = this.folders[folder].data.id
                        entry.data.sort = sort
                    }

                }
                let createdEntries = await JournalEntry.create(entries.toObject())
                for (let entry of createdEntries) {
                    this.journals[entry.data.name] = entry;
                }
            }
            if (json.items) {
                let head = await this.getFolderForType("Item")

                for (let k of json.items)
                    k.folder = head.id

                await Itemdsa5.create(json.items)
            }
            if (json.scenes) {
                let head = await this.getFolderForType("Scene")
                let scene = game.packs.get(json.scenes)
                let entries = (await scene.getDocuments()).map(x => x.toObject())
                let journal = game.packs.get(json.journal)
                let journs = (await journal.getDocuments()).map(x => x.toObject())
                let journHead = await this.getFolderForType("JournalEntry")
                let finishedIds = new Map()
                for (let entry of entries) {
                    entry.folder = head.id
                    for (let n of entry.notes) {
                        try {
                            let journ = journs.find(x => x.flags.dsa5.initId == n.entryId)
                            if (!(finishedIds.has(journ._id))) {

                                journ.folder = journHead.id
                                let createdEntries = await JournalEntry.create(journ)
                                finishedIds.set(journ._id, createdEntries.id)
                            }

                            n.entryId = finishedIds.get(journ._id)
                        } catch (e) {
                            console.warn("Could not initialize Scene Notes" + e)
                        }
                    }
                }
                let createdEntries = await Scene.create(entries)
                for (let entry of createdEntries) {
                    this.scenes[entry.data.name] = entry;
                }

                if (json.initialScene) {
                    const initialScene = this.scenes[json.initialScene]
                    await game.settings.set("core", NotesLayer.TOGGLE_SETTING, true)
                    await initialScene.activate()
                    await initialScene.update({ navigation: true })

                }
            }
            if (json.actors) {
                let head = await this.getFolderForType("Actor")
                let actor = game.packs.get(json.actors)
                let entries = (await actor.getDocuments()).map(x => x.toObject())
                let actorFolders = new Map()
                if (getProperty(bookData, "chapters")) {
                    for (const chapter of bookData.chapters) {
                        for (const subChapter of chapter.content) {
                            if (subChapter.actors) {
                                let subChapterHasActors = false
                                for (const act of subChapter.actors) {
                                    if (!actorFolders.has(act)) {
                                        actorFolders.set(act, subChapter.name)
                                        subChapterHasActors = true
                                    }
                                }
                                if (subChapterHasActors) await this.getFolderForType("Actor", head.id, subChapter.name)
                            }
                        }
                    }
                }
                for (let entry of entries) {
                    const parentFolder = actorFolders.has(entry.name) ? await this.getFolderForType("Actor", head.id, actorFolders.get(entry.name)) : head

                    entry.folder = parentFolder.id
                    if (entry._id) delete entry._id
                }
                let createdEntries = await Actor.create(entries)
                for (let entry of createdEntries) {
                    this.actors[entry.data.name] = entry;
                }
            }

        })
        this.lock = false
        initButton.find("i").remove()
        ui.notifications.notify(game.i18n.localize("initComplete"))
        await this.close()
    }

    async dontInitialize() {
        if (game.settings.settings.has(`${this.module}.initialized`))
            await game.settings.set(this.module, "initialized", true)

        ui.notifications.notify(game.i18n.localize("initSkipped"))
        await this.close()
    }

    submit(button) {
        try {
            if (button.callback) button.callback(this.options.jQuery ? this.element : this.element[0]);
        } catch (err) {
            ui.notifications.error(err);
            throw new Error(err);
        }
    }

    async getFolderForType(entityType, parent = null, folderName = null) {
        if (!folderName) folderName = game.i18n.localize(`${this.module}.name`)

        let folder = await game.folders.contents.find(x => x.name == folderName && x.type == entityType && x.data.parent == parent)
        if (!folder) {
            folder = await Folder.create({
                name: folderName,
                type: entityType,
                sorting: "m",
                color: "",
                parent
            })
        }
        return folder
    }
}