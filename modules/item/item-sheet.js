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
import RuleChaos from "../system/rule_chaos.js"
import { ItemSheetObfuscation } from "./obfuscatemixin.js"

export default class ItemSheetdsa5 extends ItemSheet {
    constructor(item, options) {
        super(item, options);
        this.mce = null;
    }

    _getSubmitData(updateData = {}) {
        const data = super._getSubmitData(updateData);
        const overrides = foundry.utils.flattenObject(this.item.overrides || {});
        Object.keys(overrides).forEach((v) => delete data[v]);
        return data;
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            tabs: [{ navSelector: ".tabs", contentSelector: ".content" }],
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
        Items.registerSheet("dsa5", InformationSheet, { makeDefault: true, types: ["information"] });

        Items.unregisterSheet("dsa5", ItemSheetdsa5, {
            types: [
                "armor", "equipment", "rangeweapon", "blessing", "magictrick", "spellextension", "consumable",
                "species", "career", "culture", "advantage", "specialability", "disadvantage", "ritual", "information",
                "ceremony", "liturgy", "spell", "disease", "poison", "meleeweapon", "ammunition", "plant", "magicalsign", "patron"
            ]
        });
    }

    async _render(force = false, options = {}) {
        await super._render(force, options);

        $(this._element).find(".close").attr("data-tooltip", game.i18n.localize("SHEET.Close"));
        $(this._element).find(".configure-sheet").attr("data-tooltip", game.i18n.localize("SHEET.Configure"));
        $(this._element).find(".import").attr("data-tooltip", game.i18n.localize("SHEET.Import"));
        $(this._element).find(".rolleffect").attr("data-tooltip", game.i18n.localize("SHEET.RollEffect"));
        $(this._element).find(".showItemHead").attr("data-tooltip", game.i18n.localize("SHEET.PostItem"));
        $(this._element).find(".consumeItem").attr("data-tooltip", game.i18n.localize("SHEET.ConsumeItem"));
        $(this._element).find(".rollDamaged").attr("data-tooltip", game.i18n.localize("DSASETTINGS.armorAndWeaponDamage"));
        $(this._element).find(".onUseEffect").attr("data-tooltip", game.i18n.localize("SHEET.onUseEffect"))
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
        return `systems/dsa5/templates/items/item-${this.item.type}-sheet.html`;
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
            ef.update({ disabled: !ef.system.disabled })
        })

        html.find('.condition-edit').click(ev => {
            const effect = this.item.effects.get($(ev.currentTarget).attr("data-id"))
            effect.sheet.render(true)
        })

        DSA5ChatAutoCompletion.bindRollCommands(html)
        DSA5StatusEffects.bindButtons(html)

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
                data['hasLocalization'] = game.i18n.has(`APPLICATION.${this.item.system.skill} - ${this.item.name}`)
                data['localization'] = game.i18n.localize(`APPLICATION.${this.item.system.skill} - ${this.item.name}`)
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
            data.canAdvance = this.item.actor.system.canAdvance && this._advancable()

        DSA5StatusEffects.prepareActiveEffects(this.item, data)
        data.item = this.item
        data.armorAndWeaponDamage = game.settings.get("dsa5", "armorAndWeaponDamage")
        data.isGM = game.user.isGM
        data.enrichedDescription = await TextEditor.enrichHTML(getProperty(this.item.system, "description.value"), {secrets: true, async: true})
        data.enrichedGmdescription = await TextEditor.enrichHTML(getProperty(this.item.system, "gmdescription.value"), {secrets: true, async: true})
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
        await this._enchant([dragData])
    }

    async _enchant(dragDataArray) {
        const enchantments = this.item.getFlag("dsa5", "enchantments") || []
        if (enchantments.length + dragDataArray.length > 7) return ui.notifications.error(game.i18n.localize("DSAError.tooManyEnchants"))

        for (let dragData of dragDataArray) {
            const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined, false)
            if (["spell", "liturgy", "ceremony", "ritual"].includes(typeClass)) {
                if (!item.pack) return ui.notifications.error(game.i18n.localize("DSAError.onlyCompendiumSpells"))

                const enchantment = {
                    name: item.name,
                    pack: item.pack,
                    id: enchantments.length,
                    itemId: item.id,
                    permanent: ["liturgy", "ceremony"].includes(typeClass) || dragData.permanent,
                    actorId: dragData.actorId,
                    charged: true,
                    talisman: ["liturgy", "ceremony"].includes(typeClass),
                    fw: ["liturgy", "ceremony"].includes(typeClass) ? 18 : dragData.fw || 0
                }
                enchantments.push(enchantment)
            }
        }
        if (enchantments.length) {
            const update = { flags: { dsa5: { enchantments } } }
            await this.item.update(update)
        }

    }

    async poison(event) {
        const dragData = JSON.parse(event.dataTransfer.getData("text/plain"))
        const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined, false)
        if (typeClass == "poison") {
            const poison = {
                name: item.name,
                pack: item.pack,
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
                item.system.talentValue.value = enchantment.fw
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
            this.item.update({ flags: { dsa5: { poison: { permanent: !this.item.flags.dsa5.poison.permanent } } } })
        })
        html.find('.poison-delete').click(ev => {
            this.deletePoison()
        })
        html.find('.poison-show').click(async() => {
            let item
            if (this.item.actor) item = this.item.actor.items.find(x => x.type == "poison" && x.name == this.item.flags.dsa5.poison.name)
            if (!item) item = await this.getSpell(this.item.flags.dsa5.poison)

            if (item) {
                item.sheet.render(true)
            }
        })
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
        let dom = getProperty(this.item.system, "effect.attributes")
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

        data.traditionArtifacts = DSA5.traditionArtifacts
        data.hasEnchantments = data.poison || (data.enchantments && data.enchantments.length > 0)
        return data
    }
}

