import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import DiceDSA5 from "../system/dice-dsa5.js"

export default class Actordsa5 extends Actor {
    static async create(data, options) {
        if (data instanceof Array)
            return super.create(data, options);

        if (data.items)
            return super.create(data, options);

        // Initialize empty items
        data.items = [];

        data.flags =
        {

        }

        let skills = await DSA5_Utility.allSkills() || [];

        if (data.type == "character") {
            data.items = data.items.concat(skills);


            super.create(data, options); // Follow through the the rest of the Actor creation process upstream
        }
    }

    prepareBaseData() {
        for (let ch of Object.values(this.data.data.characteristics)) {
            ch.value = ch.initial + ch.advances + (ch.modifier || 0);
            ch.bonus = Math.floor(ch.value / 10)
            ch.cost = DSA5_Utility._calculateAdvCost(ch.advances, "characteristic")
        }
    }

    //prepare calculated attributes
    prepareData() {
        try {
            super.prepareData();
            const data = this.data;

            if (this.data.type == "character")
                this.prepareCharacter();



        }
        catch (error) {
            console.error("Something went wrong with preparing actor data: " + error)
            ui.notifications.error(game.i18n.localize("ACTOR.PreparationError") + error)
        }
    }



    prepareCharacter() {
        if (this.data.type != "character")
            return;

        //calculate some attributes
    }


    prepare() {
        let preparedData = duplicate(this.data)
        // Call prepareItems first to organize and process OwnedItems
        mergeObject(preparedData, this.prepareItems())

        // Add speciality functions for each Actor type
        if (preparedData.type == "character") {
            this.prepareCharacter(preparedData)
        }

        //if (preparedData.type == "npc")
        //this.prepareNPC(preparedData)

        //if (preparedData.type == "creature")
        //this.prepareCreature(preparedData)

        return preparedData;
    }

    prepareItems() {
        let actorData = duplicate(this.data)
        let bodySkills = [];
        let socialSkills = [];
        let knowledgeSkills = [];
        let tradeSkills = [];
        let natureSkills = [];
        console.log("preparing items")
        for (let i of actorData.items) {
            try {
                i.img = i.img || DEFAULT_TOKEN;

                // *********** TALENTS ***********
                if (i.type === "skill") {
                    console.log("preparing skill")
                    this.prepareSkill(i);
                    switch (i.data.group.value) {
                        case "body":
                            bodySkills.push(i);
                            break;
                        case "social":
                            socialSkills.push(i);
                            break;
                        case "knowledge":
                            knowledgeSkills.push(i);
                            break;
                        case "trade":
                            tradeSkills.push(i);
                            break;
                        case "nature":
                            natureSkills.push(i);
                            break;
                    }
                }
            }
            catch (error) {
                console.error("Something went wrong with preparing item " + i.name + ": " + error)
                ui.notifications.error("Something went wrong with preparing item " + i.name + ": " + error)
                // ui.notifications.error("Deleting " + i.name);
                // this.deleteEmbeddedEntity("OwnedItem", i._id);
            }
        }
        return {
            allSkillsLeft: {
                "body": bodySkills,
                "social": socialSkills,
                "nature": natureSkills
            },
            allSkillsRight: {
                "knowledge": knowledgeSkills,
                "trade": tradeSkills
            }
        }
    }

