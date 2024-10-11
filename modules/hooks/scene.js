const { getProperty, mergeObject } = foundry.utils

export default function() {
    Hooks.on('preCreateScene', function(doc, createData, options, userId) {
        if (!createData.grid?.units) doc.updateSource({ grid: { units: game.i18n.localize('gridUnits') }})

        if(!createData.backgroundColor) {
            doc.updateSource({ backgroundColor: "#000000" })
        }

        if(!doc.pack && !options.dsaInit && createData.notes?.some(x => getProperty(x, "flags.dsa5.initName"))){
            new foundry.applications.api.DialogV2({
                window: {
                    title: "DIALOG.warning",
                },                
                content: `<p>${createData.name}</p><p>${game.i18n.localize('DSAError.mapsViaJournalbrowser')}</p>`,
                buttons: [
                  {
                    action: 'yes',
                    icon: "fa fa-check",
                    default: true,
                    label: "yes",
                    callback: () => {
                        const newOptions = options || {}
                        options.dsaInit = true
                        Scene.create(createData, newOptions)
                    },
                  },
                  {
                    action: 'withJournals',
                    icon: "fas fa-book",
                    label: "Book.tryInit",
                    callback: async() => {
                        try{
                            const mod = doc.flags.core.sourceId.split(".")[1]
                            const initializer = new game.dsa5.apps.DSA5Initializer("DSA5 Module Initialization", "", mod, game.i18n.lang)
                            const json = await initializer.loadJson()
                            initializer.initScenes(json, [createData.name])
                        } catch (e) {
                            const newOptions = options || {}
                            options.dsaInit = true
                            await Scene.create(createData, newOptions)
                        }    
                    },
                  },    
                  {
                    action: 'no',
                    icon: "fas fa-times",
                    label: "cancel"
                  }
                ]
              }).render(true)
            return false
        }
    })

    Hooks.on('preCreateActiveEffect', function(doc, createData, options, userId) {
        if (doc.parent.documentName != "Actor") return

        let update = { duration: {
            startTime: game.time.worldTime
        }}

        if(createData.flags?.dsa5?.onDelayed) {
            mergeObject(update, { 
                duration: { seconds: createData.flags.dsa5.onDelayed },
                system: { 
                    delayed: true,
                    originalDuration: createData.duration
                } 
            })
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