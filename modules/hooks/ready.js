import DSA5Tutorial from "../system/tutorial.js";
import Itemdsa5 from "../item/item-dsa5.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import { setEnrichers } from './texteditor.js'
import { connectHook } from "./itemDrop.js";
import DidYouKnow from "../system/didyouknow.js";
import TokenHotbar2 from "../system/tokenHotbar2.js";
import DSAIniTracker from "../system/dsa-ini-tracker.js";
import DSATour from "../tours/dsa_tour.js";
import { initImagePopoutTochat } from "./imagepopouttochat.js";
import { connectSocket } from "./socket.js";

export default function() {
    Hooks.on("ready", async() => {
        connectSocket()

        if (DSA5_Utility.moduleEnabled("vtta-tokenizer") && !(await game.settings.get("dsa5", "tokenizerSetup")) && game.user.isGM) {
            await game.settings.set("vtta-tokenizer", "default-frame-pc", "[data] systems/dsa5/icons/backgrounds/token_green.webp")
            await game.settings.set("vtta-tokenizer", "default-frame-npc", "[data] systems/dsa5/icons/backgrounds/token_black.webp")
            await game.settings.set("vtta-tokenizer", "default-frame-neutral", "[data] systems/dsa5/icons/backgrounds/token_blue.webp")
            await game.settings.set("dsa5", "tokenizerSetup", true)
        }

        if (DSA5_Utility.moduleEnabled("dice-so-nice") && !(await game.settings.get("dsa5", "diceSetup")) && game.user.isGM) {
            await game.settings.set("dice-so-nice", "immediatelyDisplayChatMessages", true)
            await game.settings.set("dsa5", "diceSetup", true)
        }

        await DSA5Tutorial.firstTimeMessage()

        Itemdsa5.setupSubClasses()

        DidYouKnow.showOneMessage()
        TokenHotbar2.registerTokenHotbar()

        connectHook()
        DSAIniTracker.connectHooks()
        const hook = (dat) => {
            if(dat.tabName == "settings") {
                DSATour.travelAgency()
                Hooks.off('changeSidebarTab', hook)
            }
        }
        Hooks.on('changeSidebarTab', hook)

        setEnrichers()
        initImagePopoutTochat()

        Hooks.call("DSA5ready", game.dsa5)
    });
}