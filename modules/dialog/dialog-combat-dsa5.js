import Actordsa5 from "../actor/actor-dsa5.js";
import Itemdsa5 from "../item/item-dsa5.js";
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5Dialog from "./dialog-dsa5.js";
import DialogShared from "./dialog-shared.js";

export default class DSA5CombatDialog extends DialogShared {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 700,
            resizable: true,
        });
        return options;
    }

    activateListeners(html) {
        super.activateListeners(html);
        let specAbs = html.find(".specAbs");
        specAbs.mouseenter((ev) => {
            if (ev.currentTarget.getElementsByClassName("hovermenu").length == 0) {
                let div = document.createElement("div");
                div.classList.add("hovermenu");
                let post = document.createElement("i");
                post.classList.add("fas", "fa-comment");
                post.title = game.i18n.localize("SHEET.PostItem");
                post.addEventListener("mousedown", this._postItem, false);
                div.appendChild(post);
                ev.currentTarget.appendChild(div);
            }
        });
        specAbs.mouseleave((ev) => {
            let e = ev.toElement || ev.relatedTarget;
            if (e.parentNode == this || e == this) return;

            ev.currentTarget.querySelectorAll(".hovermenu").forEach((e) => e.remove());
        });

        html.on("mousedown", ".specAbs", (ev) => {
            if (html.find(".opportunityAttack").is(":checked")) {
                ui.notifications.error(game.i18n.localize("DSAError.opposedAttackNoSpecAbs"));
                return;
            }
            const elem = $(ev.currentTarget);
            let step = Number(elem.attr("data-step"));
            const maxStep = Number(elem.attr("data-maxStep"));
            const subcategory = Number(elem.attr("data-category"));

            if (ev.button == 0) {
                step = Math.min(maxStep, step + 1);
                if ([0, 1].includes(subcategory) && game.settings.get("dsa5", "limitCombatSpecAbs")) {
                    const siblings = elem.siblings(`[data-category="${subcategory}"]`);
                    siblings.removeClass("active").attr("data-step", 0);
                    siblings.find(".step").text(DialogShared.roman[0]);
                }
            } else if (ev.button == 2) {
                step = Math.clamped(maxStep, 0, step - 1)
            }
            elem.attr("data-step", step);
            if (step > 0) {
                elem.addClass("active");
            } else {
                elem.removeClass("active");
            }
            elem.find(".step").text(DialogShared.roman[step]);
        });
        html.find(".opportunityAttack").change((ev) => {
            if ($(ev.currentTarget).is(":checked")) {
                for (let k of html.find(".specAbs")) {
                    $(k).removeClass("active").attr("data-step", 0).find(".step").text("");
                }
            }
        });

        let targets = this.readTargets();

        if (targets.length == 0) {
            this.setRollButtonWarning()
        } else if (targets.length > 1) {
            this.setMultipleTargetsWarning()
        }
        // not great
        const that = this
        this.checkTargets = setInterval(function() {
            targets = that.compareTargets(html, targets);
        }, 500);
    }

    async close(options = {}) {
        clearInterval(this.checkTargets);
        return await super.close(options);
    }

    _postItem(ev) {
        ev.stopPropagation();
        const elem = $(ev.currentTarget).closest(".specAbs");
        const actorId = elem.attr("data-actor");
        const id = elem.attr("data-id");

        const actor = game.actors.get(actorId);
        actor.items.get(id).postItem();

        return false;
    }

    prepareFormRecall(html) {
        super.prepareFormRecall(html);
        if (canvas.scene && game.settings.get("dsa5", "sightAutomationEnabled")) {
            const darkness = canvas.scene.data.darkness;
            const threholds = game.settings
                .get("dsa5", "sightOptions")
                .split("|")
                .map((x) => Number(x));
            let level = 0;
            while (threholds[level] <= darkness) level += 1;

            const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
            if (actor) {
                const darkSightLevel = AdvantageRulesDSA5.vantageStep(actor.data, game.i18n.localize("LocalizedIDs.darksight")) + SpecialabilityRulesDSA5.abilityStep(actor.data, game.i18n.localize("LocalizedIDs.sappeurStyle"));
                const blindCombat = SpecialabilityRulesDSA5.abilityStep(actor.data, game.i18n.localize("LocalizedIDs.blindFighting"));
                if (level < 4 && level > 0) {
                    if (darkSightLevel > 1) {
                        level = 0;
                    } else {
                        level = Math.max(0, level - darkSightLevel);
                        if (SpecialabilityRulesDSA5.hasAbility(actor.data, game.i18n.localize("LocalizedIDs.traditionBoron")))
                            level = Math.max(0, level - 1);
                        level = Math.min(
                            4,
                            level + AdvantageRulesDSA5.vantageStep(actor.data, game.i18n.localize("LocalizedIDs.nightBlind"))
                        );
                    }
                }

                level = Math.max(0, level - blindCombat);
            }

            const elem = html.find(`[name="vision"] option:nth-child(${level + 1})`);
            if (elem.length) elem[0].selected = true;
        }
    }

    static assassinationModifiers(html, testData) {
        const mode = html.find('[name="assassinate"]').val()
        if (!mode || mode == "-") return []

        testData.opposingWeaponSize = 0
        const advantageousPositionMod = html.find('[name="advantageousPosition"]').is(":checked") ? 2 : 0
        const opposingWeaponSize = ["short", "medium", "long"].indexOf(html.find('[name="weaponsize"]').val())
        const modeTranslated = game.i18n.localize(`DIALOG.${mode}`)
        const result = [{
            name: modeTranslated,
            value: 10 - advantageousPositionMod - opposingWeaponSize
        }]
        if (mode == "assassinate") {
            const weaponsize = ["short", "medium", "long"].indexOf(testData.source.data.reach.value)

            const dices = Math.max(1, (new Roll(testData.source.data.damage.value.replace(/[DWw]/g, "d"))).terms.reduce((prev, cur) => {
                return prev + (cur.faces ? cur.number : 0)
            }, 0)) - 1

            const tpMod = [2, 0, -2, -4][weaponsize] - dices * 2
            const multiplier = Math.max(1, 5 - weaponsize - dices)

            result.push({
                name: modeTranslated + " (" + game.i18n.localize('CHARAbbrev.damage') + ")",
                damageBonus: tpMod,
                value: 0,
                step: 1
            }, {
                name: modeTranslated + " (*)",
                damageBonus: `*${multiplier}`,
                value: 0,
                step: 1
            })
        } else {
            if (!testData.source.effects) testData.source.effects = []

            testData.source.effects.push({
                "_id": modeTranslated,
                "changes": [],
                "disabled": false,
                "duration": {},
                "icon": "icons/svg/aura.svg",
                "label": modeTranslated,
                "transfer": true,
                "flags": {
                    "dsa5": {
                        "value": null,
                        "editable": true,
                        "description": modeTranslated,
                        "custom": true,
                        "auto": null,
                        "manual": 0,
                        "resistRoll": `${game.i18n.localize("LocalizedIDs.selfControl")} -3`,
                        "hideOnToken": false,
                        "hidePlayers": false,
                        "customDuration": "",
                        "advancedFunction": "1",
                        "args0": "unconscious",
                        "args1": ""
                    }
                }
            })
        }

        return result
    }

    static resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, mode) {
        this._resolveDefault(testData, cardOptions, html, options);

        //TODO move this to situational modifiers only
        testData.rangeModifier = html.find('[name="distance"]').val();
        testData.opposingWeaponSize = html.find('[name="weaponsize"]').val();
        testData.narrowSpace = html.find('[name="narrowSpace"]').is(":checked");
        testData.attackOfOpportunity = this.attackOfOpportunity(html, testData.situationalModifiers);
        testData.situationalModifiers.push(
            Itemdsa5.parseValueType(game.i18n.localize("sight"), html.find('[name="vision"]').val() || 0), {
                name: game.i18n.localize("attackFromBehind"),
                value: html.find('[name="attackFromBehind"]').is(":checked") ? -4 : 0,
            }, {
                name: game.i18n.localize("MODS.damage"),
                damageBonus: html.find('[name="damageModifier"]').val(),
                value: 0,
                step: 1,
            }, {
                name: game.i18n.format("defenseCount", { malus: multipleDefenseValue }),
                value: (Number(html.find('[name="defenseCount"]').val()) || 0) * multipleDefenseValue,
            }, {
                name: game.i18n.localize("wrongHand"),
                value: html.find('[name="wrongHand"]').is(":checked") ? -4 : 0,
            }, {
                name: game.i18n.localize("advantageousPosition"),
                value: html.find('[name="advantageousPosition"]').is(":checked") ? 2 : 0,
            },
            ...Itemdsa5.getSpecAbModifiers(html, mode),
            ...this.assassinationModifiers(html, testData)
        );
        if (mode == "attack") {
            testData.situationalModifiers.push({
                name: game.i18n.localize("doubleAttack"),
                value: html.find('[name="doubleAttack"]').is(":checked") ?
                    -2 + SpecialabilityRulesDSA5.abilityStep(actor, game.i18n.localize("LocalizedIDs.twoWeaponCombat")) : 0,
            });
        }
    }

    static resolveRangeDialog(testData, cardOptions, html, actor, options) {
        this._resolveDefault(testData, cardOptions, html, options);

        //TODO move this to situational modifiers only
        testData.rangeModifier = html.find('[name="distance"]').val();

        testData.situationalModifiers.push({
                name: game.i18n.localize("target") + " " + html.find('[name="targetMovement"] option:selected').text(),
                value: Number(html.find('[name="targetMovement"]').val()) || 0,
            }, {
                name: game.i18n.localize("shooter") + " " + html.find('[name="shooterMovement"] option:selected').text(),
                value: Number(html.find('[name="shooterMovement"]').val()) || 0,
            }, {
                name: game.i18n.localize("mount") + " " + html.find('[name="mountedOptions"] option:selected').text(),
                value: Number(html.find('[name="mountedOptions"]').val()) || 0,
            }, {
                name: game.i18n.localize("rangeMovementOptions.QUICKCHANGE"),
                value: html.find('[name="quickChange"]').is(":checked") ? -4 : 0,
            }, {
                name: game.i18n.localize("MODS.combatTurmoil"),
                value: html.find('[name="combatTurmoil"]').is(":checked") ? -2 : 0,
            }, {
                name: game.i18n.localize("aim"),
                value: Number(html.find('[name="aim"]').val()) || 0,
            }, {
                name: game.i18n.localize("MODS.damage"),
                damageBonus: html.find('[name="damageModifier"]').val(),
                value: 0,
                step: 1,
            }, {
                name: game.i18n.localize("sight"),
                value: Number(html.find('[name="vision"]').val() || 0),
            },
            ...Itemdsa5.getSpecAbModifiers(html, "attack"), {
                name: game.i18n.localize("sizeCategory"),
                value: DSA5.rangeSizeModifier[html.find('[name="size"]').val()],
            }
        );
    }

    static _resolveDefault(testData, cardOptions, html, options) {
        cardOptions.rollMode = html.find('[name="rollMode"]').val();
        testData.situationalModifiers = Actordsa5._parseModifiers(html);
        mergeObject(testData.extra.options, options);
    }

    static attackOfOpportunity(html, situationalModifiers) {
        let value = html.find('[name="opportunityAttack"]').is(":checked") ? -4 : 0;
        if (value) {
            situationalModifiers.push({
                name: game.i18n.localize("opportunityAttack"),
                value,
            });
            const enemySense = game.i18n.localize("LocalizedIDs.enemySense")
            game.user.targets.forEach((target) => {
                if (target.actor) {
                    if (target.actor.items.find((x) => x.type == "specialability" && x.name == enemySense)) {
                        situationalModifiers.push({
                            name: enemySense,
                            value,
                        });
                        return;
                    }
                }
            });
        }
        return value != 0;
    }

    static getRollButtons(testData, dialogOptions, resolve, reject) {
        let buttons = DSA5Dialog.getRollButtons(testData, dialogOptions, resolve, reject);
        if (
            testData.source.type == "rangeweapon" ||
            (testData.source.type == "trait" && testData.source.data.traitType.value == "rangeAttack")
        ) {
            const LZ =
                testData.source.type == "trait" ?
                Number(testData.source.data.reloadTime.value) :
                Actordsa5.calcLZ(testData.source, testData.extra.actor)
            const progress = testData.source.data.reloadTime.progress
            if (progress < LZ) {
                mergeObject(buttons, {
                    reloadButton: {
                        label: `${game.i18n.localize("WEAPON.reload")} (${progress}/${LZ})`,
                        callback: async() => {
                            const actor = await DSA5_Utility.getSpeaker(testData.extra.speaker)
                            await actor.updateEmbeddedDocuments("Item", [
                                { _id: testData.source._id, "data.reloadTime.progress": progress + 1 },
                            ])
                            const infoMsg = game.i18n.format("WEAPON.isReloading", {
                                actor: testData.extra.actor.name,
                                item: testData.source.name,
                                status: `${progress + 1}/${LZ}`,
                            })
                            await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg))
                        },
                    },
                })
            }
        }
        return buttons
    }
}