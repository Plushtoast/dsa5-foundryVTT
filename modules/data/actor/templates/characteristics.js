import { DSADataModel } from "../../abstract.js";

const { SchemaField, NumberField } = foundry.data.fields;

export default class CharacteristicsTemplate extends DSADataModel {
  
    static defineSchema() {
        return {
            characteristics: new SchemaField({
                mu: new SchemaField({
                    initial: new NumberField({ initial: 8 }),
                    species: new NumberField({ initial: 0 }),
                    modifier: new NumberField({ initial: 0 }),
                    advances: new NumberField({ initial: 0 }),
                }),
                kl: new SchemaField({
                    initial: new NumberField({ initial: 8 }),
                    species: new NumberField({ initial: 0 }),
                    modifier: new NumberField({ initial: 0 }),
                    advances: new NumberField({ initial: 0 }),
                }),
                in: new SchemaField({
                    initial: new NumberField({ initial: 8 }),
                    species: new NumberField({ initial: 0 }),
                    modifier: new NumberField({ initial: 0 }),
                    advances: new NumberField({ initial: 0 }),
                }),
                ch: new SchemaField({
                    initial: new NumberField({ initial: 8 }),
                    species: new NumberField({ initial: 0 }),
                    modifier: new NumberField({ initial: 0 }),
                    advances: new NumberField({ initial: 0 }),
                }),
                ff: new SchemaField({
                    initial: new NumberField({ initial: 8 }),
                    species: new NumberField({ initial: 0 }),
                    modifier: new NumberField({ initial: 0 }),
                    advances: new NumberField({ initial: 0 }),
                }),
                ge: new SchemaField({
                    initial: new NumberField({ initial: 8 }),
                    species: new NumberField({ initial: 0 }),
                    modifier: new NumberField({ initial: 0 }),
                    advances: new NumberField({ initial: 0 }),
                }),
                ko: new SchemaField({
                    initial: new NumberField({ initial: 8 }),
                    species: new NumberField({ initial: 0 }),
                    modifier: new NumberField({ initial: 0 }),
                    advances: new NumberField({ initial: 0 }),
                }),
                kk: new SchemaField({
                    initial: new NumberField({ initial: 8 }),
                    species: new NumberField({ initial: 0 }),
                    modifier: new NumberField({ initial: 0 }),
                    advances: new NumberField({ initial: 0 }),
                }),
            }),
            sheetLocked: new SchemaField({
              value: new BooleanField({ initial: false }),
            }),
        }
    }
}