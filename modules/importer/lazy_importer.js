export default class LazyImporter {
    static async bindImports() {
        import ("./import_functions.js").then(module => {
            game.dsa5.importers = module.default
        })
    }
    static async bindInitCreator() {
        import ("./init_creator.js").then(module => {
            game.dsa5.initCreator = module.default
        })
        import ("./initers.js").then(module2 => {
            game.dsa5.initers = module2.default
        })
    }
}