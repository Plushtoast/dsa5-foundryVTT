import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"

export default class Itemdsa5 extends Item {
    static defaultImages = {
        "advantage": "icons/commodities/materials/hair-tuft-brown.webp",
        "disadvantage": "icons/commodities/bones/skull-hollow-white.webp",
        "armor": "icons/equipment/chest/breastplate-layered-leather-brown-silver.webp",
        "meleeweapon": "icons/weapons/swords/greatsword-blue.webp",
        "rangeweapon": "icons/weapons/bows/longbow-recurve-leather-brown.webp",
        "equipment": "icons/containers/bags/sack-simple-leather-brown.webp",
        "liturgy": "icons/sundries/scrolls/scroll-writing-orange-black.webp",
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
        "abilitymagical": "icons/tools/scribal/ink-quill-pink.webp",
        "abilitylanguage": "icons/sundries/documents/document-official-capital.webp",
        "abilitystaff": "icons/weapons/staves/staff-ornate-red.webp",
        "abilityanimal": "icons/environment/creatures/frog-spotted-green.webp",
        "trait": "icons/commodities/biological/organ-brain-pink-purple.webp",
        "Tiere": "icons/environment/creatures/horse-brown.webp",
        "aggregatedTest": "icons/sundries/gaming/dice-runed-brown.webp",

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

    prepare() {
        let data = duplicate(this.data)
        preparedData.img = preparedData.img || DEFAULT_TOKEN;
        return preparedData;
    }

    _armorChatData() {
        const data = duplicate(this.data.data);
        let properties = [
            this._chatLineHelper("protection", data.protection.value),
            this._chatLineHelper("encumbrance", data.encumbrance.value)
        ]
        if (data.effect.value != "") {
            properties.push(this._chatLineHelper("effect", data.effect.value))
        }
        return properties
    }

    _rangeweaponChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("combatskill", data.combatskill.value)
        ]
    }

    _meleeweaponChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("atmod", data.atmod.value),
            this._chatLineHelper("pamod", data.pamod.value),
            this._chatLineHelper("combatskill", data.combatskill.value)
        ]
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
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("feature", data.feature.value),
        ]
    }

    _liturgyChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("KaPCost", data.castingTime.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value)
        ]
    }
    _ceremonyChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("KaPCost", data.castingTime.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value)
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
            this._chatLineHelper("AsPCost", data.castingTime.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value)
        ]
    }

    _ritualChatData() {
        const data = duplicate(this.data.data);
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("AsPCost", data.castingTime.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value)
        ]
    }

    _chatLineHelper(key, val) {
        return `<b>${game.i18n.localize(key)}</b>: ${val ? val : "-"}`
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