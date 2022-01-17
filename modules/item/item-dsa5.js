import DSA5_Utility from "../system/utility-dsa5.js";
import DiceDSA5 from "../system/dice-dsa5.js"
import Actordsa5 from "../actor/actor-dsa5.js";
import DSA5StatusEffects from "../status/status_effects.js";
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import ItemRulesDSA5 from "../system/item-rules-dsa5.js";
import DSAActiveEffectConfig from "../status/active_effects.js";
import RuleChaos from "../system/rule_chaos.js";
import CreatureType from "../system/creature-type.js";

export default class Itemdsa5 extends Item {
    static defaultImages = {
        "advantage": "systems/dsa5/icons/categories/Vorteil.webp",
        "disadvantage": "systems/dsa5/icons/categories/Nachteil.webp",
        "armor": "systems/dsa5/icons/categories/Armor.webp",
        "meleeweapon": "systems/dsa5/icons/categories/Meleeweapon.webp",
        "rangeweapon": "systems/dsa5/icons/categories/Rangeweapon.webp",
        "equipment": "systems/dsa5/icons/categories/Equipment.webp",
        "consumable": "systems/dsa5/icons/categories/Equipment.webp",
        "liturgy": "systems/dsa5/icons/categories/Liturgy.webp",
        "spell": "systems/dsa5/icons/categories/Spell.webp",
        "ammunition": "systems/dsa5/icons/categories/Munition.webp",
        "career": "systems/dsa5/icons/categories/Career.webp",
        "magictrick": "systems/dsa5/icons/categories/Spelltrick.webp",
        "blessing": "systems/dsa5/icons/categories/Blessing.webp",
        "combatskill": "systems/dsa5/icons/categories/Combat_Skill.webp",
        "skill": "systems/dsa5/icons/categories/Skill.webp",
        "Geweihte": "systems/dsa5/icons/categories/Geweihte.webp",
        "Weltliche": "systems/dsa5/icons/categories/Weltliche.webp",
        "Zauberer": "systems/dsa5/icons/categories/Zauberer.webp",
        "ritual": "systems/dsa5/icons/categories/ritual.webp",
        "ceremony": "systems/dsa5/icons/categories/ceremony.webp",
        "abilityclerical": "systems/dsa5/icons/categories/ability_clerical.webp",
        "abilityCombat": "systems/dsa5/icons/categories/ability_combat.webp",
        "abilityfatePoints": "systems/dsa5/icons/categories/ability_fate_points.webp",
        "abilitygeneral": "systems/dsa5/icons/categories/ability_general.webp",
        "specialability": "systems/dsa5/icons/categories/ability_general.webp",
        "abilitymagical": "systems/dsa5/icons/categories/ability_magical.webp",
        "abilitylanguage": "systems/dsa5/icons/categories/Ability_Language.webp",
        "abilitystaff": "systems/dsa5/icons/categories/ability_staff.webp",
        "abilityceremonial": "systems/dsa5/icons/categories/ability_ceremonial.webp",
        "abilityanimal": "systems/dsa5/icons/categories/ability_animal.webp",
        "trait": "systems/dsa5/icons/categories/trait.webp",
        "Tiere": "systems/dsa5/icons/categories/Tiere.webp",
        "aggregatedTest": "systems/dsa5/icons/categories/aggregated_test.webp",
        "poison": "systems/dsa5/icons/categories/poison.webp",
        "disease": "systems/dsa5/icons/categories/disease.webp",
        "spellextension": "systems/dsa5/icons/categories/Spellextension.webp",
        "species": "icons/environment/people/group.webp",
        "application": "systems/dsa5/icons/categories/Skill.webp",
        "trick": "systems/dsa5/icons/categories/Tiere.webp",
        "disadvantageanimal": "systems/dsa5/icons/categories/NachteilAnimal.webp",
        "advantageanimal": "systems/dsa5/icons/categories/VorteilAnimal.webp",
        "diseaseanimal": "systems/dsa5/icons/categories/diseaseAnimal.webp",
        "effectwrapper": "icons/svg/aura.svg",
        "liturgyTalisman": "systems/dsa5/icons/categories/LiturgieTalisman.webp",
        "plant": "systems/dsa5/icons/categories/plant.webp",
        "magicalsign": "systems/dsa5/icons/categories/magicalsign.webp",
        "abilitypact": "systems/dsa5/icons/categories/ability_pact.webp",
    }

    static defaultIcon(data) {
        if (!data.img || data.img == "") {
            if (data.type in this.defaultImages) {
                data.img = this.defaultImages[data.type]
            } else {
                data.img = "systems/dsa5/icons/blank.webp";
            }
        }
    }

    static async create(data, options) {
        this.defaultIcon(data)
        return await super.create(data, options);
    }

    static getSpecAbModifiers(html, mode) {
        let res = []
        for (let k of html.find('.specAbs')) {
            let step = Number($(k).attr("data-step"))
            if (step > 0) {
                let val = mode == "attack" ? $(k).attr("data-atbonus") : $(k).attr("data-pabonus")
                res.push({
                    name: $(k).find('a').text(),
                    value: Number(val) * step,
                    damageBonus: $(k).attr("data-tpbonus"),
                    dmmalus: $(k).attr("data-dmmalus") * step,
                    step: step,
                    specAbId: $(k).attr("data-id")
                })
            }
        }
        return res
    }

    static setupSubClasses() {
        game.dsa5.config.ItemSubclasses = {
            ritual: RitualItemDSA5,
            spell: SpellItemDSA5,
            liturgy: LiturgyItemDSA5,
            ceremony: CeremonyItemDSA5,
            advantage: VantageItemDSA5,
            disadvantage: VantageItemDSA5,
            aggregatedTest: aggregatedTestItemDSA5,
            trait: TraitItemDSA5,
            blessing: BlessingItemDSA5,
            magictrick: CantripItemDSA5,
            specialability: SpecialAbilityItemDSA5,
            disease: DiseaseItemDSA5,
            poison: PoisonItemDSA5,
            armor: ArmorItemDSA5,
            rangeweapon: RangeweaponItemDSA5,
            meleeweapon: MeleeweaponDSA5,
            ammunition: AmmunitionItemDSA5,
            equipment: EquipmentItemDSA5,
            combatskill: CombatskillDSA5,
            skill: SkillItemDSA5,
            consumable: ConsumableItemDSA,
            spellextension: SpellextensionItemDSA5,
            species: SpeciesItemDSA5,
            effectwrapper: EffectWrapperItemDSA5,
            plant: PlantItemDSA5,
            magicalsign: MagicalSignItemDSA5
        }
    }

    static buildSpeaker(actor, tokenId) {
        return {
            token: tokenId,
            actor: actor ? actor.data._id : undefined,
            scene: canvas.scene ? canvas.scene.id : null
        }
    }

    static addCreatureTypeModifiers(actorData, source, situationalModifiers) {
        const creatureTypes = CreatureType.detectCreatureType(actorData)
        const isSpell = ["spell", "ceremony", "liturgy", "ritual"].includes(source.type)
        for (let k of creatureTypes) {
            const modifiers = k.damageModifier(source)
            if (isSpell) {
                for (let mod of modifiers) {
                    mod.armorPen = k.spellResistanceModifier(actorData)
                }
            }
            situationalModifiers.push(...modifiers)
        }
    }

    static parseValueType(name, val) {
        let type = ""
        if (/^\*/.test(val)) {
            type = "*"
            val = val.substring(1)
        }
        return {
            name,
            value: Number(val),
            type
        }
    }

