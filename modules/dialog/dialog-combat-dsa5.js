import Actordsa5 from "../actor/actor-dsa5.js";
import Itemdsa5 from "../item/item-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import DiceDSA5 from "../system/dice-dsa5.js";
import Riding from "../system/riding.js";
import RuleChaos from "../system/rule_chaos.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5Dialog from "./dialog-dsa5.js";
import DialogShared from "./dialog-shared.js";
import DSA5StatusEffects from "../status/status_effects.js";
import DPS from "../system/derepositioningsystem.js";
const { mergeObject, duplicate, getProperty } = foundry.utils

export default class DSA5CombatDialog extends DialogShared {
    static rollModifiers = {
        wrongHand: { mod: -4 },
        advantageousPosition: {  mod: 2 },
        attackFromBehindLabel: { mod: -4 },
        opportunityAttack: { mod: -4 },
        doubleAttack: { mod: -2 },
        narrowSpace: { mod: 0 },

        combatTurmoil: { mod: -2 },
        quickChange: { mod: -4 },
        targetMovement: { mod: 0 },
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 700,
            resizable: true,
        });
        return options;
    }

    static setData(actor, type, testData){
        const rollModifiers = duplicate(DSA5CombatDialog.rollModifiers)
        rollModifiers.narrowSpace.mod = this.getNarrowSpaceModifier(testData, testData.mode)
        const tt = `${type}RollModifiers`
        if(actor.system[tt]){
            for(let key of Object.keys(actor.system[tt])){
                rollModifiers[key].mod += (Number(actor.system[tt][key]?.mod ?? 0))
            }
        }
        return rollModifiers
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

        html.find('.variantChange').mousedown(ev => this.changeSpecAbVariant(ev))

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
                step = Math.clamp(maxStep, 0, step - 1)
            }
            elem.attr("data-step", step);
            elem.toggleClass("active", step > 0);

            elem.find(".step").text(DialogShared.roman[step]);
            this.checkCounterAttack(ev)
            this.calculateModifier()
        });
        html.find(".opportunityAttack").change((ev) => {
            if ($(ev.currentTarget).is(":checked")) {
                for (let k of html.find(".specAbs")) {
                    $(k).removeClass("active").attr("data-step", 0).find(".step").text("");
                }
            }
        });
        html.on("change", "input,select", ev => this.calculateModifier(ev))
        html.find(".modifiers option").mousedown((ev) => {
            this.calculateModifier(ev)
        })
        html.find('.quantity-click').mousedown(ev => this.calculateModifier(ev));
        let targets = this.readTargets();
        this.calculateModifier()
            // not great
        const that = this
        this.checkTargets = setInterval(function() {
            targets = that.compareTargets(html, targets);
        }, 500);
    }

    checkCounterAttack(ev) {
        if(!this.dialogData.mode == "parry") return

        const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker)

        if(actor){
            const counterAttack = actor.items.get(ev.currentTarget.dataset.id).name == game.i18n.localize("LocalizedIDs.counterAttack")
            if (counterAttack) {
                this.dialogData.counterAttack = ev.button == 0
                this.prepareWeapon()
                const mode = ev.button == 0 ? "attack" : "parry"
                const item = actor.items.get(this.dialogData.source._id)
                let situationalModifiers = DSA5StatusEffects.getRollModifiers(actor, item, { mode: mode })
                Itemdsa5.getSubClass(item.type).getSituationalModifiers(situationalModifiers, actor, { mode: mode }, item)
                if (mode == "attack") {
                    situationalModifiers = situationalModifiers.filter(x => x.type != "defenseMalus")
                    let modIndex = situationalModifiers.findIndex(x => x.name == game.i18n.localize("statuseffects"))
                    let attackStatEffect
                    if (modIndex >= 0) {
                        attackStatEffect = situationalModifiers.splice(modIndex, 1).pop()
                    } 
                    const defenseModifiers = []
                    Itemdsa5.getSubClass(item.type).getSituationalModifiers(defenseModifiers, actor, { mode: "parry" }, item)
                    modIndex = defenseModifiers.findIndex(x => x.name == game.i18n.localize("statuseffects"))
                    let defenseStatEffect
                    if (modIndex >= 0) {
                        defenseStatEffect = defenseModifiers.splice(modIndex, 1).pop()
                    }
                    situationalModifiers.unshift(...defenseModifiers)

                    if (attackStatEffect) {
                        if (defenseStatEffect) {
                            attackStatEffect.value += defenseStatEffect.value
                        }
                        situationalModifiers.push(attackStatEffect)
                    } else if (defenseStatEffect) {
                        situationalModifiers.push(defenseStatEffect)
                    }
                }
                const htmlMods = $(this._element).find("[name=situationalModifiers]")
                if (situationalModifiers.length > 0) {
                    if (htmlMods.length == 0) {
                        const modBox = `<div class="modifiers form-group custom-select">
                                            <label>${game.i18n.localize("DIALOG.SituationalModifiers")}</label>
                                            <select name="situationalModifiers" multiple data-tooltip="${game.i18n.localize("DIALOG.deselectWithStrg")}" />
                                        </div>`
                        $(this._element).find("[name=rollMode]").parent().after(modBox)
                        this.position.height += 86
                        this.setPosition(this.position)
                    }
                    let mods = ''
                    for (const mod of situationalModifiers) {
                        mods += `<option value="${mod.value}"
                                        data-tooltip="${Handlebars.helpers.situationalTooltip(mod)}"
                                        ${mod.type ? " data-type=" + mod.type : ""}
                                        ${mod.specAbId ? " data-specAbId=" + mod.specAbId : ""}
                                        ${mod.armorPen ? " data-armorPen=" + mod.armorPen : ""}
                                        ${mod.selected ? " selected" : ""}>
                                    ${mod.name} [${mod.value}]
                                </option>`
                    }
                    $(this._element).find(".modifiers select").html(mods)
                } else if (htmlMods.length > 0) {
                    htmlMods.parent().remove()
                    this.position.height -= 86
                    this.setPosition(this.position)
                }
            }
        }
    }

    changeSpecAbVariant(ev){
        ev.stopPropagation()
        ev.preventDefault()

        const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker)

        if(actor){
            const current = Number(ev.currentTarget.dataset.current)
            let next = current + 1
            if(next >= Number(ev.currentTarget.dataset.variantcount)) next = 0

            ev.currentTarget.dataset.current = next
            $(ev.currentTarget).text(["A", "B", "C"][next])

            const parent = $(ev.currentTarget).closest('.specAbs')[0]
            const specAb = actor.items.get(parent.dataset.id)
            const path = `effect.value${["","2","3"][next]}`

            const res = (this.dialogData.mode == "attack" ? Itemdsa5.attackSpecAbs([specAb], actor, path) : Itemdsa5.defenseSpecAbs([specAb], actor, path))[0]

            parent.dataset.dmmalus = res.dmmalus || 0
            parent.dataset.atbonus = res.atbonus || 0
            parent.dataset.tpbonus = res.tpbonus || 0
            parent.dataset.pabonus = res.pabonus || 0
            parent.dataset.tooltip = res.label

            this.calculateModifier()
        }
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

    recallSettings(speaker, source, mode, renderData) {
        super.recallSettings(speaker, source, mode, renderData)
        this.prepareWeapon()
        return this
    }

    prepareWeapon() {
        let weapon
        const source = this.dialogData.source
        if (["meleeweapon", "rangeweapon"].includes(source.type)) {
            const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker)

            if (actor) {
                const combatskill = source.system.combatskill.value
                let skill = Actordsa5._calculateCombatSkillValues(
                    actor.items.find((x) => x.type == "combatskill" && x.name == combatskill).toObject(),
                    actor.system
                )
                switch (source.type) {
                    case "meleeweapon":
                        weapon = Actordsa5._prepareMeleeWeapon(source, [skill], actor)
                        break
                    case "rangeweapon":
                        weapon = Actordsa5._prepareRangeWeapon(source, [], [skill], actor)
                        break
                }
                if (this.dialogData.mode == "attack" || this.dialogData.counterAttack) {
                    this.dialogData.rollValue = weapon.attack
                } else if (this.dialogData.mode == "parry") {
                    this.dialogData.rollValue = weapon.parry
                }
            } else if (source.type == "dodge") {
                this.dialogData.rollValue = source.system.value
            } else {
                if (this.dialogData.mode == "attack" || this.dialogData.counterAttack) {
                    this.dialogData.rollValue = Number(source.system.at.value)
                } else if (this.dialogData.mode == "parry") {
                    this.dialogData.rollValue = Number(source.system.pa)
                }
            }
        }
    }

    prepareFormRecall(html) {
        super.prepareFormRecall(html);
        const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker)
        DPS.lightLevel(actor, html)
        const isRider = Riding.isRiding(actor)

        const advantageousPosition = html.find('[name="advantageousPosition"]')[0]
        if (this.dialogData.mode == "attack"){
            const targetIsRider = Array.from(game.user.targets).some(x => Riding.isRiding(x.actor))
            if(advantageousPosition && (targetIsRider || isRider))
                advantageousPosition.checked = isRider && !targetIsRider

            const mountedOptions = html.find('[name="mountedOptions"]')[0]
            if(isRider && mountedOptions){
                const horse = Riding.getHorse(actor)
                if(horse){
                    mountedOptions.selectedIndex = Riding.horseSpeedModifier(horse)
                }
            }
        }
        else if(this.dialogData.mode == "parry" && actor.flags.oppose){
            const attacker = DSA5_Utility.getSpeaker(actor.flags.oppose.speaker)
            const attackerIsRider = Riding.isRiding(attacker)
            if(advantageousPosition && (attackerIsRider || isRider))
                advantageousPosition.checked = isRider && !attackerIsRider
        }
        this.calculateModifier()
    }

    static assassinationModifiers(testData, formData) {
        const mode = formData.assassinate
        if (!mode || mode == "-") return []

        testData.opposingWeaponSize = 0
        const advantageousPositionMod = formData.advantageousPosition ? 2 : 0
        const opposingWeaponSize = DSA5.meleeRangesArray.indexOf(formData.weaponsize)
        const modeTranslated = game.i18n.localize(`DIALOG.${mode}`)
        const result = [{
            name: modeTranslated,
            value: 10 - advantageousPositionMod - opposingWeaponSize
        }]
        if (mode == "assassinate") {
            let weaponsize = DSA5.meleeRangesArray.indexOf(testData.source.system.reach.value)
            if(!RuleChaos.isYieldedTwohanded(testData.source) && testData.source.system.worn.wrongGrip){
                weaponsize = Math.min(weaponsize, 1)
            }

            const dices = Math.max(1, (new Roll(testData.source.system.damage.value.replace(/[DWw]/g, "d"))).terms.reduce((prev, cur) => {
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

            if(!testData.source.effects.find(x => x._id == modeTranslated)){
                testData.source.effects.push({
                    "_id": modeTranslated,
                    "changes": [],
                    "disabled": false,
                    "duration": {},
                    "icon": "icons/svg/aura.svg",
                    "name": modeTranslated,
                    "transfer": true,
                    "flags": {
                        "dsa5": {
                            "description": modeTranslated,
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
        }

        return result
    }

    async calculateModifier() {
        if (this.dialogData.mode == "damage") return

        const source = this.dialogData.source
        const isMelee = (source.type == "trait" && getProperty(source, "system.traitType.value") == "meleeAttack") || source.type == "meleeweapon" || source.type == "dodge"
        const testData = { source: this.dialogData.source, extra: { options: {} } }
        const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker)
        isMelee ? DSA5CombatDialog.resolveMeleeDialog(testData, {}, this.element, actor, {}, -3, this.dialogData.mode) :
            DSA5CombatDialog.resolveRangeDialog(testData, {}, this.element, actor, {}, this.dialogData.mode)

        this.dialogData.modifier = await DiceDSA5._situationalModifiers(testData)
        this.updateRollButton(this.readTargets())
    }

    static getNarrowSpaceModifier(testData, mode){
        if(!mode) return 0

        if (RuleChaos.isShield(testData.source))
            return getProperty(DSA5.narrowSpaceModifiers , `shield${testData.source.system.reach.shieldSize}.${mode}`) || 0

        return getProperty(DSA5.narrowSpaceModifiers , `weapon${testData.source.system.reach.value}.${mode}`) || 0
    }

    static resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, mode) {
        this._resolveDefault(testData, cardOptions, html, options);

        //TODO move this to situational modifiers onlye
        const data = new FormDataExtended(html.find('form')[0]).object
        const targetIsSwarm = DSA5CombatDialog.targetIsSwarm(testData)
        const attackerIsSwarm = actor.isSwarm()
        testData.opposingWeaponSize = attackerIsSwarm ? 0 : data.weaponsize
        testData.attackOfOpportunity = this.attackOfOpportunity(testData.situationalModifiers, data);
        testData.situationalModifiers.push(
            Itemdsa5.parseValueType(game.i18n.localize("sight"), data.vision || 0), {
                name: game.i18n.localize("attackFromBehind"),
                value: Number(data.attackFromBehind) || 0,
            }, {
                name: game.i18n.localize("MODS.damage"),
                damageBonus: data.damageModifier,
                value: 0,
                step: 1,
            }, {
                name: game.i18n.format("defenseCount", { malus: multipleDefenseValue }),
                value: (Number(data.defenseCount) || 0) * multipleDefenseValue,
            }, {
                name: game.i18n.localize("wrongHand"),
                value: Number(data.wrongHand) || 0,
            }, {
                name: game.i18n.localize("advantageousPosition"),
                value: Number(data.advantageousPosition) || 0,
            },
            {
                name: game.i18n.localize("sizeCategory"),
                value: targetIsSwarm ? 0 : (DSA5.meleeSizeModifier[data.size] || 0),
            },
            ...Itemdsa5.getSpecAbModifiers(html, mode),
            ...this.assassinationModifiers(testData, data),
            {
                name: game.i18n.localize("narrowSpace"),
                value: Number(data.narrowSpace) || 0
            },
            {
                name: game.i18n.localize("doubleAttack"),
                value: Number(data.doubleAttack) || 0,
            }
        );
        if (testData.situationalModifiers.some(x => x.name == game.i18n.localize("LocalizedIDs.counterAttack"))) {
            testData.mode = "attack"
            testData.extra.counterAttack = true
        }
    }

     static resolveRangeDialog(testData, cardOptions, html, actor, options) {
        this._resolveDefault(testData, cardOptions, html, options);
        const data = new FormDataExtended(html.find('form')[0]).object
        const zigzag = Number(data.quickChange) || 0
        const sizeMod = DSA5.rangeSizeModifier[data.size] || 0
        const rangeMod = DSA5.rangeMods[ data.distance || "medium"].attack
        testData.situationalModifiers.push({
                name: game.i18n.localize("target") + " " + html.find('[name="targetMovement"] option:selected').text(),
                value: Number(data.targetMovement) || 0,
            }, {
                name: game.i18n.localize("shooter") + " " + html.find('[name="shooterMovement"] option:selected').text(),
                value: Number(data.shooterMovement) || 0,
            }, {
                name: game.i18n.localize("mount") + " " + html.find('[name="mountedOptions"] option:selected').text(),
                value: Number(data.mountedOptions) || 0,
            }, {
                name: game.i18n.localize("rangeMovementOptions.QUICKCHANGE"),
                value: zigzag,
            }, {
                name: game.i18n.localize("MODS.combatTurmoil"),
                value: Number(data.combatTurmoil) || 0,
            }, {
                name: game.i18n.localize("aim"),
                value: Number(data.aim) || 0,
            }, {
                name: game.i18n.localize("MODS.damage"),
                damageBonus: data.damageModifier,
                value: 0,
                step: 1,
            }, {
                name: game.i18n.localize("sight"),
                value: Number(data.vision) || 0,
            }, {
                name: game.i18n.localize("sizeCategory"),
                value: sizeMod,
            }, {
                name: game.i18n.localize("distance"),
                value: rangeMod,
                damageBonus: DSA5.rangeMods[ data.distance || "medium"].damage
            },
            ...Itemdsa5.getSpecAbModifiers(html, "attack")
        );

        const sharpshooter = actor.items.find(x => x.type == "specialability" && x.name == game.i18n.localize("LocalizedIDs.sharpshooter"))
        if(sharpshooter){
            const toSearch = getProperty(testData.source, "system.combatskill.value")?.toLowerCase()
            if(toSearch && sharpshooter.system.list.value.split(/;|,/).map((x) => x.trim().toLowerCase()).includes(toSearch)){
                const possibleMods = [data.targetMovement, data.shooterMovement, data.mountedOptions, zigzag, sizeMod, rangeMod]
                const sumMod = Math.abs(possibleMods.reduce((prev, cur) => {
                    if(Number(cur) < 0) prev += Number(cur)
                    return prev
                }, 0))
                const sharpshooterMod = Math.min(Number(sharpshooter.system.step.value) * 2, sumMod)
                if(sharpshooterMod){
                    testData.situationalModifiers.push({
                        name: game.i18n.localize("LocalizedIDs.sharpshooter"),
                        value: sharpshooterMod
                    })
                }
            }
        }
    }

    static _resolveDefault(testData, cardOptions, html, options) {
        cardOptions.rollMode = html.find('[name="rollMode"]').val();
        testData.situationalModifiers = Actordsa5._parseModifiers(html);
        mergeObject(testData.extra.options, options);
    }

    static targetIsSwarm() {
        let res = false
        game.user.targets.forEach((target) => {
            if (target.actor?.isSwarm()) {
                res =  true
                return
            }
        });

        return res
    }

    static attackOfOpportunity(situationalModifiers, formData) {
        let value = Number(formData.opportunityAttack) || 0
        if (value) {
            situationalModifiers.push({
                name: game.i18n.localize("opportunityAttack"),
                value,
            });
            const enemySense = game.i18n.localize("LocalizedIDs.enemySense")
            const winhallStyle = game.i18n.localize("LocalizedIDs.winhallStyle")
            game.user.targets.forEach((target) => {
                for(const item of target.actor?.items || []){
                    if(item.type == "specialability"){
                        if(item.name == enemySense){
                            situationalModifiers.push({
                                name: enemySense,
                                value: -4,
                            });
                        }
                        else if(item.name == winhallStyle){
                            situationalModifiers.push({
                                name: winhallStyle,
                                value: -2,
                            });
                        }

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
            (testData.source.type == "trait" && testData.source.system.traitType.value == "rangeAttack")
        ) {
            const LZ =
                testData.source.type == "trait" ?
                Number(testData.source.system.reloadTime.value) :
                Actordsa5.calcLZ(testData.source, testData.extra.actor)
            const progress = testData.source.system.reloadTime.progress
            if (progress < LZ) {
                mergeObject(buttons, {
                    reloadButton: {
                        label: `${game.i18n.localize("WEAPON.reload")} (${progress}/${LZ})`,
                        callback: async() => {
                            const actor = await DSA5_Utility.getSpeaker(testData.extra.speaker)
                            await actor.updateEmbeddedDocuments("Item", [
                                { _id: testData.source._id, "system.reloadTime.progress": progress + 1 },
                            ])
                            const infoMsg = game.i18n.format("WEAPON.isReloading", {
                                actor: actor.token?.name || actor.prototypeToken.name,
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