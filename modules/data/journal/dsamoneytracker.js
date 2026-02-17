export class DSAMoneyTrackerEntry extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const { TypedObjectField, SchemaField, StringField, NumberField } = foundry.data.fields;

        return {
            entries: new TypedObjectField(new SchemaField({
                created: new NumberField({ required: true, initial: 0, label: 'TRACKER.FIELDS.money.entries.created.label' }),
                type: new StringField({ initial: '', label: 'TRACKER.FIELDS.money.entries.type.label' }),
                name: new StringField({ initial: '', label: 'TRACKER.FIELDS.money.entries.name.label' }),
                amount: new NumberField({ initial: 1, min: 0, label: 'TRACKER.FIELDS.money.entries.amount.label' }),
                previous: new NumberField({ initial: 0, label: 'TRACKER.FIELDS.money.entries.previous.label' }),
                next: new NumberField({ initial: 0, label: 'TRACKER.FIELDS.money.entries.next.label' }),
                cost: new NumberField({ initial: 0, label: 'TRACKER.FIELDS.money.entries.cost.label' }),
                total: new NumberField({ initial: 0, label: 'TRACKER.FIELDS.money.entries.total.label' }),
            }))
        };
    }
}
