export default function() {

    Hooks.once('diceSoNiceReady', (dice3d) => {
        dice3d.addColorset({
            name: 'mu',
            description: 'DSA5.mu',
            category: 'DSA5.dies',
            foreground: '#FFFFFF',
            background: '#b3241a',
            edge: '#b3241a',
            outline: '#FFFFFF',
            texture: 'none'
        });
        dice3d.addColorset({
            name: 'kl',
            description: 'DSA5.kl',
            category: 'DSA5.dies',
            foreground: '#FFFFFF',
            background: '#8259a3',
            edge: '#8259a3',
            outline: '#FFFFFF',
            texture: 'none'
        });
        dice3d.addColorset({
            name: 'in',
            description: 'DSA5.in',
            category: 'DSA5.dies',
            foreground: '#FFFFFF',
            background: '#388834',
            edge: '#388834',
            outline: '#FFFFFF',
            texture: 'none'
        });
        dice3d.addColorset({
            name: 'ch',
            description: 'DSA5.ch',
            category: 'DSA5.dies',
            foreground: '#FFFFFF',
            background: '#0d0d0d',
            edge: '#0d0d0d',
            outline: '#FFFFFF',
            texture: 'none'
        });
        dice3d.addColorset({
            name: 'ff',
            description: 'DSA5.ff',
            category: 'DSA5.dies',
            foreground: '#000000',
            background: '#d5b467',
            edge: '#d5b467',
            outline: '#FFFFFF',
            texture: 'none'
        });
        dice3d.addColorset({
            name: 'ge',
            description: 'DSA5.ge',
            category: 'DSA5.dies',
            foreground: '#000000',
            background: '#688ec4',
            edge: '#688ec4',
            outline: '#FFFFFF',
            texture: 'none'
        });
        dice3d.addColorset({
            name: 'ko',
            description: 'DSA5.ko',
            category: 'DSA5.dies',
            foreground: '#000000',
            background: '#a3a3a3',
            edge: '#a3a3a3',
            outline: '#FFFFFF',
            texture: 'none'
        });
        dice3d.addColorset({
            name: 'kk',
            description: 'DSA5.kk',
            category: 'DSA5.dies',
            foreground: '#000000',
            background: '#d6a878',
            edge: '#d6a878',
            outline: '#FFFFFF',
            texture: 'none'
        });
        dice3d.addColorset({
            name: 'attack',
            description: 'DSA5.attack',
            category: 'DSA5.dies',
            foreground: '#FFFFFF',
            background: '#b3241a',
            edge: '#b3241a',
            outline: '#b3241a',
            texture: 'none'
        });
        dice3d.addColorset({
            name: 'dodge',
            description: 'DSA5.dodge',
            category: 'DSA5.dies',
            foreground: '#FFFFFF',
            background: '#388834',
            edge: '#388834',
            outline: '#FFFFFF',
            texture: 'none'
        });
        dice3d.addColorset({
            name: 'parry',
            description: 'DSA5.parry',
            category: 'DSA5.dies',
            foreground: '#FFFFFF',
            background: '#388834',
            edge: '#388834',
            outline: '#FFFFFF',
            texture: 'none'
        });

        import ("../../../../modules/dice-so-nice/Utils.js").then(module => {
            game.dsa5.apps.DiceSoNiceCustomization = new DiceSoNiceCustomization(module)
        })
    });
}

class DiceSoNiceCustomization {
    constructor(module) {
        const colors = module.Utils.prepareColorsetList()
        let choices = {}
        for (const [key, value] of Object.entries(colors)) {
            mergeObject(choices, value)
        }

        const attrs = ["mu", "kl", "in", "ch", "ff", "ge", "ko", "kk", "attack", "dodge", "parry"]
        for (let attr of attrs) {
            game.settings.register("dsa5", `dice3d_${attr}`, {
                name: `CHAR.${attr.toUpperCase()}`,
                hint: "Dice so nice Colorset",
                scope: "client",
                config: true,
                default: attr,
                type: String,
                choices
            });
        }
    }
    getDiceSoNiceColor(value) {
        if (game.modules.get("dice-so-nice") && game.modules.get("dice-so-nice").active) {
            return game.settings.get("dsa5", `dice3d_${value}`)
        }
        return value
    }
}