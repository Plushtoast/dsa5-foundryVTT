export default class DSA5SoundEffect {
    static sounds
    static triedInit = false

    static async playEffect(action, item) {
        const soundPath = await this.getSound(action, item)
        if (soundPath) {
            try {
                AudioHelper.play({ src: soundPath, volume: 0.8, loop: false }, true);
            } catch (exception) {
                console.warn(`Could not play item sound effect ${soundPath}`)
            }
        }
    }

    static async loadSoundConfig() {
        const effectFile = await game.settings.get("dsa5", "soundConfig")
        if (effectFile) {
            try {
                let file = await fetch(effectFile)
                let json = await file.json()
                this.sounds = json
                console.log("DSA5 | Sound Config Loaded")
            } catch (exception) {
                console.warn(exception)
            }

        }
    }

    static async getSound(action, item) {
        if (!this.sounds && !this.triedInit) {
            await this.loadSoundConfig()
            this.triedInit = true

        }

        if (!this.sounds) return undefined

        let paths = []
        let result
        switch (item.type) {
            case "meleeweapon":
            case "rangeweapon":
                paths = [
                    `${item.type}.manual.${item.name}.${action}`,
                    `${item.type}.manual.${item.name}.default.${action}`,
                    `${item.type}.manual.${item.name}.default`,
                    `${item.type }.${item.data.combatskill.value }.${action}`,
                    `${item.type}.${item.data.combatskill.value}.default`
                ]
                break
            case "skill":
                paths = [
                    `${item.type}.${item.name}.${action}`,
                    `${item.type}.${item.name}.default`
                ]
                break
            case "liturgy":
            case "spell":
            case "ceremony":
            case "ritual":
                paths = [
                    `${item.type}.${item.name}.${action}`,
                    `${item.type}.${item.name}.default`,
                ]
                break
        }
        paths.push(`${item.type}.default`)
        for (const p of paths) {
            result = getProperty(this.sounds, p)
            if (result && (typeof result === "string" || result instanceof String)) break
        }

        return result
    }
}