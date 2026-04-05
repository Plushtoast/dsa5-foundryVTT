import ShapeshiftWizard from '../shapeshift_wizard.js';
import { getShapeshiftingPreset } from './shapeshifting_presets.js';

export class ShapeshiftingAPI {
  /**
   * Open the shapeshifting wizard with optional preset-backed form defaults.
   * @param {object} options
   * @param {Actor} [options.sourceActor]
   * @param {Actor} [options.targetActor]
   * @param {string} [options.sourceUuid]
   * @param {string} [options.targetUuid]
   * @param {string} [options.preset="default"]
   * @param {object} [options.overrides]
   */
  static async open(options = {}) {
    const {
      sourceActor,
      targetActor,
      sourceUuid,
      targetUuid,
      preset = 'default',
      overrides,
    } = options;

    const source = sourceActor || (sourceUuid ? await fromUuid(sourceUuid) : null);
    const target = targetActor || (targetUuid ? await fromUuid(targetUuid) : null);

    if (!source || source.documentName !== 'Actor') {
      ui.notifications.error(game.i18n.localize('Shapeshift.noSourceActor'));
      return;
    }

    if (!target || target.documentName !== 'Actor') {
      ui.notifications.error(game.i18n.localize('Shapeshift.noTargetActor'));
      return;
    }

    const formPreset = getShapeshiftingPreset(preset, overrides);
    const wizard = game.dsa5.config.hooks.shapeshift || new ShapeshiftWizard();
    game.dsa5.config.hooks.shapeshift = wizard;

    await wizard.setShapeshift(source, target, formPreset);
    await wizard.render(true);
    return wizard;
  }

  static async shapeshift(options = {}) {
    return this.open(options);
  }
}