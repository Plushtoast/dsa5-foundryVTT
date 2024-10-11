import DSA5CombatDialog from "../dialog/dialog-combat-dsa5.js";
import DSA5SpellDialog from "../dialog/dialog-spell-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import DiceDSA5 from "../system/dice-dsa5.js";
import OnUseEffect from "../system/onUseEffects.js";
import DSATriggers from "../system/triggers.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import { delay } from "../system/view_helper.js";
const { mergeObject, getProperty, duplicate, setProperty } = foundry.utils

function automatedAnimation(successLevel, options = {}) {
    if (DSA5_Utility.moduleEnabled("autoanimations")) {
        console.warn("Animations for on use effects not enabled yet");
    }
}

function effectDummy(name, changes, duration) {
    return OnUseEffect.effectBaseDummy(name, changes, duration);
}

async function callMacro(packName, name, actor, item, qs, args = {}) {
    let result = {};
    if (!game.user.can("MACRO_SCRIPT")) {
        ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
    } else {
        const pack = game.packs.get(packName);
        let documents = await pack?.getDocuments({ name });
        if (!documents || !documents.length) {
            for (let pack of game.packs.filter(x => x.documentName == "Macro" && /\(internal\)/.test(x.metadata.label))) {
                documents = await pack.getDocuments({ name });
                if (documents.length) break
            }
        }

        if (documents.length) {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
            const fn = new AsyncFunction("actor", "item", "qs", "automatedAnimation", "args", documents[0].command)
            try {
                args.result = result;
                const context = mergeObject({ automatedAnimation, effectDummy }, this)
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

Hooks.once("i18nInit", () => {
    DSAActiveEffectConfig.effectDurationRegexes = [
        { regEx: new RegExp(game.i18n.localize("DSAREGEX.combatRounds"), "i"), seconds: 5 },
        { regEx: new RegExp(game.i18n.localize("DSAREGEX.minutes"), "i"), seconds: 60 },
        { regEx: new RegExp(game.i18n.localize("DSAREGEX.hours"), "i"), seconds: 3600 },
        { regEx: new RegExp(game.i18n.localize("DSAREGEX.days"), "i"), seconds: 3600 * 24 },
        { regEx: new RegExp(game.i18n.localize("DSAREGEX.weeks"), "i"), seconds: 3600 * 24 * 7 },
        { regEx: new RegExp(game.i18n.localize("DSAREGEX.months"), "i"), seconds: 3600 * 24 * 30 },
        { regEx: new RegExp(game.i18n.localize("DSAREGEX.years"), "i"), seconds: 3600 * 24 * 350 }
    ];
})

export default class DSAActiveEffectConfig extends ActiveEffectConfig {
    static AdvantageRuleItems = new Set(["armor", "meleeweapon", "rangeweapon"])

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            resizable: true,
        });
    }

    static async callMacro(packName, name, actor, item, qs, args = {}) {
        return await callMacro(packName, name, actor, item, qs, args)
    }

    static async startDelayedEffect(duration, effect) {        
        effect.update({ 
            "system.delayed": false,
            "duration": duration,
            "flags.dsa5.-=onDelayed": null
        })
    }

    static onDelayedEffect(actor, effect) {
        let continueDeletion = true
        if(effect.system.delayed) {
            const duration = effect.system?.originalDuration || { seconds: "", rounds: ""}
            mergeObject(duration, {
                startRound: game.combat?.round,
                startTurn: game.combat?.turn,
                startTime: game.time.worldTime        
            })
            if (!duration.rounds && duration.seconds) {
                duration.rounds = Number(duration.seconds) / 5
            }
            if(effect.changes.length || effect.statuses.size) {
                this.startDelayedEffect(duration, effect)
                continueDeletion = false
            }

            if(effect.system.macroEffect) {                
                const testData = effect.system.initialTestData
                const sourceActor = game.actors.get(effect.system.sourceActor)
                const source = effect.system.source
                
                const macroEffect = duplicate(effect.system.macroEffect)
                delete macroEffect.flags.dsa5?.onDelayed
                macroEffect.system.delayed = false
                macroEffect.duration = duration
                this.applyAdvancedFunction(actor, [macroEffect], source, testData, sourceActor)
            }
        }
        return continueDeletion
    }

    static async onEffectRemove(actor, effect) {
        const onRemoveMacro = getProperty(effect, "flags.dsa5.onRemove");
        if (onRemoveMacro) {
            if (!game.user.can("MACRO_SCRIPT")) {
                ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
            } else {
                try {
                    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
                    const fn = new AsyncFunction("effect", "actor", onRemoveMacro)
                    await fn.call(this, effect, actor);
                } catch (err) {
                    ui.notifications.error(
                        `There was an error in your macro syntax. See the console (F12) for details`
                    );
                    console.error(err);
                    console.warn(err.stack);
                }
            }
        }
    }

    async checkTimesUpInstalled() {
        const isInstalled = DSA5_Utility.moduleEnabled("times-up")
        if (!isInstalled && game.user.isGM) ui.notifications.warn('DSAError.shouldTimesUp', { localize: true })
        return isInstalled
    }

    async _render(force = false, options = {}) {
        await super._render(force, options);

        let index = 0;

        const itemType = getProperty(this.object, "parent.type");
        const isWeapon = ["meleeweapon", "rangeweapon"].includes(itemType) || (itemType == "trait" && ["meleeAttack", "rangeAttack"].includes(getProperty(this.object, "parent.system.traitType.value")))
        const effectConfigs = {
            hasSpellEffects: isWeapon || [
                    "spell",
                    "liturgy",
                    "ritual",
                    "skill",
                    "ceremony",
                    "consumable",
                    "poison",
                    "disease",
                    "ammunition"
                ].includes(itemType) ||
                (["specialability"].includes(itemType) && getProperty(this.object, "parent.system.category.value") == "Combat"),
            hasDamageTransformation: ["ammunition", "meleeweapon", "rangeweapon"].includes(itemType),
            hasTriggerEffects: ["specialability"].includes(itemType),
            hasSuccessEffects: ["poison", "disease"].includes(itemType)
        };

        let advancedFunctions = []

        if (effectConfigs.hasSpellEffects || effectConfigs.hasDamageTransformation || effectConfigs.hasTriggerEffects) {
            advancedFunctions.push({ name: `ActiveEffects.advancedFunctions.none`, index: 0 })
        }

        if(effectConfigs.hasSpellEffects){
            for(let x of ["systemEffect", "macro", "creature"]){
                advancedFunctions.push({ name: `ActiveEffects.advancedFunctions.${x}`, index: (index += 1) })
            }
        }

        if (effectConfigs.hasDamageTransformation) {
            advancedFunctions.push(
                { name: "ActiveEffects.advancedFunctions.armorPostprocess", index: DSATriggers.EVENTS.ARMOR_TRANSFORMATION }, 
                { name: "ActiveEffects.advancedFunctions.damagePostprocess", index: DSATriggers.EVENTS.DAMAGE_TRANSFORMATION }
            );
        }
        if (effectConfigs.hasTriggerEffects) {
            advancedFunctions.push(
                { name: "ActiveEffects.advancedFunctions.postRoll", index: DSATriggers.EVENTS.POST_ROLL },
                { name: "ActiveEffects.advancedFunctions.postOpposed", index: DSATriggers.EVENTS.POST_OPPOSED }
            );
        }
        const config = {
            systemEffects: this.getStatusEffects(),
            canEditMacros: game.user.isGM || game.settings.get("dsa5", "playerCanEditSpellMacro"),
        };

        const messageReceivers = ["players", "player", "playergm", "gm"].reduce((obj, e) => {
            obj[e] = game.i18n.localize(`ActiveEffects.messageReceivers.${e}`)
            return obj
        }, {})

        const applySuccessConditions = {
            1: 'ActiveEffects.onSuccess',
            2: 'ActiveEffects.onFailure'
        }

        const canWeaponAdvantages = DSAActiveEffectConfig.AdvantageRuleItems.has(itemType)
        const macroIndexes = [2, 6, 7]
        const elem = $(this._element);
        elem.find(".tabs").append(`<a class="item" data-tab="advanced"><i class="fas fa-shield-alt"></i>${game.i18n.localize("advanced")}</a>`);

        const template = await renderTemplate("systems/dsa5/templates/status/advanced_effect.html", {
            effect: this.object,
            advancedFunctions,
            effectConfigs,
            macroIndexes,
            messageReceivers,
            canWeaponAdvantages,
            equipmentAdvantageOptions: {
                1: game.i18n.localize(`AdvantageRuleItems.${itemType}.1`),
                2: game.i18n.localize(`AdvantageRuleItems.${itemType}.2`)
            },
            applySuccessConditions,
            config,
            isWeapon,
            dispositions: Object.entries(CONST.TOKEN_DISPOSITIONS).reduce((obj, e) => {
                obj[e[1]] = `TOKEN.DISPOSITION.${e[0]}`
                return obj;
            }, { 2:  game.i18n.localize("all")})
        });
        elem.find('.tab[data-tab="effects"]').after($(template));
        elem.find(".advancedSelector").on("change", ev => {
            let effect = this.object;
            effect.flags.dsa5.advancedFunction = $(ev.currentTarget).val();

            renderTemplate("systems/dsa5/templates/status/advanced_functions.html", { effect, config, macroIndexes }).then((template) => {
                elem.find(".advancedFunctions").html(template);
            });
        });
        elem.find(".auraSelector").on("change", ev => {
            elem.find('.auraDetails').toggleClass("dsahidden", !ev.currentTarget.checked)
            elem.find('.auraBox').toggleClass("groupbox", ev.currentTarget.checked)
        })
        if(this.object.statuses.size && game.i18n.has(this.object.description)) {
            elem.find('[data-tab="details"] .editor').replaceWith(`<p>${game.i18n.localize(this.object.description)}</p>`)
        }
        this.checkTimesUpInstalled()
    }

    getStatusEffects() {
        return CONFIG.statusEffects.map((x) => {
            return { id: x.id, name: game.i18n.localize(x.name) };
        }).sort((a, b) => a.name.localeCompare(b.name))
    }

    static applyRollTransformation(actor, options, functionID) {
        let msg = "";
        let source = options.origin;
        for (const ef of source.effects) {
            try {
                if (Number(getProperty(ef, "flags.dsa5.advancedFunction")) == functionID) {
                    if (!game.user.can("MACRO_SCRIPT")) {
                        ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
                    } else {
                        try {
                            const syncFunction = Object.getPrototypeOf(function(){}).constructor
                            const fn = new syncFunction("ef", "callMacro", "actor", "msg", "source", getProperty(ef, "flags.dsa5.args3"))
                            fn.call(this, ef, callMacro, actor, msg, source);
                        } catch (err) {
                            ui.notifications.error(
                                `There was an error in your macro syntax. See the console (F12) for details`
                            );
                            console.error(err);
                            console.warn(err.stack);
                        }
                    }
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
                const isAura = getProperty(ef, "flags.dsa5.isAura")
                
                if (isAura) {
                    const radius = `${getProperty(ef, "flags.dsa5.auraRadius") || 1}`.replace(/q(l|s)/i, qs);                    
                    const evaluatedRadius = (await new Roll(radius).evaluate()).total;
                    setProperty(ef, "flags.dsa5.auraRadius", evaluatedRadius)
                }

                if (resistRoll && !skipResistRolls) {
                    const skills = resistRoll.split(" ");
                    const mod = `${skills.pop()}`;
                    resistRolls.push({
                        skill: skills.join(" "),
                        mod: Math.round(Roll.safeEval(`${mod}`.replace(/q(l|s)/i, qs).replaceAll("step", specStep))) || 0,
                        effect: ef,
                        target: actor,
                        token: actor.token?.id
                    });
                } else {
                    effectApplied = true;
                    if (!effectNames.has(ef.name)) effectNames.add(ef.name)

                    const onDelayed = getProperty(ef, "flags.dsa5.onDelayed")
                    
                    const delayedData = { 
                        duration: { 
                            seconds: onDelayed
                        },
                        system: {
                            delayed: true,
                            originalDuration: ef.duration
                        }
                    }

                    let isEffectWithChange = (ef.changes && ef.changes.length > 0) || (isAura && !customEf)

                    if (customEf) {
                        switch (customEf) {
                            case 1: //Systemeffekt
                                {
                                    let value = `${getProperty(ef, "flags.dsa5.args1")}` || "1";
                                    if (/,/.test(value)) {
                                        value = Number(value.split(",")[qs - 1]);
                                    } else {
                                        value = Number(value.replace(game.i18n.localize("CHARAbbrev.QS"), qs));
                                    }
                                    const effectId =  getProperty(ef, "flags.dsa5.args0")
                                    const effectName = game.i18n.localize(`CONDITION.${effectId}`);
                                    const effectData = { 
                                        name: `${source.name} (${effectName})`, 
                                        duration: ef.duration
                                    }
                                    if(onDelayed) mergeObject(effectData, delayedData)

                                    await actor.addTimedCondition(effectId, value, false, false, effectData);
                                }
                                break;
                            case 2: //Macro
                                if (!game.user.can("MACRO_SCRIPT")) {
                                    ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
                                } else {
                                    if(onDelayed) {
                                        const copy = duplicate(ef)
                                        copy.changes = []
                                        isEffectWithChange = true
                                        mergeObject(ef, {
                                            system: {
                                                macroEffect: copy,
                                                sourceActor: sourceActor?.id,
                                                source: source,
                                                initialTestData: {
                                                    qualityStep: testData.qualityStep,
                                                }
                                            }})
                                    } else {
                                        try {
                                            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
                                            const fn = new AsyncFunction("effect", "actor", "callMacro", "msg", "source", "actor", "sourceActor", "testData", "qs", getProperty(ef, "flags.dsa5.args3"))
                                            await fn.call(this, ef, actor, callMacro, msg, source, actor, sourceActor, testData, qs);
                                        } catch (err) {
                                            ui.notifications.error(
                                                `There was an error in your macro syntax. See the console (F12) for details`
                                            );
                                            console.error(err);
                                            console.warn(err.stack);
                                        }
                                    }
                                }
                                break;
                            case 3: // Creature Link
                                const creatures = (getProperty(ef, "flags.dsa5.args4") || "")
                                    .split(",")
                                    .map((x) => `@Compendium[${x.trim().replace(/(@Compendium\[|\])/)}]`)
                                    .join(" ");
                                msg += `<p><b>${game.i18n.localize("ActiveEffects.advancedFunctions.creature")}</b>:</p><p>${creatures}</p>`;
                                break;
                        }
                    }

                    if (isEffectWithChange) {
                        if(onDelayed) {
                            delete ef.flags.dsa5.onDelayed
                            mergeObject(ef, delayedData)
                        } 

                        effectsWithChanges.push(ef);
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
            effectsWithChanges
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

        const hasSuccessEffects = ["poison", "disease"].includes(source.type)

        if (hasSuccessEffects) testData.qualityStep = testData.successLevel > 0 ? 1 : 2

        const attacker = DSA5_Utility.getSpeaker(speaker) ||
            DSA5_Utility.getSpeaker(getProperty(message.flags, "data.preData.extra.speaker")) ||
            game.actors.get(getProperty(message.flags, "data.preData.extra.actor.id"))

        const sourceActor = attacker;
        let effects = (await this._parseEffectDuration(source, testData, message.flags.data.preData, attacker)).filter(x => !getProperty(x, "flags.dsa5.applyToOwner"));

        if (hasSuccessEffects) effects = effects.filter(x => getProperty(x, "flags.dsa5.successEffect") == testData.qualityStep || !getProperty(x, "flags.dsa5.successEffect"))
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
        duration = duration.replace(/ x /g, " * ").replace(game.i18n.localize("CHARAbbrev.QS"), testData.qualityStep);
        try {
            for (const reg of DSAActiveEffectConfig.effectDurationRegexes) {
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
        const csdemo = `${game.i18n.localize("LocalizedIDs.wrestle")} 1`;
        const democs = `${game.i18n.localize("LocalizedIDs.wrestle")} 1`;
        const closeCombat = game.i18n.localize("closeCombatAttacks");
        const rangeCombat = game.i18n.localize("rangeCombatAttacks");
        const combatReg = `${regenerate} (${game.i18n.localize("CHARAbbrev.CR")})`;
        const AsPCost = game.i18n.localize("AsPCost");
        const KaPCost = game.i18n.localize("KaPCost");
        const permanentCost = game.i18n.localize("permanentCost")
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
            {
                name: `${game.i18n.localize("threshold")} (${game.i18n.localize("condition")})`,
                val: "system.thresholds.effects",
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
                ph: "+1d6",
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
                ph: "+1d6",
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
            { name: `${permanentCost} ${game.i18n.localize('CHARAbbrev.AsP')}`, val: "system.status.astralenergy.permanentGear", mode: 2, ph: "1" },
            { name: `${permanentCost} ${game.i18n.localize('CHARAbbrev.KaP')}`, val: "system.status.astralenergy.permanentGear", mode: 2, ph: "1" },
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
            {
                name: `${game.i18n.localize("MODS.sight")}`,
                val: `system.sightModifier.value`,
                mode: 2,
                ph: "-1",
            },
            {
                name: `${game.i18n.localize("MODS.sightMax")}`,
                val: `system.sightModifier.maxLevel`,
                mode: 5,
                ph: "4",
            },
            {
                name: `${game.i18n.localize("LocalizedIDs.immuneTo")} ${game.i18n.localize("condition")}`,
                val: `system.immunities`,
                mode: 2,
                ph: "feared",
            },
            {
                name: game.i18n.localize("temperature.heatProtection"),
                val: `system.temperature.heatProtection`,
                mode: 2,
                ph: "1",
            },
            {
                name: game.i18n.localize("temperature.coldProtection"),
                val: `system.temperature.coldProtection`,
                mode: 2,
                ph: "1",
            },
            {
                name: `${game.i18n.localize('TYPES.Item.combatskill')} - ${game.i18n.localize("CHAR.ATTACK")}`,
                val: `system.skillModifiers.combat.attack`,
                mode: 0,
                ph: csdemo
            },
            {
                name: `${game.i18n.localize('TYPES.Item.combatskill')} - ${game.i18n.localize("CHAR.PARRY")}`,
                val: `system.skillModifiers.combat.parry`,
                mode: 0,
                ph: csdemo
            },
            {
                name: `${game.i18n.localize('TYPES.Item.combatskill')} - ${game.i18n.localize("KTW")}`,
                val: `system.skillModifiers.combat.step`,
                mode: 0,
                ph: csdemo
            },
            {
                name: `${game.i18n.localize('TYPES.Item.combatskill')} - ${game.i18n.localize("damage")}`,
                val: `system.skillModifiers.combat.damage`,
                mode: 0,
                ph: csdemo
            }
        ];

        const models = ["liturgy", "ceremony", "spell", "ritual", "skill", "feature"];
        for (const k of models) {
            let key = k == "skill" ? "skillglobal" : k;
            const el = game.i18n.localize(key);
            optns.push(
                { name: `${el} - ${FW}`, val: `system.skillModifiers.${k}.FW`, mode: 0, ph: demo }, 
                { name: `${el} - ${FP}`, val: `system.skillModifiers.${k}.FP`, mode: 0, ph: demo }, 
                { name: `${el} - ${stepValue}`, val: `system.skillModifiers.${k}.step`, mode: 0, ph: demo }, 
                { name: `${el} - ${QS}`, val: `system.skillModifiers.${k}.QL`, mode: 0, ph: demo }, 
                { name: `${el} - ${partChecks}`, val: `system.skillModifiers.${k}.TPM`, mode: 0, ph: demo });
        }

        for(let ef of CONFIG.statusEffects){
            if(getProperty(ef, "flags.dsa5.max")){
                optns.push({
                    name: game.i18n.localize(ef.name),
                    val: `system.condition.${ef.id}`,
                    mode: 2,
                    ph: 1
                })
            }
        }

        if(this.object.parent?.type == "armor") {
            optns.push({
                name: game.i18n.localize("CustomActiveEffects.armor.vulnerability"),
                val: `self.armorVulnerability`,
                mode: 0,
                ph: "Swords 5"
            })
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

        for(let model of ["spell", "liturgy", "ceremony", "ritual"]){
            const modelName = DSA5_Utility.categoryLocalization(model)
            for(const k of ["soulpower", "toughness"]){
                optns.push({ name: `${game.i18n.localize(k)} (${modelName})`, val: `system.status.${k}.${model}resist`, mode: 2, ph: "1" });
            }
            for(const k of Object.keys(DSA5SpellDialog.rollModifiers)){
                optns.push({
                    name: `${modelName} - ${game.i18n.localize(k.replace("Spell", ""))}`,
                    val: `system.${model}RollModifiers.${k}.mod`,
                    mode: 2,
                    ph: "1",
                },
                {
                    name: `${modelName} - ${game.i18n.localize(k.replace("Spell", ""))} - ${game.i18n.localize("advanced")}`,
                    val: `system.${model}RollModifiers.${k}.custom`,
                    mode: 0,
                    ph: descriptor,
                })
            }
        }

        for(let model of ["meleeweapon", "rangeweapon"]){
            const modelName = DSA5_Utility.categoryLocalization(model)

            for(const k of Object.keys(foundry.utils.flattenObject(DSA5CombatDialog[`${model}RollModifiers`]))){
                optns.push({
                    name: `${modelName} - ${game.i18n.localize(`MODS.${k.replace(/\.[a-z]+$/, "")}`)}`,
                    val: `system.${model}RollModifiers.${k}`,
                    mode: 2,
                    ph: "1",
                })
            }
        }

        if(["meleeweapon", "rangeweapon"].includes(this.object.parent?.type)){
            const modelName = DSA5_Utility.categoryLocalization(this.object.parent.type)
            const maneuver = game.i18n.localize('combatmaneuver')
            const maneuverExample = game.i18n.localize('LocalizedIDs.weaponThrow')

            for(let k of ["attack", "parry", "damage"]){
                if(k == "parry" && this.object.parent.type == "rangeweapon") continue

                const mode = game.i18n.localize(`CHAR.${k.toUpperCase()}`)
                optns.push({
                    name: `${modelName} - ${mode}`,
                    val: `self.situational.${k}`,
                    mode: 0,
                    ph: "1",
                })
            }

            optns.push({
                name: `${maneuver} - ${game.i18n.localize('CHAR.attack')}`,
                val: `self.maneuver.atbonus`,
                mode: 0,
                ph: `${maneuverExample} 1`,
            }, {
                name: `${maneuver} - ${game.i18n.localize('CHAR.parry')}`,
                val: `self.maneuver.pabonus`,
                mode: 0,
                ph: `${maneuverExample} 1`,
            }, {
                name: `${maneuver} - ${game.i18n.localize('CHAR.damage')}`,
                val: `self.maneuver.tpbonus`,
                mode: 0,
                ph: `${maneuverExample} 1`,
            })
        }

        optns = optns.sort((a, b) => a.name.localeCompare(b.name));

        for (let optn of optns) if (!optn.ph || optn.mode == undefined) console.warn(optn)

        optns = optns.map(x => `<option value="${x.val}" data-mode="${x.mode}" data-ph="${x.ph}">${x.name}</option>`).join("\n");
        return `<select class="selMenu">${optns}</select>`;
    }

    activateListeners(html) {
        super.activateListeners(html);
        const dropDown = this.dropDownMenu();
        html.find(".changes-list .effect-change .key").append(dropDown);
        html.find(".selMenu").select2({ width: "element"}).change((ev) => {
            const elem = $(ev.currentTarget);
            elem.siblings("input").val(elem.val());
            const parent = elem.closest(".effect-change");
            const data = elem.find("option:selected");
            parent.find(".mode select").val(data.attr("data-mode"));
            parent.find(".value input").attr("placeholder", data.attr("data-ph"));
            elem.trigger("blur");
        });
        html.find('.select2').each((i, el) => {
            $(el)[0].style.removeProperty("width")
        })
    }
}