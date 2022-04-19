import DSA5_Utility from "../system/utility-dsa5.js"
import DSA5 from "../system/config-dsa5.js"
import DSA5StatusEffects from "../status/status_effects.js"
import DSA5ChatListeners from "../system/chat_listeners.js"
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js"
import { itemFromDrop, svgAutoFit } from "../system/view_helper.js"
import DSA5ChatAutoCompletion from "../system/chat_autocompletion.js"
import EquipmentDamage from "../system/equipment-damage.js"
import DiceDSA5 from "../system/dice-dsa5.js"
import OnUseEffect from "../system/onUseEffects.js"

export default class ItemSheetdsa5 extends ItemSheet {
    constructor(item, options) {
        super(item, options);
        this.mce = null;
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "item"]),
            width: 450,
            height: 500,
        });
        return options;
    }

    static setupSheets() {
        Items.unregisterSheet("core", ItemSheet);
        Items.registerSheet("dsa5", ItemSheetdsa5, { makeDefault: true });
        Items.registerSheet("dsa5", ItemSpeciesDSA5, { makeDefault: true, types: ["species"] });
        Items.registerSheet("dsa5", ItemCareerDSA5, { makeDefault: true, types: ["career"] });
        Items.registerSheet("dsa5", ItemCultureDSA5, { makeDefault: true, types: ["culture"] });
        Items.registerSheet("dsa5", VantageSheetDSA5, { makeDefault: true, types: ["advantage", "disadvantage"] });
        Items.registerSheet("dsa5", SpellSheetDSA5, { makeDefault: true, types: ["ritual", "ceremony", "liturgy", "spell"] });
        Items.registerSheet("dsa5", SpecialAbilitySheetDSA5, { makeDefault: true, types: ["specialability"] });
        Items.registerSheet("dsa5", MeleeweaponSheetDSA5, { makeDefault: true, types: ["meleeweapon"] });
        Items.registerSheet("dsa5", PoisonSheetDSA5, { makeDefault: true, types: ["poison"] });
        Items.registerSheet("dsa5", DiseaseSheetDSA5, { makeDefault: true, types: ["disease"] });
        Items.registerSheet("dsa5", ConsumableSheetDSA5, { makeDefault: true, types: ["consumable"] });
        Items.registerSheet("dsa5", SpellExtensionSheetDSA5, { makeDefault: true, types: ["spellextension"] });
        Items.registerSheet("dsa5", MagictrickSheetDSA5, { makeDefault: true, types: ["magictrick"] });
        Items.registerSheet("dsa5", BlessingSheetDSA5, { makeDefault: true, types: ["blessing"] });
        Items.registerSheet("dsa5", RangeweaponSheet, { makeDefault: true, types: ["rangeweapon"] });
        Items.registerSheet("dsa5", EquipmentSheet, { makeDefault: true, types: ["equipment"] });
        Items.registerSheet("dsa5", ArmorSheet, { makeDefault: true, types: ["armor"] });
        Items.registerSheet("dsa5", AmmunitionSheet, { makeDefault: true, types: ["ammunition"] });
        Items.registerSheet("dsa5", PlantSheet, { makeDefault: true, types: ["plant"] });
        Items.registerSheet("dsa5", MagicalSignSheet, { makeDefault: true, types: ["magicalsign"] });
        Items.registerSheet("dsa5", PatronSheet, { makeDefault: true, types: ["patron"] });

        Items.unregisterSheet("dsa5", ItemSheetdsa5, {
            types: [
                "armor", "equipment", "rangeweapon", "blessing", "magictrick", "spellextension", "consumable",
                "species", "career", "culture", "advantage", "specialability", "disadvantage", "ritual",
                "ceremony", "liturgy", "spell", "disease", "poison", "meleeweapon", "ammunition", "plant", "magicalsign", "patron"
            ]
        });
    }

    async _render(force = false, options = {}) {
        await super._render(force, options);

        $(this._element).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        $(this._element).find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
        $(this._element).find(".import").attr("title", game.i18n.localize("SHEET.Import"));
        $(this._element).find(".rolleffect").attr("title", game.i18n.localize("SHEET.RollEffect"));
        $(this._element).find(".showItemHead").attr("title", game.i18n.localize("SHEET.PostItem"));
        $(this._element).find(".consumeItem").attr("title", game.i18n.localize("SHEET.ConsumeItem"));
        $(this._element).find(".rollDamaged").attr("title", game.i18n.localize("DSASETTINGS.armorAndWeaponDamage"));
        $(this._element).find(".onUseEffect").attr("title", game.i18n.localize("SHEET.onUseEffect"))
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "showItemHead",
            icon: `fas fa-comment`,
            onclick: async() => this.item.postItem()
        })
        if (this.item.actor && OnUseEffect.getOnUseEffect(this.item)) {
            buttons.unshift({
                class: "onUseEffect",
                icon: `fas fa-dice-six`,
                onclick: async() => {
                    const onUse = new OnUseEffect(this.item)
                    onUse.executeOnUseEffect()
                }
            })
        }
        return buttons
    }

    setupEffect(ev) {
        this.item.setupEffect().then(setupData => this.item.itemTest(setupData))
    }

    get template() {
        let type = this.item.type;
        return `systems/dsa5/templates/items/item-${type}-sheet.html`;
    }

    _getItemId(ev) {
        return $(ev.currentTarget).parents(".item").attr("data-item-id")
    }

    _advanceStep() {}

    _refundStep() {}

    async advanceWrapper(ev, funct) {
        let elem = $(ev.currentTarget)
        let i = elem.find('i')
        if (!i.hasClass("fa-spin")) {
            i.addClass("fa-spin fa-spinner")
            await this[funct]()
            i.removeClass("fa-spin fa-spinner")
        }
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find(".advance-step").mousedown(ev => this.advanceWrapper(ev, "_advanceStep"))
        html.find(".refund-step").mousedown(ev => this.advanceWrapper(ev, "_refundStep"))
        html.find('.domainsPretty').click(ev => {
            $(ev.currentTarget).hide()
            $(ev.currentTarget).next('.domainToggle').show()
        })

        html.find('[data-edit="img"]').mousedown(ev => {
            if (ev.button == 2) DSA5_Utility.showArtwork(this.item)
        })

        html.find(".status-add").click(() => {
            if (this.item.actor) {
                ui.notifications.error(game.i18n.localize("DSAError.nestedEffectNotSupported"))
            } else {
                DSA5StatusEffects.createCustomEffect(this.item, "", this.item.name)
            }
        })

        html.find('.condition-show').mousedown(ev => {
            ev.preventDefault()
            const id = $(ev.currentTarget).attr("data-id")
            if (ev.button == 0) {
                const effect = this.item.effects.get(id)
                effect.sheet.render(true)
            } else if (ev.button == 2) {
                this.item.deleteEmbeddedDocuments("ActiveEffect", [id])
            }
        })

        html.find(".condition-toggle").mousedown(ev => {
            let condKey = $(ev.currentTarget).parents(".statusEffect").attr("data-id")
            let ef = this.item.effects.get(condKey)
            ef.update({ disabled: !ef.data.disabled })
        })

        html.find('.condition-edit').click(ev => {
            const effect = this.item.effects.get($(ev.currentTarget).attr("data-id"))
            effect.sheet.render(true)
        })

        DSA5StatusEffects.bindButtons(html)
        html.on('click', '.chat-condition', ev => {
            DSA5ChatListeners.postStatus($(ev.currentTarget).attr("data-id"))
        })

        let toObserve = html.find(".item-header")
        if (toObserve.length) {
            let svg = toObserve.find('svg')
            if (svg) {
                let observer = new ResizeObserver(function(entries) {
                    let entry = entries[0]
                    svgAutoFit(svg, entry.contentRect.width)
                });
                observer.observe(toObserve.get(0));
                let input = toObserve.find('input')
                if (!input.get(0).disabled) {
                    svg.click(() => {
                        svg.hide()
                        input.show()
                        input.focus()
                    })
                    input.blur(function() {
                        svg.show()
                        input.hide()
                    })
                }
            }
        }
    }

    async getData(options) {
        let data = super.getData(options).data;

        switch (this.item.type) {
            case "skill":
                data['characteristics'] = DSA5.characteristics;
                data['skillGroups'] = DSA5.skillGroups;
                data['skillBurdens'] = DSA5.skillBurdens;
                data['hasLocalization'] = game.i18n.has(`SKILLdescr.${this.item.name}`)
                data['StFs'] = DSA5.StFs;
                break;
            case "application":
                data['hasLocalization'] = game.i18n.has(`APPLICATION.${this.item.data.data.skill} - ${this.item.name}`)
                data['localization'] = game.i18n.localize(`APPLICATION.${this.item.data.data.skill} - ${this.item.name}`)
                data['allSkills'] = await DSA5_Utility.allSkillsList()
                break
            case "combatskill":
                data['weapontypes'] = DSA5.weapontypes;
                data['guidevalues'] = DSA5.combatskillsGuidevalues;
                data['hasLocalization'] = game.i18n.has(`Combatskilldescr.${this.item.name}`)
                data['StFs'] = DSA5.StFs;
                break;
            case "trait":
                data["traitCategories"] = DSA5.traitCategories
                data['ranges'] = DSA5.meleeRanges;
                break
            case "aggregatedTest":
                data["allSkills"] = await DSA5_Utility.allSkillsList()
                break
        }
        data.isOwned = this.item.actor
        data.editable = this.isEditable
        if (data.isOwned)
            data.canAdvance = this.item.actor.data.canAdvance && this._advancable()

        DSA5StatusEffects.prepareActiveEffects(this.item, data)
        data.item = this.item
        data.armorAndWeaponDamage = game.settings.get("dsa5", "armorAndWeaponDamage")
        return data;
    }

    _advancable() {
        return false
    }
}