class InformationSheet extends ItemSheetdsa5 {
    async getData(options) {
        const data = await super.getData(options)
        mergeObject(data, {
            allSkills: await DSA5_Utility.allSkillsList()
        })
        return data
    }
}

class AmmunitionSheet extends Enchantable {
    constructor(item, options) {
        super(item, options);
        this.isPoisonable = true
    }
    async getData(options) {
        const data = await super.getData(options)
        data['ammunitiongroups'] = DSA5.ammunitiongroups
        data['domains'] = this.prepareDomains()
        return data
    }
}

class EquipmentSheet extends ItemSheetObfuscation(Enchantable) {
    async getData(options) {
        const data = await super.getData(options);
        mergeObject(data, {
            equipmentTypes: DSA5.equipmentTypes,
            domains: this.prepareDomains(),
            canOnUseEffect: game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        })
        if (this.isBagWithContents()) {
            let weightSum = 0
            mergeObject(data, {
                containerContent: this.item.actor.items
                .filter(x => DSA5.equipmentCategories.includes(x.type) && x.system.parent_id == this.item.id)
                .map(x => {
                    x.weight = parseFloat((x.system.weight.value * x.system.quantity.value).toFixed(3));
                    weightSum += Number(x.weight)
                    const enchants = getProperty(x, "flags.dsa5.enchantments")
                    if (enchants && enchants.length > 0) {
                        x.enchantClass = "rar"
                    } else if ((x.system.effect && x.system.effect.value != "") || x.effects.length > 0) {
                        x.enchantClass = "common"
                    }
                    return x
                }),
                weightSum: parseFloat(weightSum.toFixed(3)),
                weightWidth: `style="width: ${Math.min(this.item.system.capacity ? weightSum / this.item.system.capacity * 100 : 0, 100)}%"`,
                weightExceeded: weightSum > Number(this.item.system.capacity) ? "exceeded" : ""
            })
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
                await item.update({ "system.parent_id": 0 });
                this.render(true)
            }
        })
    }

    isBagWithContents() {
        return this.item.actor && getProperty(this.item, "system.equipmentType.value") == "bags"
    }

    async _onDrop(event) {
        if (this.isBagWithContents()) {
            const dragData = JSON.parse(event.dataTransfer.getData("text/plain"))
            const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined)
            const selfItem = this.item.id == item.id
            const ownItem = this.item.parent.id == dragData.actorId

            if (DSA5.equipmentCategories.includes(typeClass) && !selfItem) {
                item.system.parent_id = this.item.id
                if (item.system.worn && item.system.worn.value)
                    item.system.worn.value = false

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

export class ArmorSheet extends ItemSheetObfuscation(Enchantable) {
    async getData(options) {
        const data = await super.getData(options)
        mergeObject(data, {
            domains: this.prepareDomains(),
            armorSubcategories: Object.keys(DSA5.armorSubcategories),
            breakPointRating: DSA5.armorSubcategories[this.item.system.subcategory]
        })
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        return data
    }
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned && game.settings.get("dsa5", "armorAndWeaponDamage") && this.item.system.structure.max > 0) {
            buttons.unshift({
                class: "rollDamaged",
                icon: `fas fa-dice-d20`,
                onclick: async() => EquipmentDamage.breakingTest(this.item)
            })
        }
        return buttons
    }
}

