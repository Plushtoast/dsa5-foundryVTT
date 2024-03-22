import DPS from "./derepositioningsystem.js"
import { MeasuredTemplateDSA } from "./measuretemplate.js"
import OnUseEffect from "./onUseEffects.js"
import DSA5_Utility from "./utility-dsa5.js"

export class DSAAura {
    static bindAuraHooks() {
        Hooks.on("DSAauraRefresh", (template, sourceToken) => {
            if(!DSA5_Utility.isActiveGM()) return

            DSAAura.updateTokenAura(template, sourceToken)
        })
    }

    /*
    {
        "flags": {
            "dsa5": {
                "isAura": true,
                "aura": {
                    "auraToken": "tokenID",
                    "disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
                    effect: {}
                }
            }
    }
    */

    static async onDeleteToken(token) {
        if(!DSA5_Utility.isActiveGM()) return

        for(const aura in token.object.auras) {
            for(const otherToken of canvas.scene.tokens) {
                const existingEffect = otherToken.actor.effects.find(e => getProperty(e, "flags.dsa5.templateSource") == aura)
                if(existingEffect) {
                    await otherToken.actor.deleteEmbeddedDocuments("ActiveEffect", [existingEffect.id])
                }
            }
            
        }
    }   

    static validAuraTarget(token, disposition) {
        return disposition == 2 || disposition == token.document.disposition
    }

    static async inAura(sourceToken, token, template) {
        return DPS.rangeFinder(sourceToken, token).distance <= template.distance
    }

    static async checkAuraEntered(trespasser) {
        if(!DSA5_Utility.isActiveGM() || !game.canvas) return

        for(let token of canvas.scene.tokens) {
            if(token.id == trespasser.id) continue

            for(let [key, aura] of Object.entries(token.object.auras || {})) {
                let { auraSource, effect, disposition, isAura } = getProperty(aura.template.document, "flags.dsa5")
                disposition = disposition ?? 2

                if(!isAura) continue

                await DSAAura.updateAura(token, trespasser, aura.template.document, disposition, auraSource, effect)            
            }
        }
    }
 
    static async updateTokenAura(template, sourceToken) {        
        const document = template.document
        let { auraSource, effect, disposition, isAura } = getProperty(document, "flags.dsa5")
        disposition = disposition ?? 2

        if(!isAura || !game.canvas) return

        if(!auraSource) {
            await template.delete()
            return
        }       

        //problem token with same actor twice on map
        for(let token of canvas.scene.tokens) {
            await DSAAura.updateAura(sourceToken, token, document, disposition, auraSource, effect)
        }   
    }

    static async updateAura(sourceToken, token, document, disposition, auraSource, effect) {
        const inAura = await DSAAura.inAura(sourceToken, token, document)
        const existingEffect = token.actor.effects.find(e => getProperty(e, "flags.dsa5.templateSource") == auraSource)

        if(inAura && DSAAura.validAuraTarget(token, disposition) && !existingEffect) {
            const newEffect = duplicate(effect)
            mergeObject(newEffect,
                {
                    name: `${effect.name} (Aura)`,
                    flags: {
                        dsa5: {
                            templateSource: auraSource
                        }
                    }
                }
            )
            await token.actor.addCondition(newEffect)
        } else if(!inAura && existingEffect) {
            await token.actor.deleteEmbeddedDocuments("ActiveEffect", [existingEffect.id])                
        }
    }
}

export class AuraTemplate extends MeasuredTemplateDSA {
    static fromItem(effect, token, auraId) {
        const radius = getProperty(effect, "flags.dsa5.auraRadius")
        if(!radius) return

        const newEffect = duplicate(effect)
        delete newEffect.flags.dsa5.isAura

        mergeObject(newEffect, {
            flags: {
                dsa5: {
                    isAuraEffect: true
                }
            }
        })

        const templateData = {
            t: "circle",
            _id : effect.id,
            user: game.user.id,
            distance: radius,
            direction: 0,
            x: token.center.x,
            y: token.center.y,
            fillColor: game.user.color,
            flags: {
                dsa5: {
                    effect: newEffect,
                    auraSource: auraId,
                    isAura: true
                }
            }
        }

        const cls = CONFIG.MeasuredTemplate.documentClass;
        const template = new cls(templateData, { parent: canvas.scene });
        const object = new this(template);
        return object;
    }

    async _draw() {
        await super._draw();
        this.controlIcon.alpha = 0;
    }
    
    highlightGrid() {
        super.highlightGrid();
        game.canvas.grid.getHighlightLayer(this.highlightId).alpha = 0;
    
    }  

    _applyRenderFlags(flags) {
        super._applyRenderFlags(flags);    
        if (flags.refreshState ) {
            game.canvas.grid.getHighlightLayer(this.highlightId).alpha = 0;
        }
    }

    _refreshTemplate() {
        const t = this.template.clear();
    
        // Draw the Template outline
        t.lineStyle(this._borderThickness, this.borderColor, 0.75).beginFill(0x000000, 0.0);
    
        // Fill Color or Texture
        if ( this.texture ) t.beginTextureFill({texture: this.texture});
        else t.beginFill(0x000000, 0.0);
    
        // Draw the shape
        t.drawShape(this.shape);
    
        // Draw origin and destination points
        t.lineStyle(this._borderThickness, 0x000000)
          .beginFill(0x000000, 0.5)
          .endFill();
      }
}