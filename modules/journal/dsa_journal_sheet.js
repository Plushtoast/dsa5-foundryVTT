export default class DSAJournalSheet extends JournalSheet{
    static get defaultOptions(){
        const optns = super.defaultOptions
        mergeObject(optns, {
            classes: optns.classes.concat(["dsa5", "dsajournal"])
        })
        return optns
    }
}