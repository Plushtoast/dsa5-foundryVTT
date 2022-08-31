export default class DSATour extends Tour{
    static tours = ["systems/dsa5/modules/tours/lang/initial", "systems/dsa5/modules/tours/lang/library", "systems/dsa5/modules/tours/lang/actor"]    
    static gmTours = ["systems/dsa5/modules/tours/lang/mastermenu"]

    static async travelAgency(){
        const lang = game.i18n.lang == "de" ? "de" : "en"
        console.log("Adding DSA/TDE Tours")
        for(let tour of this.tours){
            const obj = await game.dsa5.apps.DSATour.fromJSON(`${tour.replace("/lang/", `/${lang}/`)}.json`);
            game.tours.register(obj.config.module, obj.id, obj);
        }
        if(!game.user.isGM) return

        for(let tour of this.gmTours){
            const obj = await game.dsa5.apps.DSATour.fromJSON(`${tour.replace("/lang/", `/${lang}/`)}.json`);
            game.tours.register(obj.config.module, obj.id, obj);
        }
    }

    async _preStep() {
        if(this.currentStep.activateTab){
            ui.sidebar.activateTab(this.currentStep.activateTab)
        }
        else if(this.currentStep.activateLayer && canvas.activeLayer.options.name != this.currentStep.activateLayer){
            await canvas[this.currentStep.activateLayer].activate()
            await delay(100)
        }
        else if(this.currentStep.appTab){
            this.app.activateTab(this.currentStep.appTab)
        }
    }

    exit(){
        super.exit()
    }

    async start() {
        if(this.config.preCommand){
            const fn = await eval(`(async() => { ${this.config.preCommand} })`)
            await fn()            
        }
        if(this.app){
            await this.app.render(true, {focus: true})
            while(!this.app.rendered) await delay(50)            
        }
        if(this.app || this.config.preCommand) 
            while(!$(this.steps[this.stepIndex + 1].selector + ':visible').length) await delay(50)

        const res = await super.start()
        $('#tooltip').show()
        return res
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}