export default class ItemLibraryModuleOptions {
  static collect(postfix = '') {
    const options = {};
    const moduleNameCache = new Map();

    for (const pack of game.packs.filter(p => ['Item', 'ActiveEffect'].includes(p.metadata.type))) {
      const packageName = pack.metadata.packageName;

      if (options[packageName + postfix]) continue;

      if (moduleNameCache.has(packageName)) {
        options[packageName + postfix] = moduleNameCache.get(packageName);
      } else {
        let displayName;
        if (game.i18n.has(`${packageName}.name`)) {
          displayName = _loc(`${packageName}.name`);
        } else if (packageName === 'dsa5') {
          displayName = game.system.title;
        } else {
          const module = game.modules.get(packageName);
          displayName = module?.title.replace(/The Dark Eye 5th Ed. - /i, '') || pack.metadata.label;
        }

        moduleNameCache.set(packageName, displayName);
        options[packageName + postfix] = displayName;
      }
    }

    return options;
  }
}