    setupCharacteristic(characteristicId, options = {}) {
        let char = this.data.data.characteristics[characteristicId];
        let title = game.i18n.localize(char.label) + " " + game.i18n.localize("Test");

        let testData = {
            source: char,
            extra: {
                characteristicId: characteristicId,
                actor: this.data,
                options: options
            }
        };

        // Setup dialog data: title, template, buttons, prefilled data
        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/characteristic-dialog.html",
            // Prefilled dialog data
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = DSA5.attributeDifficultyModifiers[html.find('[name="testDifficulty"]').val()];

                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/characteristic-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupSkill(skill, options = {}) {
        let title = skill.name + " " + game.i18n.localize("Test");
        let testData = {
            source: skill,
            extra: {
                actor: this.data,
                options: options,
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/skill-dialog.html",

            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = DSA5.skillDifficultyModifiers[html.find('[name="testDifficulty"]').val()];

                return { testData, cardOptions };
            }
        };


        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/skill-card.html", title)


        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    prepareSkill(skill) {

    }


    _setupCardOptions(template, title) {
        let cardOptions = {
            speaker: {
                alias: this.data.token.name,
                actor: this.data._id,
            },
            title: title,
            template: template,
            flags: { img: this.data.token.randomImg ? this.data.img : this.data.token.img }
            // img to be displayed next to the name on the test card - if it's a wildcard img, use the actor image
        }

        // If the test is coming from a token sheet
        if (this.token) {
            cardOptions.speaker.alias = this.token.data.name; // Use the token name instead of the actor name
            cardOptions.speaker.token = this.token.data._id;
            cardOptions.speaker.scene = canvas.scene._id
            cardOptions.flags.img = this.token.data.img; // Use the token image instead of the actor image
        }
        else // If a linked actor - use the currently selected token's data if the actor id matches
        {
            let speaker = ChatMessage.getSpeaker()
            if (speaker.actor == this.data._id) {
                cardOptions.speaker.alias = speaker.alias
                cardOptions.speaker.token = speaker.token
                cardOptions.speaker.scene = speaker.scene
                cardOptions.flags.img = speaker.token ? canvas.tokens.get(speaker.token).data.img : cardOptions.flags.img
            }
        }

        return cardOptions
    }

    async basicTest({ testData, cardOptions }, options = {}) {
        testData = await DiceDSA5.rollDices(testData, cardOptions);
        let result = DiceDSA5.rollTest(testData);

        result.postFunction = "basicTest";
        if (testData.extra)
            mergeObject(result, testData.extra);



        Hooks.call("dsa5:rollTest", result, cardOptions)

        //if (game.user.targets.size) {
        //  cardOptions.title += ` - ${game.i18n.localize("Opposed")}`;
        //  cardOptions.isOpposedTest = true
        //}

        if (!options.suppressMessage)
            DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage).then(msg => {
                //OpposedWFRP.handleOpposedTarget(msg) // Send to handleOpposed to determine opposed status, if any.
            })
        return { result, cardOptions };
    }

    static async renderRollCard(chatOptions, testData, rerenderMessage) {

        // Blank if manual chat cards
        if (game.settings.get("wfrp4e", "manualChatCards") && !rerenderMessage)
            testData.roll = testData.SL = null;

        if (game.modules.get("dice-so-nice") && game.modules.get("dice-so-nice").active && chatOptions.sound?.includes("dice"))
            chatOptions.sound = undefined;

        testData.other = testData.other.join("<br>")

        let chatData = {
            title: chatOptions.title,
            testData: testData,
            hideData: game.user.isGM
        }

        if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;
        else if (chatOptions.rollMode === "selfroll") chatOptions["whisper"] = [game.user];

        // All the data need to recreate the test when chat card is edited
        chatOptions["flags.data"] = {
            preData: chatData.testData.preData,
            postData: chatData.testData,
            template: chatOptions.template,
            rollMode: chatOptions.rollMode,
            title: chatOptions.title,
            hideData: chatData.hideData,
            fortuneUsedReroll: chatOptions.fortuneUsedReroll,
            fortuneUsedAddSL: chatOptions.fortuneUsedAddSL,
            isOpposedTest: chatOptions.isOpposedTest,
            attackerMessage: chatOptions.attackerMessage,
            defenderMessage: chatOptions.defenderMessage,
            unopposedStartMessage: chatOptions.unopposedStartMessage,
            startMessagesList: chatOptions.startMessagesList
        };

        if (!rerenderMessage) {
            // Generate HTML from the requested chat template
            return renderTemplate(chatOptions.template, chatData).then(html => {
                // Emit the HTML as a chat message
                if (game.settings.get("wfrp4e", "manualChatCards")) {
                    let blank = $(html)
                    let elementsToToggle = blank.find(".display-toggle")

                    for (let elem of elementsToToggle) {
                        if (elem.style.display == "none")
                            elem.style.display = ""
                        else
                            elem.style.display = "none"
                    }
                    html = blank.html();
                }

                chatOptions["content"] = html;
                if (chatOptions.sound)
                    console.log(`wfrp4e | Playing Sound: ${chatOptions.sound}`)
                return ChatMessage.create(chatOptions, false);
            });
        }
        else // Update message 
        {
            // Generate HTML from the requested chat template
            return renderTemplate(chatOptions.template, chatData).then(html => {

                // Emit the HTML as a chat message
                chatOptions["content"] = html;
                if (chatOptions.sound) {
                    console.log(`wfrp4e | Playing Sound: ${chatOptions.sound}`)
                    AudioHelper.play({ src: chatOptions.sound }, true)
                }
                return rerenderMessage.update(
                    {
                        content: html,
                        ["flags.data"]: chatOptions["flags.data"]
                    }).then(newMsg => {
                        ui.chat.updateMessage(newMsg);
                        return newMsg;
                    });
            });
        }
    }
}