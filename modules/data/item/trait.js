import APValueTemplate from "./templates/apvalue.js";
import DescriptionTemplate from "./templates/description.js";
import { DSADataModel } from "../abstract.js";
import DSA5 from '../../system/config-dsa5.js';

const { NumberField, SchemaField, StringField } = foundry.data.fields;

export default class TraitnData extends DSADataModel.mixin(DescriptionTemplate, APValueTemplate) {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), {
            traitType: new SchemaField({
                value: new StringField({ initial: 'meleeAttack', label: 'traitType', required: true, choices: DSA5.traitCategories }),
            }),
            // problem at is sometimes string and sometimes number
            at: new SchemaField({
                value: new StringField({ initial: '' }),
            }),
            pa: new NumberField({ initial: 0, label: 'CHAR.PARRY' }),
            reach: new SchemaField({
                value: new StringField({ initial: '', label: 'reach' }),
            }),
            damage: new SchemaField({
                value: new StringField({ initial: '1d6', label: 'damage' }),
            }),
            reloadTime: new SchemaField({
                value: new NumberField({ initial: 1, label: 'reloadTime' }),
                progress: new NumberField({ initial: 0 }),
            }),
            AsPCost: new SchemaField({
                value: new NumberField({ initial: 0 }),
            }),
            duration: new SchemaField({
                value: new StringField({ initial: '', label: 'duration' }),
            }),
            aspect: new SchemaField({
                value: new StringField({ initial: '' }),
            }),
            effect: new SchemaField({
                value: new StringField({ initial: '', label: 'effect' }),
                attributes: new StringField({ initial: '' }),
            }),
            step: new SchemaField({
                value: new NumberField({ initial: 0, label: 'stepValue' }),
            }),
            distribution: new StringField({ initial: '', label: 'distribution' }),
        });
    }

    static _migrateData(source) {
        super._migrateData(source);
    
        if(isNaN(source.AsPCost.value)) {
          source.AsPCost.value = Number(source.AsPCost.value) || 0;
        }
    }
}