class PlantSheet extends ItemSheetObfuscation(ItemSheetdsa5) {
    async getData(options) {
        const data = await super.getData(options);
        data.attributes = Object.keys(data.system.planttype).map(x => { return { name: x, checked: data.system.planttype[x] } })
        data.enrichedEffect = await TextEditor.enrichHTML(getProperty(this.item.system, "effect"), {secrets: true, async: true})
        data.enrichedRecipes = await TextEditor.enrichHTML(getProperty(this.item.system, "recipes"), {secrets: true, async: true})
        data.enrichedInformation = await TextEditor.enrichHTML(getProperty(this.item.system, "infos"), {secrets: true, async: true})

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
        const aspcost = Number(this.item.system.asp) || 0
        if (this.item.actor.system.status.astralenergy.value < aspcost)
            return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughAsP"))

        const actor = this.item.actor
        const sign = game.dsa5.config.ItemSubclasses.magicalsign
        const skill = actor.items.find(x => x.type == "skill" && x.name == game.i18n.localize("LocalizedIDs.artisticAbility"))
        const chatMessage = `<hr/><p><b>${this.item.name}</b></p><p>${this.item.system.description.value}</p><p>${sign.chatData(this.item.system, "").join("</br>")} <span class="costCheck"></span></p>`
        actor.setupSkill(skill, { other: [chatMessage], subtitle: ` (${game.i18n.localize('magicalsign')})` }, undefined).then(async(setupData) => {
            const res = await actor.basicTest(setupData, { suppressMessage: true })
            res.result.preData.calculatedSpellModifiers = { finalcost: aspcost, costsMana: true }
            await DiceDSA5.renderRollCard(res.cardOptions, res.result, res.options.rerenderMessage)
        })
    }
}

class RangeweaponSheet extends ItemSheetObfuscation(Enchantable) {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned && game.settings.get("dsa5", "armorAndWeaponDamage") && this.item.system.structure.max > 0) {
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
        mergeObject(data, {
            canOnUseEffect: game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro"),
            ammunitiongroups: DSA5.ammunitiongroups,
            combatskills: await DSA5_Utility.allCombatSkillsList("range"),
            domains: this.prepareDomains(),
            breakPointRating: DSA5.weaponStabilities[game.i18n.localize(`LocalizedCTs.${this.item.system.combatskill.value}`)]
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
        if (this.item.actor.system.status.karmaenergy.value < 1)
            return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughKaP"))

        const cantrip = game.dsa5.config.ItemSubclasses.magictrick
        await this.item.actor.update({ "system.status.karmaenergy.value": this.item.actor.system.status.karmaenergy.value -= 1 })
        let chatMessage = `<p><b>${this.item.name} - ${game.i18n.localize('blessing')} ${game.i18n.localize('probe')}</b></p><p>${this.item.system.description.value}</p><p>${cantrip.chatData(this.item.system, "").join("</br>")}</p>`
        await ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));
    }
}

class ItemCareerDSA5 extends ItemSheetdsa5 {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 700,
            height: 700,
        });
        return options;
    }

    async getData(options) {
        const data = await super.getData(options);
        let chars = duplicate(DSA5.characteristics)
        chars["-"] = "-"
        data["mageLevels"] = DSA5.mageLevels
        data['guidevalues'] = chars;
        data.enrichedClothing = await TextEditor.enrichHTML(getProperty(this.item.system, "clothing.value"), {secrets: true, async: true})
        return data
    }
}

