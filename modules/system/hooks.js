import * as initHooks from "../hooks/init.js";
import AdvantageRulesDSA5 from "./advantage-rules-dsa5.js";

export default function registerHooks() {
    initHooks.default()
    AdvantageRulesDSA5.setupFunctions()
}