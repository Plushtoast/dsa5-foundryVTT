import DSA5StatusEffects from "../status/status_effects.js"
import DSA5ChatAutoCompletion from "../system/chat_autocompletion.js"
import DSA5ChatListeners from "../system/chat_listeners.js"

export default class BookWizard extends Application {
    static wizard

    constructor(app) {
        super(app)
        this.adventures = []
        this.books = []
    }

    static get defaultOptions() {
        const options = super.defaultOptions
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "description" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "largeDialog"]),
            width: 800,
            height: 880,
            template: 'systems/dsa5/templates/wizard/adventure/adventure_wizard.html',
            title: game.i18n.localize("Book.Wizard"),
            resizable: true
        });
        return options
    }

    static initHook() {
        BookWizard.wizard = new BookWizard()

        game.dsa5.apps.journalBrowser = BookWizard.wizard

        Hooks.on("renderSidebarTab", (app, html) => {
            if (app.options.id == "journal") {
                let div = $('<div class="header-actions action-buttons flexrow"></div>')
                let button = $(`<button><i class="fa fa-book"></i>${game.i18n.localize("Book.Wizard")}</button>`)
                button.click(() => { BookWizard.wizard.render(true) })
                div.append(button)
                html.find(".header-actions:first-child").after(div)
            }
        })
    }


    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "library",
            icon: `fas fa-book`,
            onclick: async ev => this._showBooks(ev)
        })
        return buttons
    }

    async _render(force = false, options = {}) {
        await super._render(force, options)

        $(this._element).find('.library').attr("title", game.i18n.localize("Book.home"))
    }

    _showBooks() {
        this.book = null
        this.bookData = null
        this.selectedChapter = null
        this.selectedType = null
        this.journals = null
        this.actors = null
        this.scenes = null
        this.content = undefined
        this.currentType = undefined
        this.loadPage(this._element)
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.on('click', '.loadBook', ev => {
            this.selectedChapter = undefined
            this.selectedType = undefined
            this.content = undefined
            this.loadBook($(ev.currentTarget).text(), html, $(ev.currentTarget).attr("data-type"))
        })
        html.on('click', '.getChapter', ev => {
            this.selectedType = $(ev.currentTarget).closest('.toc').attr("data-type")
            this.selectedChapter = $(ev.currentTarget).attr("data-id")
            this.content = undefined
            this.loadPage(html)
        })
        html.on('click', '.subChapter', ev => {
            const name = $(ev.currentTarget).text()
            $(this._element).find('.subChapter').removeClass('selected')
            $(this._element).find(`[data-id="${name}"]`).addClass("selected")
            this.loadJournal(name)
        })
        html.on('click', '.request-roll', ev => {
            DSA5ChatAutoCompletion.showRQMessage($(ev.currentTarget).attr("data-name"), Number($(ev.currentTarget).attr("data-modifier")) || 0)
            ev.stopPropagation()
            return false
        })
        html.on('click', '.request-GC', ev => {
            DSA5ChatAutoCompletion.showGCMessage($(ev.currentTarget).attr("data-name"), Number($(ev.currentTarget).attr("data-modifier")) || 0)
            ev.stopPropagation()
            return false
        })

        html.on('click', '.showJournal', ev => {
            this.popJournal($(ev.currentTarget).attr("data-id"))
        })
        html.on('click', '.activateScene', ev => {
            this.showSzene($(ev.currentTarget).attr("data-id"), $(ev.currentTarget).attr("data-mode"))
        })

        html.on('mousedown', ".chapter img", ev => {
            let name = this.book.id
            if (ev.button == 2) game.dsa5.apps.DSA5_Utility.showArtwork({ name: name, uuid: "", img: $(ev.currentTarget).attr("src") })
        })

        DSA5StatusEffects.bindButtons(html)
        html.on('click', '.chat-condition', ev => {
            DSA5ChatListeners.postStatus($(ev.currentTarget).attr("data-id"))
        })

        html.on('click', '.showJournal', ev => {
            this.journals.find(x => x.id == $(ev.currentTarget).attr("data-id")).render(true)
        })

        html.on('click', '.importBook', async() => {
            this.importBook()
        })
    }

    async loadJournal(name) {
        this.showJournal(this.journals.find(x => { return x.name == name && x.data.flags.dsa5.parent == this.selectedChapter }))
    }
    async loadJournalById(id) {
        this.showJournal(this.journals.find(x => { return x.id == id }))
    }

    showJournal(journal) {
        let content = journal.data.content
        if (!content) content = `<img src="${journal.data.img}"/>`

        this.content = `<div><h1 class="journalHeader">${journal.name}<a class="showJournal" data-id="${journal.id}"><i class="fas fa-eye"></i></a></h1>${TextEditor.enrichHTML(content)}`
        const chapter = $(this._element).find('.chapter')
        chapter.html(this.content)
        chapter.find('.documentName-link, .entity-link').click(ev => {
            const elem = $(ev.currentTarget)
            if (this.bookData && elem.attr("data-pack") == this.bookData.journal) {
                ev.stopPropagation()
                this.loadJournalById(elem.attr("data-id"))
            }
        })
    }

    async importBook() {
        if (game.user.isGM) new InitializerForm().render(this.bookData.moduleName)
    }

    async loadBook(id, html, type) {
        if (!type) type = this.currentType
        this.currentType = type
        this.book = this[type].find(x => x.id == id)
        await fetch(this.book.path).then(async r => r.json()).then(async json => {
            this.bookData = json
            let journal = game.packs.get(json.journal)
                //Need this to replace links
            let index = await journal.getIndex()
            let entries = await journal.getDocuments()
            this.journals = entries
            if (json.actors) {
                journal = game.packs.get(json.actors)
                entries = await journal.getIndex()
                this.actors = entries
            }
            if (json.scenes) {
                journal = game.packs.get(json.scenes)
                entries = await journal.getIndex()
                this.scenes = entries
            }
            this.loadPage(html)
        })

    }

    prefillActors(chapter) {
        if (!chapter.actors) return []

        let result = []

        for (let k of chapter.actors) {
            let actor = game.actors.contents.find(x => x.name == k)
            let pack = undefined
            if (!actor) {
                actor = this.actors.find(x => x.name == k)
                pack = this.bookData.actors
            }
            result.push({
                name: k,
                actor,
                pack
            })
        }
        return result
    }

    async popJournal(id) {
        let entry = this.journals.find(x => x.id == id)
        entry.sheet.render(true)
    }

    async showSzene(name, mode = "activate") {
        let scene = game.scenes.contents.find(x => x.data.name == name)
        if (!scene)
            return ui.notifications.error(game.i18n.localize("DSAError.sceneNotInitialized"))

        switch (mode) {
            case "activate":
                scene.activate()
                break
            case "view":
                scene.view()
                break
            case "toggle":
                scene.update({ navigation: !scene.data.navigation })
                break
        }

    }

    async getChapter() {

        if (this.book) {
            if (this.content) {
                return this.content
            }
            if (this.selectedChapter) {
                if (this.selectedChapter == "prep") {
                    let info = {
                        initDescr: game.i18n.format(`${this.bookData.moduleName}.importContent`, { defaultText: game.i18n.localize('importDefault') })
                    }

                    let modules = this.bookData.modules
                    for (let k of modules) k.enabled = this.moduleEnabled(k.id)

                    return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_preparation.html', { modules, info })
                } else if (this.selectedChapter == "foundryUsage") {
                    return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_foundry.html')
                }


                let chapter = this.bookData.chapters.find(x => x.name == this.selectedType).content.find(x => x.id == this.selectedChapter)

                const subChapters = this.getSubChapters()
                if (chapter.scenes || chapter.actors || subChapters.length == 0) {
                    return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_chapter.html', { chapter, subChapters: this.getSubChapters(), actors: this.prefillActors(chapter) })
                } else {
                    return await this.loadJournal(subChapters[0])
                }

            }
            return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_cover.html', { book: this.book, bookData: this.bookData })
        } else {
            return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_intro.html', { rules: this.books.sort((a, b) => { return a.id.localeCompare(b.id) }), adventures: game.user.isGM ? this.adventures : this.adventures.filter(x => x.visible).sort((a, b) => { return a.id.localeCompare(b.id) }) })
        }
    }

    getSubChapters() {
        return this.journals.filter(x => x.data.flags.dsa5.parent == this.selectedChapter).sort((a, b) => a.data.flags.dsa5.sort > b.data.flags.dsa5.sort ? 1 : -1).map(x => x.name)
    }

    async getToc() {
        let chapters = []
        if (this.book) {
            chapters.push(...duplicate(this.bookData.chapters))
            if (this.selectedChapter) {
                let chapter
                for (let k of chapters) {
                    chapter = k.content.find(x => x.id == this.selectedChapter)
                    if (chapter) break
                }
                chapter.cssClass = "selected"
                chapter.subChapters = this.getSubChapters()
            }
            return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_toc.html', { chapters, book: this.book })
        } else {
            return '<div class="libraryImg"></div>'
        }

    }

    async loadPage(html) {
        const template = await this.getChapter()
        const toc = await this.getToc()
        html.find('.toc').html(toc)
        html.find('.chapter').html(template)
    }

    async getData(options) {
        const data = await super.getData(options);
        const template = await this.getChapter()
        const toc = await this.getToc()
        data.adventure = this.bookData
        data.currentChapter = template
        data.toc = toc
        return data
    }

    moduleEnabled(id) {
        return game.modules.get(id) && game.modules.get(id).active
    }
}

class InitializerForm extends FormApplication {
    render(mod) {
        new game.dsa5.apps.DSA5Initializer("DSA5 Module Initialization", game.i18n.format(`${mod}.importContent`, { defaultText: game.i18n.localize("importDefault") }), mod, game.i18n.lang).render(true)
    }
}