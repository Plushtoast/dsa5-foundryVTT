const { getProperty, mergeObject } = foundry.utils;

export default function () {
  Hooks.on('preCreateScene', function (doc, createData, options, userId) {
    if (!createData.grid?.units) doc.updateSource({ grid: { units: _loc('gridUnits') } });

    if (!createData.backgroundColor) {
      doc.updateSource({ backgroundColor: '#000000' });
    }

    if (!doc.pack && !options.dsaInit && createData.notes?.some((x) => getProperty(x, 'flags.dsa5.initName'))) {
      new foundry.applications.api.DialogV2({
        window: {
          title: 'DIALOG.warning',
        },
        content: `<p>${createData.name}</p><p>${_loc('DSAError.mapsViaJournalbrowser')}</p>`,
        buttons: [
          {
            action: 'yes',
            icon: 'fa fa-check',
            default: true,
            label: 'yes',
            callback: () => {
              const newOptions = options || {};
              options.dsaInit = true;
              Scene.create(createData, newOptions);
            },
          },
          {
            action: 'withJournals',
            icon: 'fas fa-book',
            label: 'Book.tryInit',
            callback: async () => {
              try {
                const mod = doc._stats.compendiumSource.split('.')[1];
                const initializer = new game.dsa5.apps.DSA5Initializer('DSA5 Module Initialization', '', mod, game.i18n.lang);
                const json = await initializer.loadJson();
                initializer.initScenes(json, [createData.name]);
              } catch (e) {
                console.warn(e);
                const newOptions = options || {};
                options.dsaInit = true;
                await Scene.create(createData, newOptions);
              }
            },
          },
          {
            action: 'no',
            icon: 'fas fa-times',
            label: 'cancel',
          },
        ],
      }).render(true);
      return false;
    }
  });

  Hooks.on('preCreateActiveEffect', function (doc, createData, options, userId) {
    if (doc.parent.documentName != 'Actor') return;

    let update = {
      start: {
        time: game.time.worldTime,
      },
    };

    const onDelayed = createData.system?.macroArgs?.onDelayed;
    if (onDelayed) {
      mergeObject(update, {
        duration: { value: parseInt(onDelayed) || 0, units: 'seconds' },
        system: {
          delayed: {
            enabled: true,
            originalDuration: createData.duration,
          },
        },
      });
    }

    if (!game.combat) {
      doc.updateSource(update);
      return;
    }

    update.start.combat = game.combat.id;
    update.start.round = game.combat.round;
    update.start.turn = game.combat.turn;
    if (doc.duration.units === 'seconds' && typeof doc.duration.value === 'number') {
      update.duration = { value: Math.round(doc.duration.value / CONFIG.time.roundTime), units: 'rounds' };
    }
    doc.updateSource(update);
  });
}
