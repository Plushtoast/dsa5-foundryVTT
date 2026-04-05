export class SummoningTarget {
  /**
   * Get a placement position. Either returns the caster's token position
   * or lets the user click on the canvas to choose a target point.
   * @param {Actor} summoner
   * @param {"caster"|"target"} mode
   * @returns {Promise<{x: number, y: number, sceneId: string}|null>}
   */
  static async acquirePosition(summoner, mode) {
    const scene = canvas.scene;
    if (!scene) return null;

    if (mode === "caster") {
      return this._casterPosition(summoner, scene);
    }

    return this._pickPosition(scene);
  }

  static _casterPosition(summoner, scene) {
    const token = summoner.token ?? summoner.getActiveTokens()[0]?.document;
    if (!token) return null;

    return { x: token.x, y: token.y, sceneId: scene.id };
  }

  static async _pickPosition(scene) {
    return new Promise((resolve) => {
      const handler = (event) => {
        const pos = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
        const snapped = canvas.grid.getSnappedPoint(pos, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX });
        canvas.stage.off("pointerdown", handler);
        document.body.style.cursor = "";
        resolve({ x: snapped.x, y: snapped.y, sceneId: scene.id });
      };

      document.body.style.cursor = "crosshair";
      canvas.stage.on("pointerdown", handler);
    });
  }
}
