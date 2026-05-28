import { getShapeshiftingPreset, SHAPESHIFTING_PRESET_KEYS } from './shapeshifting/shapeshifting_presets.js'

const { mergeObject, getProperty, setProperty, deepClone } = foundry.utils

export default class ShapeshiftWizard extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {

    constructor(app) {
        super(app)
        this.updating = false
        this.formPreset = {}
    }

    static DEFAULT_OPTIONS = {
        window: {
            title: "Shapeshift.title",
            resizable: true,
            contentClasses: ['standard-form'],
        },
        position: {
            width: 800,
            height: 740,
        },
        classes: ["dsa5", "largeDialog"],
        actions: {
            cancel: function () { this.close() },
            ok: this._shapeshift,
            applyPreset: this._applyPreset,
        }
    };

    _configureRenderParts(options) {
        return {
            main: {
                template: 'systems/dsa5/templates/wizard/shapeshiftwizard.hbs',
                scrollable: [''],
            }
        }
    }

    static buildDefaultFormState(source) {
        return {
            radios: {
                'system.characteristics.mu': 'source',
                'system.characteristics.kl': 'source',
                'system.characteristics.in': 'source',
                'system.characteristics.ch': 'source',
                'system.characteristics.ff': 'target',
                'system.characteristics.ge': 'target',
                'system.characteristics.ko': 'target',
                'system.characteristics.kk': 'target',
                'system.status.wounds': 'source',
                'system.status.karmaenergy': 'target',
                'system.status.astralenergy': 'target',
                'system.status.toughness': 'target',
                'system.status.soulpower': 'source',
                body: 'target',
                social: 'source',
                knowledge: 'source',
                trade: 'source',
                nature: 'source',
            },
            checkboxes: {
                calculateLeP: true,
                takeAdvantages: true,
                takeSkills: true,
                takeSpecAbs: false,
                takeSpells: false,
                takeLiturgies: false,
                keepVision: !source?.isToken,
                keepToken: false,
                keepItems: false,
            },
        }
    }

    static buildFormState(source, formPreset = {}) {
        const state = deepClone(this.buildDefaultFormState(source))
        mergeObject(state, formPreset || {})
        if (typeof state.checkboxes.keepVision === 'undefined') {
            state.checkboxes.keepVision = !source?.isToken
        }
        return state
    }

    async setShapeshift(source, target, formPreset = {}) {
        this.source = source
        this.target = target
        this.formPreset = deepClone(formPreset || {})
    }

    async _prepareContext(_options) {
        const data = await super._prepareContext(_options);
        const formState = ShapeshiftWizard.buildFormState(this.source, this.formPreset)
        mergeObject(data, {
            source: this.source,
            target: this.target,
            keepVision: !!formState.checkboxes.keepVision,
            keepItems: !!formState.checkboxes.keepItems,
            keepToken: !!formState.checkboxes.keepToken,
            calculateLeP: !!formState.checkboxes.calculateLeP,
            takeAdvantages: !!formState.checkboxes.takeAdvantages,
            takeSkills: !!formState.checkboxes.takeSkills,
            takeSpecAbs: !!formState.checkboxes.takeSpecAbs,
            takeSpells: !!formState.checkboxes.takeSpells,
            takeLiturgies: !!formState.checkboxes.takeLiturgies,
            presets: SHAPESHIFTING_PRESET_KEYS.map(key => ({
                key,
                label: `Shapeshift.Presets.${key}`,
            })),
            characteristics_mental: ["mu", "kl", "in", "ch"],
            characteristics_physical: ["ff", "ge", "ko", "kk"],
            status: [{
                label: "wounds",
                selected: formState.radios['system.status.wounds'] !== 'target'
            }, {
                label: "karmaenergy",
                selected: formState.radios['system.status.karmaenergy'] !== 'target'
            }, {
                label: "astralenergy",
                selected: formState.radios['system.status.astralenergy'] !== 'target'
            }],
            secondaryAttributes: [{
                label: "toughness",
                selected: formState.radios['system.status.toughness'] !== 'target'
            }, {
                label: "soulpower",
                selected: formState.radios['system.status.soulpower'] !== 'target'
            }],
            skillGroups: Object.entries(game.dsa5.config.skillGroups).map(([key, value]) => {
                return {
                    label: value,
                    key,
                    selected: formState.radios[key] !== 'target'
                }
            })
        })
        data.characteristics_mental = data.characteristics_mental.map((label) => ({
            label,
            selected: formState.radios[`system.characteristics.${label}`] !== 'target'
        }))
        data.characteristics_physical = data.characteristics_physical.map((label) => ({
            label,
            selected: formState.radios[`system.characteristics.${label}`] !== 'target'
        }))
        return data
    }

