export default class DSA5SoundEffect {
    static sounds
    static triedInit = false

    static async playEffect(action, item, successLevel, whisper = undefined, blind = false) {
        const soundPath = await this.getSound(action, item, successLevel)
        if (soundPath) {
            try {
                if (whisper) {
                    game.socket.emit("system.dsa5", {
                        type: "playWhisperSound",
                        payload: {
                            whisper,
                            soundPath
                        }
                    })
                    if (!blind) AudioHelper.play({ src: soundPath, volume: 0.8, loop: false }, false);
                } else {
                    AudioHelper.play({ src: soundPath, volume: 0.8, loop: false }, true);
                }
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
                    ...successLevels.map(x => `${item.type }.${item.system.combatskill.value }.${action}_${x}`),
                    `${item.type }.${item.system.combatskill.value }.${action}`,
                    ...successLevels.map(x => `${item.type}.${item.system.combatskill.value}.default_${x}`),
                    `${item.type}.${item.system.combatskill.value}.default`
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
                    ...successLevels.map(x => `${item.type}.${item.name}.default_${x}`),
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

    static async playMoneySound(soundToEveryone = false) {
        if (!game.modules.get("gAudioBundle-3")) return

        const soundOptions = [
            "modules/gAudioBundle-3/src/Mint Coins And Money/Coin_Slide_Carpet.ogg",
            "modules/gAudioBundle-3/src/Mint Coins And Money/Coins_Drop_Carpet_06.ogg",
            "modules/gAudioBundle-3/src/Mint Coins And Money/Coins_Bottlecaps_Drop.ogg",
            "modules/gAudioBundle-3/src/Mint Coins And Money/Coins_In_Sack_Held_By_Drawstring_06.ogg",
            "modules/gAudioBundle-3/src/Money/Money_Coins_Handle.ogg"
        ]
        const soundPath = soundOptions[Math.floor(Math.random() * soundOptions.length)]
        await this.playSoundPath(soundPath, soundToEveryone)
    }

    static async playEquipmentWearStatusChange(item, soundToEveryone = false) {
        let soundOptions = []
        const aBundle2 = game.modules.get("gAudioBundle-2")
        const aBundle3 = game.modules.get("gAudioBundle-3")
        const aBundle4 = game.modules.get("gAudioBundle-4")

        switch (item.type) {
            case "armor":
                if (aBundle2) soundOptions.push("modules/gAudioBundle-2/src/Footsteps/Footstep And Foley Sounds/Foley_Soldier_Gear_Equipment_Metal_Cloth_Heavy_Movement_Light_08.ogg")
                break
            case "meleeweapon":
                if (aBundle2) soundOptions.push("modules/gAudioBundle-2/src/Gore/Melee_Sword_Attack_04.ogg")
                if (aBundle3) soundOptions.push("modules/gAudioBundle-3/src/Medieval Armor And Impacts/Weapon_Impact_Parry_01.ogg")
                break
            case "rangeweapon":
                if (aBundle4) soundOptions.push("modules/gAudioBundle-4/src/Super Heroes Sound Design/Hawk's_Arrow_Flies_Bow_And_Arrow_Shoot_2.ogg")
                break
        }

        if (soundOptions.length == 0 && aBundle2) {
            soundOptions.push(
                "modules/gAudioBundle-2/src/Footsteps/Footstep And Foley Sounds/Foley_Sports_Bag_Grab_Pickup_Catch_04.ogg",
                "modules/gAudioBundle-2/src/Footsteps/Footstep And Foley Sounds/Footstep_Ice_Crunchy_Run_01.ogg",
                "modules/gAudioBundle-2/src/Footsteps/Footstep And Foley Sounds/Footstep_Ice_Crunchy_Run_02.ogg"
            )
        }

        if (soundOptions.length > 0) {
            const soundPath = soundOptions[Math.floor(Math.random() * soundOptions.length)]
            await this.playSoundPath(soundPath, soundToEveryone, 0.5)
        }
    }

    static async playSoundPath(soundPath, soundToEveryone = false, volume = 0.8) {
        if (!game.settings.get("dsa5", "inventorySound")) return

        try {
            AudioHelper.play({ src: soundPath, volume, loop: false }, soundToEveryone);
        } catch (exception) {
            console.warn(`Could not play item sound effect ${soundPath}`)
        }
    }
}