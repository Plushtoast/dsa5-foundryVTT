export default class CombatTables {
    static getDefenseBotch(weaponless = false) {
        let res = new Roll("2d6").roll().results[0]
        if (weaponless && res < 7)
            res += 5
        return game.i18n.localize("DEFENSEBOTCH." + res)
    }
    static getMeleeBotch(weaponless = false) {
        let res = new Roll("2d6").roll().results[0]
        if (weaponless && res < 7)
            res += 5
        return game.i18n.localize("MELEEBOTCH." + res)
    }
    static getRangeBotch() {
        let res = new Roll("2d6").roll().results[0]
        return game.i18n.localize("RANGEBOTCH." + res)
    }
}