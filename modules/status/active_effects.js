import DSA5 from "../system/config-dsa5.js";
import DiceDSA5 from "../system/dice-dsa5.js";
import DSA5_Utility from "../system/utility-dsa5.js";

function automatedAnimation(successLevel, options = {}) {
    if (DSA5_Utility.moduleEnabled("autoanimations")) {
        console.warn("Animations for on use effects not enabled yet");
    }
}

async function callMacro(context, packName, name, actor, item, qs, args = {}) {
    let result = {};
    if (!game.user.can("MACRO_SCRIPT")) {
        ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
    } else {
        const pack = game.packs.get(packName);
        const documents = await pack.getDocuments({ name });

        if (documents.length) {
            const body = `(async () => {${documents[0].data.command}})()`;
            const fn = Function("actor", "item", "qs", "args", body);
            try {
                args.result = result;
                const context = mergeObject({ automatedAnimation }, this)
                await fn.call(context, actor, item, qs, args);
            } catch (err) {
                ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                console.error(err);
                result.error = true;
            }
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
        const onRemoveMacro = getProperty(effect, "data.flags.dsa5.onRemove");
        if (onRemoveMacro) {
            if (!game.user.can("MACRO_SCRIPT")) {
                ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
            } else {
                await eval(`(async () => {${onRemoveMacro}})()`);
            }
        }
    }

    async checkTimesUpInstalled() {
        //TODO checkTimesUpInstalled
        return false
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
                (["specialability"].includes(itemType) && getProperty(this.object, "parent.data.data.category.value") == "Combat"),
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
            effect: this.object.data,
            advancedFunctions,
            effectConfigs,
            config,
        });
        elem.find('.tab[data-tab="effects"]').after($(template));

        elem.find(".advancedSelector").change((ev) => {
            let effect = this.object.data;
            effect.flags.dsa5.advancedFunction = $(ev.currentTarget).val();

            renderTemplate("systems/dsa5/templates/status/advanced_functions.html", { effect, config }).then((template) => {
                elem.find(".advancedFunctions").html(template);
            });
        });
    }

    async _onSubmit(event, { updateData = null, preventClose = false, preventRender = false } = {}) {
        const inActor =
            getProperty(this.object, "data.document.parent.documentName") != "Actor" &&
            getProperty(this.object, "data.document.parent.parent");
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
                        mod: `${Roll.safeEval(mod.replace(/q(l|s)/i, qs))}`.replace("step", specStep) || 0,
                        effect: ef,
                        target: actor,
                        token: actor.token ? actor.token.data._id : undefined
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
                                    let value = `${getProperty(ef, "flags.dsa5.args1")}`;
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
            actor.setupSkill(skill.data, { modifier: data.mod }, data.token).then(async(setupData) => {
                setupData.testData.opposable = false;
                const res = await actor.basicTest(setupData);
                const availableQs = res.result.qualityStep || 0;
                //this.automatedAnimation(res.result.successLevel);
                if (availableQs <= 0) {
                    await this.applyEffect(data.message, data.mode, [target], { effectIds: [data.effect], skipResistRolls: true })
                }
            });
        } else {
            console.warn("Actor not found for resist roll.")
        }
    }

    static async applyEffect(id, mode, targets, options = {}) {
        const message = game.messages.get(id);
        const source = message.data.flags.data.preData.source;
        const testData = message.data.flags.data.postData;
        const speaker = message.data.speaker;

        if (["poison", "disease"].includes(source.type)) {
            testData.qualityStep = testData.successLevel > 0 ? 2 : 1;
        }

        let attacker = DSA5_Utility.getSpeaker(speaker);

        if (!attacker) attacker = game.actors.get(getProperty(message.data.flags, "data.preData.extra.actor.id"));
        let sourceActor = attacker;
        let effects = await this._parseEffectDuration(source, testData, message.data.flags.data.preData, attacker);
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
                    const appliedEffect = game.i18n.format("ActiveEffects.appliedEffect", { target: actor.name, source: effectNames.join(", ") });
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
                        return { token: x.token ? x.token.data._id : undefined, actor: x.data._id, scene: canvas.scene.id };
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

        let duration = getProperty(source, "data.duration.value") || "";
        duration = duration.replace(" x ", " * ").replace(game.i18n.localize("CHARAbbrev.QS"), testData.qualityStep);
        try {
            const regexes = [
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.combatRounds"), "gi"), seconds: 5 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.minutes"), "gi"), seconds: 60 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.hours"), "gi"), seconds: 3600 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.days"), "gi"), seconds: 3600 * 24 },
            ];
            for (const reg of regexes) {
                if (reg.regEx.test(duration)) {
                    const dur = duration.replace(reg.regEx, "").trim()
                    const time = DiceDSA5._stringToRoll(dur);
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
        const FP = game.i18n.localize("MODS.FP");
        const stepValue = game.i18n.localize("stepValue");
        const QS = game.i18n.localize("MODS.QS");
        const partChecks = game.i18n.localize("MODS.partChecks");
        const demo = `${game.i18n.localize("LocalizedIDs.perception")} 1`;
        const democs = `${game.i18n.localize("LocalizedIDs.wrestle")} 1`;
        const closeCombat = game.i18n.localize("closeCombatAttacks");
        const rangeCombat = game.i18n.localize("rangeCombatAttacks");
        const combatReg = `${game.i18n.localize("regenerate")} (${game.i18n.localize("CHARAbbrev.CR")})`;
        const AsPCost = game.i18n.localize("AsPCost");
        const KaPCost = game.i18n.localize("KaPCost");
        const regenerate = game.i18n.localize("regenerate")
        const feature = `${game.i18n.localize("Healing")} 1`
        const descriptor = `${game.i18n.localize("Description")} 1`
        const miracle = `${game.i18n.localize('LocalizedIDs.miracle')}`

        let optns = [
            { name: game.i18n.localize("protection"), val: "data.totalArmor", mode: 2, ph: "1" },
            { name: game.i18n.localize("liturgyArmor"), val: "data.liturgyArmor", mode: 2, ph: "1" },
            {
                name: `${game.i18n.localize("resistanceModifier")} (${game.i18n.localize("condition")})`,
                val: "data.resistances.effects",
                mode: 0,
                ph: "inpain 1",
            },
            { name: game.i18n.localize("spellArmor"), val: "data.spellArmor", mode: 2, ph: "1" },
            { name: game.i18n.localize("carrycapacity"), val: "data.carryModifier", mode: 2, ph: "1" },
            {
                name: `${closeCombat} - ${game.i18n.localize("CHARAbbrev.AT")}`,
                val: "data.meleeStats.attack",
                mode: 2,
                ph: "1",
            },
            {
                name: `${closeCombat} - ${game.i18n.localize("CHARAbbrev.PA")}`,
                val: "data.meleeStats.parry",
                mode: 2,
                ph: "1",
            },
            {
                name: `${miracle} - ${game.i18n.localize("CHARAbbrev.AT")}`,
                val: "data.miracle.attack",
                mode: 2,
                ph: "1",
            },
            {
                name: `${miracle} - ${game.i18n.localize("CHARAbbrev.PA")}`,
                val: "data.miracle.parry",
                mode: 2,
                ph: "1",
            },
            {
                name: `${closeCombat} - ${game.i18n.localize("CHARAbbrev.damage")}`,
                val: "data.meleeStats.damage",
                mode: 2,
                ph: "1d6",
            },
            {
                name: `${closeCombat} - ${game.i18n.localize("MODS.defenseMalus")}`,
                val: "data.meleeStats.defenseMalus",
                mode: 2,
                ph: "1",
            },
            {
                name: game.i18n.localize("MODS.creatureBonus"),
                val: "data.creatureBonus",
                mode: 0,
                ph: `${game.i18n.localize("CONJURATION.elemental")} 1`,
            },
            {
                name: `${rangeCombat} - ${game.i18n.localize("CHARAbbrev.AT")}`,
                val: "data.rangeStats.attack",
                mode: 2,
                ph: "1",
            },
            {
                name: `${rangeCombat} - ${game.i18n.localize("CHARAbbrev.damage")}`,
                val: "data.rangeStats.damage",
                mode: 2,
                ph: "1d6",
            },
            {
                name: `${rangeCombat} - ${game.i18n.localize("MODS.defenseMalus")}`,
                val: "data.rangeStats.defenseMalus",
                mode: 2,
                ph: "1",
            },
            {
                name: `${game.i18n.localize("spell")} - ${game.i18n.localize("CHARAbbrev.damage")}`,
                val: "data.spellStats.damage",
                mode: 2,
                ph: "1",
            },
            {
                name: `${game.i18n.localize("liturgy")} - ${game.i18n.localize("CHARAbbrev.damage")}`,
                val: "data.liturgyStats.damage",
                mode: 2,
                ph: "1",
            },
            { name: KaPCost, val: "data.kapModifier", mode: 2, ph: "1" },
            { name: AsPCost, val: "data.aspModifier", mode: 2, ph: "1" },
            { name: `${skill} - ${FW}`, val: "data.skillModifiers.FW", mode: 0, ph: demo },
            { name: `${skill} - ${FP}`, val: "data.skillModifiers.FP", mode: 0, ph: demo },
            { name: `${skill} - ${stepValue}`, val: "data.skillModifiers.step", mode: 0, ph: demo },
            { name: `${skill} - ${QS}`, val: "data.skillModifiers.QL", mode: 0, ph: demo },
            { name: `${skill} - ${partChecks}`, val: "data.skillModifiers.TPM", mode: 0, ph: demo },
            {
                name: `${game.i18n.localize("vulnerability")} - ${game.i18n.localize("combatskill")}`,
                val: "data.vulnerabilities.combatskill",
                mode: 0,
                ph: democs,
            },

            { name: `${skill} - ${game.i18n.localize("MODS.global")}`, val: "data.skillModifiers.global", mode: 0, ph: "1" },
            {
                name: `${combatReg} - ${game.i18n.localize("wounds")}`,
                val: "data.repeatingEffects.startOfRound.wounds",
                mode: 0,
                ph: "1d6",
            },
            {
                name: `${combatReg} - ${game.i18n.localize("astralenergy")}`,
                val: "data.repeatingEffects.startOfRound.astralenergy",
                mode: 0,
                ph: "1d6",
            },
            {
                name: `${combatReg} - ${game.i18n.localize("karmaenergy")}`,
                val: "data.repeatingEffects.startOfRound.karmaenergy",
                mode: 0,
                ph: "1d6",
            },
            {
                name: `${regenerate} - ${game.i18n.localize("wounds")}`,
                val: "data.status.regeneration.LePgearmodifier",
                mode: 2,
                ph: "1",
            },
            {
                name: `${regenerate} - ${game.i18n.localize("astralenergy")}`,
                val: "data.status.regeneration.AsPgearmodifier",
                mode: 2,
                ph: "1",
            },
            {
                name: `${regenerate} - ${game.i18n.localize("karmaenergy")}`,
                val: "data.status.regeneration.KaPgearmodifier",
                mode: 2,
                ph: "1",
            },
            {
                name: `${game.i18n.localize("feature")} - ${AsPCost}`,
                val: `data.skillModifiers.feature.AsPCost`,
                mode: 0,
                ph: feature,
            },
            {
                name: `${game.i18n.localize("advanced")} - ${AsPCost}`,
                val: `data.skillModifiers.conditional.AsPCost`,
                mode: 0,
                ph: descriptor,
            },
            {
                name: `${game.i18n.localize("feature")} - ${KaPCost}`,
                val: `data.skillModifiers.feature.KaPCost`,
                mode: 0,
                ph: feature,
            },
            {
                name: `${game.i18n.localize("advanced")} - ${KaPCost}`,
                val: `data.skillModifiers.conditional.KaPCost`,
                mode: 0,
                ph: descriptor,
            },
        ];
        const models = ["liturgy", "ceremony", "spell", "ritual", "skill", "feature"];
        for (const k of models) {
            let key = k == "skill" ? "skillglobal" : k;
            const el = game.i18n.localize(key);
            optns.push({ name: `${el} - ${FW}`, val: `data.skillModifiers.${k}.FW`, mode: 0, ph: demo }, { name: `${el} - ${FP}`, val: `data.skillModifiers.${k}.FP`, mode: 0, ph: demo }, { name: `${el} - ${stepValue}`, val: `data.skillModifiers.${k}.step`, mode: 0, ph: demo }, { name: `${el} - ${QS}`, val: `data.skillModifiers.${k}.QL`, mode: 0, ph: demo }, { name: `${el} - ${partChecks}`, val: `data.skillModifiers.${k}.TPM`, mode: 0, ph: demo });
        }

        const attrs = ["mu", "kl", "in", "ch", "ff", "ge", "ko", "kk"];
        for (const k of attrs)
            optns.push({
                name: game.i18n.localize(`CHAR.${k.toUpperCase()}`),
                val: `data.characteristics.${k}.gearmodifier`,
                mode: 2,
                ph: "1",
            });

        for (const k of DSA5.gearModifyableCalculatedAttributes)
            optns.push({ name: game.i18n.localize(k), val: `data.status.${k}.gearmodifier`, mode: 2, ph: "1" });

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