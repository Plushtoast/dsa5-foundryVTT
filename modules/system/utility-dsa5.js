import DSA5 from './config-dsa5.js'

export default class DSA5_Utility {

    static async allSkills() {
        let returnSkills = [];

        const packs = game.packs.filter(p => p.metadata.tags && p.metadata.tags.includes("skill") && p.metadata.langs.includes(game.i18n.lang))
        if (!packs.length)
            return ui.notifications.error("No content found")

        for (let pack of packs) {
            let items
            await pack.getContent().then(content => items = content.filter(i => i.data.type == "skill"));
            for (let i of items) {
                returnSkills.push(i.data)
            }
        }
        return returnSkills;
    }

    static async allCombatSkills() {
        let returnSkills = [];

        const packs = game.packs.filter(p => p.metadata.tags && p.metadata.tags.includes("combatskill"))
        if (!packs.length)
            return ui.notifications.error("No content found")

        for (let pack of packs) {
            let items
            await pack.getContent().then(content => items = content.filter(i => i.data.type == "combatskill"));
            for (let i of items) {
                returnSkills.push(i.data)
            }
        }
        return returnSkills;
    }

    static async allMoneyItems() {
        let moneyItems = []
        const packs = game.packs.filter(p => p.metadata.tags && p.metadata.tags.includes("money"))

        if (!packs.length)
            return ui.notifications.error("No content found")

        for (let pack of packs) {
            let items
            await pack.getContent().then(content => items = content.filter(i => i.data.type == "money").map(i => i.data));

            let money = items.filter(t => Object.values(DSA5.moneyNames).map(n => n.toLowerCase()).includes(t.name.toLowerCase()))

            moneyItems = moneyItems.concat(money)
        }
        return moneyItems
    }

    static async allSkillsList() {
        let skills = (await this.allSkills()) || [];
        let res = {};
        for (let sk of skills) {
            res[sk.name] = sk.name;
        }
        return res;
    }

    static async allCombatSkillsList(weapontype) {
        let skills = (await this.allCombatSkills()).filter(x => x.data.weapontype.value == weapontype) || [];
        let res = {};
        for (let sk of skills) {
            res[sk.name] = sk.name;
        }
        return res;
    }

    static parseAbilityString(ability) {
        return {
            original: ability.replace(/ (FP|SP)?[+-]?\d{1,2}$/, '').trim(),
            name: ability.replace(/\((.+?)\)/g, "()").replace(/ (FP|SP)?[+-]?\d{1,2}$/, '').trim(),
            step: Number((ability.match(/[+-]?\d{1,2}$/) || [1])[0]),
            special: (ability.match(/\(([^()]+)\)/) || ["", ""])[1],
            type: ability.match(/ (FP|SP)[+-]?\d{1,2}/) ? "FP" : "",
            bonus: ability.match(/[-+]\d{1,2}$/) != undefined
        }
    }

