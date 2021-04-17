import DSA5_Utility from "./utility-dsa5.js"

class SearchDocument {
    constructor(item) {
        this.document = item
    }
    get name() {
        return this.document.name
    }
    get data() {
        let data = ''
        switch (this.itemType) {
            case 'JournalEntry':
                data = getProperty(this.document, "data.content")
                break
            default:
                data = getProperty(this.document, "data.data.description.value")
        }
        return $("<div>").html(data).text()
    }
    get id() {
        return this.document._id
    }
    get itemType() {
        switch (this.document.entity) {
            case 'Actor':
                return this.document.data.type
            case 'Item':
                return this.document.type
            default:
                return this.document.entity
        }
    }
    get options() {
        return this.document.options
    }
    hasPermission() {
        return this.document.visible
    }
    render() {
        this.document.sheet.render(true)
    }
    get compendium() {
        return this.document.compendium ? this.document.compendium.metadata.package : ""
    }
    get img() {
        switch (this.itemType) {
            case 'JournalEntry':
                return "systems/dsa5/icons/categories/DSA-Auge.webp"
            default:
                return this.document.img
        }
    }
}



export default class DSA5ItemLibrary extends Application {
    constructor(app) {
        super(app)
        this.journalBuild = false
        this.equipmentBuild = false
        this.zooBuild = false
        this.currentDetailFilter = {
            equipment: [],
            character: [],
            spell: [],
            journal: [],
            zoo: []
        }
        this.journalIndex = new FlexSearch({
            encode: "simple",
            tokenize: "reverse",
            cache: true,
            doc: {
                id: "id",
                field: [
                    "name",
                    "data"
                ],
            }
        });
        this.equipmentIndex = new FlexSearch({
            encode: "simple",
            tokenize: "reverse",
            cache: true,
            doc: {
                id: "id",
                field: [
                    "name",
                    "data",
                    "itemType"
                ],
            }
        });
        this.zooIndex = new FlexSearch({
            encode: "simple",
            tokenize: "reverse",
            cache: true,
            doc: {
                id: "id",
                field: [
                    "name",
                    "data",
                    "itemType"
                ],
            }
        });

        this.subfilters = {
            "equipment": {
                enabled: false,
                attrs: [
                    { name: "equipmentType.value", label: "equipmentType", value: "" }
                ]
            }
        }

        this.pages = {
            equipment: {},
            character: {},
            spell: {},
            journal: {},
            zoo: {}
        }

        this.filters = {
            equipment: {
                categories: {
                    "armor": false,
                    "ammunition": false,
                    "equipment": false,
                    "meleeweapon": false,
                    "rangeweapon": false,
                    "poison": false,
                    "disease": false,
                    "consumable": false
                },
                filterBy: {
                    search: ""
                }
            },
            character: {
                categories: {
                    "career": false,
                    "advantage": false,
                    "combatskill": false,
                    "culture": false,
                    "disadvantage": false,
                    "trait": false,
                    "skill": false,
                    "specialability": false,
                    "species": false
                },
                filterBy: {
                    search: ""
                }
            },
            spell: {
                categories: {
                    "blessing": false,
                    "ceremony": false,
                    "liturgy": false,
                    "magictrick": false,
                    "ritual": false,
                    "spell": false,
                    "spellextension": false
                },
                filterBy: {
                    search: ""
                }
            },
            journal: {
                categories: {},
                filterBy: {
                    search: ""
                }
            },
            zoo: {
                categories: {
                    "npc": false,
                    "character": false,
                    "creature": false
                },
                filterBy: {
                    search: ""
                }
            },

        }

    }

    getData() {
        let data = super.getData()
        data.categories = this.translateFilters()
        data.isGM = game.user.isGM
        data.items = this.items
        return data
    }

    translateFilters() {
        return {
            equipment: this.buildFilter(this.filters.equipment),
            character: this.buildFilter(this.filters.character),
            spell: this.buildFilter(this.filters.spell),
            zoo: this.buildFilter(this.filters.zoo),
            journal: this.buildFilter(this.filters.journal)
        }
    }

    buildFilter(elem) {
        let res = []
        Object.keys(elem.categories).forEach(function(key) {
            res.push({ label: game.i18n.localize(key), selected: elem.categories[key], key: key })
        })
        res = res.sort(function(a, b) {
            return a.label.localeCompare(b.label);
        });
        return res
    }

