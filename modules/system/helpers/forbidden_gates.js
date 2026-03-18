import DSA5_Utility from './utility-dsa5.js';

export class ForbiddenGatesHandler {

    static checkRollSpellResult(res, testData) {
        const actor = DSA5_Utility.getSpeaker(testData.extra.speaker);
        
        // Wir setzen das Flag für die Logik (Misserfolg erzwingen)
        if (actor && actor.system.forbiddenGatesTemp) {
            testData.extra = testData.extra || {};
            testData.extra.forbiddenGates = actor.system.forbiddenGatesTemp;
            res.forbiddenGates = actor.system.forbiddenGatesTemp;
            // Wir löschen die Temp-Daten HIER NOCH NICHT, damit der ChatMessage-Hook sie gleich abgreifen kann!
        }

        if (testData.extra?.forbiddenGates?.active) {
            if (!testData.extra.forbiddenGates.passed) {
                res.successLevel = -1;
                res.result = -1; 
                res.qualityStep = 0;
                res.description = game.i18n.localize("FORBIDDENGATES.failed");
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
           content = content.replace(/<span class="costCheck">/, '<span class="costCheck"><i class="fas fa-check" style="float:right"></i>');
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

// --- GLOBALE HOOKS ---

// 1. Forciert das Flag direkt in die Datenbank, egal was das System vorher herausfiltert!
Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
    if (game.user.id !== userId) return;

    const preData = foundry.utils.getProperty(message, "flags.data.preData") || foundry.utils.getProperty(message, "flags.dsa5.data.preData");
    if (preData && ["spell", "ritual"].includes(preData.source?.type)) {
        const actorId = preData.extra?.speaker?.actor;
        const actor = game.actors.get(actorId);
        
        if (actor && actor.system.forbiddenGatesTemp) {
            // Zwingt die Daten fest in die zu speichernde Chat-Nachricht
            message.updateSource({
                "flags.data.postData.forbiddenGates": actor.system.forbiddenGatesTemp,
                "flags.data.preData.extra.forbiddenGates": actor.system.forbiddenGatesTemp
            });
            // Jetzt bereinigen wir den Zwischenspeicher
            delete actor.system.forbiddenGatesTemp;
        }
    }
});

// 2. Kontextmenü-Eintrag global anhängen (chat_context.js bleibt komplett sauber!)
Hooks.on('getChatMessageContextOptions', (html, options) => {
    options.push(ForbiddenGatesHandler.getChatContextOption());
});

// 3. Burger-Menü in Dialogen aktivieren
Hooks.on('renderDialog', (app, html, data) => {
    if (game.dsa5 && game.dsa5.apps && game.dsa5.apps.RollDialogExtensions) {
        if (html.find('.skill-test').length > 0 || html.find('.dialog-buttons').length > 0) {
            game.dsa5.apps.RollDialogExtensions.bindBurgerMenu(app);
        }
    }
});

// 4. Burger-Menü Logik
Hooks.on('dsa5.getRollDialogContextOptions', (dialogState, menuItems) => {
    const { source, actor, dialog } = dialogState;

    if (!source || !["spell", "ritual"].includes(source.type)) return;
    if (!actor) return;

    const sfName = game.i18n.localize("FORBIDDENGATES.name");
    const sfAdvancedName = game.i18n.localize("FORBIDDENGATES.advancedName");

    const forbiddenGates = actor.items.find(x => x.type == "specialability" && x.name == sfName);
    const powerfulGates = actor.items.find(x => x.type == "specialability" && x.name == sfAdvancedName);

    if (!forbiddenGates) return;

    menuItems.push({
        name: sfName,
        icon: '<i class="fas fa-dungeon" style="display: inline-block; vertical-align: middle; border: none; margin: 0 5px 0 0;"></i>',
        callback: async () => {
            const selfControl = actor.items.find(i => i.name === game.i18n.localize("LocalizedIDs.selfControl") && i.type === "skill");
            let passed = false;
            const isPowerful = !!powerfulGates;
            const modifier = isPowerful ? 1 : 0;

            if (selfControl) {
                const skillTest = await actor.setupSkill(selfControl, {
                    modifier: modifier,
                    title: `${sfName} - ${game.i18n.localize("LocalizedIDs.selfControl")}`
                });
                const result = await actor.basicTest(skillTest);
                passed = result?.result?.successLevel > 0;
            }

            // Daten auf dem Actor parken, damit preCreateChatMessage sie gleich abholen kann
            actor.system.forbiddenGatesTemp = { active: true, passed, powerful: isPowerful };

            const htmlElement = dialog.element ? dialog.element : (dialog._element ? dialog._element[0] : null);
            if (htmlElement) {
                const rollButton = htmlElement.querySelector('.rollButton, button[data-action="rollButton"], button.dialog-button.roll, button.default');
                if (rollButton) rollButton.click();
            }
        }
    });
});

// --- V2 Dialog für die Kostenverteilung ---
class ForbiddenGatesDialog extends foundry.applications.api.DialogV2 {
    constructor(actor, totalCost, message, isPowerful) {
        const currentLeP = actor.system.status.wounds.value;
        const currentAsP = actor.system.status.astralenergy.value;
        const minAsP = isPowerful ? 0 : 1;

        const dialogContent = `
        <div class="forbidden-gates-dialog dsa5" style="padding: 5px;">
            <p style="margin-bottom: 15px;">${game.i18n.localize("FORBIDDENGATES.description")}</p>
            <div style="display: flex; align-items: center; justify-content: space-between; text-align: center; gap: 10px;">
                <div style="flex: 1;">
                    <label style="font-weight:bold;">${game.i18n.localize("LeP")}</label><br>
                    <span class="fg-current-lep">${currentLeP}</span>
                </div>
                <div style="flex: 1; border: 1px solid var(--color-border-dark, #777); padding: 5px; border-radius: 5px; background: rgba(0,0,0,0.05);">
                     <label>${game.i18n.localize("FORBIDDENGATES.lepCost")}</label><br>
                     <input type="number" class="fg-lep-cost" value="0" style="width: 50px; text-align: center; background: transparent; border: 1px solid #777;">
                </div>
                <div style="flex: 0.5; display: flex; gap: 5px; justify-content: center;">
                    <a class="fg-arrow" data-dir="left" style="cursor: pointer; padding: 5px 10px; background: rgba(0,0,0,0.1); border: 1px solid #777; border-radius: 3px; color: inherit; transition: 0.2s;"><i class="fas fa-chevron-left"></i></a>
                    <a class="fg-arrow" data-dir="right" style="cursor: pointer; padding: 5px 10px; background: rgba(0,0,0,0.1); border: 1px solid #777; border-radius: 3px; color: inherit; transition: 0.2s;"><i class="fas fa-chevron-right"></i></a>
                </div>
                <div style="flex: 1; border: 1px solid var(--color-border-dark, #777); padding: 5px; border-radius: 5px; background: rgba(0,0,0,0.05);">
                     <label>${game.i18n.localize("FORBIDDENGATES.aspCost")}</label><br>
                     <input type="number" class="fg-asp-cost" value="${totalCost}" style="width: 50px; text-align: center; background: transparent; border: 1px solid #777;">
                </div>
                <div style="flex: 1;">
                    <label style="font-weight:bold;">${game.i18n.localize("AsP")}</label><br>
                    <span class="fg-current-asp">${currentAsP}</span>
                </div>
            </div>
        </div>`;

        super({
            window: { title: game.i18n.localize("FORBIDDENGATES.dialogTitle"), resizable: true },
            position: { width: 520, height: "auto" },
            content: dialogContent,
            buttons: [
                {
                    action: "confirm",
                    label: game.i18n.localize("FORBIDDENGATES.confirm"),
                    icon: "fas fa-check",
                    callback: async () => await this._onConfirmPayment()
                },
                {
                    action: "cancel",
                    label: game.i18n.localize("FORBIDDENGATES.cancel"),
                    icon: "fas fa-times"
                }
            ]
        });

        this.actor = actor;
        this.totalCost = totalCost;
        this.message = message;
        this.minAsP = minAsP;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;
        if (!html) return;

        this.lepInput = html.querySelector('.fg-lep-cost');
        this.aspInput = html.querySelector('.fg-asp-cost');

        const updateValues = (lep, asp) => {
            this.lepInput.value = lep;
            this.aspInput.value = asp;
        };

        html.querySelectorAll('.fg-arrow').forEach(btn => {
            btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(0,0,0,0.2)');
            btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(0,0,0,0.1)');
            
            btn.addEventListener('click', ev => {
                const dir = ev.currentTarget.dataset.dir;
                let l = parseInt(this.lepInput.value) || 0;
                let a = parseInt(this.aspInput.value) || 0;

                if (dir === "left") {
                    if (a > this.minAsP) { a--; l++; }
                } else {
                    if (a < this.totalCost) { a++; l--; }
                }
                updateValues(l, a);
            });
        });

        const validateInput = () => {
            let l = parseInt(this.lepInput.value) || 0;
            let a = parseInt(this.aspInput.value) || 0;
            
            if (l + a !== this.totalCost || (a < this.minAsP && this.totalCost >= this.minAsP)) {
                a = Math.max(this.minAsP, this.totalCost - l);
                l = this.totalCost - a;
                if (a < this.minAsP && this.totalCost >= this.minAsP) { 
                    a = this.minAsP; 
                    l = this.totalCost - this.minAsP; 
                }
            }
            updateValues(l, a);
        };

        this.lepInput.addEventListener('change', validateInput);
        this.aspInput.addEventListener('change', validateInput);
        
        html.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('keydown', ev => {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    validateInput();
                }
            });
        });
    }

    async _onConfirmPayment() {
        const lepCost = parseInt(this.lepInput.value) || 0;
        const aspCost = parseInt(this.aspInput.value) || 0;

        if (this.actor.system.status.astralenergy.value < aspCost) {
            ui.notifications.error("DSAError.NotEnoughAsP", {localize: true});
            return;
        }
        
        if (aspCost > 0) {
            await this.actor.update({
                "system.status.astralenergy.value": this.actor.system.status.astralenergy.value - aspCost
            });
        }
        if (lepCost > 0) {
            await this.actor.applyDamage(lepCost);
        }

        await ForbiddenGatesHandler.updateMessage(this.message, aspCost, lepCost);
        this.close();
    }
}
