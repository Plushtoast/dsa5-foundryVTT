import DPS from "./derepositioningsystem.js"
import { MeasuredTemplateDSA } from "./measuretemplate.js"
import OnUseEffect from "./onUseEffects.js"
import DSA5_Utility from "./utility-dsa5.js"

export class DSAAura {
    static bindAuraHooks() {
        Hooks.on("DSAauraRefresh", (aura, sourceToken) => {
            if(!DSA5_Utility.isActiveGM()) return

            DSAAura.updateTokenAura(aura, sourceToken)
        })

        if (DSA5_Utility.moduleEnabled("autoanimations")) {
            Hooks.on("createMeasuredTemplate", async (template, data, userId) => {
                if (!DSA5_Utility.isActiveGM()) return

                const uuid = getProperty(template, "flags.dsa5.origin")

                if(!uuid) return

                const item = await fromUuid(uuid)

                if(!item) return

                DSAAura.applyTemplateToTargets(template, item)
            });
        }
    }

    static async applyTemplateToTargets(template, item) {
        let wait = 0
        while(wait < 10000 && !template.object?.shape) {
            await new Promise(r => setTimeout(r, 100))
            wait += 100
        }
        for(let token of canvas.scene.tokens) {
            if(template.object.shape.contains(token.object.center.x - template.x, token.object.center.y - template.y)) {
                console.log("Token in template", token.name)    
            }
        }

        if(DSA5_Utility.moduleEnabled("autoanimations")) {
            for(let token of item.parent.getActiveTokens()) {
                AutomatedAnimations.playAnimation(token, item, { targets: [], workflow: template, isTemplate: true, templateData: template })
            }
        }
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
            await this.removeAura(aura)            
        }
    }   

    static async removeAura(aura, token) {
        for(const otherToken of canvas.scene.tokens) {
            const existingEffect = otherToken.actor.effects.find(e => getProperty(e, "flags.dsa5.templateSource") == aura)
            if(existingEffect) {
                await otherToken.actor.deleteEmbeddedDocuments("ActiveEffect", [existingEffect.id])
            }
        }
    }    

    static async refreshAnimations(token) {
        if(game.ready && DSA5_Utility.moduleEnabled("autoanimations")) {
            Sequencer.EffectManager.endEffects({ name: "spot*", object: token })            
            for(let aura in token.auras) {
                const template = token.auras[aura].template
                const effect = template.document.flags.dsa5.effect
                AutomatedAnimations.playAnimation(token, effect, { targets: [], workflow: template, isTemplate: true, templateData: template })               
           }
           token.requiresAnimationRefresh = false
        } else if(game.ready) {
           token.requiresAnimationRefresh = false
        }
    }

    static removeAuras(token, foundAuras) {
        for(let aura in token.auras) {
            if(!foundAuras.includes(aura)) {
                if(!token.auras[aura]) continue

                token.auras[aura].child.destroy()
                delete token.auras[aura]
                if(DSA5_Utility.isActiveGM()) DSAAura.removeAura(aura, this)
                token.requiresAnimationRefresh = true
            }
        }
    }

    static async drawAuras(token, force = false) {
        token.auras ||= {}

        const foundAuras = []

        if(force) DSAAura.removeAuras(token, foundAuras)

        for(let aura of token.actor.auras) {
            const effect = await fromUuid(aura)

            if(token.auras[aura]) {
                foundAuras.push(aura)
                Hooks.call("DSAauraRefresh", token.auras[aura], token)
            } else {
                const template = AuraTemplate.fromItem(effect, token, aura)
                if(!template) continue

                const child = token.addChild(template)
                child.draw().then(ch => {
                    ch.template.x -= token.document.x
                    ch.template.y -= token.document.y
                })                

                token.auras[aura] = { child, template }
                foundAuras.push(aura)
                Hooks.call("DSAauraRefresh", token.auras[aura], token)
                token.requiresAnimationRefresh = true
            }        
            
        }

        DSAAura.removeAuras(token, foundAuras)

        if(token.requiresAnimationRefresh) {
            DSAAura.refreshAnimations(token)
        }
        
        DSAAura.checkAuraEntered(token.document)
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
 
    static async updateTokenAura(aura, sourceToken) {        
        const { child, template } = aura
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
            borderColor: effect.flags.dsa5.borderColor,
            flags: {
                dsa5: {
                    effect: newEffect,
                    auraSource: auraId,
                    isAura: true,
                    borderThickness: effect.flags.dsa5.borderThickness || 3,
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
        if(flags.refreshState) game.canvas.grid.getHighlightLayer(this.highlightId).alpha = 0;
    }

    _refreshTemplate() {
        const t = this.template.clear();
        if(this.document.borderColor != null)
            t.lineStyle(this.document.flags.dsa5.borderThickness, this.borderColor, 0.75).beginFill(0x000000, 0.0);

        t.drawShape(this.shape);
      }
}