    async addCondition(effect, value = 1, absolute = false, auto = true) {
        return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto)
    }

    async _dependentEffects(statusId, effect, delta) {}

    async removeCondition(effect, value = 1, auto = true, absolute = false) {
        return DSA5StatusEffects.removeCondition(this, effect, value, auto, absolute)
    }

    hasCondition(conditionKey) {
        return DSA5StatusEffects.hasCondition(this, conditionKey)
    }

    static getSkZkModifier(data, source) {
        let skMod = [0]
        let zkMod = [0]

        const hasSpellResistance = ["spell", "liturgy", "ceremony", "ritual"].includes(source.type) && source.data.effectFormula.value.trim() == ""
        if (game.user.targets.size) {
            game.user.targets.forEach(target => {
                if (target.actor) {
                    let spellResistance = 0
                    if (hasSpellResistance) {
                        const creatureTypes = CreatureType.detectCreatureType(target.actor.data)
                        spellResistance = creatureTypes.reduce((sum, x) => { return sum + x.spellResistanceModifier(target.actor.data) }, 0)
                    }

                    skMod.push(target.actor.data.data.status.soulpower.max * -1 - spellResistance)
                    zkMod.push(target.actor.data.data.status.toughness.max * -1 - spellResistance)
                }
            });
        }

        mergeObject(data, {
            SKModifier: Math.min(...skMod),
            ZKModifier: Math.min(...zkMod)
        });
    }

    static parseEffect(effect, actor) {
        let itemModifiers = {}
        let regex = new RegExp(game.i18n.localize("CHARAbbrev.GS"), "gi")
        for (let mod of effect.split(/,|;/).map(x => x.trim())) {
            let vals = mod.replace(/(\s+)/g, ' ').trim().split(" ")
            vals[0] = vals[0].replace(regex, actor.data.data.status.speed.max)
            if (vals.length == 2) {
                if (!isNaN(vals[0]) || /(=)?[+-]\d([+-]\d)?/.test(vals[0]) || /(=)?\d[dDwW]\d/.test(vals[0]) || /=\d+/.test(vals[0])) {
                    if (itemModifiers[vals[1].toLowerCase()] == undefined) {
                        itemModifiers[vals[1].toLowerCase()] = [vals[0]]
                    } else {
                        itemModifiers[vals[1].toLowerCase()].push(vals[0])
                    }
                }
            }
        }
        return itemModifiers
    }

    static getDefenseMalus(situationalModifiers, actor) {
        if (actor.data.flags.oppose) {
            let message = game.messages.get(actor.data.flags.oppose.messageId)
            const regex = / \[(-)?\d{1,}\]/
            for (let mal of message.data.flags.data.preData.situationalModifiers.filter(x => x.dmmalus != undefined && x.dmmalus != 0)) {
                situationalModifiers.push({
                    name: `${game.i18n.localize('MODS.defenseMalus')} - ${mal.name.replace(regex,"")}`,
                    value: mal.dmmalus,
                    selected: true
                })
            }
            for (let mal of message.data.flags.data.preData.situationalModifiers.filter(x => x.type == "defenseMalus" && x.value != 0)) {
                situationalModifiers.push({
                    name: mal.name.replace(regex, ""),
                    value: mal.value,
                    selected: true
                })
            }
            if (message.data.flags.data.postData.halfDefense) {
                situationalModifiers.push({
                    name: `${game.i18n.localize('MODS.defenseMalus')} - ${game.i18n.localize("halfDefenseShort")}`,
                    value: 0.5,
                    type: "*",
                    selected: true,
                })
            }
        }
    }

    static changeChars(source, ch1, ch2, ch3) {
        source.data.characteristic1.value = ch1
        source.data.characteristic2.value = ch2
        source.data.characteristic3.value = ch3
    }

    static buildCombatSpecAbs(actor, categories, toSearch, mode) {
        let searchFilter
        if (toSearch) {
            toSearch.push(game.i18n.localize("LocalizedIDs.all"))
            toSearch = toSearch.map(x => x.toLowerCase())
            searchFilter = (x, toSearch) => { return x.data.data.list.value.split(/;|,/).map(x => x.trim().toLowerCase()).filter(y => toSearch.includes(y.replace(/ \([a-zA-Z äüöÄÖÜ]*\)/, ""))).length > 0 }
        } else
            searchFilter = () => { return true }


        const combatSpecAbs = actor.items.filter(x => {
            return x.type == "specialability" &&
                categories.includes(x.data.data.category.value) &&
                x.data.data.effect.value != "" &&
                searchFilter(x, toSearch)
        })

        let combatskills = []
        const at = game.i18n.localize("LocalizedAbilityModifiers.at")
        const tp = game.i18n.localize("LocalizedAbilityModifiers.tp")
        const pa = game.i18n.localize("LocalizedAbilityModifiers.pa")
        const dm = game.i18n.localize("LocalizedAbilityModifiers.dm")

        if (mode == "attack") {
            for (let com of combatSpecAbs) {
                const effects = Itemdsa5.parseEffect(com.data.data.effect.value, actor)
                const atbonus = effects[at] || 0
                const tpbonus = effects[tp] || 0
                const dmmalus = effects[dm] || 0
                if (atbonus != 0 || tpbonus != 0 || dmmalus != 0 || com.data.effects.size > 0) {
                    const subCategory = game.i18n.localize(DSA5.combatSkillSubCategories[com.data.data.category.sub])
                    combatskills.push({
                        name: com.name,
                        atbonus,
                        tpbonus,
                        dmmalus,
                        label: `${at}: ${atbonus}, ${tp}: ${tpbonus}, ${dm}: ${dmmalus}`,
                        steps: com.data.data.step.value,
                        category: {
                            id: com.data.data.category.sub,
                            css: `ab_${com.data.data.category.sub}`,
                            name: subCategory
                        },
                        id: com.id,
                        actor: actor.id
                    })
                }
            }
        } else {
            for (let com of combatSpecAbs) {
                const effects = Itemdsa5.parseEffect(com.data.data.effect.value, actor)
                const pabonus = effects[pa] || 0
                if (pabonus != 0) {
                    const subCategory = game.i18n.localize(DSA5.combatSkillSubCategories[com.data.data.category.sub])
                    combatskills.push({
                        name: com.name,
                        pabonus,
                        tpbonus: 0,
                        dmmalus: 0,
                        label: `${pa}: ${pabonus}`,
                        steps: com.data.data.step.value,
                        category: {
                            id: com.data.data.category.sub,
                            css: `ab_${com.data.data.category.sub}`,
                            name: subCategory
                        },
                        id: com.id,
                        actor: actor.id
                    })
                }
            }
        }
        return combatskills
    }

    static getCombatSkillModifier(actor, source, situationalModifiers) {
        let combatskill = actor.items.find(x => x.type == "combatskill" && x.name == source.data.combatskill.value)

        for (let ef of combatskill.data.effects) {
            for (let change of ef.data.changes) {
                switch (change.key) {
                    case "data.rangeStats.defenseMalus":
                    case "data.meleeStats.defenseMalus":
                        situationalModifiers.push({
                            name: `${combatskill.name} - ${game.i18n.localize('MODS.defenseMalus')}`,
                            value: change.value * -1,
                            type: "defenseMalus",
                            selected: true
                        })
                        break
                }
            }
        }
    }

    static _chatLineHelper(key, val) {
        return `<b>${game.i18n.localize(key)}</b>: ${val ? val : "-"}`
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        return null
    }

    //TODO find tokenId
    setupEffect(ev, options = {}, tokenId) {
        return Itemdsa5.getSubClass(this.data.type).setupDialog(ev, options, this, tokenId)
    }

    static checkEquality(item, item2) {
        return item2.type == item.type && item.name == item2.name && item.data.description.value == item2.data.data.description.value
    }

    static async combineItem(item1, item2, actor) {
        item1 = duplicate(item1)
        item1.data.quantity.value += item2.data.quantity.value
        return await actor.updateEmbeddedDocuments("Item", [item1])
    }

    static areEquals(item, item2) {
        if (item.type != item2.type) return false

        return Itemdsa5.getSubClass(item.type).checkEquality(item, item2)
    }

    static async stackItems(stackOn, newItem, actor) {
        return await Itemdsa5.getSubClass(stackOn.type).combineItem(stackOn, newItem, actor)
    }

    _setupCardOptions(template, title) {
        const speaker = ChatMessage.getSpeaker()
        return {
            speaker: {
                alias: speaker.alias,
                scene: speaker.scene
            },
            flags: {
                img: speaker.token ? canvas.tokens.get(speaker.token).data.img : this.img
            },
            title,
            template,
        }
    }

    async itemTest({ testData, cardOptions }, options = {}) {
        testData = await DiceDSA5.rollDices(testData, cardOptions);
        let result = await DiceDSA5.rollTest(testData);

        result.postFunction = "itemTest";

        if (game.user.targets.size) {
            cardOptions.isOpposedTest = testData.opposable
            if (cardOptions.isOpposedTest)
                cardOptions.title += ` - ${game.i18n.localize("Opposed")}`;
        }

        // TODO this can probably be removed
        if (testData.extra.ammo && !testData.extra.ammoDecreased) {
            testData.extra.ammoDecreased = true
            testData.extra.ammo.data.quantity.value--;
            await this.updateEmbeddedDocuments("Item", [{ _id: testData.extra.ammo._id, "data.quantity.value": testData.extra.ammo.data.quantity.value }]);
        }

        if (!options.suppressMessage)
            DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage)

        return { result, cardOptions };
    }

    static chatData(data, name) {
        return []
    }

    static getSubClass(type) {
        if (game.dsa5.config.ItemSubclasses[type])
            return game.dsa5.config.ItemSubclasses[type]
        else
            return Itemdsa5
    }

    async postItem() {
        let chatData = duplicate(this.data);
        const properties = Itemdsa5.getSubClass(this.data.type).chatData(duplicate(chatData.data), this.name)

        chatData["properties"] = properties

        chatData.hasPrice = "price" in chatData.data;
        if (chatData.hasPrice) {
            let price = chatData.data.price.value;
            if (chatData.data.QL)
                price *= chatData.data.QL

            chatData.data.price.D = Math.floor(price / 10);
            price -= chatData.data.price.D * 10;
            chatData.data.price.S = Math.floor(price);
            price -= chatData.data.price.S;
            chatData.data.price.H = Math.floor(price / 0.1);
            price -= (chatData.data.price.H * 0.1);
            chatData.data.price.K = Math.round(price / 0.01);

            properties.push(`<b>${game.i18n.localize("price")}</b>: ${chatData.data.price.D} <div title="${game.i18n.localize("Money-D")}" class="chatmoney money-D"></div>, ${chatData.data.price.S} <div title="${game.i18n.localize("Money-S")}" class="chatmoney money-S"></div>, ${chatData.data.price.H} <div title="${game.i18n.localize("Money-H")}" class="chatmoney money-H"></div>, ${chatData.data.price.K} <div title="${game.i18n.localize("Money-K")}" class="chatmoney money-K"></div>`);
        }

        if (this.pack)
            chatData.itemLink = `@Compendium[${this.pack}.${this.id}]`

        if (chatData.img.includes("/blank.webp"))
            chatData.img = null;

        renderTemplate('systems/dsa5/templates/chat/post-item.html', chatData).then(html => {
            let chatOptions = DSA5_Utility.chatDataSetup(html)

            chatOptions["flags.transfer"] = JSON.stringify({
                type: "postedItem",
                payload: this.data,
            })
            chatOptions["flags.recreationData"] = chatData;
            ChatMessage.create(chatOptions)
        });
    }
}

class PlantItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("effect", data.effect),
            this._chatLineHelper("PLANT.recipes", data.recipes),
            this._chatLineHelper("PLANT.usages", data.usages)
        ]

        return res
    }
}

class MagicalSignItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("AsPCost", data.asp)
        ]
        if (data.category == 2) res.push(this._chatLineHelper("feature", data.feature))

        return res
    }
}

class aggregatedTestItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let result = game.i18n.localize("Ongoing")
        if (data.cummulatedQS.value >= 10) {
            result = game.i18n.localize("Success")
        } else if (data.cummulatedQS.value >= 6) {
            result = game.i18n.localize("PartSuccess")
        } else if (data.allowedTestCount.value - data.usedTestCount.value <= 0) {
            result = game.i18n.localize("Failure")
        }
        return [
            this._chatLineHelper("cummulatedQS", `${data.cummulatedQS.value} / 10`),
            this._chatLineHelper("interval", data.interval.value),
            this._chatLineHelper("probes", `${data.usedTestCount.value} / ${data.allowedTestCount.value}`),
            this._chatLineHelper("result", result),
        ]
    }
}

class AmmunitionItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("ammunitiongroup", game.i18n.localize(data.ammunitiongroup.value))
        ]
    }
}

class EffectWrapperItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return []
    }
}

class ArmorItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let properties = [
            this._chatLineHelper("protection", data.protection.value),
            this._chatLineHelper("encumbrance", data.encumbrance.value)
        ]
        if (data.effect.value != "")
            properties.push(this._chatLineHelper("effect", data.effect.value))

        return properties
    }
}

class CantripItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("feature", data.feature.value),
        ]
    }
}

class BlessingItemDSA5 extends CantripItemDSA5 {}

class SpellItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("AsPCost", data.AsPCost.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.effect.value)))
        ]
    }

    static getCallbackData(testData, html, actor) {
        testData.testModifier = Number(html.find('[name="testModifier"]').val());
        testData.testDifficulty = 0
        testData.situationalModifiers = Actordsa5._parseModifiers(html)
        testData.calculatedSpellModifiers = {
            castingTime: html.find(".castingTime").text(),
            cost: html.find(".aspcost").text(),
            reach: html.find(".reach").text(),
            maintainCost: html.find(".maintainCost").text()
        }
        testData.situationalModifiers.push({
            name: game.i18n.localize("removeGesture"),
            value: html.find('[name="removeGesture"]').is(":checked") ? -2 : 0
        }, {
            name: game.i18n.localize("removeFormula"),
            value: html.find('[name="removeFormula"]').is(":checked") ? -2 : 0
        }, {
            name: game.i18n.localize("castingTime"),
            value: html.find(".castingTime").data("mod")
        }, {
            name: game.i18n.localize("cost"),
            value: html.find(".aspcost").data('mod')
        }, {
            name: game.i18n.localize("reach"),
            value: html.find(".reach").data('mod')
        }, {
            name: game.i18n.localize("zkModifier"),
            value: html.find('[name="zkModifier"]').val() || 0
        }, {
            name: game.i18n.localize("skModifier"),
            value: html.find('[name="skModifier"]').val() || 0
        }, {
            name: game.i18n.localize("maintainedSpells"),
            value: Number(html.find('[name="maintainedSpells"]').val()) * -1
        })
        testData.extensions = SpellItemDSA5.getSpecAbModifiers(html).join(", ")
        testData.advancedModifiers = {
            chars: [0, 1, 2].map(x => Number(html.find(`[name="ch${x}"]`).val())),
            fws: Number(html.find(`[name="fw"]`).val()),
            qls: Number(html.find(`[name="qs"]`).val())
        }
        Itemdsa5.changeChars(testData.source, ...[0, 1, 2].map(x => html.find(`[name="characteristics${x}"]`).val()))
    }

    static getSpecAbModifiers(html) {
        let res = []
        for (let k of html.find('.specAbs.active')) {
            res.push(`<span title="${$(k).attr("title")}">${$(k).attr("data-name")}</span>`)
        }
        return res
    }

    static attackSpellMalus(source) {
        let res = []
        if (source.data.effectFormula.value)
            res.push({ name: game.i18n.localize('MODS.defenseMalus'), value: -4, type: "defenseMalus", selected: true })

        return res
    }

    static getPropertyFocus(actor, item) {
        const features = getProperty(item, "data.feature") || ""
        const res = []
        for (const feature of features.replace(/\(a-z äöü\-\)/gi, "").split(",").map(x => x.trim())) {
            if (SpecialabilityRulesDSA5.hasAbility(actor.data, `${game.i18n.localize('LocalizedIDs.propertyFocus')} (${feature})`)) {
                res.push({
                    name: `${game.i18n.localize('LocalizedIDs.propertyFocus')} (${feature})`,
                    value: 1
                })
                break
            }
        }
        return res
    }

    static foreignSpellModifier(actor, source, situationalModifiers, data) {
        if (game.settings.get("dsa5", "enableForeignSpellModifer") && ["npc", "character"].includes(actor.data.type) && ["spell", "ritual"].includes(source.type)) {
            const distributions = source.data.distribution.value.split(",").map(x => x.trim().toLowerCase())
            const regx = new RegExp(`(${game.i18n.localize("tradition")}|\\\)|\\\()`, "g")
            const traditions = actor.data.data.tradition.magical.replace(regx, "").split(",").map(x => x.trim().toLowerCase())
            traditions.push(game.i18n.localize("general").toLowerCase())

            data.isForeign = !distributions.some(x => traditions.includes(x))
            if (data.isForeign) {
                situationalModifiers.push({ name: game.i18n.localize('DSASETTINGS.enableForeignSpellModifer'), value: -2, selected: true })
            }
        }
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(...ItemRulesDSA5.getTalentBonus(actor.data, source.name, ["advantage", "disadvantage", "specialability", "equipment"]))
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.magicalAttunement'), 1, true))
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.magicalRestriction'), -1, true))
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.boundToArtifact'), -1, true))
        situationalModifiers.push(...this.getPropertyFocus(actor, source))
        situationalModifiers.push(...this.attackSpellMalus(source))
        this.foreignSpellModifier(actor, source, situationalModifiers, data)
        if (game.user.targets.size) {
            game.user.targets.forEach(target => {
                if (target.actor) this.addCreatureTypeModifiers(target.actor.data, source, situationalModifiers)
            });
        }
        situationalModifiers.push(...actor.getSkillModifier(source.name, source.type))
        for (const thing of actor.data.data.skillModifiers.global) {
            situationalModifiers.push({ name: thing.source, value: thing.value })
        }

        this.getSkZkModifier(data, source)
    }

    static setupDialog(ev, options, spell, actor, tokenId) {
        let sheet = "spell"
        if (spell.type == "ceremony" || spell.type == "liturgy")
            sheet = "liturgy"

        let title = spell.name + " " + game.i18n.localize(`${spell.type}Test`);

        let testData = {
            opposable: spell.data.effectFormula.value.length > 0,
            source: spell,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId)
            }
        };
        let data = {
            rollMode: options.rollMode,
            spellCost: spell.data.AsPCost.value,
            maintainCost: spell.data.maintainCost.value,
            spellCastingTime: spell.data.castingTime.value,
            spellReach: spell.data.range.value,
            canChangeCost: spell.data.canChangeCost.value == "true",
            canChangeRange: spell.data.canChangeRange.value == "true",
            canChangeCastingTime: spell.data.canChangeCastingTime.value == "true",
            hasSKModifier: spell.data.resistanceModifier.value == "SK",
            hasZKModifier: spell.data.resistanceModifier.value == "ZK",
            maxMods: Math.floor(Number(spell.data.talentValue.value) / 4),
            extensions: this.prepareExtensions(actor, spell),
            variableBaseCost: spell.data.variableBaseCost == "true",
            characteristics: [1, 2, 3].map(x => spell.data[`characteristic${x}`].value)
        }

        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, spell) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, spell)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: `/systems/dsa5/templates/dialog/${sheet}-enhanced-dialog.html`,
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                this.getCallbackData(testData, html, actor)
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions };
            }
        };

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/spell-card.html", title)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
    }

    static prepareExtensions(actor, spell) {
        return actor.items.filter(x => x.type == "spellextension" && x.data.data.source == spell.name && x.data.data.category == spell.type).map(x => {
            x.shortName = (x.name.split(" - ").length > 1 ? x.name.split(" - ")[1] : x.name)
            x.descr = $(x.data.data.description.value).text()
            return x
        })
    }
}

class LiturgyItemDSA5 extends SpellItemDSA5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("KaPCost", data.AsPCost.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.effect.value)))
        ]
    }
}

class CeremonyItemDSA5 extends LiturgyItemDSA5 {
    static getCallbackData(testData, html, actor) {
        super.getCallbackData(testData, html, actor)
        testData.situationalModifiers.push({
            name: game.i18n.localize("CEREMONYMODIFIER.artefact"),
            value: html.find('[name="artefactUsage"]').is(":checked") ? 1 : 0
        }, {
            name: game.i18n.localize("place"),
            value: html.find('[name="placeModifier"]').val()
        }, {
            name: game.i18n.localize("time"),
            value: html.find('[name="timeModifier"]').val()
        })
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(...ItemRulesDSA5.getTalentBonus(actor.data, source.name, ["advantage", "disadvantage", "specialability", "equipment"]))
        this.getSkZkModifier(data, source)
        mergeObject(data, {
            isCeremony: true,
            locationModifiers: DSA5.ceremonyLocationModifiers,
            timeModifiers: DSA5.ceremonyTimeModifiers
        })
    }
}

class CombatskillDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("Description", game.i18n.localize(`Combatskilldescr.${name}`)),
        ]
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let mode = options.mode
        let title = game.i18n.localize(item.name) + " " + game.i18n.localize(mode + "test");

        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId)
            }
        };

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/combatskill-dialog.html",
            data: {
                rollMode: options.rollMode
            },
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions };
            }
        };

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
    }
}

class ConsumableItemDSA extends Itemdsa5 {
    static chatData(dat, name) {
        return [
            this._chatLineHelper("qualityStep", data.QL),
            this._chatLineHelper("effect", DSA5_Utility.replaceDies(data.QLList.split("\n")[data.QL - 1])),
            this._chatLineHelper("charges", data.charges)
        ]
    }

    static checkEquality(item, item2) {
        return item2.type == item.type && item.name == item2.name && item.data.description.value == item2.data.data.description.value && item.data.QL == item2.data.data.QL
    }

