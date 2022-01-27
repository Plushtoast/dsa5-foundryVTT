export default class DPS {
    static rangeFinder(tokenSource, tokenTarget) {
        const gridSize = canvas.scene.data.grid
        const ray = new Ray(tokenSource, tokenTarget)
        const tileDistance = ray.distance / gridSize
        const distance = tileDistance * canvas.scene.data.gridDistance
        const elevation = Math.abs(tokenSource.data.elevation - tokenTarget.data.elevation)
        const distanceSum = Math.hypot(distance, elevation)
        return {
            elevation,
            distance,
            distanceSum,
            tileDistance,
            unit: canvas.scene.data.gridUnits
        }
    }

    static distanceModifier(tokenSource, rangeweapon, currentAmmo) {
        if (!game.settings.get("dsa5", "enableDPS") || !tokenSource) return 1

        let maxDist = {}
        for (let target of game.user.targets) {
            const dist = DPS.rangeFinder(tokenSource, target)
            if ((maxDist.distanceSum || 0) < dist.distanceSum) maxDist = dist
        }

        if (maxDist.unit == game.i18n.localize("gridUnits")) {
            const rangeMultiplier = Number(getProperty(currentAmmo, "data.rangeMultiplier")) || 1
            const rangeBands = rangeweapon.data.reach.value.split("/").map(x => Number(x) * rangeMultiplier)
            let index = 0
            while (index < 2 && rangeBands[index] < maxDist.distanceSum) { index++ }

            return index
        } else {
            return 1
        }
    }
}