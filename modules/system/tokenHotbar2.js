import OnUseEffect from "./onUseEffects.js";

export default class TokenHotbar2 extends Application {
    static registerTokenHotbar() {
        if (!game.dsa5.apps.tokenHotbar) game.dsa5.apps.tokenHotbar = new TokenHotbar2()
    }

    constructor(options) {
        super(options);

        this.combatSkills = ["selfControl", "featOfStrength", "bodyControl", "perception"].map(x => game.i18n.localize(`LocalizedIDs.${x}`))
        this.defaultSkills = [game.i18n.localize("LocalizedIDs.perception")]

        Hooks.on("controlToken", (elem, controlTaken) => {
            this.updateDSA5Hotbar()
        })
        
        Hooks.on("updateActor", (actor, updates) => {
            TokenHotbar2.hookUpdate(actor.id)     
        });
    
        Hooks.on("updateToken", (scene, token, updates) => {
            if (token._id == getProperty(game.dsa5.apps.tokenHotbar, "actor.token.id"))
                this.updateDSA5Hotbar()        
        });
    
        Hooks.on("updateOwnedItem", (source, item) => {
            TokenHotbar2.hookUpdate(source.data.id )       
        });
    
        Hooks.on("createOwnedItem", (source, item) => {
            TokenHotbar2.hookUpdate(source.data.id )   
        });
    
        Hooks.on("deleteOwnedItem", (source, item) => {
            TokenHotbar2.hookUpdate(source.data.id )   
        });
    
        Hooks.on("updateItem", (source, item) => {
            const id = getProperty(source, "parent.id")
            if(id) TokenHotbar2.hookUpdate(id) 
        });
    
        Hooks.on("createItem", (source, item) => {
            const id = getProperty(source, "parent.id")
            if(id) TokenHotbar2.hookUpdate(id)       
        });
    
        Hooks.on("deleteItem", (source, item) => {
            const id = getProperty(source, "parent.id")
            if(id) TokenHotbar2.hookUpdate(id)       
        });
    }

    static hookUpdate(changeId){
        if (changeId == getProperty(game.dsa5.apps.tokenHotbar, "actor.id"))
            game.dsa5.apps.tokenHotbar.updateDSA5Hotbar()   
    }