    static async setupDialog(ev, options, item, actor) {
        let title = game.i18n.format("CHATNOTIFICATION.usesItem", { actor: item.actor.name, item: item.name })

        if (!item.isOwned)
            return

        let charges = (item.data.data.quantity.value - 1) * item.data.data.maxCharges + item.data.data.charges
        if (charges <= 0) {
            ui.notifications.error(game.i18n.localize("DSAError.NotEnoughCharges"))
            return
        }

        let newCharges = item.data.data.charges <= 1 ? item.data.data.maxCharges : item.data.data.charges - 1
        let newQuantity = item.data.data.charges <= 1 ? item.data.data.quantity.value - 1 : item.data.data.quantity.value

        let effect = DSA5_Utility.replaceDies(item.data.data.QLList.split("\n")[item.data.data.QL - 1], false)
        let msg = `<div><b>${title}</b></div><div>${item.data.data.description.value}</div><div><b>${game.i18n.localize('effect')}</b>: ${effect}</div>`
        if (newQuantity == 0) {
            await item.actor.deleteEmbeddedDocuments("Item", [item.data._id])
        } else {
            await item.update({
                'data.quantity.value': newQuantity,
                'data.charges': newCharges
            })
        }
        await ChatMessage.create(DSA5_Utility.chatDataSetup(msg))
        await this._applyActiveEffect(item)
    }

    static async _applyActiveEffect(source) {
        let effects = source.data.effects.toObject()
        if (effects.length > 0) {
            const effectsWithChanges = effects.filter(x => x.changes && x.changes.length > 0)
            await source.actor.createEmbeddedDocuments("ActiveEffect", effectsWithChanges.map(x => {
                x.origin = source.actor.uuid
                return x
            }))
            const msg = await DSAActiveEffectConfig.applyAdvancedFunction(source.actor, effects, source, { qualityStep: source.data.data.QL })
            const infoMsg = `${game.i18n.format('ActiveEffects.appliedEffect', { target: source.actor.name, source: source.name })} ${msg || ""}`
            ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        }
    }

    static async combineItem(item1, item2, actor) {
        item1 = duplicate(item1)
        let charges = (item1.data.quantity.value - 1) * item1.data.maxCharges + item1.data.charges
        let item2charges = (item2.data.quantity.value - 1) * item2.data.maxCharges + item2.data.charges
        let newQuantity = Math.floor((charges + item2charges) / item1.data.maxCharges) + 1
        let newCharges = (charges + item2charges) % item1.data.maxCharges
        if (newCharges == 0) {
            newQuantity -= 1
            newCharges = item1.data.maxCharges
        }
        item1.data.quantity.value = newQuantity
        item1.data.charges = newCharges
        return await actor.updateEmbeddedDocuments("Item", [item1])
    }
}

class DiseaseItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("stepValue", data.step.value),
            this._chatLineHelper("incubation", data.incubation.value),
            this._chatLineHelper("damage", DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.damage.value))),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("source", DSA5_Utility.replaceDies(data.source.value)),
            this._chatLineHelper("treatment", data.treatment.value),
            this._chatLineHelper("antidot", data.antidot.value),
            this._chatLineHelper("resistanceModifier", data.resistance.value)
        ]
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        source = DSA5_Utility.toObjectIfPossible(source)
        if (game.user.targets.size) {
            game.user.targets.forEach(target => {
                if (target.actor) situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(target.actor.data, game.i18n.localize("LocalizedIDs.ResistanttoDisease"), -1))
            });
        }
        this.getSkZkModifier(data, source)
        mergeObject(data, {
            hasSKModifier: source.data.resistance.value == "SK",
            hasZKModifier: source.data.resistance.value == "ZK"
        })
    }
    static setupDialog(ev, options, item, actor, tokenId) {
        let title = item.name + " " + game.i18n.localize(item.type) + " " + game.i18n.localize("Test");

        let testData = {
            opposable: false,
            source: item.data,
            extra: {
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId)
            }
        };
        let data = {
            rollMode: options.rollMode
        }
        let situationalModifiers = []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/poison-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                testData.situationalModifiers.push({
                    name: game.i18n.localize("zkModifier"),
                    value: html.find('[name="zkModifier"]').val() || 0
                })
                testData.situationalModifiers.push({
                    name: game.i18n.localize("skModifier"),
                    value: html.find('[name="skModifier"]').val() || 0
                })
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions };
            }
        };

        let cardOptions = item._setupCardOptions(`systems/dsa5/templates/chat/roll/${item.type}-card.html`, title)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
    }
}

class EquipmentItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("equipmentType", game.i18n.localize(`Equipment.${data.equipmentType.value}`))
        ]
    }
}

class MeleeweaponDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("atmod", data.atmod.value),
            this._chatLineHelper("pamod", data.pamod.value),
            this._chatLineHelper("combatskill", data.combatskill.value)
        ]
        if (data.effect.value != "")
            res.push(this._chatLineHelper(DSA5_Utility.replaceConditions("effect", data.effect.value)))

        return res
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        let wrongHandDisabled = AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize('LocalizedIDs.ambidextrous'))
        source = DSA5_Utility.toObjectIfPossible(source)

        let toSearch = [source.data.combatskill.value]
        let combatskills = Itemdsa5.buildCombatSpecAbs(actor, ["Combat"], toSearch, data.mode)
        if (data.mode == "attack") {
            let targetWeaponsize = "short"
            if (game.user.targets.size) {
                game.user.targets.forEach(target => {
                    if (target.actor) {
                        let defWeapon = target.actor.items.filter(x => x.data.type == "meleeweapon" && x.data.data.worn.value)
                        if (defWeapon.length > 0)
                            targetWeaponsize = defWeapon[0].data.data.reach.value

                        this.addCreatureTypeModifiers(target.actor.data, source, situationalModifiers)
                    }
                });
            }

            this.getCombatSkillModifier(actor, source, situationalModifiers)

            const defenseMalus = Number(actor.data.data.meleeStats.defenseMalus) * -1
            if (defenseMalus != 0) {
                situationalModifiers.push({
                    name: `${game.i18n.localize("statuseffects")} - ${game.i18n.localize('MODS.defenseMalus')}`,
                    value: defenseMalus,
                    type: "defenseMalus",
                    selected: true
                })
            }
            mergeObject(data, {
                visionOptions: DSA5.meleeRangeVision(data.mode),
                weaponSizes: DSA5.meleeRanges,
                melee: true,
                wrongHandDisabled: wrongHandDisabled,
                offHand: !wrongHandDisabled && source.data.worn.offHand,
                targetWeaponSize: targetWeaponsize,
                combatSpecAbs: combatskills,
                showAttack: true,
                constricted: actor.hasCondition("constricted")
            });
        } else if (data.mode == "parry") {
            Itemdsa5.getDefenseMalus(situationalModifiers, actor)
            mergeObject(data, {
                visionOptions: DSA5.meleeRangeVision(data.mode),
                showDefense: true,
                wrongHandDisabled: wrongHandDisabled && source.data.worn.offHand,
                melee: true,
                combatSpecAbs: combatskills,
                constricted: actor.hasCondition("constricted")
            });
        }

        const statEff = Number(actor.data.data.meleeStats[data.mode])
        if (statEff != 0) {
            situationalModifiers.push({
                name: game.i18n.localize("statuseffects"),
                value: statEff,
                selected: true
            })
        }
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let mode = options.mode
        let title = game.i18n.localize(item.name) + " " + game.i18n.localize(mode + "test");

        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId)
            }
        };
        const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, typeof item.toObject === 'function' ? item.toObject() : item)
        let data = {
            rollMode: options.rollMode,
            mode,
            defenseCountString: game.i18n.format("defenseCount", { malus: multipleDefenseValue })
        }
        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item, { mode }) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                testData.rangeModifier = html.find('[name="distance"]').val()
                testData.sizeModifier = DSA5.rangeSizeModifier[html.find('[name="size"]').val()]
                testData.opposingWeaponSize = html.find('[name="weaponsize"]').val()
                testData.narrowSpace = html.find('[name="narrowSpace"]').is(":checked")
                testData.doubleAttack = html.find('[name="doubleAttack"]').is(":checked") ? (-2 + SpecialabilityRulesDSA5.abilityStep(actor, game.i18n.localize('LocalizedIDs.twoWeaponCombat'))) : 0
                testData.wrongHand = html.find('[name="wrongHand"]').is(":checked") ? -4 : 0
                let attackOfOpportunity = html.find('[name="opportunityAttack"]').is(":checked") ? -4 : 0
                testData.attackOfOpportunity = attackOfOpportunity != 0
                testData.situationalModifiers.push(
                    Itemdsa5.parseValueType(game.i18n.localize("sight"), html.find('[name="vision"]').val() || 0), {
                        name: game.i18n.localize("opportunityAttack"),
                        value: attackOfOpportunity
                    }, {
                        name: game.i18n.localize("attackFromBehind"),
                        value: html.find('[name="attackFromBehind"]').is(":checked") ? -4 : 0
                    }, {
                        name: game.i18n.localize("MODS.damage"),
                        damageBonus: html.find('[name="damageModifier"]').val(),
                        value: 0,
                        step: 1
                    }, {
                        name: game.i18n.format("defenseCount", { malus: multipleDefenseValue }),
                        value: (Number(html.find('[name="defenseCount"]').val()) || 0) * multipleDefenseValue
                    }, {
                        name: game.i18n.localize("advantageousPosition"),
                        value: html.find('[name="advantageousPosition"]').is(":checked") ? 2 : 0
                    })

                testData.situationalModifiers.push(...Itemdsa5.getSpecAbModifiers(html, mode))
                mergeObject(testData.extra.options, options)
                Hooks.call("callbackDialogCombatDSA5", testData, actor, html, item, tokenId)

                return { testData, cardOptions };
            }
        };

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
    }
}

class PoisonItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("stepValue", data.step.value),
            this._chatLineHelper("poisonType", data.poisonType.value),
            this._chatLineHelper("start", data.start.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("resistanceModifier", data.resistance.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.effect.value)))
        ]
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        source = DSA5_Utility.toObjectIfPossible(source)
        if (game.user.targets.size) {
            game.user.targets.forEach(target => {
                if (target.actor) situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(target.actor.data, game.i18n.localize("LocalizedIDs.poisonResistance"), -1))
            });
        }
        this.getSkZkModifier(data, source)
        mergeObject(data, {
            hasSKModifier: source.data.resistance.value == "SK",
            hasZKModifier: source.data.resistance.value == "ZK"
        })
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let title = item.name + " " + game.i18n.localize(item.type) + " " + game.i18n.localize("Test");

        let testData = {
            opposable: false,
            source: item.data,
            extra: {
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId)
            }
        };

        let data = {
            rollMode: options.rollMode
        }

        let situationalModifiers = []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/poison-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = Actordsa5._parseModifiers(html)

                testData.situationalModifiers.push({
                    name: game.i18n.localize("zkModifier"),
                    value: html.find('[name="zkModifier"]').val() || 0
                })
                testData.situationalModifiers.push({
                    name: game.i18n.localize("skModifier"),
                    value: html.find('[name="skModifier"]').val() || 0
                })
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions };
            }
        };

        let cardOptions = item._setupCardOptions(`systems/dsa5/templates/chat/roll/${item.type}-card.html`, title)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
    }
}

class RangeweaponItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("combatskill", data.combatskill.value),
            this._chatLineHelper("reach", data.reach.value)
        ]
        if (data.effect.value != "")
            res.push(this._chatLineHelper(DSA5_Utility.replaceConditions("effect", data.effect.value)))

        return res
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        if (data.mode == "attack") {
            source = DSA5_Utility.toObjectIfPossible(source)

            const toSearch = [source.data.combatskill.value]
            const combatskills = Itemdsa5.buildCombatSpecAbs(actor, ["Combat"], toSearch, data.mode)
            let currentAmmo = actor.items.get(source.data.currentAmmo.value)

            if (currentAmmo) {
                currentAmmo = currentAmmo.toObject(false)
                source.data.effect.attributes = source.data.effect.attributes.split(",").concat(currentAmmo.data.effect.attributes.split(",")).filter(x => x != "").join(",")
            }

            this.getCombatSkillModifier(actor, source, situationalModifiers)

            situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.restrictedSenseSight'), -2))
            let targetSize = "average"
            if (game.user.targets.size) {
                game.user.targets.forEach(target => {
                    if (target.actor) {
                        const tar = getProperty(target.actor.data, "data.status.size")
                        if (tar) targetSize = tar.value

                        this.addCreatureTypeModifiers(target.actor.data, source, situationalModifiers)
                    }
                });
            }

            if (currentAmmo) {
                if (currentAmmo.data.atmod) {
                    situationalModifiers.push({
                        name: `${currentAmmo.name} - ${game.i18n.localize('atmod')}`,
                        value: currentAmmo.data.atmod,
                        selected: true,
                        specAbId: source.data.currentAmmo.value
                    })
                }
                if (currentAmmo.data.damageMod || currentAmmo.data.armorMod) {
                    const dmgMod = {
                        name: `${currentAmmo.name} - ${game.i18n.localize('MODS.damage')}`,
                        value: currentAmmo.data.damageMod.replace(/wWD/g, "d") || 0,
                        type: "dmg",
                        selected: true,
                        specAbId: source.data.currentAmmo.value
                    }
                    if (currentAmmo.data.armorMod) dmgMod["armorPen"] = currentAmmo.data.armorMod
                    situationalModifiers.push(dmgMod)
                }
            }

            const defenseMalus = Number(actor.data.data.rangeStats.defenseMalus) * -1
            if (defenseMalus != 0) {
                situationalModifiers.push({
                    name: `${game.i18n.localize("statuseffects")} - ${game.i18n.localize('MODS.defenseMalus')}`,
                    value: defenseMalus,
                    type: "defenseMalus",
                    selected: true
                })
            }

            const rangeOptions = {...DSA5.rangeWeaponModifiers }
            delete rangeOptions[AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize('LocalizedIDs.senseOfRange')) ? "long" : "rangesense"]

            mergeObject(data, {
                rangeOptions: rangeOptions,
                sizeOptions: DSA5.rangeSizeCategories,
                visionOptions: DSA5.rangeVision,
                mountedOptions: DSA5.mountedRangeOptions,
                shooterMovementOptions: DSA5.shooterMovementOptions,
                targetMovementOptions: DSA5.targetMomevementOptions,
                targetSize: targetSize,
                combatSpecAbs: combatskills,
                aimOptions: DSA5.aimOptions
            });
        }
        const statEff = Number(actor.data.data.rangeStats[data.mode])
        if (statEff != 0) {
            situationalModifiers.push({
                name: game.i18n.localize("statuseffects"),
                value: statEff,
                selected: true
            })
        }
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let mode = options.mode
        let title = game.i18n.localize(item.name) + " " + game.i18n.localize(mode + "test");

        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId)
            }
        };

        if (actor.data.type != "creature" && mode != "damage") {
            let itemData = item.data.data ? item.data.data : item.data
            if (itemData.ammunitiongroup.value == "-") {
                testData.extra.ammo = duplicate(item)
                if ((testData.extra.ammo.data.quantity.value <= 0)) {
                    return ui.notifications.error(game.i18n.localize("DSAError.NoAmmo"))
                }
            } else {
                const ammoItem = actor.getEmbeddedDocument("Item", itemData.currentAmmo.value)
                if (ammoItem) { testData.extra.ammo = ammoItem.toObject() }
                if (!testData.extra.ammo || !itemData.currentAmmo.value || testData.extra.ammo.data.quantity.value <= 0) {
                    return ui.notifications.error(game.i18n.localize("DSAError.NoAmmo"))
                }
            }
        }

        let data = {
            rollMode: options.rollMode,
            mode
        }
        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item, { mode }) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                testData.rangeModifier = html.find('[name="distance"]').val()
                testData.sizeModifier = DSA5.rangeSizeModifier[html.find('[name="size"]').val()]
                testData.narrowSpace = html.find('[name="narrowSpace"]').is(":checked")
                testData.wrongHand = html.find('[name="wrongHand"]').is(":checked") ? -4 : 0
                testData.situationalModifiers.push({
                    name: game.i18n.localize("target") + " " + html.find('[name="targetMovement"] option:selected').text(),
                    value: Number(html.find('[name="targetMovement"]').val()) || 0
                }, {
                    name: game.i18n.localize("shooter") + " " + html.find('[name="shooterMovement"] option:selected').text(),
                    value: Number(html.find('[name="shooterMovement"]').val()) || 0
                }, {
                    name: game.i18n.localize("mount") + " " + html.find('[name="mountedOptions"] option:selected').text(),
                    value: Number(html.find('[name="mountedOptions"]').val()) || 0
                }, {
                    name: game.i18n.localize("rangeMovementOptions.QUICKCHANGE"),
                    value: html.find('[name="quickChange"]').is(":checked") ? -4 : 0
                }, {
                    name: game.i18n.localize("MODS.combatTurmoil"),
                    value: html.find('[name="combatTurmoil"]').is(":checked") ? -2 : 0
                }, {
                    name: game.i18n.localize("aim"),
                    value: Number(html.find('[name="aim"]').val()) || 0
                }, {
                    name: game.i18n.localize("MODS.damage"),
                    damageBonus: html.find('[name="damageModifier"]').val(),
                    value: 0,
                    step: 1
                }, {
                    name: game.i18n.localize("sight"),
                    value: Number(html.find('[name="vision"]').val() || 0)
                })
                testData.situationalModifiers.push(...Itemdsa5.getSpecAbModifiers(html, "attack"))
                mergeObject(testData.extra.options, options)
                Hooks.call("callbackDialogCombatDSA5", testData, actor, html, item, tokenId)
                return { testData, cardOptions };
            }
        };

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
    }
}

