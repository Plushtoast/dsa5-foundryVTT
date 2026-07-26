import { DSARegionBehaviorBase } from './base.js';
import DSAActiveEffectConfig from '../../status/active_effect_config.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export class DSAZoneRegionBehavior extends DSARegionBehaviorBase {
  static REGION_TYPE = 'DSAZone';
  static LOCALIZATION_PREFIXES = ['REGIONBEHAVIOR_DSAZone'];

  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: this.#handleZoneEvent,
    [CONST.REGION_EVENTS.TOKEN_EXIT]: this.#handleZoneEvent,
    [CONST.REGION_EVENTS.TOKEN_MOVE_IN]: this.#handleZoneEvent,
    [CONST.REGION_EVENTS.TOKEN_MOVE_OUT]: this.#handleZoneEvent,
    [CONST.REGION_EVENTS.TOKEN_MOVE_WITHIN]: this.#handleZoneEvent,
    [CONST.REGION_EVENTS.TOKEN_ROUND_START]: this.#handleZoneEvent,
    [CONST.REGION_EVENTS.TOKEN_ROUND_END]: this.#handleZoneEvent,
  };

  static MODE_WHILE_IN_ZONE = 0;
  static MODE_ONCE = 1;
  static MODE_RECURRING = 2;

  static registerHooks() {
    Hooks.on('deleteRegion', (region) => {
      if (!DSA5_Utility.isActiveGM()) return;
      this.cleanupDeletedRegion(region).catch((error) => console.error(error));
    });
  }

  static defineSchema() {
    return {
      messageId: new StringField({ required: true }),
      mode: new NumberField({
        initial: 2,
        choices: {
          [DSAZoneRegionBehavior.MODE_WHILE_IN_ZONE]: 'REGIONBEHAVIOR_DSAZone.MODES.whileInZone',
          [DSAZoneRegionBehavior.MODE_ONCE]: 'REGIONBEHAVIOR_DSAZone.MODES.once',
          [DSAZoneRegionBehavior.MODE_RECURRING]: 'REGIONBEHAVIOR_DSAZone.MODES.recurring',
        },
      }),
      removeOnExit: new BooleanField({ initial: true }),
    };
  }

  static async #handleZoneEvent(event) {
    await this._handleRegionEvent(event);
  }

  static async cleanupDeletedRegion(region) {
    const zones = region.behaviors.filter((behavior) => behavior.type === this.REGION_TYPE && behavior.system instanceof this);
    if (!zones.length) return;

    const tokens = this.#tokensInRegion(region);
    if (!tokens.length) return;

    await Promise.all(zones.flatMap((behavior) => tokens.map((token) => behavior.system.#onDeletedRegionTokenExit(region, token))));
  }

  static #tokensInRegion(region) {
    const tokens = new Set(region.tokens ?? []);
    for (const token of region.parent?.tokens ?? []) {
      if (token.actor && token.testInsideRegion?.(region)) tokens.add(token);
    }
    return Array.from(tokens).filter((token) => token.actor);
  }

  static movementActionState(event) {
    const { token, movement } = event.data;
    const combatant = token?.combatant ?? game.combat?.combatants.find((combatant) => combatant.tokenId === token?.id);
    const combat = combatant?.parent ?? game.combat;
    const state = {
      available: false,
      inCombat: !!combat,
      combatId: combat?.id ?? null,
      combatantId: combatant?.id ?? null,
      round: combat?.round ?? null,
      turn: combat?.turn ?? null,
      turnCombatantId: combat?.combatant?.id ?? null,
      movementId: movement?.id ?? null,
      movementSubpathId: movement?.subpathId ?? null,
      speed: token?.actor?.speedByMovementType?.('walk') ?? 0,
      distance: 0,
      previousDistance: 0,
      currentDistance: 0,
      actionCount: 0,
      previousActionCount: 0,
      currentActionCount: 0,
      actionDelta: 0,
      baseActionCount: 0,
      costsBaseAction: false,
    };

    if (!token?.actor || !combatant || !combat?.started) return state;

    state.previousDistance = this.#regionMovementDistance(event.region, token, this.#previousMovementWaypoints(movement));
    state.distance = this.#regionMovementDistance(event.region, token, this.#roundMovementWaypoints(token, movement));
    state.currentDistance = this.#regionMovementDistance(event.region, token, this.#currentMovementWaypoints(movement));
    state.previousActionCount = this.#movementActionCount(state.previousDistance, state.speed);
    state.actionCount = this.#movementActionCount(state.distance, state.speed);
    state.currentActionCount = this.#movementActionCount(state.currentDistance, state.speed);
    state.actionDelta = this.#movementActionDelta(event, state);
    state.baseActionCount = Math.max(0, state.actionCount - 1);
    state.costsBaseAction = state.actionCount > 1;
    state.available = state.distance > 0;
    return state;
  }

  static #movementActionCount(distance, speed) {
    if (distance <= 0) return 0;
    if (speed <= 0) return 1;
    return Math.ceil(distance / speed);
  }

  static #movementActionDelta(event, state) {
    if (!event.data.movement || !event.name.startsWith('tokenMove')) return 0;
    if (event.name === CONST.REGION_EVENTS.TOKEN_MOVE_WITHIN && !event.data.token.regions.has(event.region)) return 0;
    return Math.max(0, state.actionCount - state.previousActionCount);
  }

  static #roundMovementWaypoints(token, movement) {
    const previousWaypoints = this.#previousMovementWaypoints(movement);
    const waypoints = [...previousWaypoints, ...(movement?.passed?.waypoints ?? [])];
    if (waypoints.length > 1) return waypoints;
    if (token.movementHistory?.length > 1) return token.movementHistory;
    return this.#currentMovementWaypoints(movement);
  }

  static #previousMovementWaypoints(movement) {
    return [
      ...(movement?.history?.recorded?.waypoints ?? []),
      ...(movement?.history?.unrecorded?.waypoints ?? []),
    ];
  }

  static #currentMovementWaypoints(movement) {
    if (!movement?.origin || !movement.passed?.waypoints?.length) return [];
    return [movement.origin, ...movement.passed.waypoints];
  }

  static #regionMovementDistance(region, token, waypoints) {
    if (!region || !token || waypoints.length <= 1) return 0;

    let distance = 0;
    const grid = region.parent?.grid ?? canvas.scene?.grid;
    if (!grid) return distance;

    for (const segment of token.segmentizeRegionMovementPath(region, waypoints)) {
      if (segment.teleport) continue;
      distance += grid.measurePath([segment.from, segment.to]).distance;
    }
    return distance;
  }

  #hasExistingEffect(token) {
    return token.actor?.effects.some((e) => e.origin === this.parent.uuid);
  }

  async _handleRegionEvent(event) {
    const { token } = event.data;
    if (!token?.actor) return;

    const regionEvent = this.#buildZoneRegionEvent(event);
    const hasMovement = !!event.data.movement;

    switch (event.name) {
      case CONST.REGION_EVENTS.TOKEN_ENTER:
        if (hasMovement) return;
        await this.#onEnter(event, regionEvent);
        break;
      case CONST.REGION_EVENTS.TOKEN_EXIT:
        if (hasMovement) return;
        await this.#onExit(event, regionEvent);
        break;
      case CONST.REGION_EVENTS.TOKEN_MOVE_IN:
        await this.#onEnter(event, regionEvent);
        break;
      case CONST.REGION_EVENTS.TOKEN_MOVE_OUT:
        await this.#onExit(event, regionEvent);
        break;
      case CONST.REGION_EVENTS.TOKEN_MOVE_WITHIN:
        await this.#onMovement(event, regionEvent);
        break;
      case CONST.REGION_EVENTS.TOKEN_ROUND_START:
      case CONST.REGION_EVENTS.TOKEN_ROUND_END:
        if (this.mode === DSAZoneRegionBehavior.MODE_RECURRING && DSA5_Utility.isActiveGM(true)) {
          await this.#applyZoneEffect(token, regionEvent);
        }
        break;
    }
  }

  async #onEnter(event, regionEvent) {
    const { token, movement } = event.data;
    if (!event.user.isSelf) return;

    if (this.mode === DSAZoneRegionBehavior.MODE_WHILE_IN_ZONE) {
      if (this.#hasExistingEffect(token)) return;

      const resumeMovement = movement ? token.pauseMovement() : undefined;
      await this.#applyZoneEffect(token, regionEvent);
      await resumeMovement?.();
    } else {
      if (this.mode === DSAZoneRegionBehavior.MODE_ONCE && this.#hasExistingEffect(token)) return;

      const resumeMovement = movement ? token.pauseMovement() : undefined;
      await this.#applyZoneEffect(token, regionEvent);
      await resumeMovement?.();
    }
  }

  async #onExit(event, regionEvent) {
    const { token, movement } = event.data;
    if (!event.user.isSelf) return;

    const resumeMovement = movement ? token.pauseMovement() : undefined;
    await this.#applyZoneEffect(token, regionEvent);

    const shouldRemove = this.mode === DSAZoneRegionBehavior.MODE_WHILE_IN_ZONE || this.removeOnExit;
    if (shouldRemove) await this.removeEffects(token);

    await resumeMovement?.();
  }

  async #onDeletedRegionTokenExit(region, token) {
    const event = {
      name: CONST.REGION_EVENTS.TOKEN_EXIT,
      data: { token, movement: null, regionDeleted: true },
      region,
      user: game.user,
    };
    await this.#onExit(event, this.#buildZoneRegionEvent(event));
  }

  #buildZoneRegionEvent(event) {
    const regionEvent = this.buildMacroRegionEvent(event);
    regionEvent.zoneMovement = this.constructor.movementActionState(event);
    return regionEvent;
  }

  async #onMovement(event, regionEvent) {
    const { token, movement } = event.data;
    if (this.mode !== DSAZoneRegionBehavior.MODE_RECURRING) return;
    if (!event.user.isSelf) return;

    const resumeMovement = movement ? token.pauseMovement() : undefined;
    await this.#applyZoneEffect(token, regionEvent);
    await resumeMovement?.();
  }

  async #applyZoneEffect(token, regionEvent = undefined) {
    const messageId = this.messageId;
    if (!messageId) return;

    const message = game.messages.get(messageId);
    if (!message) return;

    await DSAActiveEffectConfig.applyEffect(
      messageId,
      'target',
      [{ token: token.id, actor: token.actor.id, scene: token.parent?.id ?? canvas.scene.id }],
      { origin: this.parent.uuid, regionEvent },
    );
  }
}
