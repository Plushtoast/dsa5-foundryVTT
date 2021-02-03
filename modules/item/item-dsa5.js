import DSA5_Utility from "../system/utility-dsa5.js";
import DiceDSA5 from "../system/dice-dsa5.js"

export default class Itemdsa5 extends Item {
    static defaultImages = {
        "advantage": "icons/commodities/materials/hair-tuft-brown.webp",
        "disadvantage": "icons/commodities/bones/skull-hollow-white.webp",
        "armor": "systems/dsa5/icons/categories/Armor.webp",
        "meleeweapon": "systems/dsa5/icons/categories/Meleeweapon.webp",
        "rangeweapon": "systems/dsa5/icons/categories/Rangeweapon.webp",
        "equipment": "systems/dsa5/icons/categories/Equipment.webp",
        "liturgy": "systems/dsa5/icons/categories/Liturgy.webp.webp",
        "spell": "icons/sundries/scrolls/scroll-runed-brown-purple.webp",
        "ammunition": "icons/containers/ammunition/arrows-quiver-simple-brown.webp",
        "career": "icons/environment/people/commoner.webp",
        "spelltrick": "icons/sundries/scrolls/scroll-bound-blue-brown.webp",
        "blessing": "icons/commodities/treasure/token-runed-wyn-grey.webp",
        "combatskill": "icons/environment/people/charge.webp",
        "skill": "icons/tools/hand/spinning-wheel-brown.webp",
        "Geweihte": "icons/environment/people/cleric-grey.webp",
        "Weltliche": "icons/environment/people/commoner.webp",
        "Zauberer": "icons/environment/people/cleric-orange.webp",
        "ritual": "icons/sundries/books/book-symbol-triangle-silver-brown.webp",
        "ceremony": "icons/sundries/books/book-symbol-canterbury-cross.webp",
        "abilityclerical": "icons/tools/hand/scale-balances-merchant-brown.webp",
        "abilityCombat": "icons/weapons/axes/axe-hammer-blackened.webp",
        "abilityfatePoints": "icons/weapons/wands/wand-skull-forked.webp",
        "abilitygeneral": "icons/tools/smithing/crucible.webp",
        "specialability": "icons/tools/smithing/crucible.webp",
        "abilitymagical": "icons/tools/scribal/ink-quill-pink.webp",
        "abilitylanguage": "icons/sundries/documents/document-official-capital.webp",
        "abilitystaff": "icons/weapons/staves/staff-ornate-red.webp",
        "abilityanimal": "icons/environment/creatures/frog-spotted-green.webp",
        "trait": "icons/commodities/biological/organ-brain-pink-purple.webp",
        "Tiere": "icons/environment/creatures/horse-brown.webp",
        "aggregatedTest": "icons/sundries/gaming/dice-runed-brown.webp",
        "poison": "icons/commodities/materials/bowl-liquid-red.webp",
        "disease": "icons/commodities/biological/pustules-brown.webp"
    }

    static defaultIcon(data) {
        if (!data.img) {
            if (data.type in this.defaultImages) {
                data.img = this.defaultImages[data.type]
            } else {
                data.img = "systems/dsa5/icons/blank.webp";
            }
        }
    }

    static async create(data, options) {
        this.defaultIcon(data)
        super.create(data, options);
    }

    prepareData() {
        super.prepareData();
    }

    _armorChatData() {
        const data = duplicate(this.data.data);
        let properties = [
            this._chatLineHelper("protection", data.protection.value),
            this._chatLineHelper("encumbrance", data.encumbrance.value)
        ]
        if (data.effect.value != "")
            properties.push(this._chatLineHelper("effect", data.effect.value))

        return properties
    }

    _rangeweaponChatData() {
        const data = duplicate(this.data.data);
        res = [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("combatskill", data.combatskill.value)
        ]
        if (data.effect.value != "")
            res.push(this._chatLineHelper("effect", data.effect.value))

        return res
    }

    _meleeweaponChatData() {
        const data = duplicate(this.data.data);
        let res = [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("atmod", data.atmod.value),
            this._chatLineHelper("pamod", data.pamod.value),
            this._chatLineHelper("combatskill", data.combatskill.value)
        ]
        if (data.effect.value != "")
            res.push(this._chatLineHelper("effect", data.effect.value))

        return res
    }

