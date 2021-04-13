import DSA5 from "../system/config-dsa5.js"

export default class DSAActiveEffectConfig extends ActiveEffectConfig {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            resizable: true
        })
    }

    dropDownMenu() {
            let optns = [
                { name: game.i18n.localize('protection'), val: "data.totalArmor" },
                { name: game.i18n.localize('carrycapacity'), val: "data.carryModifier" },
                { name: `${game.i18n.localize('closeCombatAttacks')} - ${game.i18n.localize('CHARAbbrev.AT')}`, val: "data.meleeStats.attack" },
                { name: `${game.i18n.localize('closeCombatAttacks')} - ${game.i18n.localize('CHARAbbrev.PA')}`, val: "data.meleeStats.parry" },
                { name: `${game.i18n.localize('closeCombatAttacks')} - ${game.i18n.localize('CHARAbbrev.damage')}`, val: "data.meleeStats.damage" },
                { name: `${game.i18n.localize('rangeCombatAttacks')} - ${game.i18n.localize('CHARAbbrev.AT')}`, val: "data.rangeStats.attack" },
                { name: `${game.i18n.localize('rangeCombatAttacks')} - ${game.i18n.localize('CHARAbbrev.damage')}`, val: "data.rangeStats.damage" },
                { name: game.i18n.localize('KaPCost'), val: "data.kapModifier" },
                { name: game.i18n.localize('AsPCost'), val: "data.aspModifier" },
            ]
            const attrs = ["mu", "kl", "in", "ch", "ff", "ge", "ko", "kk"]
            for (const k of attrs)
                optns.push({ name: game.i18n.localize(`CHAR.${k.toUpperCase()}`), val: `data.characteristics.${k}.gearmodifier` })

            for (const k of DSA5.gearModifyableCalculatedAttributes)
                optns.push({ name: game.i18n.localize(k), val: `data.characteristics.${k}.gearmodifier` })

            optns = optns.sort((a, b) => { return a.name.localeCompare(b.name) })

            return `<select class="selMenu">${optns.map(x=> {return `<option value="${x.val}">${x.name}</option>`})}</select>`
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('.changes-list .effect-change .key').append(this.dropDownMenu())
        html.find('.selMenu').change(ev => {
            const elem = $(ev.currentTarget)
            elem.siblings('input').val(elem.val())
            elem.blur()
        })
    }
}