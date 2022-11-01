import Actordsa5 from "../actor/actor-dsa5.js"
import DSAActiveEffectConfig from "../status/active_effects.js"
import CreatureType from "../system/creature-type.js"
import EquipmentDamage from "../system/equipment-damage.js"
import DSA5_Utility from "../system/utility-dsa5.js"


export default class TableEffects{
    //todo maybe add the effect later with second button and undspecific target

    static async applyEffect(id, mode){
        const message = game.messages.get(id)
        const hasEffect = getProperty(message, "flags.dsa5.hasEffect")
        const options = getProperty(message, "flags.dsa5.options") || {}
 
        console.log(hasEffect, options)
        if(hasEffect) {
            //maintain order
            const methods = ["damageModifier", "gearDamaged", "gearLost", "resistEffect", "malus", "selfDamage"]

            let targets = []
            let source = undefined

            if(mode == "self") {
                const speaker = DSA5_Utility.getSpeaker(options.speaker)
                targets.push(speaker)
                source = options.source ? speaker.items.get(options.source) : undefined
            }
            else targets = Array.from(game.user.targets).map(x => x.actor)

            for(let method of methods){
                const ef = getProperty(hasEffect, method)
                if(ef) {
                    const result = await TableEffects[method](ef, mode, targets, source, id, message)
                    if(!result) console.warn(`Table effect for <${method} not working yet`, args, mode,  targets, source)
                }
            }
            const tt = game.i18n.format("ActiveEffects.appliedEffect", { source: game.i18n.localize('table'), target: targets.map(x => x.name).join(", ") })
            await message.update({ content: message.content.replace(/hideAnchor">/, `hideAnchor"><i class="fas fa-check" style="float:right" data-tooltip="${tt}"></i>`) })
        }
    }

    static async damageModifier(args, mode, targets, source){
        //TODO
    } 
    
    static async gearDamaged(args, mode, targets, source){
        if(source && ["meleeweapon", "rangeweapon"].includes(source.type)){
            const attributes = getProperty(source, "system.effect.attributes") || ""
            const regex = new RegExp(`(${CreatureType.magical}|${CreatureType.clerical})`, "i")
            const isMagical = regex.test(attributes)
            if(isMagical)
                await source.update({"system.worn.value": false})    
            else
                await EquipmentDamage.absoluteDamageLevelToItem(source, args) 
                
            return true
        }
    }

    static async gearLost(args, mode, targets, source){
        if(source && ["meleeweapon", "rangeweapon"].includes(source.type)){
            await source.update({"system.worn.value": false})
            if(args.distance) {
                const roll = await new Roll(args.distance).evaluate({async: true})
                const renderedRoll = await roll.render()
                const msg = game.i18n.format("WEAPON.dropped", {distance: roll.total})
                ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${msg}</p>${renderedRoll}`))
            }
            return true
        }
    }

    static async resistEffect(args, mode, targets, source, id){
        for(let target of targets){
            const resistRolls = [
                {
                    skill: args.roll,
                    mod: args.modifier || 0,
                    effect: {_id: "botchEffect", label: args.fail.description},
                    target,
                    token: target.token ? target.token.id : undefined
                }
            ]
            DSAActiveEffectConfig.createResistRollMessage(resistRolls, id, mode)
        }
        return true
    }

    static evaluateTargetArg(args, targets) {
        let finalTargets = targets
        let hasTargets = true
        if(args.target == "victim"){
            const newTargets = Array.from(game.user.targets).map(x => x.actor)
            if(newTargets.length) 
                finalTargets = newTargets
            else {
                hasTargets = false
                ui.notifications.warn("DSAError.noVictim")
            }                
        } 
        return { hasTargets, finalTargets}
    }

    static async malus(args, mode, targets, source){
        const { hasTargets, finalTargets} = this.evaluateTargetArg(args, targets)
        
        for(let malus of args){
            const alternateEffect = !hasTargets && malus.noTarget
            const systemEffect = alternateEffect ? malus.noTarget.systemEffect : malus.systemEffect
            const systemEffectLevel  = alternateEffect ? malus.noTarget.level : malus.level

            const changes = alternateEffect ? malus.noTarget.changes : malus.changes
            const duration = alternateEffect ? malus.noTarget.duration : malus.duration

            if(systemEffect){
                //todo duration for system effects
                for(let target of finalTargets){
                    await target.addCondition(systemEffect, systemEffectLevel || 1 , false, false)
                }
                return true
            } else if(changes) {
                const ef = new OnUseEffect().effectDummy(game.i18n.localize("botchCritEffect"), changes || [], duration || { })
                    
                mergeObject(ef, {
                    flags: {
                        dsa5: {
                            hideOnToken: false,
                            hidePlayers: false,
                        }
                    }
                })
                    
                for(let target of finalTargets){
                    await target.addCondition(ef)
                }
                return true
            }
        }
    }

    //todo selfattack similar to selfdamage but with defense
    //todo include target area
    //todo args defendable modifier
    static async selfAttack(args, mode, targets, source){

    }

    static async selfDamage(args, mode, targets, source){
        const { hasTargets, finalTargets} = this.evaluateTargetArg(args, targets)
        
        if(source){
            const obj = DSA5_Utility.toObjectIfPossible(source)
            for(let actor of finalTargets){
                const combatskills = actor.items.filter(x => x.type == "combatskill").map(x => Actordsa5._calculateCombatSkillValues(x.toObject(), actor.system))
                let preparedItem
                if(args.damage)
                    preparedItem = { damagedie: args.damage, damageAdd: ""}
                else if(source.type == "rangeweapon")
                    preparedItem = Actordsa5._prepareRangeWeapon(obj, [], combatskills, actor)
                else if(source.type == "meleeweapon")
                    preparedItem =  Actordsa5._prepareMeleeWeapon(obj, combatskills, actor)                    
                else
                    preparedItem = source.system.traitType.value == "meleeAttack" ? Actordsa5._prepareRangeTrait(obj) : Actordsa5._prepareMeleetrait(obj) 
                
                const damage = (preparedItem.damagedie + preparedItem.damageAdd).replace(/wWD/g, "d")
                const roll = await new Roll(`(${damage})*${args.multiplier || 1}${args.modifier || ""}`).evaluate({async: true})
                
                await actor.applyDamage(Math.round(roll.total))
                ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()))
            }
            return true
        }
    }
}