import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import { DSATrapRegionBehavior } from '../regionbehaviors/trap.js';
import AoeTemplate from './templates/aoe.js';

const { StringField } = foundry.data.fields;

export default class TrapData extends ItemDataModel.mixin(DescriptionTemplate, AoeTemplate) {
  static LOCALIZATION_PREFIXES = ["REGIONBEHAVIOR_DSATrap"];

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(),
      {
        ...DSATrapRegionBehavior.sharedSchema(),
        charges: new StringField({ initial: "0", required: true }),
      }
    );
  }

  async toRegionBehavior() {
    const data = {
      type: 'DSATrap',
      name: this.parent.name,
      system: {
        description: this.description.value,
        gmdescription: this.gmdescription.value,
      }
    }

    for (const key of Object.keys(DSATrapRegionBehavior.sharedSchema())) {
      if (this[key] !== undefined) data.system[key] = this[key];
    }

    data.system.charges = (await new Roll(this.charges).evaluate()).total

    return data;
  }

  makeShape(data) {
    const gridSize = canvas.scene.grid.size;

    const shape = {
      x: data.x,
      y: data.y,
    }
    const value = Number(this.target.value) || 1;
    const width = this.target.width || 1;

    switch (this.target.type) {
      case 'cube':
        shape.type = 'rectangle'
        shape.width = value * gridSize;
        shape.height = value * gridSize;
        break;
      case 'line':
        shape.type = 'rectangle'
        shape.width = value * gridSize;
        shape.height = width * gridSize;
        break;
      case 'sphere':
        shape.type = 'ellipse'
        shape.radiusX = value * gridSize;
        shape.radiusY = value * gridSize;
        break;
      case 'cone':
        ui.notifications.warn(game.i18n.localize("Cone templates are currently not supported"));
        return;
      default:
        return;
    }
    return shape;
  }

  async createRegionBehavior(data) {
    if (!canvas.regions.active) await canvas.regions.activate()

    const behavior = await this.toRegionBehavior();
    const shape = this.makeShape(data);
    const takenNames = new Set(canvas.regions.documentCollection.map(x => x.name));
    let name = this.parent.name;
    let index = 0;
    while (takenNames.has(name)) {
      name = `${this.parent.name} (${++index})`;
    }

    const region = {
      name,
      behaviors: [behavior]
    }

    if (shape) region.shapes = [shape];

    await canvas.scene.createEmbeddedDocuments("Region", [region])
  }

  static _migrateData(source) {
    super._migrateData(source);

    if (typeof source.trigger === "string") {
      source.trigger = 0;
    }

    if (source.damageText) {
      source.damageFormula = source.damageText;
      delete source.damageText;
    }
  }
}
