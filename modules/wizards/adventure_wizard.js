import { bindImgToCanvasDragStart } from "../hooks/imgTileDrop.js"
import { increaseFontSize } from "../hooks/journal.js"
import DSA5StatusEffects from "../status/status_effects.js"
import DSA5ChatAutoCompletion from "../system/chat_autocompletion.js"
import DSA5 from "../system/config-dsa5.js"
import { slist } from "../system/view_helper.js"
const { mergeObject, duplicate } = foundry.utils

export default class BookWizard extends Application {
    static wizard

    constructor(app) {
        super(app)
        this.adventures = []
        this.books = []
        this.rshs = []
        this.manuals = []
        this.fulltextsearch = true
    }

    static get defaultOptions() {
        const options = super.defaultOptions
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "description" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "largeDialog", "noscrollWizard", "bookWizardsheet"]),
            width: 800,
            height: 880,
            scrollY: [".pages-list .scrollable"],
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

        Hooks.on("renderJournalDirectory", (app, html) => {
            let div = $('<div class="header-actions action-buttons flexrow"></div>')
            let button = $(`<button id="openJournalBrowser"><i class="fa fa-book"></i>${game.i18n.localize("Book.Wizard")}</button>`)
            button.on('click', () => { BookWizard.wizard.render(true) })
            div.append(button)
            html.find(".header-actions:first-child").after(div)
        })
    } 

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "increaseFontSize",
            tooltip: "SHEET.increaseFontSize",
            icon: "fas fa-arrows-up-down",
            onclick: async () => increaseFontSize($(this._element).find('.chapter'))
        })

        buttons.unshift({
            label: "Library",
            class: "library",
            tooltip: "Book.home",
            icon: `fas fa-book`,
            onclick: async () => this._showBooks()
        })
        return buttons
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
        this.fulltextsearch = true
        this.searchString = undefined
        this.currentType = undefined
        this.pageTocs = undefined
        this.selectedSubChapter = undefined
        this.loadPage(this._element)
    }

    async toggleBookVisibility(id, type, toggle){
        const config = game.settings.get("dsa5", "expansionPermissions")
        config[id] = toggle
        await game.settings.set("dsa5", "expansionPermissions", config)

        let book = this[type].find(x => x.id == id)
        const json = await (await fetch(book.path)).json()
        const keys = ["actors","journal","scenes"]
        for(const key of keys){
            if(!json[key]) continue

            let pack = game.packs.get(json[key]);
            let visibility = toggle ? "OBSERVER" : "NONE"

            const ownership = { ownership: {
                PLAYER: visibility,
                TRUSTED: visibility
            }}

            await pack.configure(ownership)
        }
        this.render()
    }

    activateListeners(html) {
        super.activateListeners(html)

        html.on('click', '.toggleVisibility', async(ev) => {
            const id = ev.currentTarget.dataset.itemid
            const type = ev.currentTarget.dataset.type
            const toggle = $(ev.currentTarget).find('i').hasClass("fa-toggle-off")
            this.toggleBookVisibility(id, type, toggle)
        })

        html.on('click', '.showMapNote', ev => {
            game.journal.get(ev.currentTarget.dataset.entryid).panToNote()
        })

        html.on("search keyup", ".filterJournals", ev => {
            this.filterToc(ev.currentTarget.value)
        })

        html.on("click", ".heading-link", ev => this._onClickPageLink(ev))

        html.on('click', '.show-item', async(ev) => {
            //TODO maybe try to open imported character
            let itemId = ev.currentTarget.dataset.uuid
            const item = await fromUuid(itemId)
            item.sheet.render(true)
        })

        html.on('click', '.movePage', async(ev) => this.movePage(ev))

        html.on('click', '.loadBook', ev => {
            this.loadBook($(ev.currentTarget).text(), html, ev.currentTarget.dataset.type)
        })
        html.on('click', '.getChapter', ev => {
            this.selectedType = $(ev.currentTarget).closest('.toc').attr("data-type")
            this.selectedChapter = ev.currentTarget.dataset.id
            this.content = undefined
            this.pageTocs = undefined
            this.loadPage(html)
        })
        html.on('click', '.subChapter', async(ev) => {
            const name = $(ev.currentTarget).text()
            const jid = ev.currentTarget.dataset.jid
            if (jid) {
                await this.loadJournalById(jid)
            } else {
                $(this._element).find('.subChapter').removeClass('selected')
                $(this._element).find(`[data-id="${name}"]`).addClass("selected")
                await this.loadJournal(name)
            }

            this._saveScrollPositions(html)
            html.find('.toc').html(await this.getToc())
            this._restoreScrollPositions(html)

            if(this.searchString) this.filterToc(this.searchString)
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
            this.showSzene(ev.currentTarget.dataset.id, ev.currentTarget.dataset.mode)
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

        html.on('click', '.importBook', async() => this.importBook())

        bindImgToCanvasDragStart(html)

        slist(html, '.breadcrumbs', this.resaveBreadCrumbs)
    }

    async getPagy(chapter, journalId) {
        const journals = this.journals.filter(x => x.flags.dsa5.parent == chapter).sort((a, b) => a.flags.dsa5.sort > b.flags.dsa5.sort ? 1 : -1)
        const targetindex = journals.findIndex(x => x._id == journalId)
        return { journals, targetindex }
    }

    async movePage(ev) {
        const dir = ev.currentTarget.dataset.action
        let { journals, targetindex } = await this.getPagy(this.selectedChapter, this.selectedSubChapter)
        let flattenedChapters = []

        for(let chap of this.bookData.chapters){
            for(let sub of chap.content){
                flattenedChapters.push(sub.name)
            }
        }

        let curChapterIndex = flattenedChapters.findIndex(x => x == this.selectedChapter)
        this.bookData.chapters.findIndex(x => x.name == this.selectedChapter)

        if(dir == "next") targetindex++
        else targetindex--

        if(targetindex < 0) {
            this.selectedChapter = flattenedChapters[curChapterIndex - 1]
            if(!this.selectedChapter) return

            journals = (await this.getPagy(this.selectedChapter, undefined)).journals
            targetindex = 0
        } else if( targetindex >= journals.length) {
            this.selectedChapter = flattenedChapters[curChapterIndex + 1]
            if(!this.selectedChapter) return

            journals = (await this.getPagy(this.selectedChapter, undefined)).journals
            targetindex = 0
        }

        if(["prep", "foundryUsage"].includes(this.selectedChapter)) return

        let journal = journals[targetindex]

        if(journal) {
            await this.loadJournalById(journal.id)
        }

        const toc = await this.getToc()
        this._saveScrollPositions(this._element)
        this._element.find('.toc').html(toc)
        this._restoreScrollPositions(this._element)
    }

    async loadJournal(name) {
        await this.showJournal(this.journals.find(x => x.name == name && x.flags.dsa5.parent == this.selectedChapter ))
    }

    async loadJournalById(id) {
        await this.showJournal(this.journals.find(x => x.id == id))
    }

    async resaveBreadCrumbs(target) {
        const breadcrumbs = {}
        for (let elem of target.getElementsByTagName("div")) {
            breadcrumbs[elem.dataset.uuid] = elem.innerText
        }
        await game.settings.set("dsa5", `breadcrumbs_${game.world.id}`, JSON.stringify(breadcrumbs))
    }

    markFindings(html) {
        const container = html.closest('.tocCollapsing')
        container.find('.searchLines').remove()
        const findings = html.find('.searchMatch')

        if(findings.length == 0) return

        const markers = []
        const boundingRect = html.find("> div")[0].getBoundingClientRect()
        for(let finding of findings){
            const bounding = finding.getBoundingClientRect()
            markers.push(`<div class="marker" style="top:${(bounding.top - boundingRect.top)/boundingRect.height*100}%"></div>`)
            
        }
        const lines = $(`<div class="searchLines">${markers.join("")}</div>`)        
        container.append(lines)
    }

    async filterToc(val) {
        this.searchString = val
        if (val != undefined) {
            val = val.toLowerCase().trim()

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
                const content = await this.getToc()
                $(this._element).find('.toc').html(content).find(".filterJournals").trigger("focus")
            }
        }

        const journal = await this.getChapter()
        const chapter = $(this._element).find('.chapter')
        chapter.html(journal)
        this.markFindings(chapter)
    }

    showSearchResults(pageContent) {
        if(this.searchString) {
            TextEditor._replaceTextContent(TextEditor._getTextNodes(pageContent), new RegExp(this.searchString, "ig"), (match, options) => {
                return $(`<span class="searchMatch">${match[0]}</span>`)[0]
            })
        }
    }

    _onClickPageLink(ev) {
        const anchor = ev.currentTarget.closest("[data-anchor]")?.dataset.anchor;        
        if ( anchor ) {
          const element = this.element[0].querySelector(`.chapter [data-anchor="${anchor}"]`)
          if ( element ) {
            element.scrollIntoView({behavior: "smooth"});
            return;
          }
        }
        const page = this.element[0].querySelector(`.journalHeader`);
        page?.scrollIntoView({behavior: "smooth"});
    }

    async _renderHeadings(toc, shiftFirst = false) {
        const headings = Object.values(toc);
        
        if(shiftFirst) headings.shift();

        const minLevel = Math.min(...headings.map(node => node.level));

        return await renderTemplate("templates/journal/journal-page-toc.html", {
          headings: headings.reduce((arr, {text, level, slug, element}) => {
            if ( element ) element.dataset.anchor = slug;
            if ( level < minLevel + 2 ) {
                arr.push({text, slug, level: level - minLevel + 2});
                
            }
            return arr;
          }, [])
        });
        //tocNode.querySelectorAll(".heading-link").forEach(el => el.addEventListener("click", this._onClickPageLink.bind(this)));
    }

    async renderContent(journal) {
        this.content = journal.id
        let content = ""
        const pageTocs = []
        for(let page of journal.pages){
            const sheet = journal.sheet.getPageSheet(page.id)
            const data = await sheet.getData();
            const view = (await sheet._renderInner(data)).get();
            const pageName = page.name.replace(/ Text$/gi, "")
            const equalName = journal.name == pageName

            const pageToc = JournalEntryPage.implementation.buildTOC(view)
            pageTocs.push(await this._renderHeadings(pageToc, equalName))

            let pageContent = view[view.length -1]
            this.showSearchResults(pageContent)
            pageContent = $(pageContent).html()           

            if(page.type == "video") pageContent = `<div class="video-container">${pageContent}</div>`
            if(!equalName) pageContent = `<h2 data-anchor="${page.name.slugify()}">${pageName}</h2>${pageContent}`

            content += pageContent
        }

        this.pageTocs = pageTocs.join("")
        
        const pinIcon = this.findSceneNote(journal.getFlag("dsa5", "initId"))
        const enriched = await TextEditor.enrichHTML(content, {secrets: game.user.isGM, async: true})
        
        return `<div><h1 class="journalHeader" data-uuid="${journal.uuid}">${journal.name}<div class="jrnIcons">${pinIcon}<a class="pinJournal"><i class="fas fa-thumbtack"></i></a><a class="showJournal"><i class="fas fa-eye"></i></a></div></h1>${enriched}`
    }

    async showJournal(journal) {
        const chapter = $(this._element).find('.chapter')
        chapter.html(await this.renderContent(journal))

        this.selectedSubChapter = journal.id

        $(this._element).find('.subChapter').removeClass('selected')
        $(this._element).find(`[data-jid="${journal.id}"]`).addClass("selected")
        bindImgToCanvasDragStart(chapter)
        this.markFindings(chapter)
        chapter.find('.documentName-link, .entity-link, .content-link').on('click', ev => {
            const dataset = ev.currentTarget.dataset
            if (this.bookData && dataset.pack == this.bookData.journal) {
                //todo make this work for pages
                if(dataset.type != "JournalEntryPage") {
                    ev.stopPropagation()
                    this.loadJournalById(dataset.id)
                }

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
        if (game.user.isGM) new InitializerForm().render(this.bookData.moduleName, this.bookData.options)
    }

    async loadBook(id, html, type) {        
        this.selectedChapter = undefined
        this.selectedType = undefined
        this.content = undefined

        if (!type) type = this.currentType

        this.currentType = type
        this.book = this[type].find(x => x.id == id)
        await fetch(this.book.path).then(async r => r.json()).then(async json => {
            this.bookData = json
            let journal = game.packs.get(json.journal)
                //Need this to replace links
            await journal.getIndex()
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
            this.checkChapters(journal)
            this.loadPage(html)
        })
    }

    checkChapters(journal) {
        if(this.bookData.chapters) return

        this.bookData.isDynamic = true
        this.bookData.chapters = [
            {
                "name": game.i18n.localize(`${this.bookData.moduleName}.name`),
                "content": journal.folders.map(x => {
                    return {
                        "name": x.name,
                        "id": x.id
                    }
                })
            }
        ]
    }

    async prefillActors(chapter) {
        if (!chapter.actors) return []

        let result = []
        const head = await game.folders.contents.find(x => x.name == game.i18n.localize(`${this.bookData.moduleName}.name`) && x.type == "Actor" && x.folder == null)
        const folderids = head ? await game.folders.contents.filter(x => x.type == "Actor" && x.folder?.id == head.id).map(x => x.id) : undefined
        for (let k of chapter.actors) {
            let actor = folderids?.length ? game.actors.contents.find(x => x.name == k && folderids.includes(x.folder?.id)) : undefined
            let pack = undefined
            let id = actor?.id
            let uuid = actor?.uuid
            if (!actor) {
                actor = this.actors.find(x => x.name == k)
                pack = this.bookData.actors
                id = actor?._id
                uuid = actor ? `Compendium.${pack}.${id}` : undefined
            }
            result.push({
                name: k,
                actor,
                pack,
                id,
                uuid
            })
        }
        return result
    }

    async popJournal(uuid) {
        const entry = await fromUuid(uuid)
        entry.sheet.render(true)
    }

    async showSzene(name, mode = "activate") {
        let scene = game.scenes.contents.find(x => x.name == name)
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
                scene.update({ navigation: !scene.navigation })
                break
        }
    }

    async getChapter() {
        if (this.book) {
            if (this.content) {
                const journal = this.journals.find(x => x.id == this.content)
                return await this.renderContent(journal)
            }
            if (this.selectedChapter) {
                if (this.selectedChapter == "prep") {
                    let info = {
                        initDescr: game.i18n.format(`${this.bookData.options?.scope || this.bookData.moduleName}.importContent`, { defaultText: game.i18n.localize('importDefault') })
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
                    this.selectedSubChapter = subChapters[0].id
                    return await this.loadJournalById(subChapters[0].id)
                }

            }
            return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_cover.html', { book: this.book, bookData: this.bookData })
        } else {
            return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_intro.html', {
                rshs: this.filterBooks(this.rshs),
                rules: this.filterBooks(this.books),
                adventures: this.filterBooks(this.adventures),
                manuals: this.filterBooks(this.manuals),
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
        let jrns
        if(this.bookData.isDynamic) {
           jrns = this.journals.filter(x => x.folder.id == this.selectedChapter)
                .sort((a, b) => a.sort > b.sort ? 1 : -1)
        } else {
            jrns = this.journals.filter(x => x.flags.dsa5.parent == this.selectedChapter)
                .sort((a, b) => a.flags.dsa5.sort > b.flags.dsa5.sort ? 1 : -1)
        }

        return jrns.map(x => {
            const selected = this.selectedSubChapter == x.id
            return {name: x.name, id: x.id, selected, cssClass: selected ? "selected" : ""}
        })
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
                if(chapter) {
                    chapter.cssClass = "selected"
                    chapter.subChapters = this.getSubChapters()
                }
            }
            return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_toc.html', { 
                chapters, 
                searchString: this.searchString, 
                book: this.book,
                pageTocs: this.pageTocs,
                fulltextsearch: this.fulltextsearch ? "on" : "" 
            })
        } else {
            return '<div class="libraryImg"></div>'
        }

    }

    async loadPage(html) {
        const template = await this.getChapter()
        const toc = await this.getToc()

        this._saveScrollPositions(html)
        html.find('.toc').html(toc)
        const chapter = html.find('.chapter')
        chapter.html(template)
        this.markFindings(chapter)
        this._restoreScrollPositions(html)
    }

    async getData(options) {
        const data = await super.getData(options);
        const currentChapter = await this.getChapter()
        const toc = await this.getToc()
        const index = game.settings.get("dsa5", "journalFontSizeIndex")
        const fontSize = DSA5.journalFontSizes[index - 1] || 14;
        mergeObject(data, {
            adventure: this.bookData,
            currentChapter,
            breadcrumbs: this.renderBreadcrumbs(),
            toc,
            fontSize
        })
        return data
    }

    async pinJournal(uuid, name = undefined) {
        let breadcrumbs = this.readBreadCrumbs()
        if (!name) name = (await fromUuid(uuid))?.name || ""
        breadcrumbs[uuid] = name
        game.settings.set("dsa5", `breadcrumbs_${game.world.id}`, JSON.stringify(breadcrumbs))
        this.render(true)
    }

    unpinJournal(uuid) {
        let breadcrumbs = this.readBreadCrumbs()
        delete breadcrumbs[uuid]
        game.settings.set("dsa5", `breadcrumbs_${game.world.id}`, JSON.stringify(breadcrumbs))
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
            breadcrumbs = JSON.parse(game.settings.get("dsa5", `breadcrumbs_${game.world.id}`))
        } catch (e) {
            console.log("No Journalbrowser notes found")
        }
        return breadcrumbs
    }

    renderBreadcrumbs() {
        const breadcrumbs = this.readBreadCrumbs()
        const btns = Object.entries(breadcrumbs).map(x => `<div data-tooltip="${x[1]}" data-uuid="${x[0]}" class="openPin item">${x[1]}</div>`)

        if (btns.length > 0) return `<div id="breadcrumbs" class="breadcrumbs wrap row-section">${btns.join("")}</div>`

        return ""
    }

    moduleEnabled(id) {
        if(game.modules.get(id)) {
            return game.modules.get(id).active ? "fa-check" : "fa-dash"
        }
        return "fa-times"
    }
}

class InitializerForm extends FormApplication {
    render(mod, options) {
        new game.dsa5.apps.DSA5Initializer("DSA5 Module Initialization", game.i18n.format(`${options?.scope || mod}.importContent`, { defaultText: game.i18n.localize("importDefault") }), mod, game.i18n.lang, options).render(true)
    }
}

class JournalSearch {
    constructor(item) {
        const data = item.pages.find(x => true).text.content
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