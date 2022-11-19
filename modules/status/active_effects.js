import DSA5 from "../system/config-dsa5.js";
import DiceDSA5 from "../system/dice-dsa5.js";
import DSA5_Utility from "../system/utility-dsa5.js";

function automatedAnimation(successLevel, options = {}) {
    if (DSA5_Utility.moduleEnabled("autoanimations")) {
        console.warn("Animations for on use effects not enabled yet");
    }
}

async function callMacro(packName, name, actor, item, qs, args = {}) {
    let result = {};
    if (!game.user.can("MACRO_SCRIPT")) {
        ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
    } else {
        const pack = game.packs.get(packName);
        let documents = await pack.getDocuments({ name });
        if (!documents.length) {
            for (let pack of game.packs.filter(x => x.documentName == "Macro" && /\(internal\)/.test(x.metadata.label))) {
                documents = await pack.getDocuments({ name });
                if (documents.length) break
            }
        }

        if (documents.length) {
            const body = `(async () => {${documents[0].command}})()`;
            const fn = Function("actor", "item", "qs", "automatedAnimation", "args", body);
            try {
                args.result = result;
                const context = mergeObject({ automatedAnimation }, this)
                await fn.call(context, actor, item, qs, automatedAnimation, args);
            } catch (err) {
                ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                console.error(err);
                result.error = true;
            }
        } else {
            ui.notifications.error(
                game.i18n.format("DSAError.macroNotFound", { name })
            );
        }
    }
    return result;
};

