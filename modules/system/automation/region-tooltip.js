const { renderTemplate } = foundry.applications.handlebars;

/**
 * Canvas hover tooltips for DSA trap regions.
 * Works while the token layer is active, without stealing clicks from tokens.
 */
export default class RegionTooltipHandler {
  static TYPES = new Set(['DSATrap']);

  static #hoveredKey = '';
  static #anchor = null;
  static #onMouseMove = this.#handleMouseMove.bind(this);
  static #onPointerLeave = this.hide.bind(this);

  static registerHooks() {
    Hooks.on('canvasReady', () => this.#onCanvasReady());
    Hooks.on('tearDownCanvas', () => this.hide());
  }

  static #onCanvasReady() {
    canvas.registerMouseMoveHandler(this.#onMouseMove, 0, this, true);
    const view = canvas.app?.canvas ?? canvas.app?.view;
    view?.addEventListener?.('pointerleave', this.#onPointerLeave);
  }

  static #handleMouseMove(position) {
    if (!game.user.isGM) return;
    if (!canvas.ready || canvas.regions?._placementContext) {
      this.hide();
      return;
    }

    const regions = this.regionsAt(position);
    const key = regions.map((region) => region.id).join('|');
    if (!key) {
      this.hide();
      return;
    }
    if (key === this.#hoveredKey) return;

    this.#hoveredKey = key;
    this.#show(regions, position, key);
  }

  /**
   * Visible DSA regions that contain the canvas point.
   * @param {{ x: number, y: number }} position
   * @returns {RegionDocument[]}
   */
  static regionsAt(position) {
    const scene = canvas.scene;
    if (!scene) return [];

    const point = { x: position.x, y: position.y };
    const hits = [];
    for (const region of scene.regions) {
      if (!region.object?.visible) continue;
      if (!region.behaviors.some((behavior) => this.TYPES.has(behavior.type))) continue;
      const tree = region.object.animationState?.polygonTree ?? region.polygonTree;
      if (!tree?.testPoint(point)) continue;
      hits.push(region);
    }
    return hits;
  }

  /**
   * @param {RegionDocument|RegionDocument[]} regions
   * @param {{ isGM?: boolean }} [options]
   * @returns {{ regions: object[] }}
   */
  static buildTooltipContext(regions, { isGM = game.user.isGM } = {}) {
    const list = Array.isArray(regions) ? regions : [regions];
    return {
      regions: list.flatMap((region) => this.#behaviorTooltips(region, isGM)),
    };
  }

  static #behaviorTooltips(region, isGM) {
    const entries = [];
    for (const behavior of region.behaviors) {
      if (!this.TYPES.has(behavior.type)) continue;
      const tooltip = behavior.system?.getHoverTooltip?.({ isGM });
      if (tooltip?.name) entries.push(tooltip);
    }
    return entries;
  }

  static async #show(regions, position, key) {
    const context = this.buildTooltipContext(regions);
    if (!context.regions.length) {
      this.hide();
      return;
    }

    const html = await renderTemplate('systems/dsa5/templates/tooltips/region.hbs', context);
    if (this.#hoveredKey !== key) return;

    const anchor = this.#ensureAnchor();
    this.#moveAnchor(position);
    game.tooltip.activate(anchor, {
      html,
      cssClass: 'dsatooltip dsatooltip-item',
      direction: game.tooltip.constructor.TOOLTIP_DIRECTIONS.UP,
    });
  }

  static hide() {
    if (!this.#hoveredKey) return;
    this.#hoveredKey = '';
    if (game.tooltip?.element === this.#anchor) game.tooltip.deactivate();
  }

  static #ensureAnchor() {
    if (this.#anchor?.isConnected) return this.#anchor;
    const el = document.createElement('div');
    el.id = 'dsa-region-tooltip-anchor';
    el.style.cssText = 'position:fixed;width:0;height:0;pointer-events:none;';
    document.body.appendChild(el);
    this.#anchor = el;
    return el;
  }

  static #moveAnchor(position) {
    const screen = canvas.clientCoordinatesFromCanvas(position);
    this.#anchor.style.left = `${Math.round(screen.x)}px`;
    this.#anchor.style.top = `${Math.round(screen.y)}px`;
  }
}
