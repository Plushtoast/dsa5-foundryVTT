import { JournalListDataModel } from './journallistdatamodel.js';

const { TextEditor } = foundry.applications.ux;

export class DSACityDetailsEntry extends JournalListDataModel {
    static CREATION_CONFIG = {
        pageType: 'citydetails',
        entryCollection: 'details',
        defaultName: 'DSACITYDETAILS.Name',
        dialogTitle: 'DSACITYDETAILS.CreateDetail',
    };

    static KIND_CHOICES = {
        temples: 'DSACITYDETAILS.KIND.temples',
        inns: 'DSACITYDETAILS.KIND.inns',
        taverns: 'DSACITYDETAILS.KIND.taverns',
        crafts: 'DSACITYDETAILS.KIND.crafts',
        merchants: 'DSACITYDETAILS.KIND.merchants',
        services: 'DSACITYDETAILS.KIND.services',
        healers: 'DSACITYDETAILS.KIND.healers',
        travellers: 'DSACITYDETAILS.KIND.travellers',
    };

    static QUALITY_CHOICES = {
        5: 'DSACITYDETAILS.QUALITY.5',
        4: 'DSACITYDETAILS.QUALITY.4',
        3: 'DSACITYDETAILS.QUALITY.3',
        2: 'DSACITYDETAILS.QUALITY.2',
        1: 'DSACITYDETAILS.QUALITY.1',
        0: 'DSACITYDETAILS.QUALITY.0',
    };

    static QUALITY_KIND_KEYS = {
        temples: 'temples',
        inns: 'inns',
        taverns: 'taverns',
        crafts: 'crafts',
        merchants: 'merchants',
        services: 'services',
        healers: 'healers',
        travellers: 'travellers',
    };

    static PRICE_CHOICES = {
        0: 'DSACITYDETAILS.PRICE.0',
        1: 'DSACITYDETAILS.PRICE.1',
        2: 'DSACITYDETAILS.PRICE.2',
        3: 'DSACITYDETAILS.PRICE.3',
        4: 'DSACITYDETAILS.PRICE.4',
        5: 'DSACITYDETAILS.PRICE.5',
    };

    static PRICE_PERCENT_BY_ROW = [70, 85, 100, 120, 150, 400];

    static defineSchema() {
        const { TypedObjectField, SchemaField, StringField, NumberField, BooleanField, HTMLField, FilePathField } = foundry.data.fields;

        return {
            details: new TypedObjectField(new SchemaField({
                name: new StringField({ required: true, initial: 'New Entry', label: 'DSACITYDETAILS.FIELDS.details.name.label' }),
                kind: new StringField({ required: true, initial: 'merchants', choices: DSACityDetailsEntry.KIND_CHOICES, label: 'DSACITYDETAILS.FIELDS.details.kind.label' }),
                typeText: new StringField({ label: 'DSACITYDETAILS.FIELDS.details.typeText.label' }),
                description: new HTMLField({ label: 'DSACITYDETAILS.FIELDS.details.description.label' }),
                gmNotes: new HTMLField({ label: 'DSACITYDETAILS.FIELDS.details.gmNotes.label' }),
                img: new FilePathField({ categories: ['IMAGE'], label: 'DSACITYDETAILS.FIELDS.details.img.label' }),
                visible: new BooleanField({ initial: true, label: 'DSACITYDETAILS.FIELDS.details.visible.label' }),
                qualityRowIndex: new NumberField({ nullable: true, initial: null, choices: DSACityDetailsEntry.QUALITY_CHOICES, label: 'DSACITYDETAILS.FIELDS.details.qualityRowIndex.label' }),
                priceRowIndex: new NumberField({ nullable: true, initial: 2, choices: DSACityDetailsEntry.PRICE_CHOICES, label: 'DSACITYDETAILS.FIELDS.details.priceRowIndex.label' }),
            })),
        };
    }

    static createEntryData(options = {}) {
        const detail = foundry.utils.mergeObject({
            name: _loc('DSACITYDETAILS.newEntryPlaceholder'),
            kind: 'merchants',
            typeText: '',
            description: '',
            gmNotes: '',
            img: '',
            visible: true,
            qualityRowIndex: null,
            priceRowIndex: 2,
        }, options, { inplace: false });

        detail.kind = this.resolveKind(detail.kind);
        return detail;
    }

    static async prepareCityDetail(entry, { page = null, key = null } = {}) {
        entry.kind = this.resolveKind(entry.kind);
        entry.kindLabel = _loc(this.KIND_CHOICES[entry.kind] || this.KIND_CHOICES.merchants);
        entry.preparedDescription = await TextEditor.enrichHTML(entry.description || '', { secrets: game.user.isGM });
        entry.preparedGMNotes = await TextEditor.enrichHTML(entry.gmNotes || '', { secrets: game.user.isGM });
        entry.hasImage = !!entry.img;
        entry.hasTypeText = !!entry.typeText?.trim();
        entry.qualityQS = entry.qualityRowIndex ? 6 - entry.qualityRowIndex : null;
        entry.priceQS = entry.priceRowIndex ? 1 + entry.priceRowIndex : null;
        entry.pricePercent = this.PRICE_PERCENT_BY_ROW[entry.priceRowIndex] ?? 100;
        entry.qualityText = entry.qualityQS === null ? '' : this.resolveQualityLabel(entry.kind, entry.qualityRowIndex);
        entry.priceText = _loc(this.PRICE_CHOICES[entry.priceRowIndex] || this.PRICE_CHOICES[2]);
        entry.hasQuality = entry.qualityQS !== null;
        entry.hasPrice = entry.priceRowIndex !== null && entry.priceRowIndex !== undefined;
        entry.uuid = page?.uuid;
        entry.detailKey = key;
    }

    static resolveKind(kind) {
        if (kind && Object.hasOwn(this.KIND_CHOICES, kind)) return kind;

        const pluralized = `${kind}s`;
        if (kind && Object.hasOwn(this.KIND_CHOICES, pluralized)) return pluralized;

        return 'merchants';
    }

    static resolveQualityLabel(kind, rowIndex) {
        const qualityKind = this.QUALITY_KIND_KEYS[this.resolveKind(kind)] || 'generic';
        const sectionKey = `DSACITYDETAILS.QUALITY_BY_KIND.${qualityKind}.${rowIndex}`;
        if (game.i18n.has(sectionKey)) return _loc(sectionKey);
        return _loc(this.QUALITY_CHOICES[rowIndex] || this.QUALITY_CHOICES[5]);
    }
}