export default class DSAActiveEffectConfig extends ActiveEffectConfig {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            resizable: true,
        });
    }

    static async onEffectRemove(actor, effect) {
        const onRemoveMacro = getProperty(effect, "flags.dsa5.onRemove");
        if (onRemoveMacro) {
            if (!game.user.can("MACRO_SCRIPT")) {
                ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
            } else {
                await eval(`(async () => {${onRemoveMacro}})()`);
            }
        }
    }

    async checkTimesUpInstalled() {
        const isInstalled = DSA5_Utility.moduleEnabled("times-up")
        if (!isInstalled && game.user.isGM) ui.notifications.warn(game.i18n.localize('DSAError.shouldTimesUp'))
        return isInstalled
    }

    async _render(force = false, options = {}) {
        await super._render(force, options);
        let index = -1;
        const advancedFunctions = ["none", "systemEffect", "macro", "creature"].map((x) => {
            return { name: `ActiveEffects.advancedFunctions.${x}`, index: (index += 1) };
        });
        const itemType = getProperty(this.object, "parent.type");
        const effectConfigs = {
            hasSpellEffects: [
                    "spell",
                    "liturgy",
                    "ritual",
                    "ceremony",
                    "consumable",
                    "poison",
                    "disease",
                    "ammunition",
                    "meleeweapon",
                    "rangeweapon",
                ].includes(itemType) ||
                (["specialability"].includes(itemType) && getProperty(this.object, "parent.system.category.value") == "Combat") ||
                (itemType == "trait" && ["meleeAttack", "rangeAttack"].includes(getProperty(this.object, "parent.system.traitType.value")))
                ,
            hasDamageTransformation: ["ammunition"].includes(itemType),
        };
        if (effectConfigs.hasDamageTransformation) {
            advancedFunctions.push({ name: "ActiveEffects.advancedFunctions.armorPostprocess", index: 4 }, { name: "ActiveEffects.advancedFunctions.damagePostprocess", index: 5 });
        }
        const config = {
            systemEffects: this.getStatusEffects(),
            canEditMacros: game.user.isGM || (await game.settings.get("dsa5", "playerCanEditSpellMacro")),
        };
        let elem = $(this._element);
        elem
            .find(".tabs")
            .append(`<a class="item" data-tab="advanced"><i class="fas fa-shield-alt"></i>${game.i18n.localize("advanced")}</a>`);
        let template = await renderTemplate("systems/dsa5/templates/status/advanced_effect.html", {
            effect: this.object,
            advancedFunctions,
            effectConfigs,
            config,
        });
        elem.find('.tab[data-tab="effects"]').after($(template));

        elem.find(".advancedSelector").change((ev) => {
            let effect = this.object;
            effect.flags.dsa5.advancedFunction = $(ev.currentTarget).val();

            renderTemplate("systems/dsa5/templates/status/advanced_functions.html", { effect, config }).then((template) => {
                elem.find(".advancedFunctions").html(template);
            });
        });

        this.checkTimesUpInstalled()
    }

    async _onSubmit(event, { updateData = null, preventClose = false, preventRender = false } = {}) {
        const inActor =
            getProperty(this.object, "system.document.parent.documentName") != "Actor" &&
            getProperty(this.object, "system.document.parent.parent");
        if (inActor) ui.notifications.error(game.i18n.localize("DSAError.nestedEffectNotSupported"));
        return await super._onSubmit(event, { updateData, preventClose, preventRender });
    }

    getStatusEffects() {
        return duplicate(CONFIG.statusEffects).map((x) => {
            return { id: x.id, label: game.i18n.localize(x.label) };
        }).sort((a, b) => a.label.localeCompare(b.label))
    }

    getData(options) {
        const data = super.getData(options);
        return data;
    }

    static applyRollTransformation(actor, options, functionID) {
        let msg = "";
        let source = options.origin;
        for (const ef of source.effects) {
            try {
                if (Number(getProperty(ef, "flags.dsa5.advancedFunction")) == functionID) {
                    eval(getProperty(ef, "flags.dsa5.args3"));
                }
            } catch (exception) {
                console.warn("Unable to apply advanced effect", exception, ef);
            }
        }
        options.origin = source;
        return { msg, options };
    }

    static async applyAdvancedFunction(actor, effects, source, testData, sourceActor, skipResistRolls = true) {
        let msg = "";
        const resistRolls = [];
        let effectApplied = false;
        const effectsWithChanges = [];
        const effectNames = new Set()

        for (const ef of effects) {
            if (ef.origin) delete ef.origin

            const specStep = Number(getProperty(ef, "flags.dsa5.specStep")) || 0
            try {
                const customEf = Number(getProperty(ef, "flags.dsa5.advancedFunction"));
                const qs = Math.min(testData.qualityStep || 0, 6);
                const resistRoll = getProperty(ef, "flags.dsa5.resistRoll");

                if (resistRoll && !skipResistRolls) {
                    const skills = resistRoll.split(" ");
                    const mod = `${skills.pop()}`;
                    resistRolls.push({
                        skill: skills.join(" "),
                        mod: Math.round(Roll.safeEval(`${mod}`.replace(/q(l|s)/i, qs).replace("step", specStep))) || 0,
                        effect: ef,
                        target: actor,
                        token: actor.token ? actor.token.id : undefined
                    });
                } else {
                    effectApplied = true;
                    if (!effectNames.has(ef.label)) effectNames.add(ef.label)
                    if (ef.changes && ef.changes.length > 0) {
                        effectsWithChanges.push(ef);
                    }
                    if (customEf) {
                        switch (customEf) {
                            case 1: //Systemeffekt
                                {
                                    const effect = duplicate(CONFIG.statusEffects.find((e) => e.id == getProperty(ef, "flags.dsa5.args0")));
                                    let value = `${getProperty(ef, "flags.dsa5.args1")}` || "1";
                                    effect.duration = ef.duration;
                                    if (/,/.test(value)) {
                                        value = Number(value.split(",")[qs - 1]);
                                    } else {
                                        value = Number(value.replace(game.i18n.localize("CHARAbbrev.QS"), qs));
                                    }
                                    await actor.addCondition(effect, value, false, false);
                                }
                                break;
                            case 2: //Macro
                                if (!game.user.can("MACRO_SCRIPT")) {
                                    ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
                                } else {
                                    await eval(`(async () => {${getProperty(ef, "flags.dsa5.args3")}})()`);
                                }
                                break;
                            case 3: // Creature Link
                                let creatures = (getProperty(ef, "flags.dsa5.args4") || "")
                                    .split(",")
                                    .map((x) => `@Compendium[${x.trim().replace(/(@Compendium\[|\])/)}]`)
                                    .join(" ");
                                msg += `<p><b>${game.i18n.localize("ActiveEffects.advancedFunctions.creature")}</b>:</p><p>${creatures}</p>`;
                                break;
                        }
                    }
                }
            } catch (exception) {
                console.warn("Unable to apply advanced effect");
                console.warn(exception);
                console.warn(ef);
            }
        }
        await actor.createEmbeddedDocuments(
            "ActiveEffect",
            effectsWithChanges.map((x) => {
                x.origin = actor.uuid;
                return x;
            })
        );
        return { msg, resistRolls, effectApplied, effectNames: Array.from(effectNames) };
    }

    static async resistEffect(ev) {
        const data = ev.currentTarget.dataset;
        const target = { token: data.token, actor: data.actor, scene: canvas.id }
        const actor = DSA5_Utility.getSpeaker(target)
        if (actor) {
            const skill = actor.items.find((x) => x.type == "skill" && x.name == data.skill);
            actor.setupSkill(skill, { modifier: data.mod }, data.token).then(async(setupData) => {
                setupData.testData.opposable = false;
                const res = await actor.basicTest(setupData);
                const availableQs = res.result.qualityStep || 0;
                //this.automatedAnimation(res.result.successLevel);

                if (availableQs < 1) {
                    await this.applyEffect(data.message, data.mode, [target], { effectIds: [data.effect], skipResistRolls: true })
                }
            });
        } else {
            console.warn("Actor not found for resist roll.")
        }
    }

    static async applyEffect(id, mode, targets, options = {}) {
        const message = game.messages.get(id);
        const source = message.flags.data.preData.source;
        const testData = message.flags.data.postData;
        const speaker = message.speaker;

        if (["poison", "disease"].includes(source.type)) {
            testData.qualityStep = testData.successLevel > 0 ? 2 : 1;
        }

        const attacker = DSA5_Utility.getSpeaker(speaker) || 
            DSA5_Utility.getSpeaker(getProperty(message.flags, "data.preData.extra.speaker")) || 
            game.actors.get(getProperty(message.flags, "data.preData.extra.actor.id"))

        let sourceActor = attacker;
        let effects = await this._parseEffectDuration(source, testData, message.flags.data.preData, attacker);
        if (options.effectIds) effects = effects.filter(x => options.effectIds.includes(x._id))
        let actors = [];
        if (mode == "self") {
            if (attacker) actors.push(attacker);
        } else {
            if (targets) actors = targets.map((x) => DSA5_Utility.getSpeaker(x));
            else if (game.user.targets.size) {
                game.user.targets.forEach((target) => {
                    if (target.actor) actors.push(target.actor);
                });
            }
        }
        if (game.user.isGM) {
            for (let actor of actors) {
                const { msg, resistRolls, effectApplied, effectNames } = await DSAActiveEffectConfig.applyAdvancedFunction(
                    actor,
                    effects,
                    source,
                    testData,
                    sourceActor,
                    options.skipResistRolls || false
                );
                if (effectApplied) {
                    const appliedEffect = game.i18n.format("ActiveEffects.appliedEffect", { target: actor.token?.name || actor.name, source: effectNames.join(", ") });
                    const infoMsg = `${appliedEffect}${msg || ""}`;
                    await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
                }
                if (resistRolls.length) {
                    await this.createResistRollMessage(resistRolls, id, mode);
                }
            }
        } else {
            game.socket.emit("system.dsa5", {
                type: "addEffect",
                payload: {
                    mode,
                    id,
                    actors: actors.map((x) => {
                        return { token: x.token ? x.token.id : undefined, actor: x.id, scene: canvas.scene.id };
                    }),
                },
            });
        }
    }

    static async createResistRollMessage(resistRolls, id, mode) {
        for (const resist of resistRolls) {
            const template = await renderTemplate("systems/dsa5/templates/chat/roll/resist-roll.html", {
                resist,
                id,
                mode
            });
            await ChatMessage.create(DSA5_Utility.chatDataSetup(template));
        }
    }

    static async _parseEffectDuration(source, testData, preData, attacker) {
        const specAbIds = {}
        for (let spec of preData.situationalModifiers.filter((x) => x.specAbId)) {
            specAbIds[spec.specAbId] = spec.step
        }
        const specKeys = Object.keys(specAbIds)
        const specAbs = attacker ? attacker.items.filter((x) => specKeys.includes(x.id)) : [];
        let effects = source.effects ? duplicate(source.effects) : [];
        for (const spec of specAbs) {
            const specEffects = duplicate(spec).effects
            for (let specEf of specEffects) {
                setProperty(specEf, "flags.dsa5.specStep", specAbIds[spec.id])
            }
            effects.push(...specEffects);
        }

        let duration = getProperty(source, "system.duration.value") || "";
        duration = duration.replace(" x ", " * ").replace(game.i18n.localize("CHARAbbrev.QS"), testData.qualityStep);
        try {
            const regexes = [
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.combatRounds"), "gi"), seconds: 5 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.minutes"), "gi"), seconds: 60 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.hours"), "gi"), seconds: 3600 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.days"), "gi"), seconds: 3600 * 24 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEXmaintain.weeks"), "gi"), seconds: 3600 * 24 * 7 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEXmaintain.months"), "gi"), seconds: 3600 * 24 * 30 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEXmaintain.years"), "gi"), seconds: 3600 * 24 * 350 }
            ];
            for (const reg of regexes) {
                if (reg.regEx.test(duration)) {
                    const dur = duration.replace(reg.regEx, "").trim()
                    const time = await DiceDSA5._stringToRoll(dur);
                    if (!isNaN(time)) {
                        for (let ef of effects) {
                            let calcTime = time * reg.seconds;
                            const customDuration = getProperty(ef, "flags.dsa5.customDuration");
                            if (customDuration) {
                                let qsDuration = customDuration.split(",")[testData.qualityStep - 1];
                                if (qsDuration && qsDuration != "-") calcTime = Number(qsDuration);
                            }
                            ef.duration.seconds = calcTime;
                            ef.duration.rounds = ef.duration.seconds / 5;
                        }
                    }
                    break;
                }
            }
        } catch (e) {
            console.error(`Could not parse duration '${duration}' of '${source.name}'`);
        }
        return effects;
    }

    dropDownMenu() {
        const FW = game.i18n.localize("MODS.FW");
        const skill = game.i18n.localize("skill");
        const regenerate = game.i18n.localize("regenerate")
        const FP = game.i18n.localize("MODS.FP");
        const stepValue = game.i18n.localize("stepValue");
        const QS = game.i18n.localize("MODS.QS");
        const partChecks = game.i18n.localize("MODS.partChecks");
        const demo = `${game.i18n.localize("LocalizedIDs.perception")} 1`;
        const democs = `${game.i18n.localize("LocalizedIDs.wrestle")} 1`;
        const closeCombat = game.i18n.localize("closeCombatAttacks");
        const rangeCombat = game.i18n.localize("rangeCombatAttacks");
        const combatReg = `${regenerate} (${game.i18n.localize("CHARAbbrev.CR")})`;
        const AsPCost = game.i18n.localize("AsPCost");
        const KaPCost = game.i18n.localize("KaPCost");
        const feature = `${game.i18n.localize("Healing")} 1`
        const descriptor = `${game.i18n.localize("Description")} 1`
        const miracle = `${game.i18n.localize('LocalizedIDs.miracle')}`

        let optns = [
            { name: game.i18n.localize("protection"), val: "system.totalArmor", mode: 2, ph: "1" },
            { name: game.i18n.localize("liturgyArmor"), val: "system.liturgyArmor", mode: 2, ph: "1" },
            {
                name: `${game.i18n.localize("resistanceModifier")} (${game.i18n.localize("condition")})`,
                val: "system.resistances.effects",
                mode: 0,
                ph: "inpain 1",
            },
            { name: game.i18n.localize("spellArmor"), val: "system.spellArmor", mode: 2, ph: "1" },
            { name: game.i18n.localize("carrycapacity"), val: "system.carryModifier", mode: 2, ph: "1" },
            {
                name: `${closeCombat} - ${game.i18n.localize("CHARAbbrev.AT")}`,
                val: "system.meleeStats.attack",
                mode: 2,
                ph: "1",
            },
            {
                name: `${closeCombat} - ${game.i18n.localize("CHARAbbrev.PA")}`,
                val: "system.meleeStats.parry",
                mode: 2,
                ph: "1",
            },
            {
                name: `${miracle} - ${game.i18n.localize("CHARAbbrev.AT")}`,
                val: "system.miracle.attack",
                mode: 2,
                ph: "1",
            },
            {
                name: `${miracle} - ${game.i18n.localize("CHARAbbrev.PA")}`,
                val: "system.miracle.parry",
                mode: 2,
                ph: "1",
            },
            {
                name: `${closeCombat} - ${game.i18n.localize("CHARAbbrev.damage")}`,
                val: "system.meleeStats.damage",
                mode: 2,
                ph: "1d6",
            },
            {
                name: `${closeCombat} - ${game.i18n.localize("MODS.defenseMalus")}`,
                val: "system.meleeStats.defenseMalus",
                mode: 2,
                ph: "1",
            },
            {
                name: game.i18n.localize("MODS.creatureBonus"),
                val: "system.creatureBonus",
                mode: 0,
                ph: `${game.i18n.localize("CONJURATION.elemental")} 1`,
            },
            {
                name: `${rangeCombat} - ${game.i18n.localize("CHARAbbrev.AT")}`,
                val: "system.rangeStats.attack",
                mode: 2,
                ph: "1",
            },
            {
                name: `${rangeCombat} - ${game.i18n.localize("CHARAbbrev.damage")}`,
                val: "system.rangeStats.damage",
                mode: 2,
                ph: "1d6",
            },
            {
                name: `${rangeCombat} - ${game.i18n.localize("MODS.defenseMalus")}`,
                val: "system.rangeStats.defenseMalus",
                mode: 2,
                ph: "1",
            },
            {
                name: `${game.i18n.localize("spell")} - ${game.i18n.localize("CHARAbbrev.damage")}`,
                val: "system.spellStats.damage",
                mode: 2,
                ph: "1",
            },
            {
                name: `${game.i18n.localize("liturgy")} - ${game.i18n.localize("CHARAbbrev.damage")}`,
                val: "system.liturgyStats.damage",
                mode: 2,
                ph: "1",
            },
            { name: KaPCost, val: "system.kapModifier", mode: 2, ph: "1" },
            { name: AsPCost, val: "system.aspModifier", mode: 2, ph: "1" },
            { name: `${skill} - ${FW}`, val: "system.skillModifiers.FW", mode: 0, ph: demo },
            { name: `${skill} - ${FP}`, val: "system.skillModifiers.FP", mode: 0, ph: demo },
            { name: `${skill} - ${stepValue}`, val: "system.skillModifiers.step", mode: 0, ph: demo },
            { name: `${skill} - ${QS}`, val: "system.skillModifiers.QL", mode: 0, ph: demo },
            { name: `${skill} - ${partChecks}`, val: "system.skillModifiers.TPM", mode: 0, ph: demo },
            {
                name: `${game.i18n.localize("vulnerability")} - ${game.i18n.localize("combatskill")}`,
                val: "system.vulnerabilities.combatskill",
                mode: 0,
                ph: democs,
            },

            { name: `${skill} - ${game.i18n.localize("MODS.global")}`, val: "system.skillModifiers.global", mode: 0, ph: "1" },
            {
                name: `${combatReg} - ${game.i18n.localize("wounds")}`,
                val: "system.repeatingEffects.startOfRound.wounds",
                mode: 0,
                ph: "1d6",
            },
            {
                name: `${combatReg} - ${game.i18n.localize("astralenergy")}`,
                val: "system.repeatingEffects.startOfRound.astralenergy",
                mode: 0,
                ph: "1d6",
            },
            {
                name: `${combatReg} - ${game.i18n.localize("karmaenergy")}`,
                val: "system.repeatingEffects.startOfRound.karmaenergy",
                mode: 0,
                ph: "1d6",
            },
            {
                name: `${regenerate} - ${game.i18n.localize("wounds")}`,
                val: "system.status.regeneration.LePgearmodifier",
                mode: 2,
                ph: "1",
            },
            {
                name: `${regenerate} - ${game.i18n.localize("astralenergy")}`,
                val: "system.status.regeneration.AsPgearmodifier",
                mode: 2,
                ph: "1",
            },
            {
                name: `${regenerate} - ${game.i18n.localize("karmaenergy")}`,
                val: "system.status.regeneration.KaPgearmodifier",
                mode: 2,
                ph: "1",
            },
            {
                name: `${game.i18n.localize("feature")} - ${AsPCost}`,
                val: `system.skillModifiers.feature.AsPCost`,
                mode: 0,
                ph: feature,
            },
            {
                name: `${game.i18n.localize("advanced")} - ${AsPCost}`,
                val: `system.skillModifiers.conditional.AsPCost`,
                mode: 0,
                ph: descriptor,
            },
            {
                name: `${game.i18n.localize("feature")} - ${KaPCost}`,
                val: `system.skillModifiers.feature.KaPCost`,
                mode: 0,
                ph: feature,
            },
            {
                name: `${game.i18n.localize("advanced")} - ${KaPCost}`,
                val: `system.skillModifiers.conditional.KaPCost`,
                mode: 0,
                ph: descriptor,
            },
        ];
        const models = ["liturgy", "ceremony", "spell", "ritual", "skill", "feature"];
        for (const k of models) {
            let key = k == "skill" ? "skillglobal" : k;
            const el = game.i18n.localize(key);
            optns.push({ name: `${el} - ${FW}`, val: `system.skillModifiers.${k}.FW`, mode: 0, ph: demo }, { name: `${el} - ${FP}`, val: `system.skillModifiers.${k}.FP`, mode: 0, ph: demo }, { name: `${el} - ${stepValue}`, val: `system.skillModifiers.${k}.step`, mode: 0, ph: demo }, { name: `${el} - ${QS}`, val: `system.skillModifiers.${k}.QL`, mode: 0, ph: demo }, { name: `${el} - ${partChecks}`, val: `system.skillModifiers.${k}.TPM`, mode: 0, ph: demo });
        }

        for (const k of Object.keys(DSA5.characteristics))
            optns.push({
                name: game.i18n.localize(`CHAR.${k.toUpperCase()}`),
                val: `system.characteristics.${k}.gearmodifier`,
                mode: 2,
                ph: "1",
            });

        for (const k of DSA5.gearModifyableCalculatedAttributes)
            optns.push({ name: game.i18n.localize(k), val: `system.status.${k}.gearmodifier`, mode: 2, ph: "1" });

        optns = optns.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        for (let optn of optns) {
            if (!optn.ph || optn.mode == undefined) console.warn(optn);
        }

        optns = optns
            .map((x) => {
                return `<option value="${x.val}" data-mode="${x.mode}" data-ph="${x.ph}">${x.name}</option>`;
            })
            .join("\n");
        return `<select class="selMenu">${optns}</select>`;
    }

    activateListeners(html) {
        super.activateListeners(html);
        const dropDown = this.dropDownMenu();
        html.find(".changes-list .effect-change .key").append(dropDown);
        html.find(".selMenu").change((ev) => {
            const elem = $(ev.currentTarget);
            elem.siblings("input").val(elem.val());
            const parent = elem.closest(".effect-change");
            const data = elem.find("option:selected");
            parent.find(".mode select").val(data.attr("data-mode"));
            parent.find(".value input").attr("placeholder", data.attr("data-ph"));
            elem.blur();
        });
    }
}