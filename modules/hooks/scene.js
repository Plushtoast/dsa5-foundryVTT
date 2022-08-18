export default function() {
    Hooks.on('preCreateScene', function(doc, createData, options, userId) {
        if (!createData.grid?.units) doc.updateSource({ grid: { units: game.i18n.localize('gridUnits') }})
    })

    Hooks.on('preCreateActiveEffect', function(doc, createData, options, userId) {
        if (doc.parent.documentName != "Actor") return

        let update = { duration: {} }
        if (!doc.duration.startTime) {
            update.duration.startTime = game.time.worldTime
        }

        if (!game.combat) {
            doc.updateSource(update)
            return
        }

        update.duration.combat = game.combat.id
        update.duration.startRound = game.combat.round
        update.duration.startTurn = game.combat.turn
        if (!doc.duration.rounds && doc.duration.seconds) {
            update.duration.rounds = doc.duration.seconds / 5
        }
        doc.updateSource(update)
    })
}