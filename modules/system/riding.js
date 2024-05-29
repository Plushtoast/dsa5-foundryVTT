import DSA5_Utility from "./utility-dsa5.js"
const { mergeObject, getProperty, hasProperty } = foundry.utils

export default class Riding {
    static preRenderedUnmountHud = `
    <div class="control-icon" data-action="ride">
        <i class="fas fa-horse" style="transform: rotate(180deg)" data-tooltip="RIDING.unmount" width="36" height="36">
    </div>
    `
    static preRenderedMountHud = `<div class="control-icon" data-action="ride"><i class="fas fa-horse" data-tooltip="RIDING.mount" width="36" height="36"></div>`
    static preRenderedSpeedHud = `
    <div class="control-icon" data-action="rideIncrease"><i class="fas fa-caret-up" data-tooltip="RIDING.increase" width="36" height="36"></div>
    <div class="control-icon" data-action="rideDecrease"><i class="fas fa-caret-down" data-tooltip="RIDING.decrease" width="36" height="36"></div>
    `

    static async createTokenHook(token, options, id){
        if(!DSA5_Utility.isActiveGM()) return

        const scene = token.parent
        if(this.isRiding(token.actor) && scene.active){
            const horse = this.getHorse(token.actor)

            if(!horse) return

            const horseTokenSource = await horse.getTokenDocument()
            horseTokenSource.updateSource({ x: token.x, y: token.y, hidden: token.hidden })

            const horseToken = (await scene.createEmbeddedDocuments("Token", [horseTokenSource]))[0]
            const tokenUpdate = {"flags.dsa5.horseTokenId": horseToken.id, elevation: (horseToken.document.elevation ?? 0) + 1}
            mergeObject(tokenUpdate, this.adaptTokenSize(token, horseToken))
            await token.update(tokenUpdate)

            if(!horseToken.actorLink){
                await token.actor.update({
                    "system.horse.actorLink": false,
                    "system.horse.token": { scene: scene.id, token: horseToken.id }
                })
            }
        }
    }

    static isRiding(actor){
        return getProperty(actor, "system.horse.isRiding")
    }

    static updateTokenHook(token, data, options){
        if(!DSA5_Utility.isActiveGM()) return

        const horseId = getProperty(token, "flags.dsa5.horseTokenId")
        const scene = token.parent
        if(horseId && scene.active && (data.x || data.y) && this.isRiding(token.actor)){
            scene.updateEmbeddedDocuments("Token", [
                {
                    _id: horseId,
                    x: data.x ?? token.x,
                    y: data.y ?? token.y
                }
            ])
        }
    }

    static rollLoyalty(actor, options = {}){
        const horse = this.getHorse(actor)
        if(!horse) return

        const skill = this.getLoyaltyFromHorse(horse)
        if(!skill){
            return ui.notifications.warn(game.i18n.format("DSAError.notFound", {category: DSA5_Utility.categoryLocalization("skill"), name: game.i18n.localize("LocalizedIDs.loyalty")}))
        }
        horse.setupSkill(skill, options, horse.token?.id).then(setupData => {
            horse.basicTest(setupData)
        });
    }

    static async updateRiderSpeed(horse, newSpeed) {
        //Might need to speed this up somehow
        if(!canvas?.tokens?.documentCollection) return

        const horseIds = horse.getActiveTokens().map(x => x.id)
        for(let token of Array.from(canvas.tokens.documentCollection)){
            if(horseIds.includes(token.getFlag("dsa5", "horseTokenId"))){
                if(newSpeed != token.actor.system.status.speed.max){
                    token.actor.prepareData()
                    token.actor.sheet.render()
                }
            }
        }
    }

    static getLoyaltyFromHorse(horse){
        return horse.items.find(x => x.type == "skill" && x.name.startsWith(game.i18n.localize('LocalizedIDs.loyalty')))
    }

    static activateListeners(html, actor){
        html.find('.riding-toggle').click(() => this.toggleIsRiding(actor))
        html.find('.showHorse').click(() => this.getHorse(actor).sheet.render(true))
        html.find('.horse-delete').click(() => this.clearMount(actor))
        html.find('.horse-loyalty').click(() => this.rollLoyalty(actor))
        html.find('[name="horseSpeedSelector"]').change(async(ev) => {
            ev.preventDefault()
            const horse = Riding.getHorse(actor)
            Riding.setSpeed(horse, ev.currentTarget.value)
        })
    }

