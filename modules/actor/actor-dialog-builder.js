import DSA5 from "../config/config-dsa5.js";
import { RollDialogBuilder } from "../dialog/dialog-builder.js";
import { ModifierCalculator } from "../item/concerns/modifier-calculator.js";
import DSA5StatusEffects from "../status/status_effects.js";
import DiceDSA5 from "../system/rolls/dice-dsa5.js";
import Actordsa5 from "./actor-dsa5.js";
import { RegenerationModifiers } from "./concerns/regeneration-modifiers.js";

const { mergeObject, getProperty } = foundry.utils;

export class ActorDialogBuilder extends RollDialogBuilder {
    static createRegenerationDialog(statusId, options, tokenId, actor) {
        const title = game.i18n.localize('regenerationTest');
        const item = { type: 'regenerate', system: {} };
        const template = 'systems/dsa5/templates/chat/roll/regeneration-card.hbs';

        const { testData, cardOptions } = this.createBaseConfig(item, actor, tokenId, options, template, title)

        testData.opposable = false;
        testData.extra.statusId = statusId;

        const situationalModifiers = DSA5StatusEffects.getRollModifiers(actor, item);
        situationalModifiers.push(...RegenerationModifiers.get(actor));

        const dialogOptions = {
            title,
            template: 'systems/dsa5/templates/dialog/regeneration-dialog.hbs',
            data: {
                rollMode: options.rollMode,
                regenerationInterruptOptions: DSA5.regenerationInterruptOptions,
                regnerationCampLocations: DSA5.regnerationCampLocations,
                showAspModifier: actor.system.isMage,
                showKapModifier: actor.system.isPriest,
                situationalModifiers,
                modifier: options.modifier || 0,
            },
            callback: (html, options = {}) => {
                testData.situationalModifiers = ModifierCalculator._parseModifiers(html);
                cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
                testData.situationalModifiers.push(
                    {
                        name: game.i18n.localize('camplocation') + ' - ' + html.find('[name="regnerationCampLocations"] option:selected').text(),
                        value: html.find('[name="regnerationCampLocations"]').val(),
                    },
                    {
                        name: game.i18n.localize('interruption') + ' - ' + html.find('[name="regenerationInterruptOptions"] option:selected').text(),
                        value: html.find('[name="regenerationInterruptOptions"]').val(),
                    },
                );
                testData.regenerationFactor = html.find('[name="badEnvironment"]').is(':checked') ? 0.5 : 1;
                const attrs = ['LeP', 'KaP', 'AsP'];
                const update = {};
                for (let k of attrs) {
                    testData[`${k}Modifier`] = Number(html.find(`[name="${k}Modifier"]`).val() || 0);
                    testData[`regeneration${k}`] = Number(actor.system.status.regeneration[`${k}max`]);
                    const regenerate = html.find(`[name="regenerate${k}"]`).is(':checked') ? 1 : 0;
                    testData[`regenerate${k}`] = regenerate;
                    if (regenerate) update[`system.status.regeneration.${k}Temp`] = 0;
                }

                mergeObject(testData.extra.options, options);
                actor.update(update);
                return { testData, cardOptions };
            },
        };

        return DiceDSA5.setupDialog({ testData, cardOptions, dialogOptions });
    }

}