class Enchantable extends ItemSheetdsa5 {
    async _onDrop(event) {
        await this.enchant(event)
        if (this.isPoisonable) await this.poison(event)
    }

    async enchant(event) {
        const dragData = JSON.parse(event.dataTransfer.getData("text/plain"))
        const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined)
        if (["spell", "liturgy", "ceremony", "ritual"].includes(typeClass)) {
            let enchantments = this.item.getFlag("dsa5", "enchantments") || []
            if (enchantments.length >= 7) {
                return ui.notifications.error(game.i18n.localize("DSAError.tooManyEnchants"))
            }
            if (!dragData.pack) {
                return ui.notifications.error(game.i18n.localize("DSAError.onlyCompendiumSpells"))
            }

            const enchantment = {
                name: item.name,
                pack: dragData.pack,
                id: enchantments.length,
                itemId: item._id,
                permanent: ["liturgy", "ceremony"].includes(typeClass),
                actorId: dragData.actorId,
                charged: true,
                talisman: ["liturgy", "ceremony"].includes(typeClass),
                fw: ["liturgy", "ceremony"].includes(typeClass) ? 18 : 0
            }
            enchantments.push(enchantment)
            let update = { flags: { dsa5: { enchantments } } }
            await this.item.update(update)
        }
    }

    async poison(event) {
        const dragData = JSON.parse(event.dataTransfer.getData("text/plain"))
        const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined)
        if (typeClass == "poison") {
            const poison = {
                name: item.name,
                pack: dragData.pack,
                itemId: item._id,
                permanent: false,
                actorId: dragData.actorId
            }
            let update = { flags: { dsa5: { poison } } }
            await this.item.update(update)
        }
    }

    toggleChargedState(id, enchantments) {
        for (let ench of enchantments) {
            if (ench.id == id) {
                ench.charged = ench.talisman && ench.permanent ? true : !ench.charged
                break
            }
        }
        this.item.update({ flags: { dsa5: { enchantments } } })
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('.ench-toggle-permanent').click(ev => {
            let { id, enchantments } = this.enchantMentId(ev)
            for (let ench of enchantments) {
                if (ench.id == id) {
                    ench.permanent = !ench.permanent
                    break
                }
            }
            this.item.update({ flags: { dsa5: { enchantments } } })
        })
        html.find('.ench-toggle-charge').click(ev => {
            let { id, enchantments } = this.enchantMentId(ev)
            this.toggleChargedState(id, enchantments)
        })
        html.find('.ench-roll').click(async(ev) => {
            let { id, enchantments } = this.enchantMentId(ev)
            let enchantment = enchantments.find(x => x.id == id)
            if (!enchantment.charged) return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughCharges"))
            let item = await this.getSpell(enchantment)

            if (item) {
                item = item.toObject()
                item.data.talentValue.value = enchantment.fw
                const actor = await DSA5_Utility.emptyActor(14)
                actor.setupSpell(item, {}, "emptyActor").then(async(setupData) => {
                    const infoMsg = game.i18n.format('CHATNOTIFICATION.enchantmentUsed', { item: this.item.name, spell: item.name })
                    await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
                    await actor.basicTest(setupData)
                    if (enchantment.permanent) {
                        this.toggleChargedState(id, enchantments)
                    } else {
                        this.deleteEnchantment(id, enchantments)
                    }
                })
            }
        })
        html.find('.ench-fw').change(ev => {
            let { id, enchantments } = this.enchantMentId(ev)
            let fw = Number($(ev.currentTarget).val())
            if (!fw) return

            for (let ench of enchantments) {
                if (ench.id == id) {
                    ench.fw = fw
                    break
                }
            }
            this.item.update({ flags: { dsa5: { enchantments } } })
        })
        html.find('.ench-delete').click(ev => {
            let { id, enchantments } = this.enchantMentId(ev)
            this.deleteEnchantment(id, enchantments)
        })
        html.find('.ench-show').click(async(ev) => {
            let { id, enchantments } = this.enchantMentId(ev)
            let enchantment = enchantments.find(x => x.id == id)
            let item = await this.getSpell(enchantment)

            if (item) {
                item.sheet.render(true)
            }
        })
        html.find('.poison-toggle-permanent').click(ev => {
            this.item.update({ flags: { dsa5: { poison: { permanent: !this.item.data.flags.dsa5.poison.permanent } } } })
        })
        html.find('.poison-delete').click(ev => {
            this.deletePoison()
        })
        html.find('.poison-show').click(async() => {
            let item
            if (this.item.actor) item = this.item.actor.data.items.find(x => x.type == "poison" && x.name == this.item.data.flags.dsa5.poison.name)
            if (!item) item = await this.getSpell(this.item.data.flags.dsa5.poison)

            if (item) {
                item.sheet.render(true)
            }
        })

        DSA5ChatAutoCompletion.bindRollCommands(html)
    }

    deletePoison() {
        this.item.update({
            [`flags.dsa5.-=poison`]: null
        })
    }

    deleteEnchantment(id, enchantments) {
        let enchantment = enchantments.findIndex(x => x.id == id)
        enchantments.splice(enchantment, 1)
        this.item.update({ flags: { dsa5: { enchantments } } })
    }

    async getSpell(enchantment) {
        const pack = await game.packs.get(enchantment.pack)

        if (!pack) {
            ui.notifications.error(game.i18n.localize('DSAError.enchantmentNotFound'))
            return
        }

        let item = await pack.getDocument(enchantment.itemId)
        if (!item) {
            const itemId = await pack.index.getName(enchantment.name)
            if (itemId) item = await pack.getDocument(itemId._id)
        }
        if (!item) ui.notifications.error(game.i18n.localize('DSAError.enchantmentNotFound'))

        return item
    }

    enchantMentId(ev) {
        return {
            id: $(ev.currentTarget).parents('.statusEffect').attr("data-id"),
            enchantments: this.item.getFlag("dsa5", "enchantments")
        }
    }

    prepareDomains() {
        let dom = getProperty(this.item.data.data, "effect.attributes")
        if (dom) {
            const magical = new RegExp(game.i18n.localize('WEAPON.magical'), 'i')
            const blessed = new RegExp(game.i18n.localize('WEAPON.clerical'), 'i')
            dom = dom.split(",").map(x => {
                let cssclass = ""
                if (magical.test(x)) cssclass = "magical"
                else if (blessed.test(x)) cssclass = "blessed"
                return `<li class="${cssclass}">${x}</li>`
            }).join("")
        }
        return dom
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            dragDrop: [{ dragSelector: ".item-list .item", dropSelector: ".content" }]
        });
        return options;
    }

    _canDragDrop(selector) {
        return this.isEditable;
    }

    async getData(options) {
        const data = await super.getData(options);
        data["enchantments"] = this.item.getFlag("dsa5", "enchantments")
        const enchantmentLabel = []
        data.poison = this.item.getFlag("dsa5", "poison")

        if (data.poison) enchantmentLabel.push("poison")
        if (data.enchantments && data.enchantments.some(x => !x.talisman)) enchantmentLabel.push("enchantment")
        if (data.enchantments && data.enchantments.some(x => x.talisman)) enchantmentLabel.push("talisman")
        data.enchantmentLabel = enchantmentLabel.map(x => game.i18n.localize(x)).join("/")

        data.hasEnchantments = data.poison || (data.enchantments && data.enchantments.length > 0)
        return data
    }
}

