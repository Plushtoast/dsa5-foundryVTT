export default class DSA5Initializer extends Dialog {
    constructor(title, content, module, journal) {
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
        this.folders = {}
        this.journal = journal
        this.journals = {}
    }

    async initialize() {
        game.settings.set(this.module, "initialized", true)

        await fetch(`modules/${this.module}/initialization.json`).then(async r => r.json()).then(async json => {
            let head = game.folders.entities.find(x => x.name == json[0].name)
            if (head) {
                this.folders[head.data.name] = head
                json.shift()
            }

            let createdFolders = await Folder.create(json)
            for (let folder of createdFolders)
                this.folders[folder.data.name] = folder;

            for (let folder in this.folders) {
                let parent = this.folders[folder].getFlag("dsa5", "parent")
                if (parent) {
                    let parentId = this.folders[parent].data._id
                    this.folders[folder].update({ parent: parentId })
                }
            }

        })

        let journal = game.packs.get(this.journal)
        let entries = await journal.getContent()
        for (let entry of entries) {
            let folder = entry.getFlag("dsa5", "parent")
            if (folder)
                entry.data.folder = this.folders[folder].data._id
        }
        let createdEntries = await JournalEntry.create(entries)
        for (let entry of createdEntries) {
            this.journals[entry.data.name] = entry;
        }


        ui.notifications.notify(game.i18n.localize("initComplete"))
    }
    async dontInitialize() {
        game.settings.set(this.module, "initialized", true)
        ui.notifications.notify(game.i18n.localize("initSkipped"))
    }



}