    static async toggleIsRiding(actor){
        await actor.update({"system.horse.isRiding": !actor.system.horse?.isRiding})

        const tokenUpdates = []
        if(!actor.system.horse.isRiding){
            for(let token of actor.getActiveTokens()){
                tokenUpdates.push({ _id: token.document.id, [`flags.dsa5.-=horseTokenId`]: null, elevation: Math.max(0, (token.document.elevation ?? 0) - 1) })
            }
            await this.removeRidingCondition(actor)
        }else{
            const horse =  this.getHorse(actor)
            let horseTokenId
            for(let horseToken of horse.getActiveTokens()){
                tokenUpdates.push({ _id: horseToken.document.id, [`flags.dsa5.-=horseTokenId`]: null })
                horseTokenId = horseToken.document.id
            }
            for(let token of actor.getActiveTokens()){
                tokenUpdates.push({ _id: token.document.id, elevation: Math.max(0, (token.document.elevation ?? 0) + 1), "flags.dsa5.horseTokenId": horseTokenId })
            }

            //TODO might need to create or search token?
            await this.addRidingCondition(actor)
        }
        await canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates, { noHooks: true })
    }

    static getRidingCondition(actor){
        const ridingLabel = game.i18n.localize("RIDING.riding")
        return actor.effects.find((x) => x.name == ridingLabel);
    }

    static async addRidingCondition(actor){
        if(!this.getRidingCondition(actor))
            await actor.addCondition(this.ridingCondition())
    }

    static async removeRidingCondition(actor){
        const ef = this.getRidingCondition(actor)
        if (ef) await actor.deleteEmbeddedDocuments("ActiveEffect", [ef.id]);
    }

    static deleteTokenHook(){
        console.warn("delete riding token hook not implemented")
    }

    static getHorse(actor, returnEmptyHorse = false){
        let horse
        if(actor.system.horse){
            if(actor.system.horse.token && !actor.system.horse.actorLink)
                horse = DSA5_Utility.getSpeaker(actor.system.horse.token)
            else
                horse = game.actors.get(actor.system.horse.actorId)

            if(!horse && returnEmptyHorse && actor.system.horse.isRiding){
                horse = { name: game.i18n.localize('unknown') }
            }
        }
        return horse
    }

    static async unmountHorse(actor, token){
        const tokenUpdate = { [`flags.dsa5.-=horseTokenId`]: null, elevation: Math.max(0, (token.document.elevation ?? 0) - 1) }
        const tokenResized = token.getFlag("dsa5", "horseResized")
        if(tokenResized){
            mergeObject(tokenUpdate, {
                [`flags.dsa5.-=horseResized`]: null,
                width: tokenResized.width,
                height: tokenResized.height
            })
        }
        await this.clearMount(actor)
        await token.update(tokenUpdate)
    }

    static async clearMount(actor){
        await actor.update({
            system: {
                horse: {
                    isRiding: false,
                    actorLink: false,
                    actorId: "",
                    "-=token": null
                }
            }
        })
        await this.removeRidingCondition(actor)
    }

    static ridingCondition() {
        return {
            name: game.i18n.localize("RIDING.riding"),
            img: "systems/dsa5/icons/thirdparty/horse-head.svg",
            changes: [{key: "system.status.dodge.gearmodifier", mode: 2, value: -2}],
            flags: {
                dsa5: {
                description: game.i18n.localize("RIDING.ridingDescription"),
                },
            },
        };
      }

    static async setHorse(rider, horse) {
        const actorUpdate = {
            system: {
                horse: {
                    isRiding: true,
                    actorLink: horse.prototypeToken.actorLink,
                    actorId: horse.id
                }
            }
        }
        if(!horse.prototypeToken.actorLink && horse.token){
            mergeObject(actorUpdate, {
                system: { horse: {
                    token: { scene: canvas.scene.id, token: horse.token.id }
                 }}
            })
        }
        await rider.update(actorUpdate)
        if(horse.isToken){
            await canvas.scene.updateEmbeddedDocuments("Token",
            rider.getActiveTokens().map(x => { return { _id: x.id, "flags.dsa5.horseTokenId": horse.token.id, x: horse.token.x, y: horse.token.y}}).concat(
                { _id: horse.token.id, [`flags.dsa5.-=horseTokenId`]: null }
            ), { noHooks: true })
        }
        await this.addRidingCondition(rider)
    }

    static adaptTokenSize(riderTokenDocument, horseTokenDocument){
        if(riderTokenDocument.width >= horseTokenDocument.width){
            return { width: 0.7 * horseTokenDocument.width, height: 0.7 * horseTokenDocument.height, "flags.dsa5.horseResized": { width: riderTokenDocument.width, height: riderTokenDocument.height } }
        }
        return {}
    }

    static async mountHorse(rider){
        const horse = canvas.tokens.controlled.find(x => x.document.id != rider.id)
        const scene = rider.parent

        const actorUpdate = {
            system: {
                horse: {
                    isRiding: true,
                    actorLink: horse.actorLink,
                    actorId: horse.actor.id
                }
            }
        }
        if(!horse.actorLink){
            mergeObject(actorUpdate, {
                system: { horse: {
                    token: { scene: scene.id, token: horse.id }
                 }}
            })
        }

        const riderTokenUpdate = { _id: rider.id, "flags.dsa5.horseTokenId": horse.id, x: horse.x, y: horse.y, elevation: (horse.document.elevation ?? 0) + 1}
        mergeObject(riderTokenUpdate, this.adaptTokenSize(rider.document, horse.document))
        await rider.actor.update(actorUpdate)
        await canvas.scene.updateEmbeddedDocuments("Token",
        [
            riderTokenUpdate,
            { _id: horse.id, [`flags.dsa5.-=horseTokenId`]: null }
        ], { noHooks: true })
        await this.addRidingCondition(rider.actor)
    }

    static speedKeys = {
        "0": { key: "system.status.speed.multiplier", mode: 5, value: 0},
        "-4": { key: "system.status.speed.initial", mode: 5, value: 4},
        "-5000": { key: "system.status.speed.multiplier", mode: 5, value: 0.66},
        "-8": { key: "system.status.speed.multiplier", mode: 5, value: 1}
    }

    static getHorseSpeed(horse){
        return horse.effects.find(x => getProperty(x, "flags.dsa5.horseSpeed"))?.flags.dsa5.horseSpeed || 0
    }

    static horseSpeedModifier(horse){
        const speed = this.getHorseSpeed(horse)
        return Object.keys(this.speedKeys).map(x => Number(x)).indexOf(Number(speed))
    }

    static increaseSpeed(horse){
        const speed = this.getHorseSpeed(horse)
        const newIndex = Math.min(3, Object.keys(this.speedKeys).map(x => Number(x)).indexOf(speed) + 1)
        this.setSpeed(horse, Object.keys(this.speedKeys).map(x => Number(x))[newIndex])
    }

    static decreaseSpeed(horse){
        const speed = this.getHorseSpeed(horse)
        const newIndex = Math.max(0, Object.keys(this.speedKeys).map(x => Number(x)).indexOf(speed) - 1)
        this.setSpeed(horse, Object.keys(this.speedKeys).map(x => Number(x))[newIndex])
    }

    static async setSpeed(horse, speed){
        await horse.deleteEmbeddedDocuments("ActiveEffect", horse.effects.filter(x => hasProperty(x, "flags.dsa5.horseSpeed")).map(x => x.id))
        await horse.addCondition({
            name: game.i18n.localize("speed") + ": " + game.i18n.localize(`RIDING.speeds.${speed}`),
            icon: "systems/dsa5/icons/thirdparty/horse-head.svg",
            changes: [this.speedKeys[speed]],
            flags: {
                dsa5: {
                    description: game.i18n.localize(`RIDING.speed.${speed}`),
                    horseSpeed: speed
                },
            },
        })
    }

    static renderTokenHUD(app, html, data){
        const actor = app.object.actor

        if(canvas.tokens.controlled.length == 2){
            html.find('.col.left').prepend(this.preRenderedMountHud)
            const btn = html.find('.control-icon[data-action="ride"]')
            btn.click(() => this.mountHorse(app.object))
        } else if(this.isRiding(actor)){
            html.find('.col.left').prepend(this.preRenderedUnmountHud)
            const btn = html.find('.control-icon[data-action="ride"]')
            btn.click(() => {
                this.unmountHorse(actor, app.object.document)
                btn.remove()
            })
            const horse = this.getHorse(actor)
            html.find('.col.right').prepend(this.preRenderedSpeedHud)
            const btn2 = html.find('.control-icon[data-action="rideIncrease"]')
            btn2.click(() => this.increaseSpeed(horse))
            const btn3 = html.find('.control-icon[data-action="rideDecrease"]')
            btn3.click(() => this.decreaseSpeed(horse))
        }
    }
}