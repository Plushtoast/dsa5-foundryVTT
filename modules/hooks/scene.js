export default function() {
    Hooks.on('preCreateScene', function(doc, createData, options, userId) {
        if (!createData.grid?.units) doc.updateSource({ grid: { units: game.i18n.localize('gridUnits') }})

        if(!createData.backgroundColor) {
            doc.updateSource({ backgroundColor: "#000000" })
        }

        if(!options.dsaInit && createData.notes?.some(x => getProperty(x, "flags.dsa5.initName"))){
            new Dialog({
                title: game.i18n.localize("DIALOG.warning"),
                content: `<p>${createData.name}</p><p>${game.i18n.localize('DSAError.mapsViaJournalbrowser')}</p>`,
                default: "yes",
                buttons: {
                  Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("yes"),
                    callback: () => {
                        const newOptions = options || {}
                        options.dsaInit = true
                        Scene.create(createData, newOptions)
                    },
                  },
                  cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel")
                  },
                },
              }).render(true)
            return false
        }
    })

    Hooks.on('preCreateActiveEffect', function(doc, createData, options, userId) {
        if (doc.parent.documentName != "Actor") return

        let update = { duration: {
            startTime: game.time.worldTime
        }}

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