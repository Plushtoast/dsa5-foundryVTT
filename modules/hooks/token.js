import { DSAAura } from '../system/aura.js';
import DPS from '../system/derepositioningsystem.js';
import tokenHUD from './tokenHUD.js';
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

  movementType() {
    const lastMovement = this.measureMovementPath(this.document.movementHistory).distance;
    //const actorSpeed = this.actor?.system.status?.speed.max || 0;

    if(lastMovement <= 0) return 0; //stehend
    if (lastMovement <= 4) return 1; //gehend
    return 2; //rennend
  }  
}