    static async _applyPreset(ev, target) {
        this.formPreset = getShapeshiftingPreset(target.dataset.preset)
        await this.render({ force: true })
    }

    static shapeshiftEffect(proportional, source) {
        return {
            name: _loc("CONDITION.shapeshift"),
            img: "icons/svg/pawprint.svg",
            statuses: ["shapeshift"],
            description: _loc("CONDITIONDESCRIPTION.shapeshift"),
            flags: {
                dsa5: {
                    originalActor: source.id,                    
                    proportional
                }
            }
        }
    }

    static async _shapeshift(ev, target) {
        if (!this.updating) {
            if (!this.source.isOwner) return ui.notifications.error("DSAError.onlyGMcanShapeshift", { localize: true })

            this.updating = true
            const html = $(this.element)
            html.find('[data-action="ok"] i').toggleClass("fa-check fa-spinner fa-spin")
            const form = html.find('form')[0];

            const data = new foundry.applications.ux.FormDataExtended(form).object;
            const sourceProperties = []
            for (const k of html.find('input:checked')) {
                const { value, name } = k;

                if (value == "source") {
                    sourceProperties.push({ className: k.dataset.group, name })
                }
            }

            if (game.user.isGM) {
                await ShapeshiftWizard.finish_shapeshift(this.source, this.target, data, sourceProperties)
            } else {
                game.socket.emit('system.dsa5', {
                    type: 'requestShapeshift',
                    payload: {
                        sourceUuid: this.source.uuid,
                        targetUuid: this.target.uuid,
                        data,
                        sourceProperties,
                        userId: game.user.id
                    },
                });
                ui.notifications.info('Shapeshift.requestToGm', { localize: true })
                this.source.sheet.close()
                this.target.sheet.close()
            }

            this.closeWizard()
        }
    }

