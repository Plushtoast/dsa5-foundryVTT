import Actordsa5 from "../actor/actor-dsa5.js";

export default class ShapeshiftWizard extends Application {

    constructor(app) {
        super(app)
        this.updating = false
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = game.i18n.localize("Shapeshift.title")
        options.template = 'systems/dsa5/templates/wizard/shapeshift-wizard.html'
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "description" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "largeDialog"]),
            width: 770,
            height: 740,
        });
        options.resizable = true
        return options;
    }

    async setShapeshift(source, target) {
        this.source = source
        this.target = duplicate(target)
    }

    getData() {
        let data = super.getData()
        mergeObject(data, {
            title: game.i18n.localize("Shapeshift.title"),
            description: game.i18n.format("Shapeshift.description", { source: this.source.name, target: this.target.name }),
            source: duplicate(this.source),
            target: this.target,
            characteristics_mental: ["mu", "kl", "in", "ch"],
            characteristics_physical: ["ff", "ge", "ko", "kk"],
            status: [{
                label: "wounds",
                selected: true
            }, {
                label: "karmaenergy",
                selected: false
            }, {
                label: "astralenergy",
                selected: false
            }],
            secondaryAttributes: [{
                label: "toughness",
                selected: false
            }, {
                label: "soulpower",
                selected: true
            }]

        })
        return data
    }

    async shapeshit() {
        let parent = $(this._element)
        parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")
        this.target.name = `${this.target.name} - ${this.source.name}`
        let actor = await Actordsa5.create(this.target, {})
        let update = {}
        for (let k of parent.find('input:checked')) {
            if ($(k).val() == "source") {
                let path = `data.${$(k).attr("name")}`
                let attr = path.split('.').reduce((o, i) => o[i], this.source)
                if ($(k).attr("class") == "characteristic") {
                    update[`${$(k).attr("name")}.initial`] = attr.initial + attr.advances
                } else if ($(k).attr("class") == "status") {
                    update[`${$(k).attr("name")}.initial`] = attr.max - attr.gearmodifier
                    update[`${$(k).attr("name")}.value`] = attr.value
                } else if ($(k).attr("class") == "secondary") {
                    update[`${$(k).attr("name")}.value`] = attr.value
                }
            }
        }
        await actor.update(update)

        if (parent.find("#takeAdvantages").is(":checked")) {
            let existing = this.target.items.filter(x => ["advantage", "disadvantage"].includes(x.type)).map(x => x.name)
            let newVantages = this.source.data.items.filter(x => ["advantage", "disadvantage"].includes(x.type) && !existing.includes(x.name)).map(x => duplicate(x))
            await actor.createEmbeddedEntity("OwnedItem", newVantages)
        }

        ui.notifications.notify(game.i18n.localize("Shapeshift.done"))
        this.close()
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('button.ok').click(ev => {
            if (!this.updating) {
                this.updating = true
                this.shapeshit()
            }

        })
        html.find('button.cancel').click(ev => {
            this.close()
        })

    }
}