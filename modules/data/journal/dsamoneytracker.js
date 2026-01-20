export class DSAMoneyTrackerEntry extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const { TypedObjectField, SchemaField, StringField, NumberField } = foundry.data.fields;

        return {
            entries: new TypedObjectField(new SchemaField({
                created: new NumberField({ required: true, initial: 0 }),
                type: new StringField({ initial: '' }),
                name: new StringField({ initial: '' }),
                amount: new NumberField({ initial: 1, min: 0 }),
                previous: new NumberField({ initial: 0 }),
                next: new NumberField({ initial: 0 }),
                cost: new NumberField({ initial: 0 }),
                total: new NumberField({ initial: 0 }),
            }))
        };
    }
}
