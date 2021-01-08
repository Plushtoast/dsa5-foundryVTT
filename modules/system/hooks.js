import * as initHooks from "../hooks/init.js";
import AdvantageRulesDSA5 from "./advantage-rules-dsa5.js";
import SpecialabilityRulesDSA5 from "./specialability-rules-dsa5.js"

export default function registerHooks() {
    initHooks.default()
    AdvantageRulesDSA5.setupFunctions()
    SpecialabilityRulesDSA5.setupFunctions()
}