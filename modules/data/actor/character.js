import { ActorDataModel } from '../baseactor.js';
import CharacteristicsTemplate from './templates/characteristics.js';
import CompanionOwnerTemplate from './templates/companion-owner.js';
import DetailsTemplate from './templates/details.js';
import MagicTemplate from './templates/magic.js';
import MerchantTemplate from './templates/merchant.js';
import RidingTemplate from './templates/riding.js';
import StatusTemplate from './templates/status.js';

const { SchemaField, NumberField, BooleanField } = foundry.data.fields;

export default class CharacterData extends ActorDataModel.mixin(RidingTemplate, CompanionOwnerTemplate, CharacteristicsTemplate, MerchantTemplate, DetailsTemplate, StatusTemplate, MagicTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      config: new SchemaField({
        autoBar: new BooleanField({ initial: true }),
        autoSize: new BooleanField({ initial: true }),
        ignoreWeaponHandLimits: new BooleanField({ initial: false }),
        lockRotation: new BooleanField({ initial: false }),
      }),
      freeLanguagePoints: new SchemaField({
        value: new NumberField({ initial: 0 }),
        used: new NumberField({ initial: 0 }),
      }),
    });
  }
}
