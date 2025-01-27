import { DSADataModel } from '../abstract.js';
import CharacteristicsTemplate from './templates/characteristics.js';
import DetailsTemplate from './templates/details.js';
import MagicTemplate from './templates/magic.js';
import StatusTemplate from './templates/status.js';

const { SchemaField, BooleanField } = foundry.data.fields;

export default class NpcData extends DSADataModel.mixin(CharacteristicsTemplate, StatusTemplate, DetailsTemplate, MagicTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      config: new SchemaField({
        autoBar: new BooleanField({ initial: true }),
        autoSize: new BooleanField({ initial: true }),
      }),

      sheetLocked: new SchemaField({
        value: new BooleanField({ initial: false }),
      }),
    });
  }
}
