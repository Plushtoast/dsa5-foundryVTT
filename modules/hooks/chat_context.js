import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {
    Hooks.on("getChatLogEntryContext", (html, options) => {
        let canHurt = li => li.find(".opposed-card").length || li.find(".dice-roll").length
        let canIncreaseQS = function(li) {
            let result = false;
            let message = game.messages.get(li.attr("data-message-id"));

            if (message.data.speaker.actor) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.permission == ENTITY_PERMISSIONS.OWNER && actor.data.type == "character" && actor.data.data.status.fatePoints.value > 0) {
                    if (!message.data.flags.data.fatePointAddQSUsed) {
                        result = message.data.flags.data.postData.successLevel > 0 && message.data.flags.data.postData.qualityStep != undefined
                    }
                }
            }
            return result;
        };
        let isTalented = function(li) {
            let result = false
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.permission == ENTITY_PERMISSIONS.OWNER) {
                    result = actor.items.find(x => x.name == `Begabung (${message.data.flags.data.preData.source.name})`) != undefined && !message.data.flags.data.talentedRerollUsed;
                }
            }
            return result
        }
        let canRerollDamage = function(li) {
            let result = false
            let message = game.messages.get(li.attr("data-message-id"));
            if (message.data.speaker.actor) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.permission == ENTITY_PERMISSIONS.OWNER && actor.data.type == "character" && actor.data.data.status.fatePoints.value > 0) {
                    result = message.data.flags.data.postData.damageRoll != undefined && !message.data.flags.data.fatePointDamageRerollUsed;
                }
            }
            return result
        };
        let canReroll = function(li) {
            let result = false;
            let message = game.messages.get(li.attr("data-message-id"));

            if (message.data.speaker.actor) {
                let actor = game.actors.get(message.data.speaker.actor);
                if (actor.permission == ENTITY_PERMISSIONS.OWNER && actor.data.type == "character" && actor.data.data.status.fatePoints.value > 0) {
                    result = !message.data.flags.data.fatePointRerollUsed;
                }
            }
            return result;
        };

        options.push(

            {
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