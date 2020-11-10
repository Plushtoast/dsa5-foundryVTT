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


    //TODO calcualte this
    static _calculateAdvCost(currentAdvances, type, modifier = 0) {
        return 1
    }

}