class AmmunitionSheet extends Enchantable {
    constructor(item, options) {
        super(item, options);
        this.mce = null;
        this.isPoisonable = true
    }
    async getData(options) {
        const data = await super.getData(options)
        data['ammunitiongroups'] = DSA5.ammunitiongroups
        data['domains'] = this.prepareDomains()
        return data
    }
}

class EquipmentSheet extends Enchantable {
    async getData(options) {
        const data = await super.getData(options);
        data['equipmentTypes'] = DSA5.equipmentTypes;
        data['domains'] = this.prepareDomains()
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        if (this.isBagWithContents()) {
            let weightSum = 0
            data['containerContent'] = this.item.actor.items
                .filter(x => DSA5.equipmentCategories.includes(x.type) && x.data.data.parent_id == this.item.id)
                .map(x => {
                    x.weight = parseFloat((x.data.data.weight.value * x.data.data.quantity.value).toFixed(3));
                    weightSum += Number(x.weight)
                    const enchants = getProperty(x.data, "flags.dsa5.enchantments")
                    if (enchants && enchants.length > 0) {
                        x.enchantClass = "rar"
                    } else if ((x.data.data.effect && x.data.data.effect.value != "") || x.data.effects.length > 0) {
                        x.enchantClass = "common"
                    }
                    return x
                })
            data['weightSum'] = parseFloat(weightSum.toFixed(3))
            data['weightWidth'] = `style="width: ${Math.min(this.item.data.data.capacity ? weightSum / this.item.data.data.capacity * 100 : 0, 100)}%"`
            data['weightExceeded'] = weightSum > Number(this.item.data.data.capacity) ? "exceeded" : ""
        }
        return data
    }

