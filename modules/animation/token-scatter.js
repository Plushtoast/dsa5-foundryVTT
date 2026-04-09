export default class TokenScatter {
  static ANIMATION_DURATION = 800;
  static STAGGER_DELAY = 100;

  static scatterPositions(cx, cy, count, gridSize) {
    const positions = [];
    const radius = Math.ceil(Math.sqrt(count)) * gridSize;

    for (let i = 0; i < count; i++) {
      const angle = ((2 * Math.PI) / count) * i + (Math.random() - 0.5) * 0.4;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      positions.push({ x, y });
    }
    return positions;
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

    for (let i = 0; i < toCreate.length; i++) {
      const actor = toCreate[i];
      const pos = positions[i];
      const snapped = scene.grid.getSnappedPoint(pos, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX });
      const td = await actor.getTokenDocument({
        x: cx,
        y: cy,
        hidden: false,
      });
      const data = td.toObject();
      data.x = cx;
      data.y = cy;
      data.alpha = 0;
      data._targetX = snapped.x;
      data._targetY = snapped.y;
      tokenDataArray.push(data);
    }

    const groupPlaceable = groupToken.object;
    if (groupPlaceable) {
      await groupPlaceable.animate(
        { alpha: 0 },
        { duration: this.ANIMATION_DURATION / 2, transition: 'swirl' }
      );
    }

    await groupToken.update({ hidden: true });

    const created = await scene.createEmbeddedDocuments('Token', tokenDataArray.map((d) => {
      const { _targetX, _targetY, ...rest } = d;
      return rest;
    }));

    const memberTokenIds = [];
    for (let i = 0; i < created.length; i++) {
      const token = created[i];
      const targetData = tokenDataArray[i];
      memberTokenIds.push(token.id);

      await token.update({
        'flags.dsa5.groupTokenId': groupToken.id,
      });

      const placeable = token.object;
      if (placeable) {
        setTimeout(() => {
          placeable.animate(
            {
              x: targetData._targetX,
              y: targetData._targetY,
              alpha: 1,
            },
            { duration: this.ANIMATION_DURATION, transition: 'swirl' }
          );
        }, i * this.STAGGER_DELAY);
      }
    }

    await groupToken.update({
      'flags.dsa5.memberTokenIds': memberTokenIds,
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

    for (let i = 0; i < memberTokens.length; i++) {
      const token = memberTokens[i];
      const placeable = token.object;
      if (placeable) {
        setTimeout(() => {
          placeable.animate(
            { x: cx, y: cy, alpha: 0 },
            { duration: this.ANIMATION_DURATION, transition: 'swirl' }
          );
        }, i * this.STAGGER_DELAY);
      }
    }

    const totalDelay =
      memberTokens.length * this.STAGGER_DELAY + this.ANIMATION_DURATION + 100;

    await new Promise((resolve) => setTimeout(resolve, totalDelay));

    await groupToken.update({ hidden: false });

    const groupPlaceable = groupToken.object;
    if (groupPlaceable) {
      await groupPlaceable.animate(
        { alpha: 1 },
        { duration: this.ANIMATION_DURATION / 2, transition: 'swirl' }
      );
    }

    await scene.deleteEmbeddedDocuments(
      'Token',
      memberTokens.map((t) => t.id)
    );

    await groupToken.update({
      'flags.dsa5.memberTokenIds': [],
    });
  }
}
