export class DSAAPTrackerEntry extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const { TypedObjectField, SchemaField, StringField, NumberField, DocumentUUIDField } = foundry.data.fields;

        return {
            entries: new TypedObjectField(new SchemaField({
                created: new NumberField({ required: true, initial: 0 }),
                type: new StringField({ initial: '' }),
                itemUuid: new DocumentUUIDField({ type: 'Item', required: false }),
                itemType: new StringField({ initial: '' }),
                itemName: new StringField({ initial: '' }),
                attr: new StringField({ initial: '' }),
                state: new NumberField({ initial: 0 }),
                previous: new NumberField({ initial: 0 }),
                next: new NumberField({ initial: 0 }),
                cost: new NumberField({ initial: 0 }),
                total: new StringField({ initial: '' }),
            }))
        };
    }
}
