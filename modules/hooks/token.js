import { DSAAura } from '../system/automation/aura.js';
import DPS from '../system/automation/derepositioningsystem.js';
import Riding from '../system/automation/riding.js';
const { getProperty } = foundry.utils;
const { Token } = foundry.canvas.placeables;

export class DSAToken extends Token {
  async _drawEffects() {
    this.effects.renderable = false;
    this.effects.removeChildren().forEach((c) => c.destroy());
    this.effects.bg = this.effects.addChild(new PIXI.Graphics());
    this.effects.overlay = null;

    let activeEffects = [];
    let hasOverlay = false;

    if (this.actor) {
      activeEffects = await this.actor.actorEffects();

      if (this.actor.isSwarm()) {
        activeEffects.push(
          new ActiveEffect({
            img: 'systems/dsa5/icons/thirdparty/bee.svg',
            id: 'swarm',
            name: 'swarm.name',
            flags: {
              dsa5: { value: this.actor.system.swarm?.effectiveCount || 1 },
            },
          }),
        );
      }
    }

    const promises = [];
    for (const effect of activeEffects) {
      if (!effect.img) continue;
      if (effect.getFlag('core', 'overlay') && !hasOverlay) {
        promises.push(this._drawOverlay(effect.img, effect.tint));
        hasOverlay = true;
      } else promises.push(this._drawEffect(effect.img, effect.tint, getProperty(effect, 'flags.dsa5.value')));
    }
    await Promise.allSettled(promises);

    this.effects.renderable = true;
    this.renderFlags.set({ refreshEffects: true });
  };

  _refreshEffects() {
    let i = 0;
    const w = Math.round(canvas.dimensions.size / 10) * 2;
    const rows = Math.floor(this.document.height * 5);
    const bg = this.effects.bg.clear().beginFill(0x000000, 0.4).lineStyle(1.0, 0x000000);
    for (const effect of this.effects.children) {
      if (effect === bg) continue;
      if (effect.isCounter) continue;

      // Overlay effect
      if (effect === this.effects.overlay) {
        const { width, height } = this.document.getSize();
        const size = Math.min(width * 0.6, height * 0.6);
        effect.width = effect.height = size;
        effect.position = this.getCenterPoint({ x: 0, y: 0 });
        effect.anchor.set(0.5, 0.5);
      }

      // Status effect
      else {
        effect.width = effect.height = w;
        effect.x = Math.floor(i / rows) * w;
        effect.y = (i % rows) * w;
        bg.drawRoundedRect(effect.x + 1, effect.y + 1, w - 2, w - 2, 2);

        if (effect.counter > 1 && !effect.counterDrawn) {
          let textEffect = game.dsa5.config.effectTextStyle;
          let color = game.settings.get('dsa5', 'statusEffectCounterColor');
          textEffect._fill = /^#[0-9A-F]+$/.test(color) ? color : '#000000';
          let text = this.effects.addChild(new foundry.canvas.containers.PreciseText(effect.counter, textEffect));
          text.x = effect.x;
          text.y = effect.y;
          text.isCounter = true;
          effect.counterDrawn = true;
        }
        i++;
      }
    }
  };

  async _drawEffect(src, tint, value) {
    if (!src) return;
    const tex = await foundry.canvas.loadTexture(src, { fallback: 'icons/svg/hazard.svg' });
    const icon = new PIXI.Sprite(tex);
    icon.tint = tint ?? 0xffffff;
    icon.counter = value;
    return this.effects.addChild(icon);
  };

  async drawAuras(force = false) {
    await DSAAura.drawAuras(this, force);
  };

  _onClickLeft2(event) {
    const distanceAccessible = game.user.isGM || !DPS.isEnabled || !this.actor?.isMerchant() || DPS.inDistance(this);

    if (!distanceAccessible)
      return ui.notifications.warn('DSAError.notInRangeToLoot', {
        localize: true,
      });

    super._onClickLeft2(event);
  };

  static MOVEMENTTYPES = Object.freeze({
    STANDING: 0,
    WALKING: 1,
    RUNNING: 2,
  })

  movementType() {
    if (Riding.isRiding(this.actor)) return DSAToken.MOVEMENTTYPES.STANDING;

    const lastMovement = this.measureMovementPath(this.document.movementHistory).distance;
    //const actorSpeed = this.actor?.system.status?.speed.max || 0;

    if (lastMovement <= 0) return DSAToken.MOVEMENTTYPES.STANDING;
    if (lastMovement <= 4) return DSAToken.MOVEMENTTYPES.WALKING;
    return DSAToken.MOVEMENTTYPES.RUNNING;
  }

