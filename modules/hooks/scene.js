export default function() {
    Hooks.on('preCreateScene', function(data, options) {
        data.gridUnits = game.i18n.localize('gridUnits')
    })

    Hooks.on('preCreateActiveEffect', function(actor, data, options) {
        mergeObject(data, {
            duration: {
                startTime: game.time.worldTime
            }
        })

        if (!game.combat) return

        data.duration.combat = game.combat.id
        data.duration.startRound = game.combat.round
        data.duration.startTurn = game.combat.turn
    })
}