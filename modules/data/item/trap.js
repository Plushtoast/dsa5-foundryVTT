import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';

const { NumberField, StringField } = foundry.data.fields;

export default class TrapData extends ItemDataModel.mixin(DescriptionTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
        stealth: new NumberField({ initial: 0, label: 'TRAP.stealth' }),
        trigger: new StringField({ initial: '', label: 'TRAP.trigger' }),
        tools: new StringField({ initial: '', label: 'TRAP.tools' }),
        difficulty: new NumberField({ initial: 0, label: 'Difficulty' }),
        damageText: new StringField({ initial: '', label: 'TRAP.damageText' }),
        complexity: new NumberField({ initial: 0 }),
    });
  }
}