    async breakOverflow(data, parent) {
        let elm = $(await renderTemplate('systems/dsa5/templates/items/baghover.html', data))

        let top = parent.offset().top + 52;
        let left = parent.offset().left - 75;
        elm.appendTo($('body'));
        elm.css({
            position: 'absolute',
            left: left + 'px',
            top: top + 'px',
            bottom: 'auto',
            right: 'auto',
            'z-index': 10000
        });
        return elm
    }

    activateListeners(html) {
        super.activateListeners(html)
        const slots = html.find('.slot')
        slots.mouseenter(async(ev) => {
            const item = $(ev.currentTarget)
            let elm = await this.breakOverflow({
                name: item.attr('data-name'),
                weight: item.attr("data-weight"),
                quantity: item.attr("data-quantity")
            }, item)
            elm.fadeIn()
            item.mouseleave(() => {
                elm.remove()
                item.off('mouseleave')
            })
        })

        slots.mousedown(async(ev) => {
            let itemId = $(ev.currentTarget).attr("data-item-id")
            let item = this.actor.items.get(itemId);

            if (ev.button == 0)
                item.sheet.render(true);
            else if (ev.button == 2) {
                $('.itemInfo').remove()
                await item.update({ "data.parent_id": 0 });
                this.render(true)
            }
        })
    }

