export default function() {
    Roll.prototype.editRollAtIndex = function(changes) {
        let results = []
        for (let change of changes) {
            let { index, val } = change

            let curindex = 0
            
            for (let term of this.terms) {
                const isDie = term instanceof Die || term.class == "Die"
                if (isDie || term.faces) {
                    if (term.results[index - curindex]) {
                        let oldVal = term.results[index - curindex].result
                        term.results[index - curindex].result = val
                        results.push(oldVal)
                    }

                    //Todo this should not be necessary
                    if(!isDie) term.total = term.results.reduce((prev, cur) => { return prev + cur.result }, 0)

                    curindex += term.results.length
                }
            }
            results.push(0)
        }
        this._total = this._evaluateTotal()
        return results
    }
}