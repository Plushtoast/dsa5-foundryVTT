const { getProperty } = foundry.utils;

export default function () {
  Hooks.on('preCreateScene', function (doc, createData, options, userId) {
    if (!createData.grid?.units) {
      doc.updateSource({ grid: { units: _loc('gridUnits') } });
    }

    const firstLevel = doc.levels.contents[0];
    if (firstLevel && !createData.backgroundColor && !createData.levels) {
      firstLevel.updateSource({ background: { color: '#000000' } });
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
}
