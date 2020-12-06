export default class LazyImporter {
    static async bindImports() {

        import ("./import_advantage.js").then(module => {
            game.dsa5.importers = module
        })

    }
}