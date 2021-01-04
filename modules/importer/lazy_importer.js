export default class LazyImporter {
    static async bindImports() {
        import ("./import_functions.js").then(module => {
            game.dsa5.importers = module
        })
    }
}