const dict = {
    de: {
        treatWounds: "Wunden versorgen",
        treatPain: "Schmerzen lindern",
        description: `<b>Wunden versorgen</b>: Alle Ziele erhalten einen Bonus von QS (${qs}) auf die nächste Regeneration.</br><b>Schmerzen lindern</b>: Pro QS kann eine Stufe Schmerz bei allen Zielen gelindert werden.`
    },
    en: {
        treatWounds: "Treat Wounds",
        treatPain: "Treat Pain",
        description: `<b>Treat Wounds</b>: All targets receive a bonus of QS (${qs}) on the next regeneration.</br><b>Treat Pain</b>: For each QS, one level of pain can be treated on the targets.`
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
    }

    async _onTreatPain(event) {
        for(let target of Array.from(game.user.targets)) {
            if(!target.actor) continue

            const ef = {
                name: `${dict.treatPain} (${this.macroData.qs})`,
                icon: "icons/svg/aura.svg",
                changes: [{key: "system.resistances.effects", value: `inpain ${this.macroData.qs}`, mode: 0}],
                duration: {},
                flags: {
                    dsa5: {
                        value: null,
                        editable: true,
                        description: `${dict.treatPain} (${this.macroData.qs})`,
                        custom: true,
                    },
                },
            }
            await target.actor.addCondition(ef)
        }
        this.close()
    }

    async _onTreatWounds(event) {
        for(let target of Array.from(game.user.targets)) {
            if(!target.actor) continue

            await target.actor.update({ "system.status.regeneration.LePTemp": Math.max(this.macroData.qs, target.actor.system.status.regeneration.LePTemp)})
        }
        this.close()
    }


    async getData() {
        const data = super.getData();
        data.macroData = this.macroData
        data.lang = dict
        return data;
    }
}

new TreatWounds(actor, item, qs).render(true);