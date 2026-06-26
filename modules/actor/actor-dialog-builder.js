import DSA5 from "../config/config-dsa5.js";
import { RollDialogBuilder } from "../dialog/dialog-builder.js";
import DSA5StatusEffects from "../status/status_effects.js";
import { SituationalModifiersWidget } from "../system/helpers/situational-modifiers-widget.js";
import DiceDSA5 from "../system/rolls/dice-dsa5.js";
import { RegenerationModifiers } from "./concerns/regeneration-modifiers.js";
const { mergeObject } = foundry.utils;
export class ActorDialogBuilder extends RollDialogBuilder {
    static createRegenerationDialog(statusId, options, tokenId, actor) {
        const title = _loc('regenerationTest');
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
                messageMode: options.messageMode,
                regenerationInterruptOptions: DSA5.regenerationInterruptOptions,
                regnerationCampLocations: DSA5.regnerationCampLocations,
                showAspModifier: actor.system.isMage,
                showKapModifier: actor.system.isPriest,
                specialAbilityOptions: RegenerationModifiers.getSpecialAbilityOptions(actor),
                situationalModifiers,
                modifier: options.modifier || 0,
            },
            callback: (html, options = {}) => {
                testData.situationalModifiers = SituationalModifiersWidget.collectFormModifiers(html);
                cardOptions.messageMode = html.find('[name="messageMode"]:checked').val();
                testData.situationalModifiers.push(
                    {
                        name: _loc('camplocation') + ' - ' + html.find('[name="regnerationCampLocations"] option:selected').text(),
                        value: html.find('[name="regnerationCampLocations"]').val(),
                    },
                    {
                        name: _loc('interruption') + ' - ' + html.find('[name="regenerationInterruptOptions"] option:selected').text(),
                        value: html.find('[name="regenerationInterruptOptions"]').val(),
                    },
                );
                testData.regenerationFactor = html.find('[name="badEnvironment"]').is(':checked') ? 0.5 : 1;
                const attrs = ['LeP', 'KaP', 'AsP'];
                const update = {};
                for (const k of attrs) {
                    testData[`${k}Modifier`] = Number(html.find(`[name="${k}Modifier"]`).val() || 0);
                    testData[`regeneration${k}`] = Number(actor.system.status.regeneration[`${k}max`]);
                    const regenerate = html.find(`[name="regenerate${k}"]`).is(':checked') ? 1 : 0;
                    testData[`regenerate${k}`] = regenerate;
                    if (regenerate) update[`system.status.regeneration.${k}Temp`] = 0;
                }
                Object.assign(testData, RegenerationModifiers.collectSpecialAbilityChoices(html));
                RegenerationModifiers.applySpecialAbilityRollOptions(testData, actor);
                mergeObject(testData.extra.options, options);
                actor.update(update);
                return { testData, cardOptions };
            },
        };
        return DiceDSA5.setupDialog({ testData, cardOptions, dialogOptions });
    }
}