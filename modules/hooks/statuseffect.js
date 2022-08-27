import DPS from "../system/derepositioningsystem.js";

export default function() {
    Token.prototype.drawEffects = async function() {
        this.effects.removeChildren().forEach(c => c.destroy());
        this.effects.bg = this.effects.addChild(new PIXI.Graphics());
        this.effects.overlay = null;

        const tokenEffects = this.document.effects;
        const actorEffects = this.actor ? await this.actor.actorEffects() : []

        let overlay = {
            src: this.document.overlayEffect,
            tint: null
        };

        if (tokenEffects.length || actorEffects.length) {
            const promises = [];

            for (let f of actorEffects) {
                if (!f.icon) continue;
                const tint = Color.from(f.tint ?? null);
                if (f.getFlag("core", "overlay")) {
                    overlay = { src: f.icon, tint };
                    continue;
                }
                promises.push(this._drawEffect(f.icon, tint, getProperty(f, "flags.dsa5.value"))) //, bg, w, i, getProperty(f, "flags.dsa5.value")));
            }
            for (let f of tokenEffects) {
                promises.push(this._drawEffect(f, null))//, bg, w, i));
            }
            await Promise.all(promises);
        }
        
        this.effects.overlay = await this._drawOverlay(overlay.src, overlay.tint);
        this._refreshEffects();
    }

    Token.prototype._refreshEffects = function() {
        let i = 0;
        const w = Math.round(canvas.dimensions.size / 2 / 5) * 2;
        const rows = Math.floor(this.document.height * 5);
        const bg = this.effects.bg.clear().beginFill(0x000000, 0.40).lineStyle(1.0, 0x000000);
        for ( const effect of this.effects.children ) {
          if ( effect === bg ) continue;
          if ( effect.isCounter) continue
    
          // Overlay effect
          if ( effect === this.effects.overlay ) {
            const size = Math.min(this.w * 0.6, this.h * 0.6);
            effect.width = effect.height = size;
            effect.position.set((this.w - size) / 2, (this.h - size) / 2);
          }
    
          // Status effect
          else {
            effect.width = effect.height = w;
            effect.x = Math.floor(i / rows) * w;
            effect.y = (i % rows) * w;
            bg.drawRoundedRect(effect.x + 1, effect.y + 1, w - 2, w - 2, 2);

            if(effect.counter > 1 && !effect.counterDrawn){
                let textEffect = game.dsa5.config.effectTextStyle
                let color = game.settings.get("dsa5", "statusEffectCounterColor")
                textEffect._fill = /^#[0-9A-F]+$/.test(color) ? color : "#000000"
                let text = this.effects.addChild(new PreciseText(effect.counter, textEffect))
                text.x = effect.x;
                text.y = effect.y;
                text.isCounter = true
                effect.counterDrawn = true
            }
            i++;
          }
        }
      }

    Token.prototype._drawEffect = async function(src, tint, value) {
        if ( !src ) return;
        let tex = await loadTexture(src, {fallback: "icons/svg/hazard.svg"});
        let icon = new PIXI.Sprite(tex);
        if ( tint ) icon.tint = tint;
        icon.counter = value
        return this.effects.addChild(icon);
     }

    TokenHUD.prototype._onToggleEffect = function(event, { overlay = false } = {}) {
        event.preventDefault();
        let img = event.currentTarget;
        const effect = (img.dataset.statusId && this.object.actor) ?
            CONFIG.statusEffects.find(e => e.id === img.dataset.statusId) :
            img.getAttribute("src");
        if (!effect.flags.dsa5.editable)
            return
        if (event.button == 0)
            return this.object.incrementCondition(effect)
        if (event.button == 2)
            return this.object.decrementCondition(effect)
    }


    Token.prototype.incrementCondition = async function(effect, { active, overlay = false } = {}) {
        const existing = this.actor.effects.find(e => e.getFlag("core", "statusId") === effect.id);
        if (!existing || Number.isNumeric(getProperty(existing, "flags.dsa5.value")))
            await this.actor.addCondition(effect.id, 1, false, false)
        else if (existing)
            await this.actor.removeCondition(effect.id, 1, false)

        if (this.hasActiveHUD) canvas.tokens.hud.refreshStatusIcons();
        return active;
    }

    Token.prototype.decrementCondition = async function(effect, { active, overlay = false } = {}) {
        this.actor.removeCondition(effect.id, 1, false)
        if (this.hasActiveHUD) canvas.tokens.hud.refreshStatusIcons();
        return active;
    }

    const defaulTokenLeftClick2 = Token.prototype._onClickLeft2
    const isMerchant = (actor) => {
        if (!actor) return false

        return ["merchant", "loot"].includes(getProperty(actor.system, "merchant.merchantType"))
    }

    Token.prototype._onClickLeft2 = function(event) {
        const distanceAccessible = game.user.isGM || !game.settings.get("dsa5", "enableDPS") || !isMerchant(this.actor) || DPS.inDistance(this)

        if (!distanceAccessible)
            return ui.notifications.warn(game.i18n.localize('DSAError.notInRangeToLoot'))

        defaulTokenLeftClick2.call(this, event)
    }
}