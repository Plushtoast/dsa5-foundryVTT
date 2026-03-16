import { DSADataModel } from '../../abstract.js';

const { SchemaField, StringField, ObjectField, BooleanField, NumberField } = foundry.data.fields;

export default class RidingTemplate extends DSADataModel {
  static defineSchema() {
    return {
      horse: new SchemaField({
        actorLink: new BooleanField(),
        token: new ObjectField(),
        actorId: new StringField(),
        isRiding: new NumberField({ initial: 0, choices: {
          0: '<div data-tooltip="RIDING.mountOptions.0" style="width:100%" class="fas fa-person-hiking"></div>',
          1: '<div data-tooltip="RIDING.mountOptions.1" style="width:100%" class="fas fa-horse"></div>',
          2: '<div data-tooltip="RIDING.mountOptions.2" style="width:100%" class="fas fa-car"></div>',
        } }),
      }),
    };
  }
}
