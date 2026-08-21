import { ItemCreateDialog } from '../item/item-create-dialog.js';
import MerchantModeHelper from './concerns/merchant-mode.js';
import MerchantConfig from '../config/merchant-config.js';

export class ActorCreateDialog extends ItemCreateDialog {
  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'item-create-dialog', 'actor-create-dialog'],
    position: {
      width: 400,
      height: 640,
    },
    window: {
      title: 'DOCUMENT.Create',
      resizable: true,
    },
  };

  static TYPE_HINTS = {
    character: 'TYPES.Actor.characterHint',
    npc: 'TYPES.Actor.npcHint',
    creature: 'TYPES.Actor.creatureHint',
    vehicle: 'TYPES.Actor.vehicleHint',
    group: 'TYPES.Actor.groupHint',
  };

  _buildDocumentTypes(restrictedTypes) {
    const types = super._buildDocumentTypes(restrictedTypes);
    const images = MerchantConfig.CREATE_TYPE_IMAGES;
    for (const entry of types) {
      entry.img = images[entry.value] || 'icons/svg/mystery-man-black.svg';
      entry.hint ??= this.constructor.TYPE_HINTS[entry.value];
    }

    const allowSynthetic = !restrictedTypes?.length || restrictedTypes.includes('npc');
    if (allowSynthetic) types.push(...MerchantModeHelper.createDialogTypes());

    types.sort((left, right) => left.label.localeCompare(right.label, game.i18n.lang));
    return types;
  }

  _prepareCreateData(data) {
    if (!data.name?.trim()) data.name = this._defaultName(data.type);
    return MerchantModeHelper.prepareCreateData(data);
  }
}
