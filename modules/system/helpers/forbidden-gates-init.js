import { ForbiddenGatesHandler } from './forbidden-gates-handler.js';

Hooks.once('init', async function() {
    await loadTemplates([
        "systems/dsa5/templates/dialog/forbidden-gates-dialog.hbs"
    ]);
});

Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
    if (game.user.id !== userId) return;

    const preData = foundry.utils.getProperty(message, "flags.data.preData") || foundry.utils.getProperty(message, "flags.dsa5.data.preData");

    if (preData && ["spell", "ritual"].includes(preData.source?.type)) {
        const actorId = preData.extra?.speaker?.actor || message.speaker?.actor;
        const actor = game.actors.get(actorId);
        
        if (actor && actor.system.forbiddenGatesTemp) {
            const temp = actor.system.forbiddenGatesTemp;
            
            message.updateSource({
                "flags.data.postData.forbiddenGates": temp,
                "flags.data.preData.extra.forbiddenGates": temp
            });
            delete actor.system.forbiddenGatesTemp;
        }
    }
});

Hooks.on('getChatMessageContextOptions', (html, options) => {
    options.push(ForbiddenGatesHandler.getChatContextOption());
});

Hooks.on('renderDialog', (app, html, data) => {
    if (game.dsa5 && game.dsa5.apps && game.dsa5.apps.RollDialogExtensions) {
        if (html.find('.skill-test').length > 0 || html.find('.dialog-buttons').length > 0) {
            game.dsa5.apps.RollDialogExtensions.bindBurgerMenu(app);
        }
    }
});

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
        icon: '<i class="fas fa-dungeon margin-right"></i>',
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
            actor.system.forbiddenGatesTemp = { active: true, passed, powerful: isPowerful };

            const htmlElement = dialog.element ? dialog.element : (dialog._element ? dialog._element[0] : null);
            if (htmlElement) {
                const rollButton = htmlElement.querySelector('.rollButton, button[data-action="rollButton"], button.dialog-button.roll, button.default');
                if (rollButton) rollButton.click();
            }
        }
    });
});
