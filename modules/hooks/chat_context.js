import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {
    Hooks.on("getChatLogEntryContext", (html, options) => {
        let canHurt = function(li) {
            let cardData = game.messages.get(li.attr("data-message-id")).data.flags.opposeData
            return (game.user.isGM && li.find(".opposed-card").length || li.find(".dice-roll").length) && cardData && cardData.damage.value > 0
        }
        let canHurtSP = function(li) {
            let cardData = game.messages.get(li.attr("data-message-id")).data.flags.opposeData
            return (game.user.isGM && li.find(".opposed-card").length || li.find(".dice-roll").length) && cardData && cardData.damage.sp > 0
        }
        let canCostMana = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.permission == ENTITY_PERMISSIONS.OWNER || game.user.isGM) {
                    return ["liturgy", "ceremony", "spell", "ritual"].includes(message.data.flags.data.preData.source.type)
                }
            }
            return false
        }
        let canIncreaseQS = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.permission == ENTITY_PERMISSIONS.OWNER && actor.data.data.status.fatePoints.value > 0) {
                    if (!message.data.flags.data.fatePointAddQSUsed) {
                        return message.data.flags.data.postData.successLevel > 0 && message.data.flags.data.postData.qualityStep != undefined
                    }
                }
            }
            return false;
        };
        let isTalented = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.permission == ENTITY_PERMISSIONS.OWNER) {
                    return actor.items.find(x => x.name == `${game.i18n.localize('LocalizedIDs.aptitude')} (${message.data.flags.data.preData.source.name})`) != undefined && !message.data.flags.data.talentedRerollUsed;
                }
            }
            return false
        }
        let canRerollDamage = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.permission == ENTITY_PERMISSIONS.OWNER && actor.data.data.status.fatePoints.value > 0) {
                    return message.data.flags.data.postData.damageRoll != undefined && !message.data.flags.data.fatePointDamageRerollUsed;
                }
            }
            return false
        };
        let canReroll = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));

            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.permission == ENTITY_PERMISSIONS.OWNER && actor.data.data.status.fatePoints.value > 0) {
                    return !message.data.flags.data.fatePointRerollUsed;
                }
            }
            return false;
        };
        let canHeal = function(li) {
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor && message.data.flags.data) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.permission == ENTITY_PERMISSIONS.OWNER) {

                    return message.data.flags.data.postData.LeP
                }
            }
            return false
        }

        options.push({
            name: game.i18n.localize("regenerate"),
            icon: '<i class="fas fa-user-plus"></i>',
            condition: canHeal,
            callback: li => {
                let message = game.messages.get(li.attr("data-message-id"))
                let actor = DSA5_Utility.getSpeaker(message.data.speaker)
                if (!actor)
                    actor = new Actordsa5(newTestData.extra.actor, { temporary: true })
                if (!actor.owner)
                    return ui.notifications.error(game.i18n.localize("DSAError.DamagePermission"))

                actor.update({
                    "data.status.wounds.value": Math.min(actor.data.data.status.wounds.max, actor.data.data.status.wounds.value + (message.data.flags.data.postData.LeP || 0)),
                    "data.status.karmaenergy.value": Math.min(actor.data.data.status.karmaenergy.max, actor.data.data.status.karmaenergy.value + (message.data.flags.data.postData.KaP || 0)),
                    "data.status.astralenergy.value": Math.min(actor.data.data.status.astralenergy.max, actor.data.data.status.astralenergy.value + (message.data.flags.data.postData.AsP || 0))
                })
            }
        }, {
            name: game.i18n.localize("CHATCONTEXT.ApplyMana"),
            icon: '<i class="fas fa-user-minus"></i>',
            condition: canCostMana,
            callback: li => {
                let message = game.messages.get(li.attr("data-message-id"))
                let cardData = message.data.flags.data
                let actor = DSA5_Utility.getSpeaker(message.data.speaker)
                if (!actor)
                    actor = new Actordsa5(newTestData.extra.actor, { temporary: true })
                if (!actor.owner)
                    return ui.notifications.error(game.i18n.localize("DSAError.DamagePermission"))
                actor.applyMana(cardData.preData.calculatedSpellModifiers.finalcost, ["ritual", "spell"].includes(cardData.preData.source.type) ? "AsP" : "KaP")
            }
        }, {
            name: game.i18n.localize("CHATCONTEXT.ApplyDamage"),
            icon: '<i class="fas fa-user-minus"></i>',
            condition: canHurt,
            callback: li => {
                let cardData = game.messages.get(li.attr("data-message-id")).data.flags.opposeData
                let defenderSpeaker = cardData.speakerDefend;
                let actor = DSA5_Utility.getSpeaker(defenderSpeaker)
                if (!actor.owner)
                    return ui.notifications.error(game.i18n.localize("DSAError.DamagePermission"))

                actor.applyDamage(cardData.damage.value)
            }
        }, {
            name: game.i18n.localize("CHATCONTEXT.ApplyDamageSP"),
            icon: '<i class="fas fa-user-minus"></i>',
            condition: canHurtSP,
            callback: li => {
                let cardData = game.messages.get(li.attr("data-message-id")).data.flags.opposeData
                let defenderSpeaker = cardData.speakerDefend;
                let actor = DSA5_Utility.getSpeaker(defenderSpeaker)
                if (!actor.owner)
                    return ui.notifications.error(game.i18n.localize("DSAError.DamagePermission"))

                actor.applyDamage(cardData.damage.sp)
            }
        }, {
            name: game.i18n.localize("CHATCONTEXT.Reroll"),
            icon: '<i class="fas fa-dice"></i>',
            condition: canReroll,
            callback: li => {
                let message = game.messages.get(li.attr("data-message-id"));
                game.actors.get(message.data.speaker.actor).useFateOnRoll(message, "reroll");
            }
        }, {
            name: game.i18n.localize("CHATCONTEXT.talentedReroll"),
            icon: '<i class="fas fa-dice"></i>',
            condition: isTalented,
            callback: li => {
                let message = game.messages.get(li.attr("data-message-id"));
                game.actors.get(message.data.speaker.actor).useFateOnRoll(message, "isTalented");
            }
        }, {
            name: game.i18n.localize("CHATCONTEXT.AddQS"),
            icon: '<i class="fas fa-plus-square"></i>',
            condition: canIncreaseQS,
            callback: li => {
                let message = game.messages.get(li.attr("data-message-id"));
                game.actors.get(message.data.speaker.actor).useFateOnRoll(message, "addQS");
            }
        }, {
            name: game.i18n.localize("CHATCONTEXT.rerollDamage"),
            icon: '<i class="fas fa-dice"></i>',
            condition: canRerollDamage,
            callback: li => {
                let message = game.messages.get(li.attr("data-message-id"));
                game.actors.get(message.data.speaker.actor).useFateOnRoll(message, "rerollDamage");
            }
        })
    })
}