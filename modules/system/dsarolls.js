export default function() {
    Roll.prototype.editRollAtIndex = function(changes) {
        let results = []
        for (let change of changes) {
            let { index, val } = change

            let curindex = 0
            for (let term of this.terms) {
                if (term instanceof Die || term.class == "Die") {
                    if (term.results[index - curindex]) {
                        let oldVal = term.results[index - curindex].result
                        term.results[index - curindex].result = val
                        results.push(oldVal)
                    }
                    curindex += term.results.length
                }
            }
            results.push(0)
        }
        this._total = this._evaluateTotal()
        return results
    }
}