    resetPosition() {
        const hotbarPosition = $('#hotbar').first().position()
        const itemWidth = game.settings.get("dsa5", "tokenhotbarSize")
        this.position.left = hotbarPosition.left + 8
        this.position.top = hotbarPosition.top - itemWidth - 25
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        const hotbarPosition = $('#hotbar').first().position()
        const itemWidth = game.settings.get("dsa5", "tokenhotbarSize")
        const position = game.settings.get("dsa5", "tokenhotbarPosition")

        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "tokenQuickHot"]),
            itemWidth,
            resizable: false,
            height: itemWidth + 45,
            zIndex: 61,
            left: hotbarPosition.left + 8,
            top: hotbarPosition.top - itemWidth - 25,
            template: "systems/dsa5/templates/status/tokenHotbar.html"
        });
        mergeObject(options, position)
        return options;
    }

    async _onWheelResize(ev) {
        let newVal = game.settings.get("dsa5", "tokenhotbarSize")
        if (ev.originalEvent.deltaY > 0) {
            newVal = Math.min(100, newVal + 5)
        } else {
            newVal = Math.max(15, newVal - 5)
        }
        await game.settings.set("dsa5", "tokenhotbarSize", newVal)
        await this.render(true)
    }

    async _cycleLayout(ev) {
        if (ev.button == 2) {
            let newVal = game.settings.get("dsa5", "tokenhotbarLayout") + 1
            if (newVal == 4) newVal = 0
            await game.settings.set("dsa5", "tokenhotbarLayout", newVal)
            await this.render(true)
        }
    }

    activateListeners(html) {
        super.activateListeners(html);
        const container = html.find(".dragHandler");
        new Draggable(this, html, container[0], this.options.resizable);

        container.on('wheel', async(ev) => {
            ev.stopPropagation()
            ev.preventDefault()
            await this._onWheelResize(ev)
            return false
        })

        container.on('mousedown', async(ev) => {
            await this._cycleLayout(ev)
        })

        html.on('mousedown', 'li', async(ev) => {
            ev.stopPropagation()
            await this.executeQuickButton(ev)
            return false
        })
        html.on('mouseenter', 'li', ev => {
            const li = $(ev.currentTarget)
            let tooltip = li.find(".tooltip");
            if (tooltip) tooltip.remove();
            tooltip = document.createElement("SPAN");
            tooltip.classList.add("tooltip");
            tooltip.textContent = li.attr("data-name")
            li.append($(tooltip));
            if (li.hasClass("primary")) {
                html.find(`.secondary[data-category="${li.attr("data-category")}"]`).addClass("shown")
            }
        })
        html.on('mouseenter', '.subbuttons', ev => {
            $(ev.currentTarget).closest('li').find('>.tooltip').remove()
        })
        html.on('mouseleave', 'li', ev => {
            const li = $(ev.currentTarget)
            let tooltip = li.find(".tooltip");
            if (tooltip) tooltip.remove()
            if (li.hasClass("primary")) {
                html.find(`.secondary[data-category="${li.attr("data-category")}"]`).removeClass("shown")
            }
        })
        html.on('mouseleave', '.tokenQuickHot', ev => {
            $(ev.currentTarget).find('.secondary').removeClass('shown')
        })

    }

    async executeQuickButton(ev) {
        const actor = canvas.tokens.controlled[0].actor
        const tokenId = canvas.tokens.controlled[0].id
        const id = ev.currentTarget.dataset.id
        const subFunction = ev.currentTarget.dataset.subfunction
        switch (subFunction) {
            case "addEffect":
                AddEffectDialog.showDialog()
                break
            case "effect":
                const effect = actor.effects.get(id)
                const isSystemEffect = effect.getFlag("core", "statusId")
                if (ev.button == 0) {
                    if (isSystemEffect) await actor.addCondition(isSystemEffect, 1, false, false)
                    else effect.sheet.render(true)
                } else if (ev.button == 2) {
                    if (isSystemEffect) await actor.removeCondition(isSystemEffect, 1, false)
                    else await actor.sheet._deleteActiveEffect(id)
                }
                await this.render(true)
                break
            case "onUse":
                let item = actor.items.get(id)
                const onUse = new OnUseEffect(item)
                onUse.executeOnUseEffect()
                break
            default:
                if ("attackWeaponless" == id) {
                    actor.setupWeaponless("attack", {}, tokenId).then(setupData => {
                        actor.basicTest(setupData)
                    });
                } else {
                    let result = actor.items.get(id)
                    if (result) {
                        switch (result.type) {
                            case "meleeweapon":
                            case "rangeweapon":
                            case "trait":
                                actor.setupWeapon(result, "attack", {}, tokenId).then(setupData => { actor.basicTest(setupData) });
                                break
                            case "liturgy":
                            case "spell":
                                actor.setupSpell(result.data, {}, tokenId).then(setupData => { actor.basicTest(setupData) });
                                break
                            case "skill":
                                actor.setupSkill(result.data, {}, tokenId).then(setupData => { actor.basicTest(setupData) })
                                break
                            case "consumable":
                                new Dialog({
                                    title: game.i18n.localize("SHEET.ConsumeItem") + ": " + result.name,
                                    content: game.i18n.localize("SHEET.ConsumeItem") + ": " + result.name,
                                    default: 'yes',
                                    buttons: {
                                        Yes: {
                                            icon: '<i class="fa fa-check"></i>',
                                            label: game.i18n.localize("yes"),
                                            callback: async() => {
                                                await result.setupEffect(null, {}, tokenId)
                                                await this.updateDSA5Hotbar()
                                            }
                                        },
                                        cancel: {
                                            icon: '<i class="fas fa-times"></i>',
                                            label: game.i18n.localize("cancel"),
                                        }
                                    }
                                }).render(true)
                                break
                        }

                    }
                }
        }
    }

    subWidth(items, itemWidth) {
        return `style="width:${Math.ceil(items.length / 3) * itemWidth}px"`
    }

    async getData() {
        const data = await super.getData()
        const actor = this.actor
        const items = {
            attacks: [],
            spells: [],
            default: [],
            skills: []
        }
        let consumable
        let onUse
        const consumables = []
        const onUsages = []
        let effects = []
        const direction = game.settings.get("dsa5", "tokenhotbarLayout")
        const vertical = direction % 2
        const itemWidth = TokenHotbar2.defaultOptions.itemWidth
        if (actor) {

            let moreSpells = []
            effects = (await actor.actorEffects()).map(x => { return { name: x.data.label, id: x.id, icon: x.data.icon, cssClass: "effect", abbrev: `${x.data.label[0]} ${x.getFlag("dsa5","value") || ""}`, subfunction: "effect" } })
            if (game.combat) {
                items.attacks.push({
                    name: game.i18n.localize("attackWeaponless"),
                    id: "attackWeaponless",
                    icon: "systems/dsa5/icons/categories/attack_weaponless.webp"
                })

                const attacktypes = ["meleeweapon", "rangeweapon"]
                const traitTypes = ["meleeAttack", "rangeAttack"]
                const spellTypes = ["liturgy", "spell"]

                for (const x of actor.items) {
                    if ((attacktypes.includes(x.type) && x.data.data.worn.value == true) || (x.type == "trait" && traitTypes.includes(x.data.data.traitType.value))) {
                        items.attacks.push({ name: x.name, id: x.id, icon: x.img, cssClass: "", abbrev: x.name[0] })
                    } else if (spellTypes.includes(x.type)) {
                        if (x.data.data.effectFormula.value) items.spells.push({ name: x.name, id: x.id, icon: x.img, cssClass: "spell", abbrev: x.name[0] })
                        else moreSpells.push({ name: x.name, id: x.id, icon: x.img, cssClass: "spell", abbrev: x.name[0] })
                    } else if (["skill"].includes(x.type) && this.combatSkills.includes(x.name)) {
                        items.default.push({ name: `${x.name} (${x.data.data.talentValue.value})`, id: x.id, icon: x.img, cssClass: "skill", abbrev: x.name[0] })
                    } else if (x.type == "consumable") {
                        consumables.push({ name: x.name, id: x.id, icon: x.img, cssClass: "consumable", abbrev: x.data.data.quantity.value })
                    }

                    if (x.getFlag("dsa5", "onUseEffect")) {
                        onUsages.push({ name: x.name, id: x.id, icon: x.img, cssClass: "onUse", abbrev: x.name[0], subfunction: "onUse" })
                    }
                }
                consumable = consumables.pop()
            } else {
                let descendingSkills = []
                for (const x of actor.items) {
                    if (["skill"].includes(x.type) && this.defaultSkills.includes(x.name)) {
                        items.default.push({ name: `${x.name} (${x.data.data.talentValue.value})`, id: x.id, icon: x.img, cssClass: "skill", abbrev: x.name[0] })
                    } else if (["skill"].includes(x.type) && !this.defaultSkills.includes(x.name) && x.data.data.talentValue.value > 0) {
                        descendingSkills.push({ name: `${x.name} (${x.data.data.talentValue.value})`, id: x.id, icon: x.img, cssClass: "skill", abbrev: x.name[0], tw: x.data.data.talentValue.value })
                    }

                    if (x.getFlag("dsa5", "onUseEffect")) {
                        onUsages.push({ name: x.name, id: x.id, icon: x.img, cssClass: "onUse", abbrev: x.name[0], subfunction: "onUse" })
                    }
                }
                items.skills.push(...descendingSkills.sort((a, b) => { return b.tw - a.tw }).slice(0, 10))
            }

            onUse = onUsages.pop()

            if (items.spells.length == 0 && moreSpells.length > 0) {
                items.spells.push(moreSpells.pop())
            }
            if (items.spells.length > 0 && moreSpells.length > 0) {
                items.spells[0].more = moreSpells.sort((a, b) => { return a.name.localeCompare(b.name) })
                items.spells[0].subwidth = this.subWidth(moreSpells, itemWidth)
            }

            if (consumable) {
                if (consumables.length > 0) {
                    consumable.more = consumables
                    consumable.subwidth = this.subWidth(consumables, itemWidth)
                }
                items.consumables = [consumable]
            }

            if (onUse) {
                if (onUsages.length > 0) {
                    onUse.more = onUsages
                    onUse.subwidth = this.subWidth(onUsages, itemWidth)
                }
                items.onUsages = [onUse]
            }
        }

        if (this.showEffects) {
            const label = game.i18n.localize("CONDITION.add")
            let effect = { name: label, id: "", icon: "icons/svg/aura.svg", cssClass: "effect", abbrev: label[0], subfunction: "addEffect" }
            if (effects.length > 0) {
                effect.more = effects
                effect.subwidth = this.subWidth(effects, itemWidth)
            }
            items.effects = [effect]
        }

        const count = Object.keys(items).reduce((prev, cur) => { return prev + items[cur].length }, 0)

        if (vertical) {
            this.position.width = itemWidth
            this.position.height = itemWidth * count + 14
        } else {
            this.position.width = itemWidth * count + 14
            this.position.height = itemWidth
        }

        mergeObject(data, { items, itemWidth, direction, count })
        return data
    }

    async render(force, options = {}) {
        const rend = await super.render(force, options)
        if (this._element) {
            this._element.css({ zIndex: 61 });
        }
        return rend
    }

    setPosition({ left, top, width, height, scale } = {}) {
        const currentPosition = super.setPosition({ left, top, width, height, scale })
        const el = this.element[0];

        if (!el.style.width || width) {
            const tarW = width || el.offsetWidth;
            const maxW = el.style.maxWidth || window.innerWidth;
            currentPosition.width = width = Math.clamped(tarW, 0, maxW);
            el.style.width = width + "px";
            if ((width + currentPosition.left) > window.innerWidth) left = currentPosition.left;
        }
        game.settings.set("dsa5", "tokenhotbarPosition", { left: currentPosition.left, top: currentPosition.top })
        return currentPosition
    }

    async updateDSA5Hotbar() {
        const controlled = canvas.tokens.controlled
        this.actor = undefined
        this.showEffects = false
        if (controlled.length === 1) {
            const actor = controlled[0].actor
            if (actor && actor.isOwner) {
                this.actor = actor
            }
        }

        if (controlled.length >= 1) {
            this.showEffects = true
        }
        await this.render(true)
    }
}

