import DSA5_Utility from '../helpers/utility-dsa5.js';
import DPS from './derepositioningsystem.js';
import DSAActiveEffectConfig from '../../status/active_effect_config.js';

export class DSARegionTemplate {

  static async placeTemplateFromChat(ev) {
    const id = $(ev.currentTarget).parents('.message').attr('data-message-id');
    const message = game.messages.get(id);
    const preData = message.flags.data.preData;
    const testData = message.flags.data.postData;

    const actor = DSA5_Utility.getSpeaker(preData.extra.speaker);
    const source = actor.items.get(preData.source._id);

    const regionData = this.buildRegionData(source, testData.qualityStep, id);
    if (!regionData) return;

    const hasDuration = !!source.system.duration?.value;
    const casterToken = actor.getActiveTokens()[0];
    const maxRange = Number(source.system.range?.value) || Infinity;

    const casterCenter = casterToken?.center;

    const region = await canvas.regions.placeRegion(regionData, {
      create: hasDuration,
      onMove({ document: regionDoc, shape, position }) {
        if (casterCenter) {
          if (shape.rotation !== undefined) {
            const angle = Math.toDegrees(Math.atan2(
              position.y - casterCenter.y,
              position.x - casterCenter.x
            ));
            shape.updateSource({ rotation: angle });
          }
          if (maxRange !== Infinity) {
            const dist = DPS.rangeFinder(casterCenter, { x: shape.x, y: shape.y });
            const inRange = dist.distanceSum <= maxRange;
            regionDoc.updateSource({ color: inRange ? '#00FF00' : '#FF0000' });
          }
        }
      }
    });

    if (!region) return;

    const targets = this.acquireTargetsFromRegion(region);

    if (targets.length) {
      const regionEvent = {
        source: 'spellTemplate',
        name: 'templatePlaced',
        trigger: 'templatePlaced',
        hasMovement: false,
        userId: game.user.id,
        regionUuid: region.uuid,
        behaviorUuid: region.behaviors.contents[0]?.uuid ?? null,
        tokenUuid: null,
        actorUuid: null,
      };

      await DSAActiveEffectConfig.applyEffect(id, 'target',
        targets.map(a => ({
          token: a.token?.id,
          actor: a.id,
          scene: canvas.scene.id,
        })),
        { regionEvent }
      );
    }

    if (hasDuration) {
      await message.update({ 'flags.dsa5.regionId': region.id });
      const duration = await DSAActiveEffectConfig.parseDurationValue(
        source.system?.duration?.value, testData.qualityStep
      );
      const [trackingAE] = await actor.createEmbeddedDocuments('ActiveEffect', [{
        name: `${source.name} (Zone)`,
        img: source.img,
        duration,
        flags: { dsa5: { regionId: region.id, sceneId: canvas.scene.id } },
      }]);
      await region.update({
        'flags.dsa5.trackingActorId': actor.id,
        'flags.dsa5.trackingAEId': trackingAE.id,
      });
    }
  }

  static buildRegionData(item, qs, messageId) {
    const target = item.system.target || {};
    const templateShape = game.dsa5.config.areaTargetTypes[target.type];
    if (!templateShape || !target.value) return null;

    const distance = Number(Roll.safeEval(`${target.value}`.replace(/(qs|ql)/gi, qs))) || 1;
    const pixelDistance = distance * canvas.scene.grid.size / canvas.scene.grid.distance;

    const shape = { type: templateShape, x: 0, y: 0, gridBased: false };

    switch (templateShape) {
      case 'circle':
        shape.radius = pixelDistance;
        break;
      case 'cone': {
        const angle = Number(target.angle) || 53.13;
        shape.radius = pixelDistance;
        shape.angle = angle;
        shape.rotation = 0;
        break;
      }
      case 'rectangle':
        shape.width = pixelDistance;
        shape.height = pixelDistance;
        shape.rotation = 0;
        break;
      case 'line': {
        const width = target.width
          ? Number(Roll.safeEval(`${target.width}`.replace(/(qs|ql)/gi, qs))) || canvas.scene.grid.distance
          : canvas.scene.grid.distance;
        shape.length = pixelDistance;
        shape.width = width * canvas.scene.grid.size / canvas.scene.grid.distance;
        shape.rotation = 0;
        break;
      }
      case 'ring': {
        const inner = target.innerWidth
          ? Number(Roll.safeEval(`${target.innerWidth}`.replace(/(qs|ql)/gi, qs))) || 0
          : 0;
        const outer = target.outerWidth
          ? Number(Roll.safeEval(`${target.outerWidth}`.replace(/(qs|ql)/gi, qs))) || 0
          : 0;
        shape.radius = pixelDistance;
        shape.innerWidth = inner * canvas.scene.grid.size / canvas.scene.grid.distance;
        shape.outerWidth = outer * canvas.scene.grid.size / canvas.scene.grid.distance;
        break;
      }
    }

    return {
      name: item.name,
      color: game.user.color,
      restriction: { enabled: true },
      shapes: [shape],
      behaviors: [{
        type: 'DSAZone',
        system: { messageId },
      }],
      flags: {
        dsa5: {
          origin: item.uuid,
          messageId,
        },
      },
    };
  }

  static acquireTargetsFromRegion(region) {
    const targets = [];
    const candidates = canvas.tokens.quadtree.getObjects(region.bounds);
    for (const token of candidates) {
      if (token.document.testInsideRegion(region)) {
        if (token.actor) targets.push(token.actor);
      }
    }
    return targets;
  }

  static getDistanceFromRegionCenter(region, tokenDoc) {
    const gridSize = canvas.scene.grid.size;
    const shape = region.shapes[0];
    const origin = { x: shape.x, y: shape.y };
    const tokenCenter = tokenDoc.object.getCenterPoint();
    const ray = new foundry.canvas.geometry.Ray(origin, tokenCenter);
    const tileDistance = ray.distance / gridSize;
    const distance = tileDistance * canvas.scene.grid.distance;
    const elevation = Math.abs(
      (tokenDoc.elevation || 0) - (region.elevation?.bottom || 0)
    );
    return Math.hypot(distance, elevation);
  }
}