class RitualItemDSA5 extends SpellItemDSA5 {
    static getCallbackData(testData, html, actor) {
        super.getCallbackData(testData, html, actor)
        testData.situationalModifiers.push({
            name: game.i18n.localize("RITUALMODIFIER.rightClothes"),
            value: html.find('[name="rightClothes"]').is(":checked") ? 1 : 0
        }, {
            name: game.i18n.localize("RITUALMODIFIER.rightEquipment"),
            value: html.find('[name="rightEquipment"]').is(":checked") ? 1 : 0
        }, {
            name: game.i18n.localize("place"),
            value: html.find('[name="placeModifier"]').val()
        }, {
            name: game.i18n.localize("time"),
            value: html.find('[name="timeModifier"]').val()
        })
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(...ItemRulesDSA5.getTalentBonus(actor.data, source.name, ["advantage", "disadvantage", "specialability", "equipment"]))
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.magicalAttunement'), 1, true))
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.magicalRestriction'), -1, true))
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.boundToArtifact'), -1, true))
        situationalModifiers.push(...this.getPropertyFocus(actor, source))
        this.foreignSpellModifier(actor, source, situationalModifiers, data)
        this.getSkZkModifier(data, source)

        mergeObject(data, {
            isRitual: true,
            locationModifiers: DSA5.ritualLocationModifiers,
            timeModifiers: DSA5.ritualTimeModifiers
        })
    }
}

class SkillItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("Description", game.i18n.localize(`SKILLdescr.${name}`)),
        ]
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(...ItemRulesDSA5.getTalentBonus(actor.data, source.name, ["advantage", "disadvantage", "specialability", "equipment"]))

        situationalModifiers.push(...actor.getSkillModifier(source.name, source.type))
        for (const thing of actor.data.data.skillModifiers.global) {
            situationalModifiers.push({ name: thing.source, value: thing.value })
        }
    }

    static setupDialog(ev, options, skill, actor, tokenId) {
        let title = skill.name + " " + game.i18n.localize("Test") + (options.subtitle || "");
        let testData = {
            opposable: true,
            source: skill,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId)
            }
        };

        let data = {
            rollMode: options.rollMode,
            difficultyLabels: (DSA5.skillDifficultyLabels),
            modifier: options.modifier || 0,
            characteristics: [1, 2, 3].map(x => skill.data[`characteristic${x}`].value)
        }

        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, skill) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, skill)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/skill-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = DSA5.skillDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                testData.advancedModifiers = {
                    chars: [0, 1, 2].map(x => Number(html.find(`[name="ch${x}"]`).val())),
                    fws: Number(html.find(`[name="fw"]`).val()),
                    qls: Number(html.find(`[name="qs"]`).val())
                }
                Itemdsa5.changeChars(testData.source, ...[0, 1, 2].map(x => html.find(`[name="characteristics${x}"]`).val()))
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions };
            }
        };

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/skill-card.html", title)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
    }
}

class SpecialAbilityItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("rule", data.rule.value),
        ]
    }
}

class SpeciesItemDSA5 extends Itemdsa5 {}


class SpellextensionItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("source", data.source),
            this._chatLineHelper("Category", game.i18n.localize(data.category)),
        ]
    }
}

class TraitItemDSA5 extends Itemdsa5 {

