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

    static async allCombatSkillsList(weapontype) {
        let skills = (await this.allCombatSkills()).filter(x => x.data.weapontype.value == weapontype) || [];
        var res = {};
        for (let sk of skills) {
            res[sk.name] = sk.name;
        }
        return res;
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

        if (forceWhisper) { // Final force !
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

    //TODO calcualte this
    static _calculateAdvCost(currentAdvances, type, modifier = 0) {
        return 1
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