class AddEffectDialog extends Dialog {
    static async showDialog() {
        const effects = duplicate(CONFIG.statusEffects).map(x => {
            return {
                label: game.i18n.localize(x.label),
                icon: x.icon,
                description: game.i18n.localize(x.description),
                id: x.id
            }
        }).sort((a, b) => a.label.localeCompare(b.label))

        const dialog = new AddEffectDialog({
            title: game.i18n.localize("CONDITION.add"),
            content: await renderTemplate('systems/dsa5/templates/dialog/addstatusdialog.html', { effects }),
            buttons: {}
        })
        dialog.position.height = Math.ceil(effects.length / 3) * 36 + 170
        dialog.render(true)
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.reactClick').click(ev => this.addEffect(ev))

        let filterConditions = ev => this._filterConditions($(ev.currentTarget), html)

        let search = html.find('.conditionSearch')
        search.keyup(event => this._filterConditions($(event.currentTarget), html))
        search[0] && search[0].addEventListener("search", filterConditions, false);
    }

    _filterConditions(tar, html) {
        if (tar.val() != undefined) {
            let val = tar.val().toLowerCase().trim()
            let conditions = html.find('.filterable')
            html.find('.filterHide').removeClass('filterHide')
            conditions.filter(function() {
                return $(this).find('span').text().toLowerCase().trim().indexOf(val) == -1
            }).addClass('filterHide')
        }
    }

    async addEffect(ev) {
        for (let token of canvas.tokens.controlled) {
            await token.actor.addCondition(ev.currentTarget.dataset.value, 1, false, false)
        }
        game.dsa5.apps.tokenHotbar.render(true)
        this.close()
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        const height = Math.ceil(CONFIG.statusEffects.length / 3) * 32

        mergeObject(options, {
            classes: ["dsa5", "tokenStatusEffects"],
            width: 700,
            resizable: true,
            height
        });
        return options;
    }
}