    static chatData(data, name) {
        let res = []
        switch (data.traitType.value) {
            case "meleeAttack":
                res = [
                    this._chatLineHelper("attack", data.at.value),
                    this._chatLineHelper("damage", data.damage.value),
                    this._chatLineHelper("reach", data.reach.value)
                ]
                break
            case "rangeAttack":
                res = [
                    this._chatLineHelper("attack", data.at.value),
                    this._chatLineHelper("damage", data.damage.value),
                    this._chatLineHelper("reach", data.reach.value),
                    this._chatLineHelper("reloadTime", data.reloadTime.value)
                ]
                break
            case "armor":
                res = [
                    this._chatLineHelper("protection", data.damage.value),
                ]
                break
            case "general":
                res = []
                break
            case "familiar":
                res = [
                    this._chatLineHelper("APValue", data.APValue.value),
                    this._chatLineHelper("AsPCost", data.AsPCost.value),
                    this._chatLineHelper("duration", data.duration.value),
                    this._chatLineHelper("aspect", data.aspect.value)
                ]
                break
            case "trick":
                res = [
                    this._chatLineHelper("APValue", data.APValue.value),
                ]
                break
            case "entity":
                //TODO
                res = []
                break
        }
        if (data.effect.value != "") res.push(this._chatLineHelper("effect", data.effect.value))

        return res
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        source = DSA5_Utility.toObjectIfPossible(source)
        let traitType = source.data.traitType.value
        let combatskills = Itemdsa5.buildCombatSpecAbs(actor, ["Combat", "animal"], undefined, data.mode)

        if (data.mode == "attack" && traitType == "meleeAttack") {
            let targetWeaponsize = "short"
            if (game.user.targets.size) {
                game.user.targets.forEach(target => {
                    if (target.actor) {
                        let defWeapon = target.actor.items.filter(x => x.data.type == "meleeweapon" && x.data.data.worn.value)
                        if (defWeapon.length > 0) targetWeaponsize = defWeapon[0].data.data.reach.value

                        this.addCreatureTypeModifiers(target.actor.data, source, situationalModifiers)
                    }
                });
            }

            const defenseMalus = Number(actor.data.data.meleeStats.defenseMalus) * -1
            if (defenseMalus != 0) {
                situationalModifiers.push({
                    name: `${game.i18n.localize("statuseffects")} - ${game.i18n.localize('MODS.defenseMalus')}`,
                    value: defenseMalus,
                    type: "defenseMalus",
                    selected: true
                })
            }

            mergeObject(data, {
                visionOptions: DSA5.meleeRangeVision(data.mode),
                weaponSizes: DSA5.meleeRanges,
                melee: true,
                showAttack: true,
                targetWeaponSize: targetWeaponsize,
                combatSpecAbs: combatskills
            });
        } else if (data.mode == "attack" && traitType == "rangeAttack") {
            let targetSize = "average"
            if (game.user.targets.size) {
                game.user.targets.forEach(target => {
                    if (target.actor) {
                        const tar = getProperty(target.actor.data, "data.status.size")
                        if (tar) targetSize = tar.value

                        this.addCreatureTypeModifiers(target.actor.data, source, situationalModifiers)
                    }
                });
            }

            const defenseMalus = Number(actor.data.data.rangeStats.defenseMalus) * -1
            if (defenseMalus != 0) {
                situationalModifiers.push({
                    name: `${game.i18n.localize("statuseffects")} - ${game.i18n.localize('MODS.defenseMalus')}`,
                    value: defenseMalus,
                    type: "defenseMalus",
                    selected: true
                })
            }

            let rangeOptions = {...DSA5.rangeWeaponModifiers }
            delete rangeOptions[AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize('LocalizedIDs.senseOfRange')) ? "long" : "rangesense"]
            mergeObject(data, {
                rangeOptions: rangeOptions,
                sizeOptions: DSA5.rangeSizeCategories,
                visionOptions: DSA5.rangeVision,
                mountedOptions: DSA5.mountedRangeOptions,
                shooterMovementOptions: DSA5.shooterMovementOptions,
                targetMovementOptions: DSA5.targetMomevementOptions,
                targetSize: targetSize,
                combatSpecAbs: combatskills,
                aimOptions: DSA5.aimOptions
            });
        } else if (data.mode == "parry") {
            Itemdsa5.getDefenseMalus(situationalModifiers, actor)
            mergeObject(data, {
                visionOptions: DSA5.meleeRangeVision(data.mode),
                showDefense: true,
                wrongHandDisabled: false,
                melee: true,
                combatSpecAbs: combatskills,
                constricted: actor.hasCondition("constricted")
            });
        }

        const statEff = Number(actor.data.data[traitType == "meleeAttack" ? "meleeStats" : "rangeStats"][data.mode])
        if (statEff != 0) {
            situationalModifiers.push({
                name: game.i18n.localize("statuseffects"),
                value: statEff,
                selected: true
            })
        }
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let mode = options["mode"]
        let title = game.i18n.localize(item.name) + " " + game.i18n.localize(mode + "test");
        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId)
            }
        };
        const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, item.toObject())
        let data = {
            rollMode: options.rollMode,
            mode,
            defenseCountString: game.i18n.format("defenseCount", { malus: multipleDefenseValue })
        }

        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item, { mode }) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                testData.rangeModifier = html.find('[name="distance"]').val()
                testData.sizeModifier = DSA5.rangeSizeModifier[html.find('[name="size"]').val()]
                testData.opposingWeaponSize = html.find('[name="weaponsize"]').val()
                testData.narrowSpace = html.find('[name="narrowSpace"]').is(":checked")
                testData.doubleAttack = html.find('[name="doubleAttack"]').is(":checked") ? (-2 + SpecialabilityRulesDSA5.abilityStep(actor, game.i18n.localize('LocalizedIDs.twoWeaponCombat'))) : 0
                testData.wrongHand = html.find('[name="wrongHand"]').is(":checked") ? -4 : 0
                let attackOfOpportunity = html.find('[name="opportunityAttack"]').is(":checked") ? -4 : 0
                testData.attackOfOpportunity = attackOfOpportunity != 0
                testData.situationalModifiers.push({
                    name: game.i18n.localize("opportunityAttack"),
                    value: attackOfOpportunity
                }, {
                    name: game.i18n.localize("attackFromBehind"),
                    value: html.find('[name="attackFromBehind"]').is(":checked") ? -4 : 0
                }, {
                    name: game.i18n.localize("target") + " " + html.find('[name="targetMovement"] option:selected').text(),
                    value: Number(html.find('[name="targetMovement"]').val()) || 0
                }, {
                    name: game.i18n.localize("shooter") + " " + html.find('[name="shooterMovement"] option:selected').text(),
                    value: Number(html.find('[name="shooterMovement"]').val()) || 0
                }, {
                    name: game.i18n.localize("mount") + " " + html.find('[name="mountedOptions"] option:selected').text(),
                    value: Number(html.find('[name="mountedOptions"]').val()) || 0
                }, {
                    name: game.i18n.localize("rangeMovementOptions.QUICKCHANGE"),
                    value: html.find('[name="quickChange"]').is(":checked") ? -4 : 0
                }, {
                    name: game.i18n.localize("MODS.combatTurmoil"),
                    value: html.find('[name="combatTurmoil"]').is(":checked") ? -2 : 0
                }, {
                    name: game.i18n.localize("aim"),
                    value: Number(html.find('[name="aim"]').val()) || 0
                }, {
                    name: game.i18n.localize("MODS.damage"),
                    damageBonus: html.find('[name="damageModifier"]').val(),
                    value: 0,
                    step: 1
                }, {
                    name: game.i18n.format("defenseCount", { malus: multipleDefenseValue }),
                    value: (Number(html.find('[name="defenseCount"]').val()) || 0) * multipleDefenseValue
                }, {
                    name: game.i18n.localize("advantageousPosition"),
                    value: html.find('[name="advantageousPosition"]').is(":checked") ? 2 : 0
                }, Itemdsa5.parseValueType(game.i18n.localize("sight"), html.find('[name="vision"]').val() || 0))
                testData.situationalModifiers.push(...Itemdsa5.getSpecAbModifiers(html, mode))
                mergeObject(testData.extra.options, options)
                Hooks.call("callbackDialogCombatDSA5", testData, actor, html, item, tokenId)
                return { testData, cardOptions };
            }
        };

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
    }
}

class VantageItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("effect", data.effect.value),
        ]
    }
}