class ConsumableSheetDSA5 extends ItemSheetObfuscation(ItemSheetdsa5) {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 480
        });
        return options;
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
        data["calculatedPrice"] = (data.system.price.value * data.system.QL) || 0
        data["availableSteps"] = data.system.QLList.split("\n").map((x, i) => i + 1)
        data['equipmentTypes'] = DSA5.equipmentTypes;

        data.enrichedIngredients = await TextEditor.enrichHTML(getProperty(this.item.system, "ingredients"), {secrets: true, async: true})
        return data
    }
    setupEffect(ev) {
        this.item.setupEffect()
    }
}

class ItemCultureDSA5 extends ItemSheetdsa5 {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 700,
            height: 700,
        });
        return options;
    }

    async getData(options) {
        const data = await super.getData(options);
        data.enrichedClothing = await TextEditor.enrichHTML(getProperty(this.item.system, "clothing.value"), {secrets: true, async: true})
        return data
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
        if (this.item.actor.system.status.astralenergy.value < 1)
            return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughAsP"))

        const cantrip = game.dsa5.config.ItemSubclasses.magictrick
        await this.item.actor.update({ "system.status.astralenergy.value": this.item.actor.system.status.astralenergy.value -= 1 })
        const chatMessage = `<p><b>${this.item.name} - ${game.i18n.localize('magictrick')} ${game.i18n.localize('probe')}</b></p><p>${this.item.system.description.value}</p><p>${cantrip.chatData(this.item.system, "").join("</br>")}</p>`
        await ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));
    }
}

class MeleeweaponSheetDSA5 extends ItemSheetObfuscation(Enchantable) {
    constructor(item, options) {
        super(item, options);
        this.isPoisonable = true
    }

    async getData(options) {
        const data = await super.getData(options);
        const characteristics = mergeObject(duplicate(DSA5.characteristics), {
            "ge/kk": game.i18n.localize("CHAR.GEKK"),
            ["-"]: "-"
        })
        const twoHanded = RuleChaos.regex2h.test(this.item.name)
        let wrongGripHint = ""
        if (!twoHanded) {
            wrongGripHint = "wrongGrip.yieldTwo"
        } else {
            const localizedCT = game.i18n.localize(`LocalizedCTs.${this.item.system.combatskill.value}`)
            switch (localizedCT) {
                case "Two-Handed Impact Weapons":
                case "Two-Handed Swords":
                    const reg = new RegExp(game.i18n.localize('wrongGrip.wrongGripBastardRegex'))
                    if (reg.test(this.item.name))
                        wrongGripHint = "wrongGrip.yieldOneBastard"
                    else
                        wrongGripHint = "wrongGrip.yieldOneSwordBlunt"

                    break
                default:
                    wrongGripHint = "wrongGrip.yieldOnePolearms"
            }
        }
        mergeObject(data, {
            characteristics,
            twoHanded,
            wrongGripLabel: twoHanded ? "wrongGrip.oneHanded" : "wrongGrip.twoHanded",
            wrongGripHint,
            combatskills: await DSA5_Utility.allCombatSkillsList("melee"),
            ranges: DSA5.meleeRanges,
            shieldSizes: DSA5.shieldSizes,
            isShield: this.item.system.combatskill.value == game.i18n.localize("LocalizedIDs.Shields"),
            domains: this.prepareDomains(),
            breakPointRating: DSA5.weaponStabilities[game.i18n.localize(`LocalizedCTs.${this.item.system.combatskill.value}`)]
        })
        if (this.item.actor) {
            const combatSkill = this.item.actor.items.find(x => x.type == "combatskill" && x.name == this.item.system.combatskill.value)
            data['canBeOffHand'] = combatSkill && !(combatSkill.system.weapontype.twoHanded) && this.item.system.worn.value
            data['canBeWrongGrip'] = !["Daggers", "Fencing Weapons"].includes(game.i18n.localize(`LocalizedCTs.${this.item.system.combatskill.value}`))
        }
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        return data
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned && game.settings.get("dsa5", "armorAndWeaponDamage") && this.item.system.structure.max > 0) {
            buttons.unshift({
                class: "rollDamaged",
                icon: `fas fa-dice-d20`,
                onclick: async() => EquipmentDamage.breakingTest(this.item)
            })
        }
        return buttons
    }
}

