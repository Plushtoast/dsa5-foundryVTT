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

                ],
            }
        });


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
                categories: {},
                filterBy: {
                    search: ""
                }
            },

        }
        this.subfilters = {
            "spellextension": ["source"]
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

    async filterStuff(category, index) {
        let search = this.filters[category].filterBy.search

        let fields = {
            field: ["name", "data"],
            limit: 60
        }
        let filteredItems = []

        for (let filter in this.filters[category].categories) {
            if (this.filters[category].categories[filter]) {
                let query = duplicate(fields)
                if (search == "") {
                    filteredItems.push(...index.search(filter, { field: ["itemType"], limit: 60 }))
                } else {
                    mergeObject(query, { where: { itemType: filter } })
                    filteredItems.push(...index.search(search, query))
                }
            }
        }

        if (Object.keys(this.filters[category].categories).length == 0)
            filteredItems = index.search(search, fields)

        return filteredItems.filter(x => x.hasPermission).sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : -1)
    }

    async filterItems(html, category) {
        let itemType = "Item"
        let filteredItems = []
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
        filteredItems = await this.filterStuff(category, index)
        let resultField = html.find('.searchResult .item-list')
        renderTemplate('systems/dsa5/templates/system/libraryItem.html', { items: filteredItems }).then(innerhtml => {

            resultField.empty().append(innerhtml)
            resultField.find(".browser-item").each((i, li) => {
                let item = index.find($(li).attr("data-item-id"))
                li.setAttribute("draggable", true);
                li.addEventListener("dragstart", event => {
                    event.dataTransfer.setData("text/plain", JSON.stringify({
                        type: itemType,
                        pack: item.options.compendium ? `${item.options.compendium.metadata.package}.${item.options.compendium.metadata.name}` : "",
                        id: item.id
                    }))

                })
            })
        });
        return filteredItems;
    }

    async _render(force = false, options = {}) {
        await super._render(force, options)
        this._createIndex("equipment", "Item", game.items)
    }

    async _createIndex(category, entity, worldStuff) {
        if (this[`${category}Build`]) return

        //await this[`${category}Index`].clear()
        const target = $(this._element).find(`*[data-tab="${category}"]`)
        this.showLoading(target)
        const packs = game.packs.filter(p => p.entity == entity && (game.user.isGM || !p.private))
        Promise.all(packs.map(p => p.getContent())).then(indexes => {
            let items = worldStuff.map(x => new SearchDocument(x))
            indexes.forEach((index, idx) => {
                items.push(...index.map(x => new SearchDocument(x)))
            })
            this[`${category}Index`].add(items)
            this[`${category}Build`] = true
            this.hideLoading(target)
        })
    }


    activateListeners(html) {
        super.activateListeners(html)

        html.on("click", ".filter", ev => {
            let tab = $(ev.currentTarget).closest('.tab')
            let category = tab.attr("data-tab")
            this.filters[category].categories[$(ev.currentTarget).attr("data-category")] = $(ev.currentTarget).is(":checked");
            this.filterItems(tab, category);
        })

        html.on("click", ".item-name", ev => {
            let itemId = $(ev.currentTarget).parents(".browser-item").attr("data-item-id")
            let type = $(ev.currentTarget).closest('.tab').attr("data-tab")
            switch (type) {
                case "zoo":
                    this.zooIndex.find(itemId).render()
                    break
                case "journal":
                    this.journalIndex.find(itemId).render()
                    break
                default:
                    this.equipmentIndex.find(itemId).render()
            }

        })

        html.on("keyup", ".filterBy-search", ev => {
            let tab = $(ev.currentTarget).closest('.tab')
            let category = tab.attr("data-tab")
            this.filters[category].filterBy.search = $(ev.currentTarget).val();
            this.filterItems(tab, category);
        })
        html.find(`*[data-tab="journal"]`).click(x => {
            this._createIndex("journal", "JournalEntry", game.journal)
        })
        html.find(`*[data-tab="zoo"]`).click(x => {
            this._createIndex("zoo", "Actor", game.actors)
        })
    }


    showLoading(html) {
        const loading = $(`<div class="loader"><i class="fa fa-4x fa-spinner fa-spin"></i>${game.i18n.localize('buildingIndex')}</div>`)
        loading.appendTo(html.find('.searchResult'))
    }

    hideLoading(html) {
        html.find('.loader').remove()
    }
}