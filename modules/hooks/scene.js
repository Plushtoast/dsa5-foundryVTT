export default function() {
    Hooks.on('preCreateScene', function(data, options) {
        data.gridUnits = game.i18n.localize('gridUnits')
    })

    Hooks.on('preCreateActiveEffect', function(actor, data, options) {
        if (actor.entity != "Actor") return

        if (!data.duration) data.duration = {}
        if (!data.duration.startTime) data.duration.startTime = game.time.worldTime

        if (!game.combat) return

        data.duration.combat = game.combat.id
        data.duration.startRound = game.combat.round
        data.duration.startTurn = game.combat.turn
        if (!data.duration.rounds && data.duration.seconds) {
            data.duration.rounds = data.duration.seconds / 5
        }
    })
}