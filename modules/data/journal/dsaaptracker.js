export class DSAAPTrackerEntry extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const { TypedObjectField, SchemaField, StringField, NumberField, DocumentUUIDField } = foundry.data.fields;

        return {
            entries: new TypedObjectField(new SchemaField({
                created: new NumberField({ required: true, initial: 0, label: 'TRACKER.FIELDS.ap.entries.created.label' }),
                type: new StringField({ initial: '', label: 'TRACKER.FIELDS.ap.entries.type.label' }),
                itemUuid: new DocumentUUIDField({ type: 'Item', required: false, label: 'TRACKER.FIELDS.ap.entries.itemUuid.label' }),
                itemType: new StringField({ initial: '', label: 'TRACKER.FIELDS.ap.entries.itemType.label' }),
                itemName: new StringField({ initial: '', label: 'TRACKER.FIELDS.ap.entries.itemName.label' }),
                attr: new StringField({ initial: '', label: 'TRACKER.FIELDS.ap.entries.attr.label' }),
                state: new NumberField({ initial: 0, label: 'TRACKER.FIELDS.ap.entries.state.label' }),
                previous: new NumberField({ initial: 0, label: 'TRACKER.FIELDS.ap.entries.previous.label' }),
                next: new NumberField({ initial: 0, label: 'TRACKER.FIELDS.ap.entries.next.label' }),
                cost: new NumberField({ initial: 0, label: 'TRACKER.FIELDS.ap.entries.cost.label' }),
                total: new StringField({ initial: '', label: 'TRACKER.FIELDS.ap.entries.total.label' }),
            }))
        };
    }
}
