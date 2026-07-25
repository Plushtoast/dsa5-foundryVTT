import { DSADataModel } from '../../abstract.js';

const { SchemaField, StringField, BooleanField, TypedObjectField, FilePathField } = foundry.data.fields;

export default class CompanionOwnerTemplate extends DSADataModel {
  static defineSchema() {
    return {
      companions: new TypedObjectField(new SchemaField({
        uuid: new StringField({ required: true }),
        hotbar: new BooleanField({ initial: false }),
      })),
      /** Cached summoning favorites for quick-select (uuid/name/img — no actor load on sheet prep). */
      conjurationFavorites: new TypedObjectField(new SchemaField({
        uuid: new StringField({ required: true }),
        name: new StringField({ required: true }),
        img: new FilePathField({ categories: ['IMAGE'], required: true }),
      })),
    };
  }
}
