export default class DSA5Hotbar extends Hotbar {
    constructor(options) {
        super(options);

        this.combatSkills = [game.i18n.localize("LocalizedIDs.selfControl"), game.i18n.localize("LocalizedIDs.featOfStrength"), game.i18n.localize("LocalizedIDs.perception")]
        this.defaultSkills = [game.i18n.localize("LocalizedIDs.perception")]

        Hooks.on("controlToken", (elem, controlTaken) => {
            this.updateDSA5Hotbar()
        })
    }

    async _render(force = false, options = {}) {
        await super._render(force, options);
        $(this._element).append($('<div class="tokenQuickHot"></div>'))
        this.addContextColor()
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.on('click', '.tokenQuickHot li', async(ev) => {
            ev.stopPropagation()
            await this.executeQuickButton(ev)
            return false
        })
        html.on('mouseenter', '.tokenQuickHot li', ev => {
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
        html.on('mouseenter', '.tokenQuickHot .subbuttons', ev => {
            $(ev.currentTarget).closest('li').find('>.tooltip').remove()
        })
        html.on('mouseleave', '.tokenQuickHot li', ev => {
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
        const id = $(ev.currentTarget).attr("data-id")
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

    addContextColor() {
        const parry = new RegExp(` ${game.i18n.localize('CHAR.PARRY')}$`)
        const attack = new RegExp(` ${game.i18n.localize('CHAR.ATTACK')}$`)
        const macroList = $(this._element).find('#macro-list')
        for (const macro of this.macros) {
            if (!macro.macro) continue

            if (parry.test(macro.macro.data.name)) {
                macroList.find(`[data-macro-id="${macro.macro.data._id}"]`).addClass("parry")
            } else if (attack.test(macro.macro.data.name)) {
                macroList.find(`[data-macro-id="${macro.macro.data._id}"]`).addClass("attack")
            }
        }
    }

    async updateDSA5Hotbar() {
        const controlled = canvas.tokens.controlled
        if (controlled.length === 1) {
            const actor = controlled[0].actor
            if (actor && actor.isOwner) {
                await this.updateIcons(actor)
                await this.toggleBar(false)
            } else {
                await this.toggleBar(true)
            }
        } else {
            await this.toggleBar(true)
        }
    }

    async updateIcons(actor) {
        const items = {
            attacks: [],
            spells: [],
            default: [],
            skills: []
        }
        let consumable
        const consumables = []
        let moreSpells = []
        if (game.combat) {
            items.attacks.push({
                name: game.i18n.localize("attackWeaponless"),
                id: "attackWeaponless",
                icon: "systems/dsa5/icons/categories/attack_weaponless.webp"
            })

            const attacktypes = ["meleeweapon", "rangeweapon"]
            const traitTypes = ["meleeAttack", "rangeAttack"]
            const spellTypes = ["liturgy", "spell"]

            for (const x of actor.data.items) {
                if ((attacktypes.includes(x.type) && x.data.data.worn.value == true) || (x.type == "trait" && traitTypes.includes(x.data.data.traitType.value))) {
                    items.attacks.push({ name: x.name, id: x.id, icon: x.img, cssClass: "", abbrev: x.name[0] })
                } else if (spellTypes.includes(x.type)) {
                    if (x.data.data.effectFormula.value) items.spells.push({ name: x.name, id: x.id, icon: x.img, cssClass: "spell", abbrev: x.name[0] })
                    else moreSpells.push({ name: x.name, id: x.id, icon: x.img, cssClass: "spell", abbrev: x.name[0] })
                } else if (["skill"].includes(x.type) && this.combatSkills.includes(x.name)) {
                    items.default.push({ name: `${x.name} (${x.data.data.talentValue.value})`, id: x.id, icon: x.img, cssClass: "skill", abbrev: x.name[0] })
                } else if (x.type == "consumable") {
                    consumables.push({ name: x.name, id: x.id, icon: x.img, cssClass: "", abbrev: x.data.data.quantity.value })
                }
            }
            consumable = consumables.pop()
        } else {
            let descendingSkills = []
            for (const x of actor.data.items) {
                if (["skill"].includes(x.type) && this.defaultSkills.includes(x.name)) {
                    items.default.push({ name: `${x.name} (${x.data.data.talentValue.value})`, id: x.id, icon: x.img, cssClass: "skill", abbrev: x.name[0] })
                } else if (["skill"].includes(x.type) && !this.defaultSkills.includes(x.name) && x.data.data.talentValue.value > 0) {
                    descendingSkills.push({ name: `${x.name} (${x.data.data.talentValue.value})`, id: x.id, icon: x.img, cssClass: "skill", abbrev: x.name[0], tw: x.data.data.talentValue.value })
                }
            }
            items.skills.push(...descendingSkills.sort((a, b) => { return b.tw - a.tw }).slice(0, 10))
        }
        if (items.spells.length == 0 && moreSpells.length > 0) {
            items.spells.push(moreSpells.pop())
        }
        if (items.spells.length > 0 && moreSpells.length > 0) {
            items.spells[0].more = moreSpells.sort((a, b) => { return a.name.localeCompare(b.name) })
            items.spells[0].subwidth = `style="width:${moreSpells.length * 35}px"`
        }
        if (consumable && consumables.length > 0) {
            consumable.more = consumables
            consumable.subwidth = `style="width:${consumables.length * 35}px"`
        }
        const template = await renderTemplate("systems/dsa5/templates/status/tokenHotbar.html", { items, consumables, consumable })
        $(this._element).find('.tokenQuickHot').html(template)
    }

    async toggleBar(hide) {
        const elem = $(this._element).find('.tokenQuickHot')
        if (hide) {
            elem.removeClass("expanded")
        } else {
            elem.addClass("expanded")
        }
    }
}