class PoisonSheetDSA5 extends ItemSheetObfuscation(ItemSheetdsa5) {
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
        if (this.item.system.step.value > 1) {
            xpCost = this.item.system.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.system.step.value - 1]
            }
            xpCost = await SpecialabilityRulesDSA5.refundFreelanguage(this.item, this.item.actor, xpCost)
            await this.item.actor._updateAPs(xpCost * -1)
            await this.item.update({ "system.step.value": this.item.system.step.value - 1 })
        }
    }

    async _advanceStep() {
        let xpCost, steps
        if (this.item.system.step.value < this.item.system.maxRank.value) {
            xpCost = this.item.system.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.system.step.value]
            }
            xpCost = await SpecialabilityRulesDSA5.isFreeLanguage(this.item, this.item.actor, xpCost)
            if (await this.item.actor.checkEnoughXP(xpCost)) {
                await this.item.actor._updateAPs(xpCost)
                await this.item.update({ "system.step.value": this.item.system.step.value + 1 })
            }
        }
    }

    _advancable() {
        return this.item.system.maxRank.value > 0
    }

    async getData(options) {
        const data = await super.getData(options);
        mergeObject(data, {
            categories: DSA5.specialAbilityCategories,
            subCategories: DSA5.combatSkillSubCategories,
            traditionArtifacts: DSA5.traditionArtifacts,
            canOnUseEffect: game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        })
        return data
    }

}

class ItemSpeciesDSA5 extends ItemSheetdsa5 {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 530,
            height: 570,
        });
        return options;
    }

    async getData(options) {
        const data = await super.getData(options);
        mergeObject(data, {
            hasLocalization: game.i18n.has(`Racedescr.${this.item.name}`)
        })
        return data
    }
}

class SpellSheetDSA5 extends ItemSheetdsa5 {
    async getData(options) {
        const data = await super.getData(options);
        data.characteristics = DSA5.characteristics;
        data.StFs = DSA5.StFs;
        data.resistances = DSA5.magicResistanceModifiers
        data.targetTypes = DSA5.areaTargetTypes
        if (data.isOwned) {
            data.extensions = this.item.actor.items.filter(x => { return x.type == "spellextension" && x.system.source == this.item.name && this.item.type == x.system.category })
        }
        return data
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.item-edit').click(ev => {
            ev.preventDefault()
            let itemId = this._getItemId(ev)
            const item = this.item.actor.items.get(itemId)
            item.sheet.render(true);
        });

        html.find('.item-delete').click(ev => {
            this._deleteItem(ev)
        });
    }

    _deleteItem(ev) {
        let itemId = this._getItemId(ev);
        let item = this.actor.items.find(x => x.id == itemId)
        let message = game.i18n.format("DIALOG.DeleteItemDetail", { item: item.name })
        renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.html', { message }).then(html => {
            new Dialog({
                title: game.i18n.localize("deleteConfirmation"),
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
        let item = this.item.actor.items.find(x => x.id == itemId)
        await this.item.actor._updateAPs(-1 * item.system.APValue.value)
        await this.item.actor.deleteEmbeddedDocuments("Item", [itemId]);
    }
}

class SpellExtensionSheetDSA5 extends ItemSheetdsa5 {
    async getData(options) {
        const data = await super.getData(options)
        mergeObject(data, {
            categories: { spell: "spell", liturgy: "liturgy", ritual: "ritual", ceremony: "ceremony" }
        })
        return data
    }
}

class VantageSheetDSA5 extends ItemSheetdsa5 {
    _advancable() {
        return this.item.system.max.value > 0
    }

    async _refundStep() {
        let xpCost, steps
        if (this.item.system.step.value > 1) {
            xpCost = this.item.system.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.system.step.value - 1]
            }
            await this.item.actor._updateAPs(xpCost * -1)
            await this.item.update({ "system.step.value": this.item.system.step.value - 1 })
        }
    }

    async getData(options) {
        const data = await super.getData(options)
        data.canOnUseEffect = game.user.isGM || await game.settings.get("dsa5", "playerCanEditSpellMacro")
        return data
    }

    async _advanceStep() {
        let xpCost, steps
        if (this.item.system.step.value < this.item.system.max.value) {
            xpCost = this.item.system.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.system.step.value]
            }
            if (await this.item.actor.checkEnoughXP(xpCost)) {
                await this.item.actor._updateAPs(xpCost)
                await this.item.update({ "system.step.value": this.item.system.step.value + 1 })
            }
        }
    }
}
