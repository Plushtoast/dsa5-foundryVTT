import DSA5_Utility from './utility-dsa5.js';
import ForbiddenGatesDialog from './forbidden-gates-dialog.js';

export class ForbiddenGatesHandler {

    static checkRollSpellResult(res, testData) {
        const extra = testData.extra || {};
        const speaker = extra.speaker || testData.speaker;
        const actor = DSA5_Utility.getSpeaker(speaker) || (testData.source ? testData.source.parent : null);
        
        if (actor && actor.system.forbiddenGatesTemp) {
            testData.extra = extra;
            testData.extra.forbiddenGates = actor.system.forbiddenGatesTemp;
            res.forbiddenGates = actor.system.forbiddenGatesTemp;
        }

        if (testData.extra?.forbiddenGates?.active) {
            if (!testData.extra.forbiddenGates.passed) {
                res.successLevel = -1;
                res.result = -1; 
                res.qualityStep = 0;
                

                res.fp = -1; 
                res.pointsRemaining = -1; 
                
                res.critical = false;
                res.fumble = false;
                
                res.description = game.i18n.localize("FORBIDDENGATES.failed");

                if (res.characteristics) {
                    res.characteristics.forEach(ch => {
                        ch.suc = false; 
                    });
                }
            }
        }
        return res;
    }

    static getChatContextOption() {
        return {
            name: 'Verbotene Pforten zahlen', 
            icon: '<i class="fas fa-dungeon"></i>', 
            condition: (li) => {
                const messageId = li.length ? li[0].dataset.messageId : li.dataset?.messageId;
                const message = game.messages.get(messageId);
                const preData = foundry.utils.getProperty(message, "flags.data.preData") || foundry.utils.getProperty(message, "flags.dsa5.data.preData");
                const postData = foundry.utils.getProperty(message, "flags.data.postData") || foundry.utils.getProperty(message, "flags.dsa5.data.postData");
                
                return postData?.forbiddenGates?.active || preData?.extra?.forbiddenGates?.active;
            },
            callback: (li) => ForbiddenGatesHandler.payCosts(li)
        };
    }

    static async payCosts(li) {
        const messageId = li.length ? li[0].dataset.messageId : li.dataset?.messageId;
        const message = game.messages.get(messageId);
        const preData = foundry.utils.getProperty(message, "flags.data.preData") || foundry.utils.getProperty(message, "flags.dsa5.data.preData");
        const postData = foundry.utils.getProperty(message, "flags.data.postData") || foundry.utils.getProperty(message, "flags.dsa5.data.postData");
        const actor = DSA5_Utility.getSpeaker(message.speaker);
        
        const forbiddenData = postData?.forbiddenGates || preData?.extra?.forbiddenGates;
        if (!forbiddenData) return;

        const passed = forbiddenData.passed;
        const isPowerful = forbiddenData.powerful || false; 
        
        const cost = preData.calculatedSpellModifiers.finalcost;
        const maxAsP = actor.system.status.astralenergy.value;

        if (!passed || postData.successLevel < 1) {
            let paidAsP = Math.min(maxAsP, cost);
            let paidLeP = cost - paidAsP;

            await actor.update({ "system.status.astralenergy.value": maxAsP - paidAsP });
            if (paidLeP > 0) await actor.applyDamage(paidLeP);

            await ForbiddenGatesHandler.updateMessage(message, paidAsP, paidLeP);
        } else {
            new ForbiddenGatesDialog(actor, cost, message, isPowerful).render(true);
        }
    }

    static async updateMessage(message, paidAsP, paidLeP) {
        let content = message.content;
        
        if (content.includes('class="costCheck"')) {
           content = content.replace(/<span class="costCheck">/, '<span class="costCheck"><i class="fas fa-check fg-check-right"></i>');
        } else {
           content += `<br><span class="costCheck"><i class="fas fa-check"></i> ${game.i18n.localize("FORBIDDENGATES.name")}</span>`;
        }

        await message.update({
            content: content,
            "flags.data.manaApplied": true, 
            "flags.data.forbiddenGatesPaid": { asp: paidAsP, lep: paidLeP }
        });

        let infoMsg = "";
        if (paidAsP > 0) infoMsg += game.i18n.format("FORBIDDENGATES.paidInfoAsP", { asp: paidAsP });
        if (paidLeP > 0) infoMsg += game.i18n.format("FORBIDDENGATES.paidInfoLeP", { lep: paidLeP });

        if (infoMsg !== "") ChatMessage.create({ content: infoMsg, speaker: message.speaker });
    }
}
