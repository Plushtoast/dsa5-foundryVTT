//import Actordsa5 from "system/dsa5/modules/actor/actor-dsa5.js";

// let shapeshift = new ShapeshiftWizard()
//await shapeshift.setShapeshift(item, this.actor)
//shapeshift.render(true)

export default class ShapeshiftWizard extends Application {

    constructor(app) {
        super(app)
        this.updating = false

        Hooks.on("deleteActorActiveEffect", (actor, effect) => {
            if (effect.flags.dsa5 && effect.flags.core && effect.flags.core.statusId == "shapeshift") {
                ShapeshiftWizard.restoreShape(actor, effect)
                return false
            }
        })
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

    static getFXFilter(back = false, newImg) {
        return [{
            filterType: "polymorph",
            filterId: `polymorphToNewForm${back}`,
            type: 6,
            padding: 70,
            magnify: 1,
            imagePath: newImg,
            animated: {
                progress: {
                    active: true,
                    animType: "halfCosOscillation",
                    val1: 0,
                    val2: 100,
                    loops: 1,
                    loopDuration: 1000
                }
            },
            autoDisable: false,
            autoDestroy: false
        }]
    }

    static async startAnimation(target, morph, token, back, img) {
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

        if (game.modules.get("tokenmagic") && game.modules.get("tokenmagic").active) {
            let filter = ShapeshiftWizard.getFXFilter(back, img)
            token.TMFXhasFilterId(filter.filterId)
            TokenMagic.addUpdateFilters(target, filter)
            await delay(1100)
            morph()
            await delay(500)
            token.TMFXdeleteFilters(filter.filterId)
        } else {
            morph()
        }
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

    shapeshiftEffect() {
        return {
            label: game.i18n.localize("CONDITION.shapeshift"),
            icon: "icons/svg/pawprint.svg",

            flags: {
                dsa5: {
                    originalActor: this.source.data._id,
                    value: null,
                    editable: true,
                    noEffect: true,
                    description: game.i18n.localize("CONDITIONDESCRIPTION.shapeshift"),
                    custom: true,
                    custom: true
                }
            },
            id: "shapeshift"
        }
    }

    async shapeshift() {

        if (!game.user.isGM) {
            return ui.notifications.error(game.i18n.localize("DSAError.onlyGMcanShapeshift"))
        }

        let parent = $(this._element)

        await this.source.addCondition(this.shapeshiftEffect())
        parent.find("button.ok i").toggleClass("fa-check fa-spinner fa-spin")
        let sourceData = duplicate(this.source)

        this.target.name = `${sourceData.name} - ${this.target.name}`


        for (let k of parent.find('input:checked')) {
            if ($(k).val() == "source") {
                let attr = getProperty(this.source, `data.${$(k).attr("name")}`)

                if ($(k).attr("class") == "characteristic") {
                    this.target[`${$(k).attr("name")}.initial`] = attr.initial + attr.advances
                } else if ($(k).attr("class") == "status") {
                    this.target[`${$(k).attr("name")}.initial`] = attr.max - attr.gearmodifier
                    this.target[`${$(k).attr("name")}.value`] = attr.value
                } else if ($(k).attr("class") == "secondary") {
                    this.target[`${$(k).attr("name")}.value`] = attr.value
                }
            }
        }

        this.target.effects = this.target.effects.concat(sourceData.effects)
        this.target.permission = sourceData.permission
        this.target.folder = sourceData.folder
        this.target.flags = sourceData.flags

        this.target.token.name = sourceData.name

        this.target.token.actorLink = sourceData.token.actorLink
        this.target.data.status.fatePoints.current = sourceData.data.status.fatePoints.current
        this.target.data.status.fatePoints.value = sourceData.data.status.fatePoints.value
            //this.target.data.status.size = sourceData

        game.dsa5.apps.DSA5_Utility.calcTokenSize(this.target, this.target.token)

        const tokenConfig = ["displayName", "vision", "actorLink", "disposition", "displayBars", "bar1", "bar2"];
        if (parent.find("#keepVision").is(":checked")) {
            tokenConfig.push(...['dimSight', 'brightSight', 'dimLight', 'brightLight', 'vision', 'sightAngle']);
        }
        for (let c of tokenConfig) {
            this.target.token[c] = sourceData.token[c];
        }

        let filters = []
        if (parent.find("#takeAdvantages").is(":checked")) filters.push(...["advantage", "disadvantage"])
        if (parent.find("#takeSpecAbs").is(":checked")) filters.push("specialability")
        if (parent.find("#takeSpells").is(":checked")) filters.push(...["spell", "ritual", "magictrick"])
        if (parent.find("#takeLiturgies").is(":checked")) filters.push(...["liturgy", "ceremony", "blessing"])

        if (parent.find("#takeSkills").is(":checked")) {
            filters.push(...["skill", "combatskill"])
            this.target.items = this.target.items.filter(x => !["combatskill", "skill"].includes(x.type))
        }

        let existing = this.target.items.filter(x => filters.includes(x.type)).map(x => x.name)
        let newItems = sourceData.items.filter(x => filters.includes(x.type) && !existing.includes(x.name)).map(x => duplicate(x))

        this.target.items.push(...newItems)

        if (this.source.isToken) {
            let func = x => {
                const tokenData = this.target.token
                tokenData.actorData = this.target
                delete tokenData.actorData.token
                this.closeWizard()
                this.source.token.update(tokenData)
            }

            return ShapeshiftWizard.startAnimation(this.source.token, func, this.source.token, false, this.target.token.img)
        }

        delete this.target.token.actorId
        await this.source.sheet.close()
        let actor = await game.dsa5.entities.Actordsa5.create(this.target, { renderSheet: true })

        const tokens = this.source.getActiveTokens(true)

        if (canvas.scene) {
            for (let token of tokens) {
                const newTokenData = duplicate(this.target.token)
                if (!token.data.actorLink) newTokenData.actorData = actor.data
                newTokenData._id = token.data._id
                newTokenData.actorId = actor.id

                let func = x => {
                    canvas.scene.updateEmbeddedEntity("Token", newTokenData)
                }

                ShapeshiftWizard.startAnimation(token, func, token, false, newTokenData.img)
            }
        }

        ui.notifications.notify(game.i18n.localize("Shapeshift.done"))

        //if (canvas.scene) {
        //   canvas.scene.updateEmbeddedEntity("Token", updates)
        // }
        this.closeWizard()
    }

    closeWizard() {
        this.close()
        this.updating = false
    }

    static async restoreShape(actor, shapeshift) {
        this.updating = true
        if (!actor.owner) {
            ui.notifications.error(game.i18n.localize("DSAError.onlyGMcanShapeshift"))
            return this.closeWizard()
        }

        const original = await game.actors.get(shapeshift.flags.dsa5.originalActor)
        if (!original) return this.closeWizard()

        if (actor.isToken) {
            let func = x => {
                const prototypeTokenData = duplicate(original.data.token)

                prototypeTokenData.actorData = duplicate(original);
                game.dsa5.apps.DSA5_Utility.calcTokenSize(prototypeTokenData.actorData, prototypeTokenData)
                this.updating = false
                actor.token.update(prototypeTokenData);
            }

            return ShapeshiftWizard.startAnimation(actor.token, func, actor.token, true, original.data.token.img)
        }
        if (shapeshift.flags.dsa5.originalActor == actor._id) return this.closeWizard()

        original.removeCondition({ id: "shapeshift" })


        if (canvas.ready) {
            const tokens = actor.getActiveTokens(true);

            for (let token of tokens) {
                const tokenData = duplicate(original.data.token);
                tokenData._id = token.id;
                tokenData.actorId = original.id;
                let func = async(x) => {
                    await canvas.scene.updateEmbeddedEntity("Token", tokenData);
                }
                ShapeshiftWizard.startAnimation(token, func, token, true, original.data.token.img)
            }

        }
        const isRendered = actor.sheet.rendered;
        if (game.user.isGM) await actor.delete();
        original.sheet.render(isRendered);
        this.updating = false
        return original;
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('button.ok').click(ev => {
            if (!this.updating) {
                this.updating = true
                this.shapeshift()
            }
        })
        html.find('button.cancel').click(ev => {
            this.close()
        })
    }
}