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
                        await this.initialize()
                    }
                },
                cancel: {
                    label: game.i18n.localize("cancel"),
                    callback: async() => {
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
    }

    async initialize() {
        game.settings.set(this.module, "initialized", true)

        await fetch(`modules/${this.module}/initialization${this.lang}.json`).then(async r => r.json()).then(async json => {
            let foldersToCreate = json.folders
            if (foldersToCreate.length > 0) {
                let head = game.folders.entities.find(x => x.name == foldersToCreate[0].name && x.type == "JournalEntry")
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
                        let parentId = this.folders[parent].data._id
                        this.folders[folder].update({ parent: parentId })
                    }
                }

                let journal = game.packs.get(json.journal)
                let entries = await journal.getContent()
                for (let entry of entries) {
                    let folder = entry.getFlag("dsa5", "parent")
                    let sort = entry.getFlag("dsa5", "sort")
                    if (folder) {
                        entry.data.folder = this.folders[folder].data._id
                        entry.data.sort = sort
                    }

                }
                let createdEntries = await JournalEntry.create(entries)
                for (let entry of createdEntries) {
                    this.journals[entry.data.name] = entry;
                }
            }
            if (json.items) {
                let head = await this.getFolderForType("Item")

                for (let k of json.items)
                    k.folder = head._id

                await Itemdsa5.create(json.items)
            }
            if (json.scenes) {
                let head = await this.getFolderForType("Scene")
                let scene = game.packs.get(json.scenes)
                let entries = await scene.getContent()
                for (let entry of entries) {
                    entry.data.folder = head._id
                    entry.data.notes.forEach(n => {
                        try {
                            n.entryId = this.journals[getProperty(n, `flags.dsa5.initName`)].data._id
                        } catch (e) {
                            console.warn("Could not initialize Scene Notes" + e)
                        }
                    })
                }
                let createdEntries = await Scene.create(entries)
                for (let entry of createdEntries) {
                    this.scenes[entry.data.name] = entry;
                }
            }
            if (json.actors) {
                let head = await this.getFolderForType("Actor")
                let actor = game.packs.get(json.actors)
                let entries = await actor.getContent()
                for (let entry of entries) {
                    entry.data.folder = head._id
                }
                let createdEntries = await Actor.create(entries.map(x => x.data))
                for (let entry of createdEntries) {
                    this.actors[entry.data.name] = entry;
                }
            }
        })

        ui.notifications.notify(game.i18n.localize("initComplete"))
    }

    async dontInitialize() {
        game.settings.set(this.module, "initialized", true)
        ui.notifications.notify(game.i18n.localize("initSkipped"))
    }

    async getFolderForType(entityType) {
        let folderName = game.i18n.localize(`${this.module}.name`)
        let head = await game.folders.entities.find(x => x.name == folderName && x.type == entityType)
        if (!head) {
            head = await Folder.create({
                "name": folderName,
                "type": entityType,
                "sorting": "a",
                "color": "",
                "parent": null
            })
        }
        return head
    }
}