    static async onRequestShapeshift(payload) {
        const { sourceUuid, targetUuid, data, sourceProperties, userId } = payload;
        const user = game.users.get(userId);
        const source = await fromUuid(sourceUuid);
        const target = await fromUuid(targetUuid);
        const content = await TextEditor.enrichHTML(_loc('Shapeshift.userRequest', {
            name: user.name,
            source: source.link,
            target: target.link
        }))

        const proceed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Shapeshift.title" },
            content: `<p>${content}</p>`,
            rejectClose: false,
        });
        if (!proceed) return;

        await ShapeshiftWizard.finish_shapeshift(source, target, data, sourceProperties, true);
    }

    /**
     * Play a morph transition on every active token that changed texture.
     * Falls back gracefully when the canvas is not ready.
     */
    static async _animateTokenTransition(tokens, newTextureSrc) {
        if (!canvas.ready) return

        for (const token of tokens) {
            const placeable = token.object ?? canvas.tokens?.get(token.id)?.object
            if (!placeable) continue

            if (placeable.document.texture.src !== newTextureSrc) {
                await placeable.animate(
                    { texture: { src: newTextureSrc } },
                    { transition: 'morph', duration: 1000 }
                )
            } else {
                // Same texture — drive a manual swirl transition for visual feedback
                const mesh = placeable.mesh
                if (!mesh) continue

                const Filter = foundry.canvas.rendering.filters.TextureTransitionFilter
                const CanvasAnimation = foundry.canvas.animation.CanvasAnimation

                const filter = Filter.create()
                filter.type = Filter.TYPES.SWIRL
                const targetRT = canvas.app.renderer.generateTexture(mesh, { resolution: mesh.texture.resolution })
                filter.targetTexture = targetRT

                mesh.filters ??= []
                mesh.filters.unshift(filter)

                const promise = CanvasAnimation.animate(
                    [{ attribute: 'progress', parent: filter.uniforms, to: 1 }],
                    { name: `shapeshift-${placeable.id}`, duration: 1000, context: mesh }
                )
                promise.finally(() => {
                    mesh.filters?.findSplice(f => f === filter)
                    targetRT.destroy(true)
                })
            }
        }
    }

    static _sceneTokenDocument(token) {
        return token?.document ?? token;
    }

    static _activeTokenDocuments(actor) {
        const documents = actor.getActiveTokens(true).map(token => this._sceneTokenDocument(token)).filter(token => token?.id);
        if (documents.length || !canvas.scene) return documents;

        return canvas.scene.tokens.filter(token => token.actorId === actor.id || token.actor?.id === actor.id);
    }

    static async _deleteShapeshiftEffect(shapeshift, ...actors) {
        const parent = shapeshift.parent?.documentName === 'Actor' ? shapeshift.parent : null;
        const owners = [parent, ...actors].filter((actor, index, candidates) => {
            return actor?.effects?.has(shapeshift.id) && candidates.findIndex(candidate => candidate?.uuid === actor.uuid) === index;
        });
        for (const owner of owners) {
            await owner.deleteEmbeddedDocuments("ActiveEffect", [shapeshift.id], { noHook: true })
        }
    }

    static async finish_shapeshift(source, target, data, sourceProperties, remote = false) {
        const proportionalLeP = !!data.calculateLeP
        const proportionSettings = {
            wounds: proportionalLeP && data["system.status.wounds"] == "target",
            astralenergy: proportionalLeP && data["system.status.astralenergy"] == "target",
            karmaenergy: proportionalLeP && data["system.status.karmaenergy"] == "target"
        }
        await source.addCondition(ShapeshiftWizard.shapeshiftEffect(proportionSettings, source))
        const sourceData = source.toObject()
        const targetData = target.toObject()
        targetData.name = `${sourceData.name} - ${targetData.name}`

        if (targetData.prototypeToken.randomImg) {
            const images = await target.getTokenImages()
            if (images.length) {
                targetData.prototypeToken.texture.src = images[Math.floor(Math.random() * images.length)]
            }
            targetData.prototypeToken.randomImg = false
        }

        for (const k of sourceProperties) {
            const { className, name } = k;
            const attr = getProperty(source, name)

            if (className == "characteristic") {
                setProperty(targetData, `${name}.initial`, attr.initial + attr.advances)
            } else if (className == "status") {
                setProperty(targetData, `${name}.value`, attr.value)
                setProperty(targetData, `${name}.initial`, attr.max - attr.gearmodifier)
            } else if (className == "secondary") {
                setProperty(targetData, `${name}.value`, attr.value)
            }
        }

        if (proportionSettings.wounds) {
            const proportional = Math.max(1, Math.round((targetData.system.status.wounds.initial + targetData.system.status.wounds.advances) * source.system.status.wounds.value / source.system.status.wounds.max))
            setProperty(targetData, `system.status.wounds.value`, proportional)
        }

        const sourceEffects = sourceData.effects.filter(x => [null, undefined, `Actor.${sourceData._id}`].includes(x.origin))
        targetData.effects = targetData.effects.concat(sourceEffects.map(x => {
            x.origin = undefined
            return x
        }))

        targetData.ownership = sourceData.ownership
        targetData.folder = sourceData.folder
        targetData.flags = sourceData.flags

        targetData.prototypeToken.name = sourceData.name
        targetData.prototypeToken.actorLink = sourceData.prototypeToken.actorLink
        targetData.system.status.fatePoints.current = sourceData.system.status.fatePoints.current
        targetData.system.status.fatePoints.value = sourceData.system.status.fatePoints.value

        game.dsa5.apps.DSA5_Utility.calcTokenSize(targetData, targetData.prototypeToken)

        const tokenConfig = ["displayName", "actorLink", "disposition", "displayBars", "bar1", "bar2"];
        if (data.keepVision) {
            tokenConfig.push('sight', 'light');
        }

        const sourceToken = source.getActiveTokens().length ? source.getActiveTokens()[0].document.toObject() : sourceData.prototypeToken

        for (const c of tokenConfig) {
            setProperty(targetData.prototypeToken, c, getProperty(sourceToken, c))
        }

        const filters = []
        if (data.takeAdvantages) filters.push("advantage", "disadvantage")
        if (data.takeSpecAbs) filters.push("specialability")
        if (data.takeSpells) filters.push("spell", "ritual", "magictrick")
        if (data.takeLiturgies) filters.push("liturgy", "ceremony", "blessing")
        if (data.keepItems) filters.push(...game.dsa5.config.equipmentCategories)

        if (data.takeSkills) {
            filters.push("combatskill")
            targetData.items = targetData.items.filter(x => !["combatskill"].includes(x.type))
        }

        const groupKeeps = sourceProperties.filter(x => x.className == "talents").map(x => x.name)

        targetData.items = targetData.items.filter(x => {
            return x.type != 'skill' || !groupKeeps.includes(x.system.group.value)
        })
        const newItems = sourceData.items.filter(x => {
            return x.type == "skill" && groupKeeps.includes(x.system.group.value)
        }).map(x => deepClone(x))

        const keepToken = data.keepToken;
        const existing = targetData.items.filter(x => filters.includes(x.type)).map(x => x.name)
        newItems.push(...sourceData.items.filter(x => filters.includes(x.type) && !existing.includes(x.name)).map(x => deepClone(x)))

        targetData.items.push(...newItems)
        if (keepToken) targetData.img = source.img

        if (source.isToken) {
            mergeObject(targetData, {
                flags: {
                    dsa5: {
                        originalDelta: source.token.delta.toObject()
                    }
                }
            })

            const tokenData = {
                x: source.token.x,
                y: source.token.y,
                elevation: source.token.elevation,
                actorLink: false,
                name: targetData.name,
                delta: targetData,
            }
            if (keepToken) {
                mergeObject(tokenData, {
                    width: sourceData.prototypeToken.width,
                    height: sourceData.prototypeToken.height,
                    texture: {
                        src: sourceData.prototypeToken.texture.src,
                        scaleX: sourceData.prototypeToken.texture.scaleX,
                        scaleY: sourceData.prototypeToken.texture.scaleY
                    }
                })
            }

            for (const c of tokenConfig) setProperty(tokenData, c, getProperty(sourceToken, c))

            const tempToken = await target.getTokenDocument(tokenData, { parent: canvas.scene })
            const createdToken = await TokenDocument.implementation.create(tempToken, { parent: canvas.scene });
            await ShapeshiftWizard._animateTokenTransition([createdToken], createdToken.texture.src)
            await source.token.delete()
            await source.sheet.close()
            if (!remote) createdToken.actor.sheet.render(true)
            return
        }

        delete targetData.prototypeToken.actorId
        await source.sheet.close()

        const actor = await game.dsa5.entities.Actordsa5.create(targetData, { renderSheet: !remote })

        const tokens = ShapeshiftWizard._activeTokenDocuments(source)

        if (canvas.scene) {
            for (const token of tokens) {
                const newTokenData = deepClone(targetData.prototypeToken)
                if (keepToken) {
                    mergeObject(newTokenData, {
                        width: source.prototypeToken.width,
                        height: source.prototypeToken.height,
                        texture: {
                            src: source.prototypeToken.texture.src,
                            scaleX: source.prototypeToken.texture.scaleX,
                            scaleY: source.prototypeToken.texture.scaleY
                        }
                    })
                }
                newTokenData._id = token.id
                newTokenData.actorId = actor.id

                await canvas.scene.updateEmbeddedDocuments("Token", [newTokenData])
            }

            await ShapeshiftWizard._animateTokenTransition(tokens, targetData.prototypeToken.texture?.src ?? targetData.img)
        }

        ui.notifications.info("Shapeshift.done", { localize: true })
    }

    closeWizard() {
        this.close()
        this.updating = false
    }

    async restoreShape(actor, shapeshift) {
        if (!actor.isOwner) {
            ui.notifications.error("DSAError.onlyGMcanShapeshift", { localize: true })
            return this.closeWizard()
        }
        if (game.user.isGM) {
            await ShapeshiftWizard.finalizeRestoreShape(actor, shapeshift)
        } else {
            actor.sheet.close()
            game.socket.emit('system.dsa5', {
                type: 'requestRestoreShape',
                payload: {
                    actorUuid: actor.uuid,
                    shapeshiftUuid: shapeshift.uuid,
                    userId: game.user.id
                },
            });
        }

        this.closeWizard()
    }

    static async onRestoreShape(payload) {
        const { actorUuid, shapeshiftUuid } = payload;
        const actor = await fromUuid(actorUuid);
        const shapeshift = await fromUuid(shapeshiftUuid);

        if (!actor || !shapeshift) return;

        await ShapeshiftWizard.finalizeRestoreShape(actor, shapeshift, true)
    }


    static async finalizeRestoreShape(actor, shapeshift, remote = false) {

        const original = await game.actors.get(shapeshift.flags.dsa5.originalActor)
        const proportionSettings = shapeshift.flags.dsa5.proportional

        if (!original) return;

        let currentHp = actor.system.status.wounds.value

        if (proportionSettings.wounds) currentHp = Math.max(1, Math.round(original.system.status.wounds.max * actor.system.status.wounds.value / actor.system.status.wounds.max))

        if (actor.isToken) {
            const delta = mergeObject(deepClone(actor.flags?.dsa5?.originalDelta ?? {}), {
                "system.status.wounds.value": currentHp,
            });
            delta.effects = (delta.effects ?? []).filter(effect => effect._id !== shapeshift.id && !effect.statuses?.includes?.('shapeshift'));

            const tokenData = {
                x: actor.token.x,
                y: actor.token.y,
                elevation: actor.token.elevation,
                actorLink: false,
                delta,
            }

            const tempToken = await original.getTokenDocument(tokenData, { parent: canvas.scene })
            const createdToken = await TokenDocument.implementation.create(tempToken, { parent: canvas.scene });
            await ShapeshiftWizard._animateTokenTransition([createdToken], createdToken.texture.src)
            await actor.token.delete()
            await actor.sheet.close()
            if (!remote) createdToken.actor.sheet.render(true)
            return
        }

        await ShapeshiftWizard._deleteShapeshiftEffect(shapeshift, original, actor)

        if (shapeshift.flags.dsa5.originalActor == actor.id) return;

        await original.update({ "system.status.wounds.value": currentHp })

        if (canvas.ready) {
            const tokens = ShapeshiftWizard._activeTokenDocuments(actor);

            for (const token of tokens) {
                const tokenData = original.prototypeToken.toObject();
                tokenData._id = token.id;
                tokenData.actorId = original.id;
                await canvas.scene.updateEmbeddedDocuments("Token", [tokenData]);
            }

            await ShapeshiftWizard._animateTokenTransition(tokens, original.prototypeToken.texture?.src ?? original.img)
        }

        const isRendered = actor.sheet.rendered;
        await actor.delete();
        original.sheet.render(isRendered);
        if (game.dsa5.apps.LightDialog) game.dsa5.apps.LightDialog.onDarknessChange()
        return original;
    }
}
