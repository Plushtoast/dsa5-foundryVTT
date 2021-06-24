export default class DSA5SoundEffect {
    static sounds
    static triedInit = false

    static async playEffect(action, item, successLevel) {
        const soundPath = await this.getSound(action, item, successLevel)
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

    static successLevelToString(successLevel) {
        switch (successLevel) {
            case -1:
                return ["fail"]
            case -2:
                return ["botch", "fail"]
            case 1:
                return ["success"]
            case 2:
                return ["crit", "success"]
            default:
                return []
        }

    }

    static async getSound(action, item, successLevel) {
        if (!this.sounds && !this.triedInit) {
            await this.loadSoundConfig()
            this.triedInit = true
        }

        if (!this.sounds) return undefined

        const successLevels = this.successLevelToString(successLevel)
        let paths = []
        let result
        switch (item.type) {
            case "meleeweapon":
            case "rangeweapon":
                paths = [
                    ...successLevels.map(x => `${item.type}.manual.${item.name}.${action}_${x}`),
                    `${item.type}.manual.${item.name}.${action}`,
                    `${item.type}.manual.${item.name}.default.${action}`,
                    `${item.type}.manual.${item.name}.default`,
                    ...successLevels.map(x => `${item.type }.${item.data.combatskill.value }.${action}_${x}`),
                    `${item.type }.${item.data.combatskill.value }.${action}`,
                    ...successLevels.map(x => `${item.type}.${item.data.combatskill.value}.default_${x}`),
                    `${item.type}.${item.data.combatskill.value}.default`
                ]
                break
            case "skill":
                paths = [
                    ...successLevels.map(x => `${item.type}.${item.name}.${action}_${x}`),
                    `${item.type}.${item.name}.${action}`,
                    ...successLevels.map(x => `${item.type}.${item.name}.default_${x}`),
                    `${item.type}.${item.name}.default`
                ]
                break
            case "liturgy":
            case "spell":
            case "ceremony":
            case "ritual":
                paths = [
                    ...successLevels.map(x => `${item.type}.${item.name}.${action}_${x}`),
                    `${item.type}.${item.name}.${action}`,
                    ...successLevels.map(x => `${item.type}.${item.name}.default_${x}`)
                    `${item.type}.${item.name}.default`,
                ]
                break
        }
        paths.push(
            ...successLevels.map(x => `${item.type}.default_${x}`),
            `${item.type}.default`
        )
        for (const p of paths) {
            if (!hasProperty(this.sounds, p)) continue

            result = getProperty(this.sounds, p)
            if (result && (typeof result === "string" || result instanceof String)) break
        }

        return result
    }
}