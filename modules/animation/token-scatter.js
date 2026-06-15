import { DSATokenDocument } from '../hooks/token.js';

export default class TokenScatter {
  static ANIMATION_DURATION = 800;
  static STAGGER_DELAY = 100;

  static scatterPositions(cx, cy, count, gridSize) {
    const positions = [];
    const radius = gridSize;

    for (let i = 0; i < count; i++) {
      const angle = ((2 * Math.PI) / count) * i + (Math.random() - 0.5) * 0.4;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      positions.push({ x, y });
    }
    return positions;
  }

  /**
   * Animate tokens on the canvas, then persist the target state to their documents.
   * Falls back to immediate document updates when the canvas is unavailable.
   * @param {TokenDocument[]} tokens
   * @param {Array<{x?: number, y?: number, alpha?: number}>} targets
   * @param {object} [options]
   * @param {number} [options.duration]
   * @param {number} [options.stagger]
   * @param {string} [options.transition]
   * @param {(token: TokenDocument, target: object) => Promise<void>} [options.persist]
   */
  static async animateThenPersist(tokens, targets, options = {}) {
    const {
      duration = this.ANIMATION_DURATION,
      stagger = this.STAGGER_DELAY,
      transition = 'swirl',
      persist,
    } = options;

    const canAnimate = canvas.ready && tokens.some((token) => token.object);

    if (!canAnimate) {
      if (persist) {
        await Promise.all(tokens.map((token, i) => {
          const target = targets[i];
          return target ? persist(token, target) : Promise.resolve();
        }));
      } else {
        const scene = tokens[0]?.parent;
        const updates = tokens
          .map((token, i) => (targets[i] ? { _id: token.id, ...targets[i] } : null))
          .filter(Boolean);
        if (scene && updates.length) {
          await scene.updateEmbeddedDocuments('Token', updates);
        }
      }
      return;
    }

    await Promise.all(tokens.map((token, i) => {
      const target = targets[i];
      if (!target) return Promise.resolve();

      return new Promise((resolve) => {
        setTimeout(async () => {
          const placeable = token.object;
          const animateTo = {};
          if (target.x !== undefined) animateTo.x = target.x;
          if (target.y !== undefined) animateTo.y = target.y;
          if (target.alpha !== undefined) animateTo.alpha = target.alpha;

          if (placeable && Object.keys(animateTo).length) {
            await placeable.animate(animateTo, { duration, transition });
          }

          if (persist) {
            await persist(token, target);
          } else {
            await token.update(target);
          }
          resolve();
        }, i * stagger);
      });
    }));
  }

  static async deploy(groupToken, memberActors) {
    if (!game.user.isGM) return;

    const scene = groupToken.scene ?? canvas.scene;
    if (!scene) return;

    const gridSize = scene.grid.size;
    const cx = groupToken.x;
    const cy = groupToken.y;

    const actors = memberActors.filter((a) => a != null);
    if (actors.length === 0) return;

    const existingTokenActorIds = new Set(
      scene.tokens.map((t) => t.actorId)
    );

    const toCreate = [];
    for (const actor of actors) {
      if (existingTokenActorIds.has(actor.id)) continue;
      toCreate.push(actor);
    }

    if (toCreate.length === 0) return;

    const positions = this.scatterPositions(cx, cy, toCreate.length, gridSize);
    const tokenDataArray = [];
    const scatterTargets = [];

    for (let i = 0; i < toCreate.length; i++) {
      const actor = toCreate[i];
      const pos = positions[i];
      const snapped = scene.grid.getSnappedPoint(pos, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX });
      const td = await actor.getTokenDocument({
        x: cx,
        y: cy,
        hidden: false,
        alpha: 0,
      });
      const data = DSATokenDocument.applySourceTokenPlacement(groupToken, td.toObject());
      data.x = cx;
      data.y = cy;
      data.alpha = 0;
      tokenDataArray.push(data);
      scatterTargets.push({ x: snapped.x, y: snapped.y, alpha: 1 });
    }

    const groupPlaceable = groupToken.object;
    if (groupPlaceable) {
      await groupPlaceable.animate(
        { alpha: 0 },
        { duration: this.ANIMATION_DURATION / 2, transition: 'swirl' }
      );
    }

    await groupToken.update({ hidden: true });

    const created = await scene.createEmbeddedDocuments('Token', tokenDataArray);

    await this.animateThenPersist(created, scatterTargets, {
      persist: (token, target) => token.update({
        x: target.x,
        y: target.y,
        alpha: target.alpha,
        'flags.dsa5.groupTokenId': groupToken.id,
      }),
    });

    await groupToken.update({
      'flags.dsa5.memberTokenIds': created.map((token) => token.id),
    });

    return created;
  }

  static async reform(groupToken) {
    if (!game.user.isGM) return;

    const scene = groupToken.scene ?? canvas.scene;
    if (!scene) return;

    const memberTokenIds = groupToken.flags?.dsa5?.memberTokenIds || [];
    if (memberTokenIds.length === 0) return;

    const cx = groupToken.x;
    const cy = groupToken.y;

    const memberTokens = memberTokenIds
      .map((id) => scene.tokens.get(id))
      .filter(Boolean);

    const gatherTargets = memberTokens.map(() => ({ x: cx, y: cy, alpha: 0 }));

    await this.animateThenPersist(memberTokens, gatherTargets, {
      persist: (token, target) => token.update({
        x: target.x,
        y: target.y,
        alpha: target.alpha,
        hidden: true,
      }),
    });

    await scene.deleteEmbeddedDocuments(
      'Token',
      memberTokens.map((t) => t.id)
    );

    await groupToken.update({ hidden: false });

    const groupPlaceable = groupToken.object;
    if (groupPlaceable) {
      await groupPlaceable.animate(
        { alpha: 1 },
        { duration: this.ANIMATION_DURATION / 2, transition: 'swirl' }
      );
    }

    await groupToken.update({
      'flags.dsa5.memberTokenIds': [],
    });
  }
}
