import { DSADataModel } from "../abstract.js";

const { StringField, NumberField } = foundry.data.fields;

export default class InformationData extends DSADataModel {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), {
            qs1: new StringField({ initial: '' }),
            qs2: new StringField({ initial: '' }),
            qs3: new StringField({ initial: '' }),
            qs4: new StringField({ initial: '' }),
            qs5: new StringField({ initial: '' }),
            qs6: new StringField({ initial: '' }),
            skill: new StringField({ initial: '', required: true, label: 'TYPES.Item.skill' }),
            modifier: new NumberField({ initial: 0, label: 'Modifier' }),
            crit: new StringField({ initial: '' }),
            botch: new StringField({ initial: '' }),
            fail: new StringField({ initial: '' }),
        });
    }
}