    static chatDataSetup(content, modeOverride, forceWhisper) {
        let chatData = {
            user: game.user._id,
            rollMode: modeOverride || game.settings.get("core", "rollMode"),
            content: content
        };

        if (["gmroll", "blindroll"].includes(chatData.rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        if (chatData.rollMode === "blindroll") chatData["blind"] = true;
        else if (chatData.rollMode === "selfroll") chatData["whisper"] = [game.user];


        if (forceWhisper) {
            chatData["speaker"] = ChatMessage.getSpeaker();
            chatData["whisper"] = ChatMessage.getWhisperRecipients(forceWhisper);
        }

        return chatData;
    }

    static findItembyId(id) {
        let item = game.items.entities.find(x => x._id == id);
        if (item) {
            return item;
        }
    }

    static findActorbyId(id) {
        let item = game.actors.entities.find(x => x._id == id);
        if (item) {
            return item;
        }
    }

    static async findItembyIdAndPack(id, packMan) {
        const pack = game.packs.get(packMan)

        let item
        await pack.getContent().then(content => item = content.find(i => i._id == id));
        if (item) {
            return item;
        }
    }

    static getSpeaker(speaker) {
        let actor = ChatMessage.getSpeakerActor(speaker)
        if (!actor) actor = canvas.tokens.get(speaker.token).actor
        if (!actor) actor = actor = new Token(game.scenes.get(speaker.scene).getEmbeddedEntity("Token", speaker.token)).actor
        return actor
    }

    static _calculateAdvCost(currentAdvances, type, modifier = 1) {
        return DSA5.advancementCosts[type][Number(currentAdvances) + modifier]
    }

    static async findAnyItem(lookup) {
        let results = []
        let names = lookup.map(x => x.name)
        let types = lookup.map(x => x.type)
        for (let k of game.items.entities) {
            let index = names.indexOf(k.name)
            if (index >= 0 && types[index] == k.type) {
                names.splice(index, 1)
                types.splice(index, 1)
                results.push(k)
            }
        }
        //let item = game.items.entities.find(i => i.permission > 1 && i.type == category && i.name == name)
        if (names.length > 0) {
            for (let p of game.packs) {
                if (p.metadata.entity == "Item" && (game.user.isGM || !p.private)) {
                    await p.getContent().then(content => {
                        for (let k of content) {
                            let index = names.indexOf(k.name)
                            if (index >= 0 && types[index] == k.type) {
                                names.splice(index, 1)
                                types.splice(index, 1)
                                results.push(k)
                            }
                        }
                    })
                    if (names.length <= 0)
                        break
                }
            }
        }
        return results
    }

    static replaceDies(content, inlineRoll = false) {
        let regex = /( |^)(\d{1,2})?[wWdD][0-9]+((\+|-)[0-9]+)?/g
        let roll = inlineRoll ? "" : "/roll "
        return content.replace(regex, function(str) {
            return ` [[${roll}${str.replace(/[DwW]/,"d")}]]`
        })
    }

    static customEntityLinks(content) {
        let regex = /@Rq\[[a-zA-zöüäÖÜÄ& -]+ (-)?\d+\]/
        return content.replace(regex, function(str) {
            let mod = str.match(/(-)?\d+/)[0]
            let skill = str.replace(mod, "").match(/\[[a-zA-zöüäÖÜÄ& \-]+/)[0].replace(/[\[\]]/g, "").trim()
            return `<a class="roll-button request-roll" data-type="skill" data-modifier="${mod}" data-name="${skill}"><em class="fas fa-dice"></em>${skill} ${mod}</a>`
        })
    }

    static replaceConditions(content) {
        if (!DSA5.statusRegex) {
            let effects = DSA5.statusEffects.map(x => game.i18n.localize(x.label).toLowerCase())
            let keywords = ["status", "condition", "level", "levels"].map(x => game.i18n.localize(x)).join("|")
            DSA5.statusRegex = {
                effects: effects,
                regex: new RegExp(`(${keywords}) (${effects.join('|')})`, 'gi')
            }
        }

        return content.replace(DSA5.statusRegex.regex, function(str) {
            let parts = str.split(" ")
            let cond = DSA5.statusEffects[DSA5.statusRegex.effects.indexOf(parts[1].toLowerCase())]
            return `${parts[0]} <a class="chatButton chat-condition" data-id="${cond.id}"><img src="${cond.icon}"/>${parts[1]}</a>`
        })
    }

    static experienceDescription(experience) {
        if (experience >= 2100) {
            return "EXP.legendary";
        } else if (experience >= 1700) {
            return "EXP.brillant";
        } else if (experience >= 1400) {
            return "EXP.masterful";
        } else if (experience >= 1200) {
            return "EXP.competent";
        } else if (experience >= 1100) {
            return "EXP.experienced";
        } else if (experience >= 1000) {
            return "EXP.average";
        } else {
            return "EXP.inexperienced";
        }
    }

}