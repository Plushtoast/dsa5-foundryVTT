import DSA5 from "../system/config-dsa5.js"

export default class DSAActiveEffectConfig extends ActiveEffectConfig {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            resizable: true
        })
    }

    async _render(force = false, options = {}) {
        await super._render(force, options);

        const advancedFunctions = ["none", "systemEffect", "macro"].map(x => `ActiveEffects.advancedFunctions.${x}`)
        const effectConfigs = {
            hasSpellEffects: ["spell", "liturgy", "ritual", "ceremony"].includes(getProperty(this.object, "parent.type"))
        }
        const config = {
            systemEffects: this.getStatusEffects(),
            canEditMacros: game.user.isGM || game.settings.get("dsa5", "playerCanEditSpellMacro")
        }
        let elem = $(this._element)
        elem.find(".tabs").append(`<a class="item" data-tab="advanced"><i class="fas fa-shield-alt"></i>${game.i18n.localize("advanced")}</a>`)
        let template = await renderTemplate('systems/dsa5/templates/status/advanced_effect.html', { effect: this.object.data, advancedFunctions, effectConfigs, config })
        elem.find('.tab[data-tab="effects"]').after($(template))

        elem.find('.advancedSelector').change(ev => {
            let effect = this.object.data
            effect.flags.dsa5.advancedFunction = $(ev.currentTarget).val()

            renderTemplate('systems/dsa5/templates/status/advanced_functions.html', { effect, config }).then(template => {
                elem.find('.advancedFunctions').html(template)
            })
        })
    }

    getStatusEffects() {
        return duplicate(CONFIG.statusEffects).map(x => { return { id: x.id, label: game.i18n.localize(x.label) } })
    }

    getData(options) {
        const data = super.getData(options);
        return data
    }

    static async applyAdvancedFunction(actor, effects, source, testData) {

        for (const ef of effects) {
            try {
                const customEf = Number(getProperty(ef, "flags.dsa5.advancedFunction"))
                const qs = testData.qualityStep
                switch (customEf) {
                    case 1: //Systemeffekt
                        {
                            const arg0 = getProperty(ef, "flags.dsa5.args0")
                            let arg1 = `${getProperty(ef, "flags.dsa5.args1")}`
                            if (/,/.test(arg1)) {
                                arg1 = Number(arg1.split(",")[qs - 1])
                            } else {
                                arg1 = Number(arg1.replace(game.i18n.localize('CHARAbbrev.QS'), qs))
                            }
                            await actor.addCondition(arg0, arg1, false, false)
                        }
                        break
                    case 2: //Macro
                        await eval(`(async () => {${getProperty(ef, "flags.dsa5.args3")}})()`)
                        break
                }
            } catch (exception) {
                console.warn("Unable to apply advanced effect")
                console.warn(exception)
                console.warn(ef)
            }
        }
    }

    dropDownMenu() {
            let optns = [
                { name: game.i18n.localize('protection'), val: "data.totalArmor" },
                { name: game.i18n.localize('carrycapacity'), val: "data.carryModifier" },
                { name: `${game.i18n.localize('closeCombatAttacks')} - ${game.i18n.localize('CHARAbbrev.AT')}`, val: "data.meleeStats.attack" },
                { name: `${game.i18n.localize('closeCombatAttacks')} - ${game.i18n.localize('CHARAbbrev.PA')}`, val: "data.meleeStats.parry" },
                { name: `${game.i18n.localize('closeCombatAttacks')} - ${game.i18n.localize('CHARAbbrev.damage')}`, val: "data.meleeStats.damage" },
                { name: `${game.i18n.localize('closeCombatAttacks')} - ${game.i18n.localize('MODS.defenseMalus')}`, val: "data.meleeStats.defenseMalus" },
                { name: `${game.i18n.localize('rangeCombatAttacks')} - ${game.i18n.localize('CHARAbbrev.AT')}`, val: "data.rangeStats.attack" },
                { name: `${game.i18n.localize('rangeCombatAttacks')} - ${game.i18n.localize('CHARAbbrev.damage')}`, val: "data.rangeStats.damage" },
                { name: `${game.i18n.localize('rangeCombatAttacks')} - ${game.i18n.localize('MODS.defenseMalus')}`, val: "data.rangeStats.defenseMalus" },
                { name: game.i18n.localize('KaPCost'), val: "data.kapModifier" },
                { name: game.i18n.localize('AsPCost'), val: "data.aspModifier" },
                { name: `${game.i18n.localize('skill')} - ${game.i18n.localize("MODS.FW")}`, val: "data.skillModifiers.FW" },
                { name: `${game.i18n.localize('skill')} - ${game.i18n.localize("MODS.FP")}`, val: "data.skillModifiers.FP" },
                { name: `${game.i18n.localize('skill')} - ${game.i18n.localize("stepValue")}`, val: "data.skillModifiers.step" },
                { name: `${game.i18n.localize('skill')} - ${game.i18n.localize("MODS.QS")}`, val: "data.skillModifiers.QL" },
                { name: `${game.i18n.localize('skill')} - ${game.i18n.localize("MODS.partChecks")}`, val: "data.skillModifiers.TPM" },
                { name: `${game.i18n.localize('skill')} - ${game.i18n.localize("MODS.global")}`, val: "data.skillModifiers.global" },
            ]
            const attrs = ["mu", "kl", "in", "ch", "ff", "ge", "ko", "kk"]
            for (const k of attrs)
                optns.push({ name: game.i18n.localize(`CHAR.${k.toUpperCase()}`), val: `data.characteristics.${k}.gearmodifier` })

            for (const k of DSA5.gearModifyableCalculatedAttributes)
                optns.push({ name: game.i18n.localize(k), val: `data.status.${k}.gearmodifier` })

            optns = optns.sort((a, b) => { return a.name.localeCompare(b.name) })

            return `<select class="selMenu">${optns.map(x=> {return `<option value="${x.val}">${x.name}</option>`})}</select>`
    }

    activateListeners(html) {
        super.activateListeners(html)
        const dropDown = this.dropDownMenu()
        html.find('.changes-list .effect-change .key').append(dropDown)
        html.find('.selMenu').change(ev => {
            const elem = $(ev.currentTarget)
            elem.siblings('input').val(elem.val())
            elem.blur()
        })
    }
}