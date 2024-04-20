const dict = {
    de: {
        treatWounds: "Wunden versorgen",
        treatPain: "Schmerzen lindern",
        description: `<b>Wunden versorgen</b>: Alle Ziele erhalten einen Bonus von <b>QS (${qs})</b> auf die nächste Regeneration (wenn schon ein Wert eingetragen ist, wird der höhere verwendet).</br><b>Schmerzen lindern</b>: Pro QS kann eine Stufe Schmerz bei allen Zielen gelindert werden.`
    },
    en: {
        treatWounds: "Treat Wounds",
        treatPain: "Treat Pain",
        description: `<b>Treat Wounds</b>: All targets receive a bonus of <b>QS (${qs})</b> on the next regeneration (the higher one will be kept, if there is already an entry).</br><b>Treat Pain</b>: For each QS, one level of pain can be treated on the targets.`
    }
}[game.i18n.lang == "de" ? "de" : "en"]

class TreatWounds extends Application {
    constructor(actor, source, qs) {
        super();
        this.macroData = {
            actor: actor,
            source: source,
            qs: qs,
            item
        }
    }
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.template = "systems/dsa5/templates/macros/treatWounds.html";
        options.width = 500;
        options.height = "auto";
        options.title = item.name;
        options.classes = ["treat-wounds"];
        options.resizable = false;
        return options;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.treatWounds').click(this._onTreatWounds.bind(this));
        html.find('.treatPain').click(this._onTreatPain.bind(this));
        html.find('.content-link').click(ev => this.openUuid(ev))
    }

    async openUuid(ev) {
        const uuid = ev.currentTarget.dataset.uuid
        const item = game.items.get(uuid)
        if(item) {
            item.sheet.render(true)
        }
    }

    updateTargets(html) {
        const targets = Array.from(game.user.targets)
        this.targets = targets.map(x => x.actor)
        html.find('.targets').html(this.buildAnchors(targets))
    }

    async _onTreatPain(event) {
        for(let actor of this.targets) {
            if(!actor) continue

            const ef = {
                name: `${dict.treatPain} (${this.macroData.qs})`,
                img: "icons/svg/aura.svg",
                changes: [{key: "system.resistances.effects", value: `inpain ${this.macroData.qs}`, mode: 0}],
                duration: {},
                flags: {
                    dsa5: {
                        description: `${dict.treatPain} (${this.macroData.qs})`
                    },
                },
            }
            await actor.addCondition(ef)
        }
        this.close()
    }

    async _onTreatWounds(event) {
        for(let actor of this.targets) {
            if(!actor) continue

            await actor.update({ "system.status.regeneration.LePTemp": Math.max(this.macroData.qs, actor.system.status.regeneration.LePTemp)})
        }
        this.close()
    }

    buildAnchors(targets) {
        const res = []
        for(const target of targets) {
            res.push(target.toAnchor().outerHTML)
        }
        return res.join(", ")
    }

    async getData() {
        const data = super.getData();
        this.targets = [actor]
        data.macroData = this.macroData
        data.source = this.buildAnchors([args.sourceActor])
        data.lang = dict
        data.targets = this.buildAnchors(this.targets)
        return data
    }
}

new TreatWounds(actor, item, qs).render(true);