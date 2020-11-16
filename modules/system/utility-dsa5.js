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

    static findItembyId(id) {
        let item = game.items.entities.filter(x => x._id == id);
        if (item) {
            return item[0];
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