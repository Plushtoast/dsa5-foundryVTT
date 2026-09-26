import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import { DSATrapRegionBehavior } from '../regionbehaviors/trap.js';
import AoeTemplate from './templates/aoe.js';
import InformableTemplate from './templates/informable.js';
import TrapAutomation from '../../system/automation/trap.js';
import TrapFlow from '../../system/automation/trap-flow.js';
import TrapLegacyMigration from '../../system/automation/trap-legacy-migration.js';

const { StringField } = foundry.data.fields;

export default class TrapData extends ItemDataModel.mixin(DescriptionTemplate, AoeTemplate, InformableTemplate) {
  static LOCALIZATION_PREFIXES = ["REGIONBEHAVIOR_DSATrap"];
  static SOCKET_TYPE = 'trapDrop';

  static canCreateOnScene(scene = canvas.scene, user = game.user) {
    return Boolean(scene?.canUserModify?.(user, 'update'));
  }

  static isTrustedSocketDrop(item, payload = {}, requester) {
    if (item?.type !== 'trap' || !requester) return false;
    const ownerDoc = item.parent?.documentName === 'Actor' ? item.parent : item;
    if (!ownerDoc.testUserPermission?.(requester, 'OWNER')) return false;
    const scene = game.scenes.get(payload.sceneId);
    if (!scene?.testUserPermission?.(requester, 'OBSERVER')) return false;
    return Number.isFinite(Number(payload.x)) && Number.isFinite(Number(payload.y));
  }

  static async handleSocketDrop(payload = {}) {
    const scene = game.scenes.get(payload.sceneId);
    if (!scene || !this.canCreateOnScene(scene)) return;
    const requester = game.users.get(payload.userId);
    const item = await fromUuid(payload.itemUuid);
    if (!this.isTrustedSocketDrop(item, payload, requester)) return;
    return item.system.createRegionBehavior({
      x: Number(payload.x),
      y: Number(payload.y),
      sceneId: payload.sceneId,
      levelId: payload.levelId,
      fromSocket: true,
    });
  }

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

    const systemSource = this.toObject();
    for (const key of Object.keys(DSATrapRegionBehavior.sharedSchema())) {
      if (systemSource[key] !== undefined) data.system[key] = systemSource[key];
    }

    data.system.charges = (await new Roll(this.charges).evaluate()).total || 0;
    data.system.remainingCharges = data.system.charges;

    TrapAutomation.attachPayloadToBehaviorData(data, this.parent);

    return data;
  }

  static DEFAULT_DROP_SHAPE = { type: 'cube', value: 1 };

  resolveDropShape() {
    const fallback = this.constructor.DEFAULT_DROP_SHAPE;
    return {
      type: this.target?.type || fallback.type,
      value: Number(this.target?.value) || fallback.value,
      width: this.target?.width || 1,
    };
  }

  makeShape(data, scene = canvas.scene) {
    const gridSize = scene?.grid?.size;
    if (!gridSize) return;

    const resolved = this.resolveDropShape();
    const shape = {
      x: data.x,
      y: data.y,
    }
    const value = resolved.value;
    const width = resolved.width || 1;

    switch (resolved.type) {
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
        ui.notifications.warn("Cone templates are currently not supported");
        return;
      default:
        return;
    }
    return shape;
  }

  async createRegionBehavior(data = {}) {
    const scene = (data.sceneId && game.scenes.get(data.sceneId)) || canvas.scene;
    if (!scene) return;

    if (!this.constructor.canCreateOnScene(scene)) {
      if (data.fromSocket) return;
      if (!game.users.activeGM) {
        ui.notifications.warn('DSAError.requiresGM', { localize: true });
        return;
      }
      game.socket.emit('system.dsa5', {
        type: this.constructor.SOCKET_TYPE,
        payload: {
          itemUuid: this.parent.uuid,
          x: data.x,
          y: data.y,
          sceneId: scene.id,
          levelId: data.levelId || canvas.level?.id,
          userId: game.user.id,
        },
      });
      return;
    }

    if (scene === canvas.scene && canvas.regions && !canvas.regions.active) await canvas.regions.activate();

    const behavior = await this.toRegionBehavior();
    const shape = this.makeShape(data, scene);
    const takenNames = new Set((scene.regions ?? canvas.regions?.documentCollection ?? []).map((entry) => entry.name));
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
    const levelId = data.levelId || (scene === canvas.scene ? canvas.level?.id : null);
    if (levelId) region.levels = [levelId];

    const [created] = await scene.createEmbeddedDocuments("Region", [region]);
    return created;
  }

  async applyToRegion(region) {
    if (!region) return null;
    const behavior = await this.toRegionBehavior();
    const [created] = await region.createEmbeddedDocuments('RegionBehavior', [behavior]);
    return created;
  }

  static async handleRegionSheetDrop(region, event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data?.type !== 'Item' || !region) return false;
    const item = await Item.implementation.fromDropData(data);
    if (item?.type !== 'trap') return false;
    await item.system.applyToRegion(region);
    return true;
  }

  flowTypes(kind) {
    return TrapFlow.types(this.schema, kind);
  }

  async addFlowEntry(kind, type) {
    return TrapFlow.addEntry(this.parent, this.schema, kind, type);
  }

  async removeFlowEntry(kind, id) {
    return TrapFlow.removeEntry(this.parent, this.schema, kind, id);
  }

  static _migrateData(source) {
    super._migrateData(source);
    TrapAutomation.migrateSource(source);
    TrapLegacyMigration.materialize(source);
  }
}