  _getAnimationMovementSpeed(options) {
    if (game.canvas.grid.units != game.i18n.localize('gridUnits')) return super._getAnimationMovementSpeed(options);
    
    if(this.actor) {
      return this.actor.system.status.speed.max || 1;
    } 
    return CONFIG.Token.movement.defaultSpeed;
  }

  _modifyAnimationMovementSpeed(speed, options) {
    if (options.terrain instanceof foundry.data.TerrainData) speed /= options.terrain.difficulty;
    const actionConfig = CONFIG.Token.movement.actions[options.action];
    return speed * (actionConfig.speedMultiplier ?? 1);
  }
}


export class DSATokenDocument extends TokenDocument {
  _inferMovementAction() {
    if (this.hasStatusEffect("prone")) return "crawl";

    return super._inferMovementAction();
  }
}

export class DSATokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {
  static COLOR_WALKING = 0x008000; // Green
  static COLOR_RUNNING = 0xFFC000; // Yellow
  static COLOR_CRAWLING = 0x808000; // Olive
  static COLOR_CRAWLING_FAST = 0xFF8000; // Orange
  static COLOR_SWIMMING = 0x00FFFF; // Cyan
  static COLOR_SWIMMING_FAST = 0x000FF; // Blue
  static COLOR_FLYING = 0x800080; // Purple
  static COLOR_FLYING_FAST = 0xFF00FF; // Magenta
  static COLOR_IMPOSSIBLE = 0xFF0000; // Red

  _getWaypointStyle(waypoint) {
    if(!game.settings.get('dsa5', 'dsaTokenRuler')) return super._getWaypointStyle(waypoint);
    if (!waypoint.explicit && waypoint.next && waypoint.previous && waypoint.actionConfig.visualize
      && waypoint.next.actionConfig.visualize && (waypoint.action === waypoint.next.action)) return { radius: 0 };
    const scale = canvas.dimensions.uiScale;
    return { radius: 6 * scale, color: this._totalDistanceColor(waypoint), alpha: 1 };
  }

  #colorByMovementAction(action) {
    switch (action) {
      case 'swim':
        return { normal: DSATokenRuler.COLOR_SWIMMING, fast: DSATokenRuler.COLOR_SWIMMING_FAST };
      case 'fly':
        return { normal: DSATokenRuler.COLOR_FLYING, fast: DSATokenRuler.COLOR_FLYING_FAST };
      case 'crawl':
        return { normal: DSATokenRuler.COLOR_CRAWLING, fast: DSATokenRuler.COLOR_CRAWLING_FAST };
      default:
        return { normal: DSATokenRuler.COLOR_WALKING, fast: DSATokenRuler.RUNNING };
    }
  }

  _totalDistanceColor(waypoint) {
    if (game.canvas.grid.units != game.i18n.localize('gridUnits')) {
      const user = game.users.get(waypoint.userId);
      
      return user?.color ?? 0x000000
    };
    const colors = this.#colorByMovementAction(waypoint.action);

    let previous = waypoint.previous;
    let previousDistanceSum = waypoint.cost;
    while (previous) {
      previousDistanceSum += previous.cost;
      previous = previous.previous;      
    }
    
    const maxSpeed = this.token.actor?.system?.status?.speed?.max || 0;
    
    if (previousDistanceSum < maxSpeed) {
      return colors.normal;
    } else if (previousDistanceSum < maxSpeed * 2) {
      return colors.fast;
    } else {
      return DSATokenRuler.COLOR_IMPOSSIBLE;
    }
  }


  _getSegmentStyle(waypoint) {
    if(!game.settings.get('dsa5', 'dsaTokenRuler')) return super._getSegmentStyle(waypoint);
    if (!waypoint.actionConfig.visualize) return { width: 0 };

    const scale = canvas.dimensions.uiScale;
    return { width: 4 * scale, color: this._totalDistanceColor(waypoint), alpha: 1 };
  }
}


/*Hooks.on('moveToken', async (token, move, options) => {
  console.log('moveToken', token, move, options);
});

Hooks.on('moveToken', async (token, move, options) => {
  console.log('moveToken', token, move, options);
});*/