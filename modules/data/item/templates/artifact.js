import { DSADataModel } from '../../abstract.js';

const { StringField, BooleanField } = foundry.data.fields;
import DSA5 from '../../../system/config-dsa5.js';

export default class ArtifactTemplate extends DSADataModel {
  static defineSchema() {
    return {
      artifact: new StringField({
        label: 'SpecCategory.staff',
        choices: Object.fromEntries(Object.entries(DSA5.traditionArtifacts).map(([key]) => [key, `traditionArtifacts.${key}`])),
      }),
    };
  }
}
