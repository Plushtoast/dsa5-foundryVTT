import DSA5 from './config-dsa5.js'

export default class DSA5_Utility {

    static async allSkills() {
        let returnSkills = [];

        const packs = game.packs.filter(p => p.metadata.tags && p.metadata.tags.includes("skill"))
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
        var res = {};
        for (let sk of skills) {
            res[sk.name] = sk.name;
        }
        return res;
    }

    static async allCombatSkillsList(weapontype) {
        let skills = (await this.allCombatSkills()).filter(x => x.data.weapontype.value == weapontype) || [];
        var res = {};
        for (let sk of skills) {
            res[sk.name] = sk.name;
        }
        return res;
    }

    static parseAbilityString(ability) {
        return {
            original: ability.replace(/ [+]?\d{1,2}$/, '').trim(),
            name: ability.replace(/\((.+?)\)/g, "()").replace(/ [+]?\d{1,2}$/, '').trim(),
            step: Number((ability.match(/\d{1,2}$/) || [1])[0]),
            special: (ability.match(/\(([^()]+)\)/) || ["", ""])[1],
            bonus: ability.match(/[+]\d{1,2}$/) != undefined
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

    static async findItembyIdAndPack(id, packMan) {
        const pack = game.packs.get(packMan)

        let item
        await pack.getContent().then(content => item = content.find(i => i._id == id));
        if (item) {
            return item;
        }
    }

    static getSpeaker(speaker) {
        let actor = game.actors.get(speaker.actor);
        if (speaker.token)
            actor = new Token(game.scenes.get(speaker.scene).getEmbeddedEntity("Token", speaker.token)).actor
            //actor = canvas.tokens.get(speaker.token).actor
        return actor
    }

    static _calculateAdvCost(currentAdvances, type, modifier = 1) {
        return DSA5.advancementCosts[type][Number(currentAdvances) + modifier]
    }

    static async findAnyItem(category, name) {
        let item = game.items.entities.find(i => i.permission > 1 && i.type == category && i.name == name)
        if (!item) {
            for (let p of game.packs) {
                if (p.metadata.entity == "Item" && (game.user.isGM || !p.private)) {
                    await p.getContent().then(content => {
                        item = content.find(x => x.type == category && x.name == name)
                    })
                    if (item)
                        break
                }
            }
        }
        return item
    }


    static experienceDescription(experience) {
        if (experience >= 2100) {
            return "EXP-legendary";
        } else if (experience >= 1700) {
            return "EXP-brillant";
        } else if (experience >= 1400) {
            return "EXP-masterful";
        } else if (experience >= 1200) {
            return "EXP-competent";
        } else if (experience >= 1100) {
            return "EXP-experienced";
        } else if (experience >= 1000) {
            return "EXP-average";
        } else {
            return "EXP-inexperienced";
        }
    }

}