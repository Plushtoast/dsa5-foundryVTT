import { bindImgToCanvasDragStart } from "../hooks/imgTileDrop.js"
import DSA5StatusEffects from "../status/status_effects.js"
import DSA5ChatAutoCompletion from "../system/chat_autocompletion.js"
import DSA5ChatListeners from "../system/chat_listeners.js"
import DSA5_Utility from "../system/utility-dsa5.js"
import { slist } from "../system/view_helper.js"

export default class BookWizard extends Application {
    static wizard

    constructor(app) {
        super(app)
        this.adventures = []
        this.books = []
        this.rshs = []
    }

    static get defaultOptions() {
        const options = super.defaultOptions
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "description" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "largeDialog", "noscrollWizard", "bookWizardsheet"]),
            width: 800,
            height: 880,
            template: 'systems/dsa5/templates/wizard/adventure/adventure_wizard.html',
            title: game.i18n.localize("Book.Wizard"),
            resizable: true,
            dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
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
        this.journalIndex = null
        this.fulltextsearch = false
        this.currentType = undefined
        this.loadPage(this._element)
    }

    activateListeners(html) {
        super.activateListeners(html)

        html.on('click', '.toggleVisibility', async(ev) => {
            const id = ev.currentTarget.dataset.itemid
            const config = game.settings.get("dsa5", "expansionPermissions")
            config[id] = $(ev.currentTarget).find('i').hasClass("fa-toggle-off")
            await game.settings.set("dsa5", "expansionPermissions", config)
            this.render()
        })

        html.on('click', '.showMapNote', ev => {
            game.journal.get(ev.currentTarget.dataset.entryid).panToNote()
        })

        html.on("search keyup", ".filterJournals", ev => {
            this.filterToc($(ev.currentTarget).val())
        })

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
            const jid = $(ev.currentTarget).attr("data-jid")
            if (jid) {
                this.loadJournalById(jid)
            } else {
                $(this._element).find('.subChapter').removeClass('selected')
                $(this._element).find(`[data-id="${name}"]`).addClass("selected")
                this.loadJournal(name)
            }
        })

        DSA5ChatAutoCompletion.bindRollCommands(html)

        html.find('.tocCollapser').click((ev) => {
            $(ev.currentTarget).find('i').toggleClass("fa-chevron-right fa-chevron-left")
            html.find(".tocCollapsing").toggleClass('expanded')
        })
        html.on("mousedown", '.openPin', async(ev) => {
            const uuid = ev.currentTarget.dataset.uuid

            if (ev.button == 0) this.showJournal(await fromUuid(uuid))
            else if (ev.button == 2) this.unpinJournal(uuid)
        })

        html.on('click', '.showJournal', ev => {
            this.popJournal($(ev.currentTarget).closest("h1").attr("data-uuid"))
        })
        html.on('click', '.pinJournal', ev => {
            const parent = $(ev.currentTarget).closest("h1")
            const id = parent.attr("data-uuid")
            const name = parent.text()
            this.pinJournal(id, name)
        })
        html.on('click', '.activateScene', ev => {
            this.showSzene($(ev.currentTarget).attr("data-id"), $(ev.currentTarget).attr("data-mode"))
        })
        html.on('click', '.fulltextsearch', (ev) => {
            this.fulltextsearch = !this.fulltextsearch
            $(ev.currentTarget).toggleClass("on")

            this.filterToc(html.find('.filterJournals').val())
        })

        html.on('mousedown', ".chapter img", ev => {
            let name = this.book.id
            if (ev.button == 2) game.dsa5.apps.DSA5_Utility.showArtwork({ name: name, uuid: "", img: $(ev.currentTarget).attr("src") })
        })

        DSA5StatusEffects.bindButtons(html)
        html.on('click', '.chat-condition', ev => {
            DSA5ChatListeners.postStatus($(ev.currentTarget).attr("data-id"))
        })

        html.on('click', '.importBook', async() => this.importBook())
        
        bindImgToCanvasDragStart(html)

        slist(html, '.breadcrumbs', this.resaveBreadCrumbs)
        this.heightFix()
    }

    heightFix() {
        const h = $(this._element).find('.breadcrumbs').height()
        $(this._element).find('.col.seventy.scrollable').css({ "margin-bottom": `${h}px` })
    }

    async loadJournal(name) {
        this.showJournal(this.journals.find(x => x.name == name && x.data.flags.dsa5.parent == this.selectedChapter ))
    }
    async loadJournalById(id) {
        this.showJournal(this.journals.find(x => x.id == id))
    }

    async resaveBreadCrumbs(target) {
        const breadcrumbs = {}
        for (let elem of target.getElementsByTagName("div")) {
            breadcrumbs[elem.dataset.uuid] = elem.innerText
        }
        await game.settings.set("dsa5", "breadcrumbs", JSON.stringify(breadcrumbs))
    }


    async filterToc(val) {
        if (val != undefined) {
            val = val.toLowerCase().trim()
            let content
            if (val != "") {
                let result = []
                if (this.fulltextsearch) {
                    if (!this.journalIndex) {
                        this.journalIndex = new FlexSearch({
                            encode: "simple",
                            tokenize: "reverse",
                            cache: true,
                            doc: {
                                id: "id",
                                field: [
                                    "name",
                                    "data"
                                ]
                            }
                        });
                        await this.journalIndex.add(this.journals.map(x => new JournalSearch(x)))

                    }
                    result = await this.journalIndex.search(val)
                } else {
                    result = this.journals.filter(x => {
                        return x.name.toLowerCase().trim().indexOf(val) != -1
                    })
                }
                result = result.map(x => `<li class="fas fa-caret-right"><a data-jid="${x.id}" class="subChapter">${x.name}</a></li>`)

                $(this._element).find('.tocContent').html(`<ul>${result.join("\n")}</ul>`)
            } else {
                content = await this.getToc()
                $(this._element).find('.adventureWizard > .row-section > .toc').html(content).find(".filterJournals").focus()
            }

        }
    }

    tryShowImportedActor(ev) {

    }

    showJournal(journal) {
        let content = journal.data.content
        if (!content) content = `<img src="${journal.data.img}"/>`

        const pinIcon = this.findSceneNote(journal.getFlag("dsa5", "initId"))

        this.content = `<div><h1 class="journalHeader" data-uuid="${journal.uuid}">${journal.name}<div class="jrnIcons">${pinIcon}<a class="pinJournal"><i class="fas fa-thumbtack"></i></a><a class="showJournal"><i class="fas fa-eye"></i></a></div></h1>${TextEditor.enrichHTML(content)}`
        const chapter = $(this._element).find('.chapter')
        chapter.html(this.content)
        bindImgToCanvasDragStart(chapter)
        chapter.find('.documentName-link, .entity-link').click(ev => {
            const elem = $(ev.currentTarget)
            if (this.bookData && elem.attr("data-pack") == this.bookData.journal) {
                ev.stopPropagation()
                this.loadJournalById(elem.attr("data-id"))
            }
        })
    }

    findSceneNote(entryId) {
        if (entryId) {
            const importedJournalEntry = game.journal.find(x => x.getFlag("dsa5", "initId") == entryId)
            if (importedJournalEntry && importedJournalEntry.sceneNote) return `<a class="showMapNote" data-entryId="${importedJournalEntry.id}"><i class="fas fa-map-pin"></i></a>`
        }
        return ""
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

    async prefillActors(chapter) {
        if (!chapter.actors) return []

        let result = []
        const head = await game.folders.contents.find(x => x.name == game.i18n.localize(`${this.bookData.moduleName}.name`) && x.type == "Actor" && x.data.parent == null)
        const folder = head ? await game.folders.contents.find(x => x.name == chapter.name && x.type == "Actor" && x.data.parent == head.id) : undefined
        for (let k of chapter.actors) {
            let actor = folder ? game.actors.contents.find(x => x.name == k && x.data.folder == folder.id) : undefined
            let pack = undefined
            let id = actor ? actor.id : undefined
            if (!actor) {
                actor = this.actors.find(x => x.name == k)
                pack = this.bookData.actors
                id = actor ? actor._id : undefined
            }
            result.push({
                name: k,
                actor,
                pack,
                id
            })
        }
        return result
    }

    async popJournal(uuid) {
        const entry = await fromUuid(uuid)
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
                    return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_chapter.html', { chapter, subChapters: this.getSubChapters(), actors: await this.prefillActors(chapter) })
                } else {
                    return await this.loadJournal(subChapters[0].name)
                }

            }
            return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_cover.html', { book: this.book, bookData: this.bookData })
        } else {
            return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_intro.html', {
                rshs: this.filterBooks(this.rshs),
                rules: this.filterBooks(this.books),
                adventures: this.filterBooks(this.adventures),
                isGM: game.user.isGM
            })
        }
    }

    filterBooks(books) {
        const bookPermissions = game.settings.get("dsa5", "expansionPermissions")
        for (const book of books) {
            if (bookPermissions[book.id] != undefined) book.visible = bookPermissions[book.id]
        }
        return game.user.isGM ? books : books.filter(x => x.visible == undefined || x.visible).sort((a, b) => {
            return a.id.localeCompare(b.id)
        })
    }

    getSubChapters() {
        return this.journals.filter(x => x.data.flags.dsa5.parent == this.selectedChapter)
        .sort((a, b) => a.data.flags.dsa5.sort > b.data.flags.dsa5.sort ? 1 : -1)
        .map(x => {return {name: x.name, id: x.id}})
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
            return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_toc.html', { chapters, book: this.book, fulltextsearch: this.fulltextsearch ? "on" : "" })
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
        const currentChapter = await this.getChapter()
        const toc = await this.getToc()
        mergeObject(data, {
            adventure: this.bookData,
            currentChapter,
            breadcrumbs: this.renderBreadcrumbs(),
            toc
        })
        return data
    }

    async pinJournal(uuid, name) {
        let breadcrumbs = this.readBreadCrumbs()
        if (!name) name = (await fromUuid(uuid)).name
        breadcrumbs[uuid] = name
        game.settings.set("dsa5", "breadcrumbs", JSON.stringify(breadcrumbs))
        this.render(true)
    }

    unpinJournal(uuid) {
        let breadcrumbs = this.readBreadCrumbs()
        delete breadcrumbs[uuid]
        game.settings.set("dsa5", "breadcrumbs", JSON.stringify(breadcrumbs))
        this.render(true)
    }

    _canDragDrop(selector) {
        return true
    }

    async _onDrop(event) {
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData('text/plain'));
        } catch (err) {
            return false;
        }
        if (data.type == "JournalEntry") {
            this.pinJournal(data.pack ? `Compendium.${data.pack}.${data.id}` : `JournalEntry.${data.id}`)
        }
    }

    readBreadCrumbs() {
        let breadcrumbs = {}
        try {
            breadcrumbs = JSON.parse(game.settings.get("dsa5", "breadcrumbs"))
        } catch (e) {
            console.log("No Journalbrowser notes found")
        }
        return breadcrumbs
    }

    renderBreadcrumbs() {
        const breadcrumbs = this.readBreadCrumbs()
        const btns = Object.entries(breadcrumbs).map(x => `<div title="${x[1]}" data-uuid="${x[0]}" class="openPin item">${x[1]}</div>`)

        if (btns.length > 0) return `<div id"breadcrumbs" class="breadcrumbs wrap row-section">${btns.join("")}</div>`

        return ""
    }

    moduleEnabled(id) {
        return DSA5_Utility.moduleEnabled(id)
    }
}

class InitializerForm extends FormApplication {
    render(mod) {
        new game.dsa5.apps.DSA5Initializer("DSA5 Module Initialization", game.i18n.format(`${mod}.importContent`, { defaultText: game.i18n.localize("importDefault") }), mod, game.i18n.lang).render(true)
    }
}

class JournalSearch {
    constructor(item) {
        let data = getProperty(item, "data.content")
        this.document = {
            name: item.name,
            data: $("<div>").html(data).text(),
            id: item.id,
        }
    }
    get name() {
        return this.document.name
    }
    get data() {
        return this.document.data
    }
    get id() {
        return this.document.id
    }
}