    isBagWithContents() {
        return this.item.data.data.equipmentType.value == "bags" && this.item.actor
    }

    async _onDrop(event) {
        if (this.isBagWithContents()) {
            const dragData = JSON.parse(event.dataTransfer.getData("text/plain"))
            const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined)
            const selfItem = this.item.id == item.id
            const ownItem = this.item.parent.id == dragData.actorId

            if (DSA5.equipmentCategories.includes(typeClass) && !selfItem) {
                item.data.parent_id = this.item.id
                if (item.data.worn && item.data.worn.value)
                    item.data.worn.value = false

                if (ownItem) {
                    await this.item.actor.updateEmbeddedDocuments("Item", [item])
                } else {
                    await this.item.actor.sheet._addLoot(item)
                }
                this.render(true)
                return
            }
        }

        await super._onDrop(event)
    }
}

export class ArmorSheet extends Enchantable {
    async getData(options) {
        const data = await super.getData(options)
        mergeObject(data, {
            domains: this.prepareDomains(),
            armorSubcategories: Object.keys(DSA5.armorSubcategories),
            breakPointRating: DSA5.armorSubcategories[this.item.data.data.subcategory]
        })
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        return data
    }
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned && game.settings.get("dsa5", "armorAndWeaponDamage") && this.item.data.data.structure.max > 0) {
            buttons.unshift({
                class: "rollDamaged",
                icon: `fas fa-dice-d20`,
                onclick: async() => EquipmentDamage.breakingTest(this.item)
            })
        }
        return buttons
    }
}

