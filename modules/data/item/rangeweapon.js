 import DescriptionTemplate from "./templates/description.js";
 import { DSADataModel } from "../abstract.js";
 import EquipmentTemplate from "./templates/equipment.js";
import StructureTemplate from "./templates/structure.js";
import ArtifactTemplate from "./templates/artifact.js";
import DSA5 from "../../system/config-dsa5.js";
import ScopableStringField from "./fields/scopable_stringfield.js";
import ScopableNumberField from "./fields/scopable_numberfield.js";
import ObfuscableTemplate from "./templates/obfuscable.js";
 
 const { SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields;
 
 export default class RangeweaponData extends DSADataModel.mixin(DescriptionTemplate, ObfuscableTemplate, ArtifactTemplate, EquipmentTemplate, StructureTemplate) {
     static defineSchema() {
         return this.mergeSchema(super.defineSchema(), {
            ammunitiongroup: new SchemaField({
                value: new ScopableStringField({ initial: '-', label: 'ammunitiongroup', required: true, choices: DSA5.ammunitiongroups }),
            }),
            currentAmmo: new SchemaField({
                value: new StringField({ initial: '' }),
            }),
            combatskill: new SchemaField({
                value: new ScopableStringField({ initial: 'crossbows', label: 'TYPES.Item.combatskill' }),
            }),
            crit: new ScopableNumberField({ initial: 1 }),
            botch: new ScopableNumberField({ initial: 20 }),
            region: new StringField({ initial: '', label: 'PLANT.region' }),
            damage: new SchemaField({
                value: new ScopableStringField({ initial: '1d6', label: 'damage' }),
            }),
            reloadTime: new SchemaField({
                value: new ScopableNumberField({ initial: 1, label: 'reloadTime' }),
                progress: new ScopableNumberField({ initial: 0 }),
            }),
            reach: new SchemaField({
                value: new ScopableStringField({ initial: '5/25/40', label: 'reach' }),
            }),
            worn: new SchemaField({
                value: new BooleanField({ initial: false }),
            }),
         });
     }
 }