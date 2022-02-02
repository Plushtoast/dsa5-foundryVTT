import Actordsa5 from "../actor/actor-dsa5.js";
import Itemdsa5 from "../item/item-dsa5.js";
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import DialogShared from "./dialog-shared.js";

export default class DSA5CombatDialog extends DialogShared {

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 700,
            resizable: true
        });
        return options;
    }

    activateListeners(html) {
        super.activateListeners(html)
        let specAbs = html.find('.specAbs')
        specAbs.mouseenter(ev => {
            if (ev.currentTarget.getElementsByClassName('hovermenu').length == 0) {
                let div = document.createElement('div')
                div.classList.add("hovermenu")
                let post = document.createElement('i')
                post.classList.add("fas", "fa-comment")
                post.title = game.i18n.localize('SHEET.PostItem')
                post.addEventListener('mousedown', this._postItem, false)
                div.appendChild(post)
                ev.currentTarget.appendChild(div)
            }
        });
        specAbs.mouseleave(ev => {
            let e = ev.toElement || ev.relatedTarget;
            if (e.parentNode == this || e == this)
                return;

            ev.currentTarget.querySelectorAll('.hovermenu').forEach(e => e.remove());
        });


        html.on("mousedown", ".specAbs", ev => {
            if (html.find('.opportunityAttack').is(":checked")) {
                ui.notifications.error(game.i18n.localize("DSAError.opposedAttackNoSpecAbs"))
                return
            }
            const elem = $(ev.currentTarget)
            let step = Number(elem.attr('data-step'))
            const maxStep = Number(elem.attr('data-maxStep'))
            const subcategory = Number(elem.attr('data-category'))

            if (ev.button == 0) {
                step = Math.min(maxStep, step + 1)
                if ([0, 1].includes(subcategory) && game.settings.get("dsa5", "limitCombatSpecAbs")) {
                    const siblings = elem.siblings(`[data-category="${subcategory}"]`)
                    siblings.removeClass('active').attr("data-step", 0)
                    siblings.find('.step').text(DialogShared.roman[0])
                }
            } else if (ev.button == 2) {
                step = Math.max(0, Math.min(maxStep, step - 1))
            }
            elem.attr('data-step', step)
            if (step > 0) {
                elem.addClass("active")
            } else {
                elem.removeClass("active")
            }
            elem.find('.step').text(DialogShared.roman[step])
        });
        html.find(".opportunityAttack").change(ev => {
            if ($(ev.currentTarget).is(":checked")) {
                for (let k of html.find('.specAbs')) {
                    $(k).removeClass('active').attr("data-step", 0).find('.step').text('')
                }
            }
        })
        html.find('.modifiers option').mousedown(ev => {
            ev.preventDefault();
            $(ev.currentTarget).prop('selected', !$(ev.currentTarget).prop('selected'));
            return false;
        });

        const readTargets = () => {
            let targets = []
            game.user.targets.forEach(x => {
                if (x.actor) targets.push({ name: x.actor.name, img: x.actor.img })
            })
            return targets
        }

        let targets = readTargets()
        const compareTargets = () => {
            let newTargets = readTargets()
            if (JSON.stringify(targets) != JSON.stringify(newTargets)) {
                targets = newTargets
                this.updateTargets(html, targets)
            }
        }

        // not great
        this.checkTargets = setInterval(function() {
            compareTargets()
        }, 500)
    }

    updateTargets(html, targets) {
        if (targets.length > 0) {
            html.find(".targets").html(targets.map(x => `<div class="image" title="${game.i18n.localize('target')}" style="background-image:url(${x.img})"><i class="fas fa-bullseye"></i></div>`).join(""))
        } else {
            html.find(".targets").html(`<div><i class="fas fa-exclamation-circle"></i> ${game.i18n.localize('DIALOG.noTarget')}</div>`)
        }
    }

    async close(options = {}) {
        clearInterval(this.checkTargets)
        return await super.close(options)
    }

    _postItem(ev) {
        ev.stopPropagation()
        const elem = $(ev.currentTarget).closest('.specAbs')
        const actorId = elem.attr("data-actor")
        const id = elem.attr("data-id")

        const actor = game.actors.get(actorId)
        actor.items.get(id).postItem()

        return false
    }
    prepareFormRecall(html) {
        super.prepareFormRecall(html)
        if (canvas.scene && game.settings.get("dsa5", "sightAutomationEnabled")) {

            const darkness = canvas.scene.data.darkness
            const threholds = game.settings.get("dsa5", "sightOptions").split("|").map(x => Number(x))
            let level = 0
            while (threholds[level] <= darkness) level += 1

            const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker)
            if (actor) {
                const darkSightLevel = AdvantageRulesDSA5.vantageStep(actor.data, game.i18n.localize("LocalizedIDs.darksight"))
                const blindCombat = SpecialabilityRulesDSA5.abilityStep(actor.data, game.i18n.localize("LocalizedIDs.blindFighting"))
                if (level < 4 && level > 0) {
                    if (darkSightLevel > 1) {
                        level = 0
                    } else {
                        level = Math.max(0, level - darkSightLevel)
                        if (SpecialabilityRulesDSA5.hasAbility(actor.data, game.i18n.localize("LocalizedIDs.traditionBoron"))) level = Math.max(0, level - 1)
                        level = Math.min(4, level + AdvantageRulesDSA5.vantageStep(actor.data, game.i18n.localize("LocalizedIDs.nightBlind")))
                    }
                }

                level = Math.max(0, level - blindCombat)
            }

            const elem = html.find(`[name="vision"] option:nth-child(${level + 1})`)
            if (elem.length) elem[0].selected = true
        }
    }


    static resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, mode) {
        this._resolveDefault(testData, cardOptions, html, options)

        //TODO move this to situational modifiers only
        testData.rangeModifier = html.find('[name="distance"]').val()
        testData.opposingWeaponSize = html.find('[name="weaponsize"]').val()
        testData.narrowSpace = html.find('[name="narrowSpace"]').is(":checked")
        testData.attackOfOpportunity = this.attackOfOpportunity(html, testData.situationalModifiers)

        testData.situationalModifiers.push(
            Itemdsa5.parseValueType(game.i18n.localize("sight"), html.find('[name="vision"]').val() || 0), {
                name: game.i18n.localize("attackFromBehind"),
                value: html.find('[name="attackFromBehind"]').is(":checked") ? -4 : 0
            }, {
                name: game.i18n.localize("MODS.damage"),
                damageBonus: html.find('[name="damageModifier"]').val(),
                value: 0,
                step: 1
            }, {
                name: game.i18n.format("defenseCount", { malus: multipleDefenseValue }),
                value: (Number(html.find('[name="defenseCount"]').val()) || 0) * multipleDefenseValue
            }, {
                name: game.i18n.localize("wrongHand"),
                value: html.find('[name="wrongHand"]').is(":checked") ? -4 : 0
            }, {
                name: game.i18n.localize("advantageousPosition"),
                value: html.find('[name="advantageousPosition"]').is(":checked") ? 2 : 0
            },
            ...Itemdsa5.getSpecAbModifiers(html, mode)
        )
        if (mode == "attack") {
            testData.situationalModifiers.push({
                name: game.i18n.localize("doubleAttack"),
                value: html.find('[name="doubleAttack"]').is(":checked") ? (-2 + SpecialabilityRulesDSA5.abilityStep(actor, game.i18n.localize('LocalizedIDs.twoWeaponCombat'))) : 0
            })
        }

    }

    static resolveRangeDialog(testData, cardOptions, html, actor, options) {
        this._resolveDefault(testData, cardOptions, html, options)

        //TODO move this to situational modifiers only
        testData.rangeModifier = html.find('[name="distance"]').val()

        testData.situationalModifiers.push({
            name: game.i18n.localize("target") + " " + html.find('[name="targetMovement"] option:selected').text(),
            value: Number(html.find('[name="targetMovement"]').val()) || 0
        }, {
            name: game.i18n.localize("shooter") + " " + html.find('[name="shooterMovement"] option:selected').text(),
            value: Number(html.find('[name="shooterMovement"]').val()) || 0
        }, {
            name: game.i18n.localize("mount") + " " + html.find('[name="mountedOptions"] option:selected').text(),
            value: Number(html.find('[name="mountedOptions"]').val()) || 0
        }, {
            name: game.i18n.localize("rangeMovementOptions.QUICKCHANGE"),
            value: html.find('[name="quickChange"]').is(":checked") ? -4 : 0
        }, {
            name: game.i18n.localize("MODS.combatTurmoil"),
            value: html.find('[name="combatTurmoil"]').is(":checked") ? -2 : 0
        }, {
            name: game.i18n.localize("aim"),
            value: Number(html.find('[name="aim"]').val()) || 0
        }, {
            name: game.i18n.localize("MODS.damage"),
            damageBonus: html.find('[name="damageModifier"]').val(),
            value: 0,
            step: 1
        }, {
            name: game.i18n.localize("sight"),
            value: Number(html.find('[name="vision"]').val() || 0)
        }, ...Itemdsa5.getSpecAbModifiers(html, "attack"), {
            name: game.i18n.localize("sizeCategory"),
            value: DSA5.rangeSizeModifier[html.find('[name="size"]').val()]
        })
    }

    static _resolveDefault(testData, cardOptions, html, options) {
        cardOptions.rollMode = html.find('[name="rollMode"]').val();
        testData.situationalModifiers = Actordsa5._parseModifiers(html)
        mergeObject(testData.extra.options, options)
    }

    static attackOfOpportunity(html, situationalModifiers) {
        let value = html.find('[name="opportunityAttack"]').is(":checked") ? -4 : 0
        if (value) {
            situationalModifiers.push({
                name: game.i18n.localize("opportunityAttack"),
                value
            })
            game.user.targets.forEach(target => {
                if (target.actor) {
                    if (target.actor.items.find(x => x.type == "specialability" && x.name == game.i18n.localize("LocalizedIDs.enemySense"))) {
                        situationalModifiers.push({
                            name: game.i18n.localize("LocalizedIDs.enemySense"),
                            value
                        })
                        return
                    }
                }
            })
        }
        return value != 0
    }
}