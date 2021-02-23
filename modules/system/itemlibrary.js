export default class DSA5ItemLibrary extends Application {
    constructor(app) {
        super(app)
        this.items = []
        this.filters = {
            categories: {
                "advantage": false,
                "armor": false,
                "ammunition": false,
                "blessing": false,
                "career": false,
                "ceremony": false,
                "combatskill": false,
                "culture": false,
                "disadvantage": false,
                "equipment": false,
                "liturgy": false,
                "meleeweapon": false,
                "magictrick": false,
                "rangeweapon": false,
                "ritual": false,
                "trait": false,
                "skill": false,
                "spell": false,
                "specialability": false,
                "poison": false,
                "disease": false,
                "consumable": false,
                "spellextension": false,
                "species": false
            },
            filterBy: {
                search: ""
            }
        }
        this.subfilters = {
            "spellextension": ["source"]
        }
    }

    getData() {
        let data = super.getData()
        data.categories = this.translateFilters()
        data.items = this.items
        return data
    }

    translateFilters() {
        let res = []
        const filters = this.filters
        Object.keys(filters.categories).forEach(function(key) {
            res.push({ label: game.i18n.localize(key), selected: filters.categories[key], key: key })
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
        options.width = 600
        options.resizable = true
        options.title = game.i18n.localize("ItemLibrary")
        options.template = "systems/dsa5/templates/system/itemlibrary.html"
        return options
    }

    /*filterBySubcategory(i, search) {
        let subfilter = this.subfilters[i.type]
        if (subfilter) {
            console.log(i)
            console.log(subfilter)
            for (let k of subfilter) {
                if (i.data.data[k] && i.data.data[k].toLowerCase().indexOf(search) != -1)
                    return true
            }
        }
        return false
    }*/

    async filterItems(html) {
        let items = this.items
        let filteredItems = [];
        let filterCategories = []
        for (let filter in this.filters.categories) {
            if (this.filters.categories[filter])
                filterCategories.push(filter)
        }
        let search = this.filters.filterBy.search.toLowerCase()
        if (filterCategories.length > 0) {
            filteredItems = filteredItems.concat(items.filter(i => {
                return filterCategories.indexOf(i.type) != -1 &&
                    (
                        search == "" ||
                        i.name.toLowerCase().indexOf(search) != -1 ||
                        //this.filterBySubcategory(i, search) ||
                        (i.data.data.description == undefined ? false :
                            (i.data.data.description.value == undefined ? false :
                                i.data.data.description.value.toLowerCase().indexOf(search) != -1))
                    )
            }))
        }

        let resultField = html.find('.searchResult .item-list')
        renderTemplate('systems/dsa5/templates/system/libraryItem.html', { items: filteredItems }).then(innerhtml => {

            resultField.empty().append(innerhtml)
            resultField.find(".browser-item").each((i, li) => {
                let item = this.items.find(i => i._id == $(li).attr("data-item-id"))

                li.setAttribute("draggable", true);
                li.addEventListener("dragstart", event => {
                    event.dataTransfer.setData("text/plain", JSON.stringify({
                        type: "Item",
                        pack: item.options.compendium ? `${item.options.compendium.metadata.package}.${item.options.compendium.metadata.name}` : "",
                        id: item._id
                    }))

                })
            })
        });
        return filteredItems;
    }

    async _render(force = false, options = {}) {
        this._loadCompendiae()
        this._saveScrollPos()
        await super._render(force, options)
        this._setScrollPos()
    }

    async _loadCompendiae() {
        this.items = [];
        this.filterId = 0;
        for (let p of game.packs) {
            if (p.metadata.entity == "Item" && (game.user.isGM || !p.private)) {
                await p.getContent().then(content => {
                    this._understandItems(content)
                })
            }
        }
        this._understandItems(game.items.entities.filter(i => i.permission > 1));
        this.items = this.items.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : -1);
        this.filterItems(this._element)
    }

    _understandItems(itemList) {
        this.items.push(...itemList)
    }

    activateListeners(html) {
        super.activateListeners(html)

        html.on("click", ".filter", ev => {
            this.filters.categories[$(ev.currentTarget).attr("data-category")] = $(ev.currentTarget).is(":checked");
            this.filterItems(html);
        })

        html.on("click", ".item-name", ev => {
            let itemId = $(ev.currentTarget).parents(".browser-item").attr("data-item-id")
            this.items.find(i => i._id == itemId).sheet.render(true);
        })

        html.on("keyup", ".filterBy-search", ev => {
            this.filters.filterBy.search = $(ev.currentTarget).val();
            this.filterItems(html);
        })

    }

    _saveScrollPos() {
        if (this.form === null)
            return;

        const html = this._element;
        if (!html) return
        this.scrollPos = [];
        let lists = $(html.find(".save-scroll"));
        for (let list of lists) {
            this.scrollPos.push($(list).scrollTop());
        }
    }
    _setScrollPos() {
        if (this.scrollPos) {
            const html = this._element;
            let lists = $(html.find(".save-scroll"));
            for (let i = 0; i < lists.length; i++) {
                $(lists[i]).scrollTop(this.scrollPos[i]);
            }
        }
    }
}