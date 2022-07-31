export default class DSATour extends Tour{
    static tours = ["systems/dsa5/modules/tours/initial", "systems/dsa5/modules/tours/library", "systems/dsa5/modules/tours/actor"]    
    static gmTours = ["systems/dsa5/modules/tours/mastermenu"]

    static async travelAgency(){
        const lang = game.i18n.lang == "de" ? "de" : "en"
        console.log("Adding DSA/TDE Tours")
        for(let tour of this.tours){
            const obj = await game.dsa5.apps.DSATour.fromJSON(`${tour}${lang}.json`);
            game.tours.register(obj.config.module, obj.id, obj);
        }
        if(!game.user.isGM) return

        for(let tour of this.gmTours){
            const obj = await game.dsa5.apps.DSATour.fromJSON(`${tour}${lang}.json`);
            game.tours.register(obj.config.module, obj.id, obj);
        }
    }

    async _preStep() {
        if(this.currentStep.activateTab){
            ui.sidebar.activateTab(this.currentStep.activateTab)
        }
        else if(this.currentStep.activateLayer && canvas.activeLayer.options.name != this.currentStep.activateLayer){
            await canvas[this.currentStep.activateLayer].activate()
            await timeout(100)
        }
        else if(this.currentStep.appTab){
            this.app.sheet.activateTab(this.currentStep.appTab)
        }
    }

    exit(){
        TooltipManager.TOOLTIP_ACTIVATION_MS = 500
        super.exit()
    }

    async start() {
        if(this.config.preCommand){
            TooltipManager.TOOLTIP_ACTIVATION_MS = 50000000000
            const fn = await eval(`(async() => { ${this.config.preCommand} })`)
            await fn()
            if(this.app){
                console.log("muh")
                while(!this.app.sheet.rendered) await timeout(50)
            }
        }
        return super.start()
    }
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}