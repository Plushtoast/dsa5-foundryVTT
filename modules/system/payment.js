import DSA5SoundEffect from "./dsa-soundeffect.js";
import DSA5_Utility from "./utility-dsa5.js";

export default class DSA5Payment {
    static payMoney(actor, moneyString, silent = false) {
        let canPay = DSA5Payment.canPay(actor, moneyString, silent)
        if (canPay.success)
            DSA5Payment._updateMoney(actor, canPay.actorsMoney.money, canPay.actorsMoney.sum - canPay.money)

        if (!silent && canPay.msg != "")
            ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${canPay.msg}</p>`, "roll"))

        return canPay.success
    }

    static canPay(actor, moneyString, silent) {
        let money = this._getPaymoney(moneyString)
        let result = { success: false, msg: "", money: money }

        if (money) {
            result.actorsMoney = this._actorsMoney(actor)
            if (result.actorsMoney.sum >= money) {
                result.msg = game.i18n.format("PAYMENT.pay", { actor: actor.name, amount: DSA5Payment._moneyToString(money) })
                result.success = true
            } else {
                result.msg = game.i18n.format("PAYMENT.cannotpay", { actor: actor.name, amount: DSA5Payment._moneyToString(money) })
                if (silent) {
                    ui.notifications.notify(result.msg)
                }
            }
        }
        return result
    }

    static getMoney(actor, moneyString, silent = false) {
        let money = this._getPaidmoney(moneyString)

        if (money) {
            let actorsMoney = this._actorsMoney(actor)
            DSA5Payment._updateMoney(actor, actorsMoney.money, actorsMoney.sum + money)
            let msg = `<p>${game.i18n.format("PAYMENT.getPaid", {actor: actor.name, amount: DSA5Payment._moneyToString(money)})}</p>`
            if (!silent) {
                ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
            }
            return true
        }
    }

    static _updateMoney(actor, money, newSum) {
        let coins = DSA5Payment._moneyToCoins(newSum)

        for (let m of money) {
            switch (m.name) {
                case "Money-D":
                    m.system.quantity.value = coins.D
                    break
                case "Money-S":
                    m.system.quantity.value = coins.S
                    break
                case "Money-H":
                    m.system.quantity.value = coins.H
                    break
                case "Money-K":
                    m.system.quantity.value = coins.K
                    break
            }
        }

        actor.updateEmbeddedDocuments("Item", money)
    }

    static createGetPaidChatMessage(moneyString, whisper = undefined) {
        let money = this._getPaidmoney(moneyString)

        if (money) {
            const whisp = whisper ? ` (${whisper})` : ""
            let msg = `<p><b>${game.i18n.localize("PAYMENT.wage")}</b></p><p>${game.i18n.format("PAYMENT.getPaidSum", { amount: DSA5Payment._moneyToString(money) })}${whisp}</p><button class="payButton" data-pay="1" data-amount="${money}">${game.i18n.localize("PAYMENT.getPaidButton")}</button>`
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
        }
    }

    static createPayChatMessage(moneyString, whisper = undefined) {
        let money = this._getPaymoney(moneyString)

        if (money) {
            const whisp = whisper ? ` (${whisper})` : ""
            let msg = `<p><b>${game.i18n.localize("PAYMENT.bill")}</b></p>${game.i18n.format("PAYMENT.paySum", { amount: DSA5Payment._moneyToString(money) })}${whisp}</p><button class="payButton" data-pay="0" data-amount="${money}">${game.i18n.localize("PAYMENT.payButton")}</button>`
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
        }
    }

    static _getPaidmoney(moneyString) {
        let money = this._parseMoneyString(moneyString)

        if (!money) {
            let msg = `<p><b>${game.i18n.localize("PAYMENT.error")}</b></p><p><i>${game.i18n.localize("PAYMENT.getPaidexample")}</i></p>`;
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"));
            return false
        }
        return money
    }

    static _getPaymoney(moneyString) {
        let money = this._parseMoneyString(moneyString)

        if (!money) {
            let msg = `<p><b>${game.i18n.localize("PAYMENT.error")}</b></p><p><i>${game.i18n.localize("PAYMENT.payexample")}</i></p>`;
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"));
            return false
        }
        return money
    }

    static _parseMoneyString(moneyString) {
        let match = moneyString.replace(",", ".").match(/\d{1,}(\.\d{1,3}|,\d{1,3})?/)
        if (match) {
            return Number(match[0])
        } else {
            return false
        }
    }

    static _actorsMoney(actor) {
        let money = duplicate(actor.items.filter(i => i.type == "money"))

        return {
            money: money,
            sum: money.reduce((total, current) => total + Number(current.system.quantity.value) * Number(current.system.price.value), 0)
        }
    }

    static handlePayAction(elem, pay, amount, actor = undefined) {
        if (game.user.isGM && !actor) {
            ui.notifications.notify(game.i18n.localize("PAYMENT.onlyActors"))
            return
        }
        if (actor) DSA5SoundEffect.playMoneySound(true)
        else actor = game.user.character

        let result = false
        if (actor && pay) {
            result = DSA5Payment.payMoney(actor, amount)
        } else if (actor && !pay) {
            result = DSA5Payment.getMoney(actor, amount)
        } else {
            ui.notifications.notify(game.i18n.localize("PAYMENT.onlyActors"))
        }
        if (result && elem) {
            elem.fadeOut()
            game.socket.emit("system.dsa5", {
                type: "updateMsg",
                payload: {
                    id: elem.closest(".message").attr("data-message-id"),
                    updateData: {
                        [`flags.dsa5.userHidden.${game.user.id}`]: true
                    }
                }
            })
        }
    }

    static _moneyToCoins(money) {
        let m = Math.round(money * 100)
        let D = Math.floor(m / 1000)
        let S = Math.floor((m - (D * 1000)) / 100)
        let H = Math.floor((m - (D * 1000) - S * 100) / 10)
        return {
            D,
            S,
            H,
            K: Math.round(((m - (D * 1000) - S * 100 - H * 10)))
        }
    }

    static _moneyToString(money) {
            let coins = DSA5Payment._moneyToCoins(money)
            let res = []

            for (const [key, value] of Object.entries(coins)) {
                if (value > 0)
                    res.push(`<span class="nobr">${value} <span data-tooltip="${game.i18n.localize(`Money-${key}`)}" class="chatmoney money-${key}"></span></span>`)
        }
        return res.join(", ")
    }

    static async chatListeners(html) {
        html.on('click', '.payButton', ev => {
            const elem = $(ev.currentTarget)
            DSA5Payment.handlePayAction(elem, Number(elem.attr("data-pay")) != 1, elem.attr("data-amount"))
            DSA5SoundEffect.playMoneySound()
        })
    }
}