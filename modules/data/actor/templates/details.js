import { DSADataModel } from '../../abstract.js';

const { SchemaField, StringField, NumberField, HTMLField } = foundry.data.fields;

export default class DetailsTemplate extends DSADataModel {
  static SOCIAL_STATES_CHOICES = {
    0: '-',
    1: 'SOCIAL_CLASS.slave',
    2: 'SOCIAL_CLASS.freeman',
    3: 'SOCIAL_CLASS.lessernoble',
    4: 'SOCIAL_CLASS.noble',
    5: 'SOCIAL_CLASS.highborn'
  };

  static defineSchema() {
    return {
      details: new SchemaField({
        species: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        gender: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        culture: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        career: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        socialstate: new SchemaField({
          value: new NumberField({ initial: 0, choices: this.SOCIAL_STATES_CHOICES }),
        }),
        experience: new SchemaField({
          total: new NumberField({ initial: 0 }),
          spent: new NumberField({ initial: 0 }),
        }),
        Home: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        family: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        age: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        haircolor: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        eyecolor: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        height: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        weight: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        distinguishingmark: new SchemaField({
          value: new StringField({ initial: '' }),
        }),
        biography: new SchemaField({
          value: new HTMLField({ initial: '' }),
        }),
        notes: new SchemaField({
          value: new HTMLField({ initial: '' }),
          gmdescription: new HTMLField({ initial: '' }),
          ownerdescription: new HTMLField({ initial: '' }),
        }),
      }),
    };
  }

  static _migrateData(source) {
    super._migrateData(source);

    if (typeof source.details?.socialstate?.value === 'string') {
      const social = source.details.socialstate.value.trim().toLowerCase();
      source.details.socialstate.value = 0;
      Object.values(this.SOCIAL_STATES_CHOICES).forEach((value, index) => {
        const localized = game.i18n.localize(value).toLowerCase();
        if (localized === social) {
          source.details.socialstate.value = index;
        }
      });
    }
  }
}
