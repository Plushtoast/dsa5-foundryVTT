export default class LazyImporter {
    static async bindImports() {
        import (/* webpackIgnore: true */"./import_functions.js").then(module => {
            game.dsa5.importers = module.default
        })
    }
    static async bindInitCreator() {
        import (/* webpackIgnore: true */"./init_creator.js").then(module => {
            game.dsa5.initCreator = module.default
        })
        import (/* webpackIgnore: true */"./initers.js").then(module2 => {
            game.dsa5.initers = module2.default
        })
    }
}