    _ammunitionChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("ammunitiongroup", game.i18n.localize(data.ammunitiongroup.value))
        ]
    }

    _equipmentChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("equipmentType", game.i18n.localize(data.equipmentType.value))
        ]
    }

    _advantageChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("effect", data.effect.value),
        ]
    }

    _disadvantageChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("effect", data.effect.value),
        ]
    }

    _poisonChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("stepValue", data.step.value),
            this._chatLineHelper("poisonType", data.poisonType.value),
            this._chatLineHelper("start", data.start.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("resistanceModifier", data.resistance.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceDies(data.effect.value))
        ]
    }

    _diseaseChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("stepValue", data.step.value),
            this._chatLineHelper("incubation", data.incubation.value),
            this._chatLineHelper("damage", DSA5_Utility.replaceDies(data.damage.value)),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("source", DSA5_Utility.replaceDies(data.source.value)),
            this._chatLineHelper("treatment", data.treatment.value),
            this._chatLineHelper("antidot", data.antidot.value),
            this._chatLineHelper("resistanceModifier", data.resistance.value)
        ]
    }

    _specialabilityChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("rule", data.rule.value),
        ]
    }

    _blessingChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("feature", data.feature.value),
        ]
    }

    _magictrickChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("feature", data.feature.value),
        ]
    }

    _traitChatData() {
        const data = duplicate(this.data.data)
        let res = []
        switch (data.traitType.value) {
            case "meleeAttack":
                res = [
                    this._chatLineHelper("attack", data.at.value),
                    this._chatLineHelper("damage", data.damage.value),
                    this._chatLineHelper("reach", data.reach.value)
                ]
            case "rangeAttack":
                res = [
                    this._chatLineHelper("attack", data.at.value),
                    this._chatLineHelper("damage", data.damage.value),
                    this._chatLineHelper("reach", data.reach.value),
                    this._chatLineHelper("reloadTime", data.reloadTime.value)
                ]
            case "armor":
                res = [
                    this._chatLineHelper("protection", data.damage.value),
                ]
            case "general":
                res = []
            case "familiar":
                res = [
                    this._chatLineHelper("APValue", data.APValue.value),
                    this._chatLineHelper("AsPCost", data.AsPCost.value),
                    this._chatLineHelper("duration", data.duration.value),
                    this._chatLineHelper("aspect", data.aspect.value)
                ]
        }
        if (data.effect.value != "")
            res.push(this._chatLineHelper("effect", data.effect.value))
        return res
    }

    _liturgyChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("KaPCost", data.AsPCost.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceDies(data.effect.value))
        ]
    }
    _ceremonyChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("KaPCost", data.AsPCost.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceDies(data.effect.value))
        ]
    }

    _aggregatedTestChatData() {
        const data = duplicate(this.data.data);
        let result = game.i18n.localize("Ongoing")
        if (data.cummulatedQS.value >= 10) {
            result = game.i18n.localize("Success")
        }
        if (data.cummulatedQS.value >= 6) {
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

    _spellChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("AsPCost", data.AsPCost.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceDies(data.effect.value))
        ]
    }

    _ritualChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("AsPCost", data.AsPCost.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceDies(data.effect.value))
        ]
    }

    _chatLineHelper(key, val) {
        return `<b>${game.i18n.localize(key)}</b>: ${val ? val : "-"}`
    }

    setupEffect(ev, options = {}) {
        let title = this.name + " " + game.i18n.localize(this.type) + " " + game.i18n.localize("Test");

        let testData = {
            opposable: false,
            source: this.data,
            extra: {
                options: options
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/poison-dialog.html",
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = []

                testData.situationalModifiers.push({
                    name: game.i18n.localize("zkModifier"),
                    value: html.find('[name="zkModifier"]').val() || 0
                })
                testData.situationalModifiers.push({
                    name: game.i18n.localize("skModifier"),
                    value: html.find('[name="skModifier"]').val() || 0
                })

                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions(`systems/dsa5/templates/chat/roll/${this.type}-card.html`, title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    _setupCardOptions(template, title) {

        let speaker = ChatMessage.getSpeaker()
            //if (speaker.actor == this.data._id) {
        return {
            speaker: {
                alias: speaker.alias,
                scene: speaker.scene
            },
            flags: {
                img: speaker.token ? canvas.tokens.get(speaker.token).data.img : this.img
            },
            title: title,
            template: template,
        }
        //}

    }

    async itemTest({ testData, cardOptions }, options = {}) {
        testData = await DiceDSA5.rollDices(testData, cardOptions);
        let result = DiceDSA5.rollTest(testData);

        result.postFunction = "itemTest";
        if (testData.extra)
            mergeObject(result, testData.extra);

        if (game.user.targets.size) {
            cardOptions.isOpposedTest = testData.opposable
            if (cardOptions.isOpposedTest)
                cardOptions.title += ` - ${game.i18n.localize("Opposed")}`;
            else {
                game.user.updateTokenTargets([]);
            }
        }

        if (testData.extra.ammo && !testData.extra.ammoDecreased) {
            testData.extra.ammoDecreased = true
            testData.extra.ammo.data.quantity.value--;
            this.updateEmbeddedEntity("OwnedItem", { _id: testData.extra.ammo._id, "data.quantity.value": testData.extra.ammo.data.quantity.value });
        }

        if (!options.suppressMessage)
            DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage).then(msg => {
                //OpposedDsa5.handleOpposedTarget(msg)
            })

        return { result, cardOptions };
    }

    async postItem() {
        const properties = this[`_${this.data.type}ChatData`]();
        let chatData = duplicate(this.data);
        chatData["properties"] = properties

        chatData.hasPrice = "price" in chatData.data;
        if (chatData.hasPrice) {
            let price = chatData.data.price.value;
            chatData.data.price.D = Math.floor(price / 10);
            price -= chatData.data.price.D * 10;
            chatData.data.price.S = Math.floor(price);
            price -= chatData.data.price.S;
            chatData.data.price.H = Math.floor(price / 0.1);
            price -= (chatData.data.price.H * 0.1);
            chatData.data.price.K = Math.round(price / 0.01);

            properties.push(`<b>${game.i18n.localize("price")}</b>: ${chatData.data.price.D} <div title="${game.i18n.localize("Money-D")}" class="chatmoney money-D"></div>, ${chatData.data.price.S} <div title="${game.i18n.localize("Money-S")}" class="chatmoney money-S"></div>, ${chatData.data.price.H} <div title="${game.i18n.localize("Money-H")}" class="chatmoney money-H"></div>, ${chatData.data.price.K} <div title="${game.i18n.localize("Money-K")}" class="chatmoney money-K"></div>`);
        }

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

CONFIG.Item.entityClass = Itemdsa5;