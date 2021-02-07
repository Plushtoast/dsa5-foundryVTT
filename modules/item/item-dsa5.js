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
        super.create(data, options);
    }

    prepareData() {
        super.prepareData();
    }


    static _chatLineHelper(key, val) {
        return `<b>${game.i18n.localize(key)}</b>: ${val ? val : "-"}`
    }

    static setupDialog(ev, options, item, actor) {
        return null
    }

    setupEffect(ev, options = {}) {
        return Itemdsa5.getSubClass(this.data.type).setupDialog(ev, options, this)
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



    static chatData(data) {
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
        const properties = Itemdsa5.getSubClass(this.data.type).chatData(duplicate(chatData.data))

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