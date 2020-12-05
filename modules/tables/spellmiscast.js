export default class Miscast {
    static getSpellMiscast() {
        let res = new Roll("2d6").roll().results[0]
        let rand = new Roll("1d6").roll().results[0]
        return game.i18n.localize("SPELLMISCAST." + res).replace("1D6", rand)
    }

    static getLiturgyMiscast() {
        let res = new Roll("2d6").roll().results[0]
        let rand = new Roll("1d6").roll().results[0]
        let rand2 = new Roll("2d6").roll().results[0]
        return game.i18n.localize("LITURGYMISCAST." + res).replace("1D6", rand).replace("2D6", rand2)
    }
}