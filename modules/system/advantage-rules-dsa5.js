export default class AdvantageRulesDSA5 {
    static async addvantageAdded(actor, item) {
        switch (item.name) {
            case "Geweihter":
                await actor.update({
                    "data.status.karmaenergy.initial": 20
                });
                break
            case "Zauberer":
                await actor.update({
                    "data.status.astralenergy.initial": 20
                });

                break
        }
    }
}