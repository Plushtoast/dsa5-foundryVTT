export default function() {
    Hooks.on('preCreateScene', function(doc, createData, options, userId) {
        if (!createData.gridUnits) doc.data.update({ gridUnits: game.i18n.localize('gridUnits') })
    })

    Hooks.on('preCreateActiveEffect', function(doc, createData, options, userId) {
        if (doc.parent.documentName != "Actor") return

        let update = { duration: {} }
        if (!doc.data.duration.startTime) {
            update.duration.startTime = game.time.worldTime
        }

        if (!game.combat) {
            doc.data.update(update)
            return
        }

        update.duration.combat = game.combat.id
        update.duration.startRound = game.combat.round
        update.duration.startTurn = game.combat.turn
        if (!doc.data.duration.rounds && doc.data.duration.seconds) {
            update.duration.rounds = doc.data.duration.seconds / 5
        }
        doc.data.update(update)
    })
}