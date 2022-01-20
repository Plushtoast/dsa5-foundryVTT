export default function() {
    Token.prototype.drawEffects = async function() {
        this.hud.effects.removeChildren().forEach(c => c.destroy());
        const tokenEffects = this.data.effects;
        const isAllowedToSeeEffects = game.user.isGM || (this.actor && this.actor.testUserPermission(game.user, "OBSERVER")) || !(await game.settings.get("dsa5", "hideEffects"))
        const actorEffects = this.actor && isAllowedToSeeEffects ? this.actor.effects.filter(x => {
            return !x.data.disabled && !x.notApplicable && (game.user.isGM || !x.getFlag("dsa5", "hidePlayers")) && !x.getFlag("dsa5", "hideOnToken")
        }) : [];

        let overlay = {
            src: this.data.overlayEffect,
            tint: null
        };

        if (tokenEffects.length || actorEffects.length) {
            const promises = [];
            let w = Math.round(canvas.dimensions.size / 2 / 5) * 2;
            let bg = this.hud.effects.addChild(new PIXI.Graphics()).beginFill(0x000000, 0.40).lineStyle(1.0, 0x000000);
            let i = 0;

            for (let f of actorEffects) {
                if (!f.data.icon) continue;
                const tint = f.data.tint ? colorStringToHex(f.data.tint) : null;
                if (f.getFlag("core", "overlay")) {
                    overlay = { src: f.data.icon, tint };
                    continue;
                }
                promises.push(this._drawEffect(f.data.icon, i, bg, w, tint, getProperty(f, "data.flags.dsa5.value")));
                i++;
            }

            for (let f of tokenEffects) {
                promises.push(this._drawEffect(f, i, bg, w, null));
                i++;
            }
            await Promise.all(promises);
        }
        return this._drawOverlay(overlay)
    }

    Token.prototype._drawEffect = async function(src, i, bg, w, tint, value) {
        let tex = await loadTexture(src);
        let icon = this.hud.effects.addChild(new PIXI.Sprite(tex));

        icon.width = icon.height = w;
        icon.x = Math.floor(i / 5) * w;
        icon.y = (i % 5) * w;

        if (tint) icon.tint = tint;

        try {
            bg.drawRoundedRect(icon.x + 1, icon.y + 1, w - 2, w - 2, 2);
        } catch {}

        this.hud.effects.addChild(icon);

        if (value) {
            let textEffect = game.dsa5.config.effectTextStyle
            let color = await game.settings.get("dsa5", "statusEffectCounterColor")
            textEffect._fill = /^#[0-9A-F]+$/.test(color) ? color : "#000000"
            let text = this.hud.effects.addChild(new PreciseText(value, textEffect))
            text.x = icon.x;
            text.y = icon.y;
            this.hud.effects.addChild(text);
        }
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
        if (!existing || Number.isNumeric(getProperty(existing, "data.flags.dsa5.value")))
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

    Hooks.on("applyActiveEffect", (actor, change) => {
        const current = getProperty(actor.data, change.key)
        if (current == undefined)
            current = null
        const ct = getType(current)
        let update = null
        switch (ct) {
            case "Array":
                let newElems = []
                const source = change.effect.data.label
                for (let elem of `${change.value}`.split(/(;|,)/)) {
                    let vals = elem.split(" ")
                    const value = vals.pop()
                    const target = vals.join(" ")
                    newElems.push({ source, value, target })
                }
                update = current.concat(newElems)
                break;
            case "number":
                if (!isNaN(change.value))
                    update = current + Number(change.value)
        }
        if (update !== null) setProperty(actor.data, change.key, update)
        return update
    })
}