    static get defaultOptions() {
        const options = super.defaultOptions
        options.id = "DSA5ItemLibrary"
        options.classes.push("dsa5", "itemlibrary")
        options.height = 800
        options.width = 800
        options.resizable = true
        options.title = game.i18n.localize("ItemLibrary")
        options.template = "systems/dsa5/templates/system/itemlibrary.html"
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "equipment" }]
        return options
    }

    async getRandomItems(category, limit) {
        let filteredItems = []
        let index = this.equipmentIndex
        filteredItems.push(...index.search(category, { field: ["itemType"] }))
        return this.shuffle(filteredItems.filter(x => x.hasPermission)).slice(0, limit)
    }

    shuffle(array) {
        var currentIndex = array.length,
            temporaryValue, randomIndex;

        while (0 !== currentIndex) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }

        return array;
    }

    async filterStuff(category, index, page) {
        let search = this.filters[category].filterBy.search

        let fields = {
            field: ["name", "data"],
            limit: 60,
            page: page || true
        }
        let filteredItems = []

        let oneFilterSelected = false
        for (let filter in this.filters[category].categories) {
            if (this.filters[category].categories[filter]) {
                let result
                if (search == "") {
                    result = index.search(filter, { field: ["itemType"], limit: 60, page: page || true })
                } else {
                    let query = duplicate(fields)
                    mergeObject(query, { where: { itemType: filter } })
                    result = index.search(search, query)
                }
                this.pages[category].next = result.next
                filteredItems.push(...result.result)
            }
            oneFilterSelected = this.filters[category].categories[filter] || oneFilterSelected
        }

        if (!oneFilterSelected) {
            filteredItems = index.search(search, fields)
            this.pages[category].next = filteredItems.next
        }

        filteredItems = filteredItems.result ? filteredItems.result : filteredItems
        filteredItems = filteredItems.filter(x => x.hasPermission).sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : -1)
        this.setBGImage(filteredItems, category)

        return filteredItems
    }

    setBGImage(filterdItems, category) {
        $(this._element).find(`.${category} .libcontainer`)[`${filterdItems.length > 0 ? "remove" : "add"}Class`]("libraryImg")
    }

    renderResult(html, filteredItems, { index, itemType }, isPaged) {
        let resultField = html.find('.searchResult .item-list')
        renderTemplate('systems/dsa5/templates/system/libraryItem.html', { items: filteredItems }).then(innerhtml => {
            if (!isPaged) resultField.empty()

            innerhtml = $(innerhtml)
            innerhtml.each(function() {
                const li = $(this)
                li.attr("draggable", true).on("dragstart", event => {
                    let item = index.find($(li).attr("data-item-id"))
                    event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({
                        type: itemType,
                        pack: item.options.compendium ? `${item.options.compendium.metadata.package}.${item.options.compendium.metadata.name}` : "",
                        id: item.id
                    }))
                })
            })
            resultField.append(innerhtml)
        });
    }

    async filterItems(html, category, page) {
        const index = this.selectIndex(category)
        const filteredItems = await this.filterStuff(category, index.index, page)
        this.renderResult(html, filteredItems, index, page)
        return filteredItems;
    }

    selectIndex(category) {
        let itemType = "Item"
        let index = this.equipmentIndex
        switch (category) {
            case "zoo":
                itemType = "Actor"
                index = this.zooIndex
                break
            case "journal":
                itemType = "JournalEntry"
                index = this.journalIndex
                break
        }
        return { index, itemType }
    }

    async _render(force = false, options = {}) {
        await super._render(force, options)
        this.buildEquipmentIndex()
    }

    async buildEquipmentIndex() {
        await this._createIndex("equipment", "Item", game.items)
    }

    async _createIndex(category, entity, worldStuff) {
        if (this[`${category}Build`]) return

        //await this[`${category}Index`].clear()
        const target = $(this._element).find(`*[data-tab="${category}"]`)
        this.showLoading(target, category)
        const packs = game.packs.filter(p => p.entity == entity && (game.user.isGM || !p.private))
        return Promise.all(packs.map(p => p.getContent())).then(indexes => {
            let items = worldStuff.map(x => new SearchDocument(x))
            indexes.forEach((index, idx) => {
                items.push(...index.map(x => new SearchDocument(x)))
            })
            this[`${category}Index`].add(items)
            this[`${category}Build`] = true
            this.hideLoading(target, category)
        })
    }

    buildDetailFilter(html, category, subcategory, isChecked) {
        //TODO uff
        if (this.subfilters[subcategory]) {
            this.subfilters[subcategory].enabled = isChecked
            if (isChecked) {
                let filters = this.subfilters[subcategory].attrs.map(x => { return `<input type=\"text\" class=\"subfilterItem\" name=\"${x.name}\" title=\"${game.i18n.localize(x.label)}\" placeholder=\"${game.i18n.localize(x.label)}\"/>` })
                let newElem = $(`<div class=\"groupbox detail${subcategory}\" data-subcategory=\"${subcategory}\"><span>${game.i18n.localize(subcategory)}</span>${filters.join('')}</div>`)
                console.log(newElem)
                html.find(`.${category} .detailBox`).append(newElem)
            } else {
                html.find(`.detail${subcategory}`).remove()
            }
        }
    }


    activateListeners(html) {
        super.activateListeners(html)

        html.on("click", ".filter", ev => {
            const tab = $(ev.currentTarget).closest('.tab')
            const category = tab.attr("data-tab")
            const subcategory = $(ev.currentTarget).attr("data-category")
            const isChecked = $(ev.currentTarget).is(":checked")
            this.filters[category].categories[subcategory] = isChecked
            this.filterItems(tab, category);
            this.buildDetailFilter(html, category, subcategory, isChecked)
        })

        html.on("click", ".item-name", ev => {
            this.getItemFromHTML(ev).render()
        })

        html.on("mousedown", ".item-name", ev => {
            if (ev.button == 2) DSA5_Utility.showArtwork(this.getItemFromHTML(ev))
        })

        html.on("keyup", ".filterBy-search", ev => {
            const tab = $(ev.currentTarget).closest('.tab')
            const category = tab.attr("data-tab")
            this.filters[category].filterBy.search = $(ev.currentTarget).val();
            this.filterItems(tab, category);
        })
        html.on("keyup", ".subfilterItem", ev => {
            const tab = $(ev.currentTarget).closest('.tab')
            const category = tab.attr("data-tab")
            const subcategory = $(ev.currentTarget).closest('.groupbox').attr("data-subcategory")
            this.subfilters[subcategory].attrs.find(x => x.name == $(ev.currentTarget).attr("name"))["value"] = $(ev.currentTarget).val()
            this.filterItems(tab, category);
        })
        html.find(`*[data-tab="journal"]`).click(x => {
            this._createIndex("journal", "JournalEntry", game.journal)
        })
        html.find(`*[data-tab="zoo"]`).click(x => {
            this._createIndex("zoo", "Actor", game.actors)
        })
        html.find('nav .item').click(ev => {
            const tab = $(ev.currentTarget).attr("data-tab")
            html.find(`.subfilters .tab`).hide()
            html.find(`.subfilters [data-tab="${tab}"]`).show()
        })

        html.find('.showDetails').click(ev => {
            const tab = $(ev.currentTarget).attr("data-btn")
            $(ev.currentTarget).find('i').toggleClass("fa-caret-left fa-caret-right")
            html.find(`.${tab} .detailBox`).toggleClass("dsahidden")
        })

        const source = this
        $(this._element).find('.window-content').on('scroll.infinit', debounce(function(ev) {
                const log = $(ev.target);
                const pct = (log.scrollTop() + log.innerHeight()) >= log[0].scrollHeight - 100;
                const category = html.find('.tabs .item.active').attr("data-tab")
                if (pct && source.pages[category].next) {
                    const tab = html.find('.tab.active')
                    source.filterItems.call(source, tab, category, source.pages[category].next)
                }
            },
            100));
    }

    getItemFromHTML(ev) {
        const itemId = $(ev.currentTarget).parents(".browser-item").attr("data-item-id")
        const type = $(ev.currentTarget).closest('.tab').attr("data-tab")
        switch (type) {
            case "zoo":
                return this.zooIndex.find(itemId)
            case "journal":
                return this.journalIndex.find(itemId)
            default:
                return this.equipmentIndex.find(itemId)
        }
    }

    showLoading(html, category) {
        this.setBGImage([1], category)
        const loading = $(`<div class="loader"><i class="fa fa-4x fa-spinner fa-spin"></i>${game.i18n.localize('buildingIndex')}</div>`)
        loading.appendTo(html.find('.searchResult'))
    }

    hideLoading(html, category) {
        this.setBGImage([], category)
        html.find('.loader').remove()
    }
}