class PlantSheet extends ItemSheetdsa5 {
    async getData(options) {
        const data = await super.getData(options);
        data.attributes = Object.keys(data.data.planttype).map(x => { return { name: x, checked: data.data.planttype[x] } })
        return data
    }
}

class PatronSheet extends ItemSheetdsa5 {
    async getData(options) {
        const data = await super.getData(options);
        data.patronCategories = [0, 1, 2, 3].map(x => { return { name: game.i18n.localize(`PATRON.${x}`), val: x } })
        data.priorities = { 0: game.i18n.localize("PATRON.primary"), 1: game.i18n.localize("PATRON.secondary") }
        return data
    }
}

class MagicalSignSheet extends ItemSheetdsa5 {
    async getData(options) {
        const data = await super.getData(options);
        data.categories = { 1: game.i18n.localize("magicalsign"), 2: game.i18n.localize("additionalsign") }
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        return data
    }
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned) {
            buttons.unshift({
                class: "rolleffect",
                icon: `fas fa-dice-d20`,
                onclick: async ev => this.setupEffect(ev)
            })
        }
        return buttons
    }
    async setupEffect(ev) {
        const aspcost = Number(this.item.data.data.asp) || 0
        if (this.item.actor.data.data.status.astralenergy.value < aspcost)
            return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughAsP"))

        const actor = this.item.actor
        const sign = game.dsa5.config.ItemSubclasses.magicalsign
        const skill = actor.items.find(x => x.type == "skill" && x.name == game.i18n.localize("LocalizedIDs.artisticAbility"))
        const chatMessage = `<hr/><p><b>${this.item.name}</b></p><p>${this.item.data.data.description.value}</p><p>${sign.chatData(this.item.data.data, "").join("</br>")} <span class="costCheck"></span></p>`
        actor.setupSkill(skill.data, { other: [chatMessage], subtitle: ` (${game.i18n.localize('magicalsign')})` }, undefined).then(async(setupData) => {
            const res = await actor.basicTest(setupData, { suppressMessage: true })
            res.result.preData.calculatedSpellModifiers = { finalcost: aspcost, costsMana: true }
            await DiceDSA5.renderRollCard(res.cardOptions, res.result, res.options.rerenderMessage)
        })
    }
}

class RangeweaponSheet extends Enchantable {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned && game.settings.get("dsa5", "armorAndWeaponDamage") && this.item.data.data.structure.max > 0) {
            buttons.unshift({
                class: "rollDamaged",
                icon: `fas fa-dice-d20`,
                onclick: async() => EquipmentDamage.breakingTest(this.item)
            })
        }
        return buttons
    }
    async getData(options) {
        const data = await super.getData(options)
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        mergeObject(data, {
            ammunitiongroups: DSA5.ammunitiongroups,
            combatskills: await DSA5_Utility.allCombatSkillsList("range"),
            domains: this.prepareDomains(),
            breakPointRating: DSA5.weaponStabilities[game.i18n.localize(`LocalizedCTs.${this.item.data.data.combatskill.value}`)]
        })
        return data
    }
}

class BlessingSheetDSA5 extends ItemSheetdsa5 {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned) {
            buttons.unshift({
                class: "rolleffect",
                icon: `fas fa-dice-d20`,
                onclick: async ev => this.setupEffect(ev)
            })
        }
        return buttons
    }

    async getData(options) {
        const data = await super.getData(options)
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        return data
    }

    async setupEffect(ev) {
        if (this.item.actor.data.data.status.karmaenergy.value < 1)
            return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughKaP"))

        const cantrip = game.dsa5.config.ItemSubclasses.magictrick
        await this.item.actor.update({ "data.status.karmaenergy.value": this.item.actor.data.data.status.karmaenergy.value -= 1 })
        let chatMessage = `<p><b>${this.item.name} - ${game.i18n.localize('blessing')} ${game.i18n.localize('probe')}</b></p><p>${this.item.data.data.description.value}</p><p>${cantrip.chatData(this.item.data.data, "").join("</br>")}</p>`
        await ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));
    }
}

class ItemCareerDSA5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 700
        options.height = 700
        super(item, options);
        this.mce = null;
    }

    async getData(options) {
        const data = await super.getData(options);
        let chars = duplicate(DSA5.characteristics)
        chars["-"] = "-"
        data["mageLevels"] = DSA5.mageLevels
        data['guidevalues'] = chars;
        return data
    }
}

