import DSAActiveEffectConfig from "../status/active_effects.js"
import DSA5_Utility from "../system/utility-dsa5.js"


export default class TableEffects{
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
                if(ef) await TableEffects[method](ef, mode, targets, source, id)
            }
        }
    }

    static async damageModifier(args, mode, targets, source){
        console.warn("not working yet damageModifier", args, mode,  targets, source)
    } 
    
    static async gearDamaged(args, mode, targets, source){
        console.warn("not working yet gearDamaged", args, mode,  targets, source)
    }

    static async gearLost(args, mode, targets, source){
        if(source)
            await source.update({"system.worn.value": false})
        else{
            console.warn("not working yet gearLost", args, mode,  targets, source)
        }
        
    }

    static async resistEffect(args, mode, targets, source, id){
        console.warn("not working yet resistEffect", args, mode,  targets, source)
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
    }

    static async malus(args, mode, targets, source){
        if(args.systemEffect){
            for(let target of targets){
                await target.addCondition(args.systemEffect, args.level || 1 , false, false)
            }
        }else{
            console.warn("not working yet malus", args, mode,  targets, source)
        }
    }

    static async selfDamage(args, mode, targets, source){
        console.warn("not working yet selfDamage", args, mode,  targets, source)
    }
}