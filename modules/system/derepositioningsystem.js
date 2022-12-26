export default class DPS {
    static rangeFinder(tokenSource, tokenTarget) {
        const gridSize = canvas.scene.grid.size
        const ray = new Ray(tokenSource, tokenTarget)
        const tileDistance = ray.distance / gridSize
        const distance = tileDistance * canvas.scene.grid.distance
        const elevation = Math.abs((getProperty(tokenSource, "system.elevation") || 0) - (getProperty(tokenTarget, "system.elevation") || 0))
        const distanceSum = Math.hypot(distance, elevation)
        return {
            elevation,
            distance,
            distanceSum,
            tileDistance,
            unit: canvas.scene.grid.units
        }
    }

    static inDistance(toToken) {
        for (let token of canvas.scene.tokens) {
            if (token.isOwner && this.rangeFinder(toToken, token.object).tileDistance <= 2) return true
        }
        return false
    }

    static get isEnabled(){
        const sceneFlag = canvas?.scene?.getFlag("dsa5", "enableDPS")
        return sceneFlag ? sceneFlag == "2" : game.settings.get("dsa5", "enableDPS")
    }

    static distanceModifier(tokenSource, rangeweapon, currentAmmo) {
        if (!this.isEnabled || !tokenSource) return 1

        let maxDist = {}
        for (let target of game.user.targets) {
            const dist = DPS.rangeFinder(tokenSource, target)
            if ((maxDist.distanceSum || 0) < dist.distanceSum) maxDist = dist
        }

        if (maxDist.unit == game.i18n.localize("gridUnits")) {
            const rangeMultiplier = Number(getProperty(currentAmmo, "system.rangeMultiplier")) || 1
            const rangeBands = rangeweapon.system.reach.value.split("/").map(x => Number(x) * rangeMultiplier)
            let index = 0
            while (index < 2 && rangeBands[index] < maxDist.distanceSum) { index++ }

            return index
        } else {
            return 1
        }
    }

    static initDoorMinDistance() {
        const originalDoorControl = DoorControl.prototype._onMouseDown
        DoorControl.prototype._onMouseDown = function(event) {
            if (!game.user.isGM && this.isEnabled) {
                if (!DPS.inDistance(this))
                    return ui.notifications.warn(game.i18n.localize('DSAError.notInRangeToLoot'))
            }
            return originalDoorControl.apply(this, arguments)
        }
    }

}

Hooks.on("renderSceneConfig", (app, html, msg) => {
    const sceneFlag = getProperty(app.object, "flags.dsa5.enableDPS")
    const dpsSelector = `<div class="form-group">
        <label data-tooltip="DSASETTINGS.enableDPSHint">${game.i18n.localize('DSASETTINGS.enableDPS')}</label>
        <select name="flags.dsa5.enableDPS">
            <option value="" ${sceneFlag == "" ? "selected" : ""}>${game.i18n.localize("globalConfig")}</option>
            <option value="2" ${sceneFlag == "2" ? "selected" : ""}>${game.i18n.localize("yes")}</option>
            <option value="1" ${sceneFlag == "1" ? "selected" : ""}>${game.i18n.localize("no")}</option>
        </select>
    </div>`
    html.find('.tab[data-tab="grid"]').append(dpsSelector)
})