class ConsumableSheetDSA5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 480
        super(item, options);
        this.mce = null;
    }
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned) {
            buttons.unshift({
                class: "consumeItem",
                icon: `fas fa-dice-d20`,
                onclick: async ev => this.setupEffect(ev)
            })
        }
        return buttons
    }
    async getData(options) {
        const data = await super.getData(options)
        data["calculatedPrice"] = (data.data.price.value * data.data.QL) || 0
        data["availableSteps"] = data.data.QLList.split("\n").map((x, i) => i + 1)
        data['equipmentTypes'] = DSA5.equipmentTypes;
        return data
    }
    setupEffect(ev) {
        this.item.setupEffect()
    }
}

class ItemCultureDSA5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 700
        options.height = 700
        super(item, options);
        this.mce = null;
    }
}

class DiseaseSheetDSA5 extends ItemSheetdsa5 {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "rolleffect",
            icon: `fas fa-dice-d20`,
            onclick: async ev => this.setupEffect(ev)
        })
        return buttons
    }
    async getData(options) {
        const data = await super.getData(options);
        data["resistances"] = DSA5.magicResistanceModifiers
        return data
    }
}

class MagictrickSheetDSA5 extends ItemSheetdsa5 {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned) {
            buttons.unshift({
                class: "rolleffect",
                icon: `fas fa-dice-d20`,
                onclick: async ev => this.setupEffect(ev)
            })
        }
        return buttons
    }

    async getData(options) {
        const data = await super.getData(options)
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        return data
    }

    async setupEffect(ev) {
        if (this.item.actor.data.data.status.astralenergy.value < 1)
            return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughAsP"))

        const cantrip = game.dsa5.config.ItemSubclasses.magictrick
        await this.item.actor.update({ "data.status.astralenergy.value": this.item.actor.data.data.status.astralenergy.value -= 1 })
        const chatMessage = `<p><b>${this.item.name} - ${game.i18n.localize('magictrick')} ${game.i18n.localize('probe')}</b></p><p>${this.item.data.data.description.value}</p><p>${cantrip.chatData(this.item.data.data, "").join("</br>")}</p>`
        await ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));
    }
}

class MeleeweaponSheetDSA5 extends Enchantable {
    constructor(item, options) {
        super(item, options);
        this.mce = null;
        this.isPoisonable = true
    }

    async getData(options) {
        const data = await super.getData(options);
        const characteristics = mergeObject(duplicate(DSA5.characteristics), {
            "ge/kk": game.i18n.localize("CHAR.GEKK"),
            ["-"]: "-"
        })
        mergeObject(data, {
            characteristics,
            twoHanded: /\(2H/.test(this.item.name),
            combatskills: await DSA5_Utility.allCombatSkillsList("melee"),
            ranges: DSA5.meleeRanges,
            shieldSizes: DSA5.shieldSizes,
            isShield: this.item.data.data.combatskill.value == game.i18n.localize("LocalizedIDs.Shields"),
            domains: this.prepareDomains(),
            breakPointRating: DSA5.weaponStabilities[game.i18n.localize(`LocalizedCTs.${this.item.data.data.combatskill.value}`)]
        })
        if (this.item.actor) {
            const combatSkill = this.item.actor.data.items.find(x => x.type == "combatskill" && x.name == this.item.data.data.combatskill.value)
            data['canBeOffHand'] = combatSkill && !(combatSkill.data.data.weapontype.twoHanded) && this.item.data.data.worn.value
        }
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        return data
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned && game.settings.get("dsa5", "armorAndWeaponDamage") && this.item.data.data.structure.max > 0) {
            buttons.unshift({
                class: "rollDamaged",
                icon: `fas fa-dice-d20`,
                onclick: async() => EquipmentDamage.breakingTest(this.item)
            })
        }
        return buttons
    }
}

class PoisonSheetDSA5 extends ItemSheetdsa5 {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "rolleffect",
            icon: `fas fa-dice-d20`,
            onclick: async ev => this.setupEffect(ev)
        })
        return buttons
    }

    async getData(options) {
        const data = await super.getData(options);
        data["resistances"] = DSA5.magicResistanceModifiers
        return data
    }
}

