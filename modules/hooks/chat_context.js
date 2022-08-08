import Actordsa5 from "../actor/actor-dsa5.js";
import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {
    const fateAvailable = (actor, group) => { return DSA5_Utility.fateAvailable(actor, group) }
    const canHurt = function(li) {
        let cardData = game.messages.get(li.attr("data-message-id")).flags.opposeData
        return (game.user.isGM && li.find(".opposed-card").length || li.find(".dice-roll").length) && cardData && cardData.damage.value > 0
    }
    const canHurtSP = function(li) {
        let cardData = game.messages.get(li.attr("data-message-id")).flags.opposeData
        return (game.user.isGM && li.find(".opposed-card").length || li.find(".dice-roll").length) && cardData && cardData.damage.sp > 0
    }
    const canCostMana = function(li) {
        let message = game.messages.get(li.attr("data-message-id"));
        if (message.speaker.actor && message.flags.data) {
            let actor = game.actors.get(message.speaker.actor);
            if (actor.isOwner || game.user.isGM) {
                return ["liturgy", "ceremony", "spell", "ritual", "magicalsign"].includes(message.flags.data.preData.source.type) || getProperty(message.flags.data.preData, "calculatedSpellModifiers.costsMana")
            }
        }
        return false
    }
    const canUnhideData = function(li) {
        if (game.user.isGM && game.settings.get("dsa5", "hideOpposedDamage")) {
            let message = game.messages.get(li.attr("data-message-id"));
            return "hideData" in message.flags && message.flags.hideData
        }
        return false
    }
    const canHideData = function(li) {
        if (game.user.isGM && game.settings.get("dsa5", "hideOpposedDamage")) {
            let message = game.messages.get(li.attr("data-message-id"));
            return "hideData" in message.flags && !message.flags.hideData
        }
        return false
    }
    const canImproveRoll = function(li, group = false) {
        let message = game.messages.get(li.attr("data-message-id"));
        if (message.speaker.actor && message.flags.data) {
            if (message.flags.data.postData.successLevel > -2) {
                let actor = game.actors.get(message.speaker.actor);
                if (actor.isOwner && fateAvailable(actor, group)) {
                    let rollType = message.flags.data.preData.source.type
                    const mode = message.flags.data.preData.mode || ""
                    if (["skill", "spell", "liturgy", "ritual", "ceremony"].includes(rollType)) rollType = "char"
                    let schipSkill = game.i18n.localize(`SCHIPSKILLS.${rollType}${mode}`)
                    return !message.flags.data.fateImproved && actor.items.getName(schipSkill)
                }
            }
        }
        return false
    }
    const canImproveRollGroup = function(li) {
        return canImproveRoll(li, true)
    }
    const canIncreaseQS = function(li, group = false) {
        let message = game.messages.get(li.attr("data-message-id"));
        if (message.speaker.actor && message.flags.data) {
            let actor = game.actors.get(message.speaker.actor);
            if (actor.isOwner && fateAvailable(actor, group)) {
                if (!message.flags.data.fatePointAddQSUsed) {
                    return message.flags.data.postData.successLevel > 0 && message.flags.data.postData.qualityStep != undefined
                }
            }
        }
        return false;
    };
    const canIncreaseQSGroup = function(li) {
        return canIncreaseQS(li, true)
    }
    const isTalented = function(li) {
        let message = game.messages.get(li.attr("data-message-id"));
        if (message.speaker.actor && message.flags.data) {
            let actor = game.actors.get(message.speaker.actor);
            if (actor.isOwner) {
                return actor.items.find(x => x.name == `${game.i18n.localize('LocalizedIDs.aptitude')} (${message.flags.data.preData.source.name})`) != undefined && !message.flags.data.talentedRerollUsed;
            }
        }
        return false
    }
    const canRerollDamage = function(li, group = false) {
        let message = game.messages.get(li.attr("data-message-id"));
        if (message.speaker.actor && message.flags.data) {
            let actor = game.actors.get(message.speaker.actor);
            if (actor.isOwner && fateAvailable(actor, group)) {
                return message.flags.data.postData.damageRoll != undefined && !message.flags.data.fatePointDamageRerollUsed;
            }
        }
        return false
    };
    const canRerollDamageGroup = function(li) {
        return canRerollDamage(li, true)
    }
    const canReroll = function(li, group = false) {
        let message = game.messages.get(li.attr("data-message-id"));

        if (message.speaker.actor && message.flags.data) {
            let actor = game.actors.get(message.speaker.actor);
            if (actor.isOwner && fateAvailable(actor, group)) {
                return !message.flags.data.fatePointRerollUsed && !(message.flags.data.postData.rollType == "regenerate")
            }
        }
        return false;
    };
    const canRerollGroup = function(li) {
        return canReroll(li, true)
    }

    const canHeal = function(li) {
        let message = game.messages.get(li.attr("data-message-id"));
        if (message.speaker.actor && message.flags.data) {
            let actor = game.actors.get(message.speaker.actor);
            if (actor.isOwner && ["LeP", "KaP", "AsP"].some(x => getProperty(message.flags, `data.postData.${x}`) != undefined)) {
                return !message.flags.data.healApplied
            }
        }
        return false
    }
    const showHideData = function(li) {
        if (game.user.isGM) {
            let message = game.messages.get(li.attr("data-message-id"))
            if ("hideData" in message.flags) {
                let newHide = !message.flags.hideData
                let query = $(message.content)
                query.find('.hideAnchor')[newHide ? "addClass" : "removeClass"]("hideData")
                query = $('<div></div>').append(query)
                message.update({
                    "content": query.html(),
                    "flags.hideData": newHide
                });
            }
        }
    }
    let canApplyDefaultRolls = li => {
        const message = game.messages.get(li.data("messageId"));
        if (!message || !canvas.tokens) return false
        return message.isRoll && message.isContentVisible && canvas.tokens.controlled.length && li.find('.dice-roll').length;
    };

    const useFate = (li, mode, fateSource = 0) => {
        let message = game.messages.get(li.attr("data-message-id"));
        game.actors.get(message.speaker.actor).useFateOnRoll(message, mode, fateSource);
    }

    const applyDamage = async(li, mode) => {
        const message = game.messages.get(li.attr("data-message-id"))
        const cardData = message.flags.opposeData
        const defenderSpeaker = cardData.speakerDefend;
        const actor = DSA5_Utility.getSpeaker(defenderSpeaker)

        if (!actor.isOwner) return ui.notifications.error(game.i18n.localize("DSAError.DamagePermission"))
        await actor.applyDamage(cardData.damage[mode])
        await message.update({ "flags.data.damageApplied": true, content: message.content.replace(/hideAnchor">/, `hideAnchor"><i class="fas fa-check" style="float:right" data-tooltip="${game.i18n.localize("damageApplied")}"></i>`) })
    }
    const applyChatCardDamage = (li, mode) => {
        const message = game.messages.get(li.data("messageId"));
        const roll = message.rolls[0];
        return Promise.all(canvas.tokens.controlled.map(token => {
            const actor = token.actor;
            const damage = mode != "sp" ? roll.total - Actordsa5.armorValue(actor).armor : roll.total
            return actor.applyDamage(Math.max(0, damage));
        }));
    }

    Hooks.on("getChatLogEntryContext", (html, options) => {
        options.push({
                name: game.i18n.localize("CHATCONTEXT.hideData"),
                icon: '<i class="fas fa-eye"></i>',
                condition: canHideData,
                callback: (li) => { showHideData(li) }
            }, {
                name: game.i18n.localize("CHATCONTEXT.showData"),
                icon: '<i class="fas fa-eye"></i>',
                condition: canUnhideData,
                callback: (li) => { showHideData(li) }
            }, {
                name: game.i18n.localize("regenerate"),
                icon: '<i class="fas fa-user-plus"></i>',
                condition: canHeal,
                callback: async(li) => {
                    const message = await game.messages.get(li.attr("data-message-id"))
                    const actor = DSA5_Utility.getSpeaker(message.speaker)
                    if (!actor.isOwner)
                        return ui.notifications.error(game.i18n.localize("DSAError.DamagePermission"))

                    await message.update({ "flags.data.healApplied": true, content: message.content.replace(/<\/div>$/, '<i class="fas fa-check" style="float:right"></i></div>') });
                    await actor.applyRegeneration(message.flags.data.postData.LeP, message.flags.data.postData.AsP, message.flags.data.postData.KaP)
                }
            }, {
                name: game.i18n.localize("CHATCONTEXT.ApplyMana"),
                icon: '<i class="fas fa-user-minus"></i>',
                condition: canCostMana,
                callback: async(li) => {
                    let message = game.messages.get(li.attr("data-message-id"))
                    let cardData = message.flags.data
                    let actor = DSA5_Utility.getSpeaker(message.speaker)
                    if (!actor.isOwner)
                        return ui.notifications.error(game.i18n.localize("DSAError.DamagePermission"))

                    await actor.applyMana(cardData.preData.calculatedSpellModifiers.finalcost, (["ritual", "spell"].includes(cardData.preData.source.type) || getProperty(cardData.preData.calculatedSpellModifiers, "costsMana")) ? "AsP" : "KaP")
                    await message.update({ "flags.data.manaApplied": true, content: message.content.replace(/<span class="costCheck">/, `<span class="costCheck"><i class="fas fa-check" style="float:right"></i>`) })
                }
            }, {
                name: game.i18n.localize("CHATCONTEXT.ApplyDamage"),
                icon: '<i class="fas fa-user-minus"></i>',
                condition: canHurt,
                callback: li => { applyDamage(li, "value") }
            }, {
                name: game.i18n.localize("CHATCONTEXT.ApplyDamageSP"),
                icon: '<i class="fas fa-user-minus"></i>',
                condition: canHurtSP,
                callback: li => { applyDamage(li, "sp") }
            }, {
                name: game.i18n.localize("CHATCONTEXT.ApplyDamage"),
                icon: '<i class="fas fa-user-minus"></i>',
                condition: canApplyDefaultRolls,
                callback: li => { applyChatCardDamage(li, "value") }
            }, {
                name: game.i18n.localize("CHATCONTEXT.ApplyDamageSP"),
                icon: '<i class="fas fa-user-minus"></i>',
                condition: canApplyDefaultRolls,
                callback: li => { applyChatCardDamage(li, "sp") }
            }, {
                name: game.i18n.localize("CHATCONTEXT.Reroll"),
                icon: '<i class="fas fa-dice"></i>',
                condition: canReroll,
                callback: li => { useFate(li, "reroll") }
            }, {
                name: game.i18n.localize("CHATCONTEXT.RerollGroup"),
                icon: '<i class="fas fa-dice"></i>',
                condition: canRerollGroup,
                callback: li => { useFate(li, "reroll", 1) }
            }, {
                name: game.i18n.localize("CHATCONTEXT.talentedReroll"),
                icon: '<i class="fas fa-dice"></i>',
                condition: isTalented,
                callback: li => { useFate(li, "isTalented") }
            }, {
                name: game.i18n.localize("CHATCONTEXT.AddQS"),
                icon: '<i class="fas fa-plus-square"></i>',
                condition: canIncreaseQS,
                callback: li => { useFate(li, "addQS") }
            }, {
                name: game.i18n.localize("CHATCONTEXT.AddQSGroup"),
                icon: '<i class="fas fa-plus-square"></i>',
                condition: canIncreaseQSGroup,
                callback: li => { useFate(li, "addQS", 1) }
            }, {
                name: game.i18n.localize("CHATCONTEXT.rerollDamage"),
                icon: '<i class="fas fa-dice"></i>',
                condition: canRerollDamage,
                callback: li => { useFate(li, "rerollDamage") }
            }, {
                name: game.i18n.localize("CHATCONTEXT.rerollDamageGroup"),
                icon: '<i class="fas fa-dice"></i>',
                condition: canRerollDamageGroup,
                callback: li => { useFate(li, "rerollDamage", 1) }
            }, {
                name: game.i18n.localize("CHATCONTEXT.improveFate"),
                icon: '<i class="fas fa-plus-square"></i>',
                condition: canImproveRoll,
                callback: li => { useFate(li, "Improve") }
            }, {
                name: game.i18n.localize("CHATCONTEXT.improveFateGroup"),
                icon: '<i class="fas fa-plus-square"></i>',
                condition: canImproveRollGroup,
                callback: li => { useFate(li, "Improve", 1) }
            }

        )
    })
}