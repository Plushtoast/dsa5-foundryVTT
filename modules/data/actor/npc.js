import { ActorDataModel } from '../baseactor.js';
import CharacteristicsTemplate from './templates/characteristics.js';
import DetailsTemplate from './templates/details.js';
import MagicTemplate from './templates/magic.js';
import MerchantTemplate from './templates/merchant.js';
import RidingTemplate from './templates/riding.js';
import StatusTemplate from './templates/status.js';

const { SchemaField, BooleanField } = foundry.data.fields;

export default class NpcData extends ActorDataModel.mixin(RidingTemplate, CharacteristicsTemplate, MerchantTemplate, StatusTemplate, DetailsTemplate, MagicTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      config: new SchemaField({
        autoBar: new BooleanField({ initial: true }),
        autoSize: new BooleanField({ initial: true }),
        lockRotation: new BooleanField({ initial: false }),
      }),
    });
  }
}