class SpecialAbilitySheetDSA5 extends ItemSheetdsa5 {
    async _refundStep() {
        let xpCost, steps
        if (this.item.data.data.step.value > 1) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value - 1]
            }
            xpCost = await SpecialabilityRulesDSA5.refundFreelanguage(this.item.data, this.item.actor, xpCost)
            await this.item.actor._updateAPs(xpCost * -1)
            await this.item.update({ "data.step.value": this.item.data.data.step.value - 1 })
        }
    }

    async _advanceStep() {
        let xpCost, steps
        if (this.item.data.data.step.value < this.item.data.data.maxRank.value) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value]
            }
            xpCost = await SpecialabilityRulesDSA5.isFreeLanguage(this.item.data, this.item.actor, xpCost)
            if (await this.item.actor.checkEnoughXP(xpCost)) {
                await this.item.actor._updateAPs(xpCost)
                await this.item.update({ "data.step.value": this.item.data.data.step.value + 1 })
            }
        }
    }

    _advancable() {
        return this.item.data.data.maxRank.value > 0
    }

    async getData(options) {
        const data = await super.getData(options);
        data['categories'] = DSA5.specialAbilityCategories;
        data['subCategories'] = DSA5.combatSkillSubCategories
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        return data
    }

}

class ItemSpeciesDSA5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 530
        options.height = 570
        super(item, options);
        this.mce = null;
    }

    async getData(options) {
        const data = await super.getData(options);
        data['hasLocalization'] = game.i18n.has(`Racedescr.${this.item.name}`)
        return data
    }
}

class SpellSheetDSA5 extends ItemSheetdsa5 {
    async getData(options) {
        const data = await super.getData(options);
        data['characteristics'] = DSA5.characteristics;
        data['StFs'] = DSA5.StFs;
        data['resistances'] = DSA5.magicResistanceModifiers
        if (data.isOwned) {
            data['extensions'] = this.item.actor.data.items.filter(x => { return x.type == "spellextension" && x.data.data.source == this.item.name && this.item.type == x.data.data.category })
        }
        return data
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.item-edit').click(ev => {
            ev.preventDefault()
            let itemId = this._getItemId(ev)
            const item = this.item.actor.items.find(i => i.data._id == itemId)
            item.sheet.render(true);
        });

        html.find('.item-delete').click(ev => {
            this._deleteItem(ev)
        });
    }

    _deleteItem(ev) {
        let itemId = this._getItemId(ev);
        let item = this.actor.data.items.find(x => x.id == itemId)
        let message = game.i18n.format("DIALOG.DeleteItemDetail", { item: item.name })
        renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.html', { message }).then(html => {
            new Dialog({
                title: game.i18n.localize("Delete Confirmation"),
                content: html,
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("yes"),
                        callback: () => {
                            this._cleverDeleteItem(itemId)
                            $(ev.currentTarget).closest('.item').remove()
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel")
                    }
                },
                default: 'Yes'
            }).render(true)
        });
    }

    async _cleverDeleteItem(itemId) {
        let item = this.item.actor.data.items.find(x => x.id == itemId)
        await this.item.actor._updateAPs(-1 * item.data.data.APValue.value)
        await this.item.actor.deleteEmbeddedDocuments("Item", [itemId]);
    }
}

class SpellExtensionSheetDSA5 extends ItemSheetdsa5 {
    async getData(options) {
        const data = await super.getData(options)
        mergeObject(data, {
            categories: { spell: "spell", liturgy: "liturgy", ritual: "ritual", ceremony: "ceremony" }
        })
        console.log(data)
        return data
    }
}

class VantageSheetDSA5 extends ItemSheetdsa5 {
    _advancable() {
        return this.item.data.data.max.value > 0
    }

    async _refundStep() {
        let xpCost, steps
        if (this.item.data.data.step.value > 1) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value - 1]
            }
            await this.item.actor._updateAPs(xpCost * -1)
            await this.item.update({ "data.step.value": this.item.data.data.step.value - 1 })
        }
    }

    async getData(options) {
        const data = await super.getData(options)
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        return data
    }

    async _advanceStep() {
        let xpCost, steps
        if (this.item.data.data.step.value < this.item.data.data.max.value) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value]
            }
            if (await this.item.actor.checkEnoughXP(xpCost)) {
                await this.item.actor._updateAPs(xpCost)
                await this.item.update({ "data.step.value": this.item.data.data.step.value + 1 })
            }
        }
    }
}