import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {

    Hooks.on("getChatLogEntryContext", (html, options) => {
        const canHurt = function(li) {
            let cardData = game.messages.get(li.attr("data-message-id")).data.flags.opposeData
            return (game.user.isGM && li.find(".opposed-card").length || li.find(".dice-roll").length) && cardData && cardData.damage.value > 0
        }
        const canHurtSP = function(li) {
            let cardData = game.messages.get(li.attr("data-message-id")).data.flags.opposeData
            return (game.user.isGM && li.find(".opposed-card").length || li.find(".dice-roll").length) && cardData && cardData.damage.sp > 0
        }
        const canCostMana = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.isOwner || game.user.isGM) {
                    return ["liturgy", "ceremony", "spell", "ritual"].includes(message.data.flags.data.preData.source.type)
                }
            }
            return false
        }
        const canUnhideData = function(li) {
            if (game.user.isGM && game.settings.get("dsa5", "hideOpposedDamage")) {
                let message = game.messages.get(li.attr("data-message-id"));
                return "hideData" in message.data.flags && message.data.flags.hideData
            }
            return false
        }
        const canHideData = function(li) {
            if (game.user.isGM && game.settings.get("dsa5", "hideOpposedDamage")) {
                let message = game.messages.get(li.attr("data-message-id"));
                return "hideData" in message.data.flags && !message.data.flags.hideData
            }
            return false
        }
        const canIncreaseQS = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.isOwner && actor.data.data.status.fatePoints.value > 0) {
                    if (!message.data.flags.data.fatePointAddQSUsed) {
                        return message.data.flags.data.postData.successLevel > 0 && message.data.flags.data.postData.qualityStep != undefined
                    }
                }
            }
            return false;
        };
        const isTalented = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.isOwner) {
                    return actor.items.find(x => x.name == `${game.i18n.localize('LocalizedIDs.aptitude')} (${message.data.flags.data.preData.source.name})`) != undefined && !message.data.flags.data.talentedRerollUsed;
                }
            }
            return false
        }
        const canRerollDamage = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.isOwner && actor.data.data.status.fatePoints.value > 0) {
                    return message.data.flags.data.postData.damageRoll != undefined && !message.data.flags.data.fatePointDamageRerollUsed;
                }
            }
            return false
        };
        const canReroll = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));

            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.isOwner && actor.data.data.status.fatePoints.value > 0) {
                    return !message.data.flags.data.fatePointRerollUsed;
                }
            }
            return false;
        };
        const canHeal = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.isOwner && getProperty(message.data.flags, "data.postData.LeP")) {
                    return !message.data.flags.data.healApplied
                }
            }
            return false
        }
        const showHideData = function(li) {
            if (game.user.isGM) {
                let message = game.messages.get(li.attr("data-message-id"))
                if ("hideData" in message.data.flags) {
                    let newHide = !message.data.flags.hideData
                    let query = $(message.data.content)
                    query.find('.hideAnchor')[newHide ? "addClass" : "removeClass"]("hideData")
                    query = $('<div></div>').append(query)
                    message.update({
                        "content": query.html(),
                        "flags.hideData": newHide
                    });
                }
            }
        }

        const useFate = (li, mode) => {
            let message = game.messages.get(li.attr("data-message-id"));
            game.actors.get(message.data.speaker.actor).useFateOnRoll(message, mode);
        }

        const applyDamage = async(li, mode) => {
            let cardData = game.messages.get(li.attr("data-message-id")).data.flags.opposeData
            let defenderSpeaker = cardData.speakerDefend;
            let actor = DSA5_Utility.getSpeaker(defenderSpeaker)

            if (!actor.isOwner) return ui.notifications.error(game.i18n.localize("DSAError.DamagePermission"))

            await actor.applyDamage(cardData.damage[mode])
        }

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
            callback: li => {
                let message = game.messages.get(li.attr("data-message-id"))
                let actor = DSA5_Utility.getSpeaker(message.data.speaker)
                if (!actor.isOwner)
                    return ui.notifications.error(game.i18n.localize("DSAError.DamagePermission"))

                message.update({ "flags.data.healApplied": true });
                const update = {
                    "data.status.wounds.value": Math.min(actor.data.data.status.wounds.max, actor.data.data.status.wounds.value + (message.data.flags.data.postData.LeP || 0)),
                    "data.status.karmaenergy.value": Math.min(actor.data.data.status.karmaenergy.max, actor.data.data.status.karmaenergy.value + (message.data.flags.data.postData.KaP || 0)),
                    "data.status.astralenergy.value": Math.min(actor.data.data.status.astralenergy.max, actor.data.data.status.astralenergy.value + (message.data.flags.data.postData.AsP || 0))
                }
                actor.update(update)
            }
        }, {
            name: game.i18n.localize("CHATCONTEXT.ApplyMana"),
            icon: '<i class="fas fa-user-minus"></i>',
            condition: canCostMana,
            callback: li => {
                let message = game.messages.get(li.attr("data-message-id"))
                let cardData = message.data.flags.data
                let actor = DSA5_Utility.getSpeaker(message.data.speaker)
                if (!actor.isOwner)
                    return ui.notifications.error(game.i18n.localize("DSAError.DamagePermission"))
                actor.applyMana(cardData.preData.calculatedSpellModifiers.finalcost, ["ritual", "spell"].includes(cardData.preData.source.type) ? "AsP" : "KaP")
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
            name: game.i18n.localize("CHATCONTEXT.Reroll"),
            icon: '<i class="fas fa-dice"></i>',
            condition: canReroll,
            callback: li => { useFate(li, "reroll") }
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
            name: game.i18n.localize("CHATCONTEXT.rerollDamage"),
            icon: '<i class="fas fa-dice"></i>',
            condition: canRerollDamage,
            callback: li => { useFate(li, "rerollDamage") }
        })
    })
}