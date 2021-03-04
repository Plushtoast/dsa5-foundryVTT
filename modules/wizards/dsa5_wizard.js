import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js"
import DSA5 from "../system/config-dsa5.js"
import ItemRulesDSA5 from "../system/item-rules-dsa5.js"
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js"
import DSA5_Utility from "../system/utility-dsa5.js"

export default class WizardDSA5 extends Application {
    constructor(app) {
        super(app)
        this.items = []
        this.actor = null
        this.errors = []
        this.dataTypes = []
        this.attributes = []
        this.updating = false
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "description" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "largeDialog"]),
            width: 770,
            height: 740,
        });
        options.resizable = true
        return options;
    }

    parseToItem(value, types) {
        if (value.trim() == "")
            return []

        return value.split(", ").map(x => {
            let parsed = DSA5_Utility.parseAbilityString(x.trim())
            let item = this.items.find(y => y.name == parsed.original && types.includes(y.type))
            if (!item) {
                item = this.items.find(y => y.name == parsed.name && types.includes(y.type))
            }
            if (!item) {
                if (this.attributes.includes(parsed.name)) {
                    let cost = 0

                    for (let i = this.actor.data.data.characteristics[game.dsa5.config.knownShortcuts[parsed.name.toLowerCase()][1]].value + 1; i < parsed.step + 1; i++) {
                        cost += DSA5.advancementCosts.E[i]
                    }
                    item = {
                        name: parsed.name,
                        step: parsed.step,
                        attributeRequirement: true,
                        data: {
                            APValue: {
                                value: cost
                            }
                        }
                    }
                } else {
                    console.warn(`Not found <${x}>`)
                    this.errors.push(`${types.map(x => game.i18n.localize(x)).join("/")}: ${x}`)
                    item = {
                        name: x.trim(),
                        notFound: true,
                        tooltip: game.i18n.localize('DSAError.itemNotFound'),
                        apCost: "?"
                    }
                }
            } else {
                item = duplicate(item)
                item.tooltip = game.i18n.localize("Details")
                item = ItemRulesDSA5.reverseAdoptionCalculation(this.actor, parsed, item)
                if (item.data.APValue) {
                    item.APunparseable = isNaN(item.data.APValue.value)
                    item.apCost = item.APunparseable ? item.data.APValue.value : parsed.step * Number(item.data.APValue.value)
                }
            }
            item.replaceName = parsed.original
            item.step = parsed.step
            let actorHasItem = this.actor.data.items.find(y => types.includes(y.type) && y.name == parsed.original) != undefined
            item.disabled = actorHasItem || item.notFound || item.APunparseable
            if (actorHasItem)
                item.tooltip = game.i18n.localize("YouAlreadyHaveit")
            return item
        })
    }

    async addSelections(elems) {
        for (let k of elems) {
            let item = duplicate(this.items.find(x => x._id == $(k).val()))
            item.name = $(k).attr("name")

            switch (item.type) {
                case "advantage":
                case "disadvantage":
                    item.data.step.value = Number($(k).attr("data-step"))
                    item.data.APValue.value = Number($(k).attr("data-cost"))
                    await this.actor.createEmbeddedEntity("OwnedItem", item)
                    AdvantageRulesDSA5.vantageAdded(this.actor, item)
                    break
                case "specialability":
                    item.data.step.value = Number($(k).attr("data-step"))
                    item.data.APValue.value = Number($(k).attr("data-cost"))
                    await this.actor.createEmbeddedEntity("OwnedItem", item)
                    SpecialabilityRulesDSA5.abilityAdded(this.actor, item)
                    break
                case "magictrick":
                    await this.actor.createEmbeddedEntity("OwnedItem", item)
                    break
            }
        }
    }

    async alreadyAdded(string, category) {
        if (string == "") {
            return false
        }

        let result = false
        result = await new Promise((resolve, reject) => {
            new Dialog({
                title: game.i18n.localize("DIALOG.warning"),
                content: game.i18n.format('DIALOG.alreadyAddedCharacterpart', { category: game.i18n.localize(category) }),
                default: 'ok',
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: game.i18n.localize('Ok'),
                        default: true,
                        callback: html => {
                            resolve(false);
                        },
                    },
                    cancel: {
                        icon: '<i class="fas fa-close"></i>',
                        label: game.i18n.localize('Cancel'),
                        default: true,
                        callback: html => {
                            resolve(true);
                        },
                    }
                }
            }).render(true);
        });
        return result
    }

    async updateSkill(skill, itemType, factor = 1, bonus = true) {
        let parsed = DSA5_Utility.parseAbilityString(skill.trim())
        let res = this.actor.data.items.find(i => {
            return i.type == itemType && i.name == parsed.name
        });
        if (res) {
            let skillUpdate = duplicate(res)
                //skillUpdate.data.talentValue.value = parsed.step + (parsed.bonus ? Number(skillUpdate.data.talentValue.value) : 0)
            skillUpdate.data.talentValue.value = Math.max(0, factor * parsed.step + (bonus ? Number(skillUpdate.data.talentValue.value) : 0))
            await this.actor.updateEmbeddedEntity("OwnedItem", skillUpdate);
        } else {
            console.warn(`Could not find ${itemType} ${skill}`)
            this.errors.push(`${game.i18n.localize(itemType)}: ${skill}`)
        }
    }

    async _loadCompendiae() {
        this.items = [];
        for (let p of game.packs) {
            if (p.metadata.entity == "Item" && (game.user.isGM || !p.private)) {
                await p.getContent().then(content => {
                    this.items.push(...content.filter(x => this.dataTypes.includes(x.type)))
                })
            }
        }
        this.items.push(...game.items.entities.filter(i => i.permission > 1 && this.dataTypes.includes(i.type)));
    }

    _validateInput(parent) {
        let exclusives = new Set()
        let regex = /^exclusive_/
        for (let k of parent.find('.exclusive')) {
            exclusives.add(k.className.split(/\s+/).filter(x => regex.test(x))[0])
        }
        for (let k of exclusives) {
            let choice = parent.find('.allowedCount_' + k.split("_")[1])
            let allowed = Number(choice.attr('data-count'))
            if (parent.find(`.${k}:checked`).length != allowed) {
                ui.notifications.error(game.i18n.localize("DSAError.MissingChoices"))
                WizardDSA5.flashElem(choice)
                let tabElem = choice.closest('.tab').attr("data-tab")
                WizardDSA5.flashElem(parent.find(`.tabs a[data-tab='${tabElem}']`))
                return false
            }
        }
        return true
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('button.ok').click(ev => {
            if (!this.updating) {
                this.updating = true
                this.updateCharacter().then(
                    x => this.updating = false
                )
            }

        })
        html.find('button.cancel').click(ev => {
            this.close()
        })
        html.find('.show-item').click(ev => {
            let itemId = $(ev.currentTarget).attr("data-id")
            const item = this.items.find(i => i.data._id == itemId)
            item.sheet.render(true)
        })

        html.find('.exclusive').change(ev => {
            let parent = $(ev.currentTarget).closest('.content')
            let sel = $(ev.currentTarget).attr('data-sel')
            let maxDomElem = parent.find(`.allowedCount_${sel}`)
            let maxSelections = Number(maxDomElem.attr("data-count"))
            if (parent.find(`.exclusive_${sel}:checked`).length > maxSelections) {
                ev.currentTarget.checked = false
                WizardDSA5.flashElem(maxDomElem)
                return
            }
        })
    }

    static flashElem(elem, cssClass = "emphasize") {
        elem.addClass(cssClass)
        setTimeout(function() {
            elem.removeClass(cssClass)
        }, 600)
    }

    finalizeUpdate() {
        if (this.errors.length == 0) {
            this.close()
        } else {
            $(this._element).find('.dialog-buttons').html(`<div class="error"><p>${game.i18n.localize('DSAError.notUnderstood')}</p><ul><li>${this.errors.join("</li><li>")}</li></ul></div>`)
        }
    }
}