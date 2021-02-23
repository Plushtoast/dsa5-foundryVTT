import DSA5_Utility from "./utility-dsa5.js";

export default class DSA5Payment {
    static payMoney(actor, moneyString) {
        let money = this._getPaymoney(moneyString)

        if (money) {
            let actorsMoney = this._actorsMoney(actor)
            let msg = ""
            if (actorsMoney.sum >= money) {
                DSA5Payment._updateMoney(actor, actorsMoney.money, actorsMoney.sum - money)
                msg = `<p>${game.i18n.format("PAYMENT.pay", {actor: actor.name, amount: DSA5Payment._moneyToString(money)})}</p>`
            } else {
                msg = `<p>${game.i18n.format("PAYMENT.cannotpay", {actor: actor.name, amount: DSA5Payment._moneyToString(money)})}</p>`
            }
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
        }

    }

    static getMoney(actor, moneyString) {
        let money = this._getPaidmoney(moneyString)

        if (money) {
            let actorsMoney = this._actorsMoney(actor)
            DSA5Payment._updateMoney(actor, actorsMoney.money, actorsMoney.sum + money)
            let msg = `<p>${game.i18n.format("PAYMENT.getPaid", {actor: actor.name, amount: DSA5Payment._moneyToString(money)})}</p>`
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
        }
    }

    static _updateMoney(actor, money, newSum) {
        let coins = DSA5Payment._moneyToCoins(newSum)

        for (let m of money) {
            switch (m.name) {
                case "Money-D":
                    m.data.quantity.value = coins.D
                    break
                case "Money-S":
                    m.data.quantity.value = coins.S
                    break
                case "Money-H":
                    m.data.quantity.value = coins.H
                    break
                case "Money-K":
                    m.data.quantity.value = coins.K
                    break
            }
        }

        actor.updateEmbeddedEntity("OwnedItem", money)
    }

    static createGetPaidChatMessage(moneyString) {
        let money = this._getPaidmoney(moneyString)

        if (money) {
            let msg = `<p><b>${game.i18n.localize("PAYMENT.wage")}</b></p><p>${game.i18n.format("PAYMENT.getPaidSum", {amount: DSA5Payment._moneyToString(money)})}</p><button class="getPaidButton" data-amount="${money}">${game.i18n.localize("PAYMENT.getPaidButton")}</button>`
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
        }
    }

    static createPayChatMessage(moneyString) {
        let money = this._getPaymoney(moneyString)

        if (money) {
            let msg = `<p><b>${game.i18n.localize("PAYMENT.bill")}</b></p>${game.i18n.format("PAYMENT.paySum", {amount: DSA5Payment._moneyToString(money)})}</p><button class="payButton" data-amount="${money}">${game.i18n.localize("PAYMENT.payButton")}</button>`
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
        let money = duplicate(actor.data.items.filter(i => i.type == "money"))

        return {
            money: money,
            sum: money.reduce((total, current) => total + Number(current.data.quantity.value) * Number(current.data.price.value), 0)
        }
    }

    static handlePayAction(ev, pay) {
        if (game.user.isGM) {
            ui.notifications.notify(game.i18n.localize("PAYMENT.onlyActors"))
            return
        }
        let actor = game.user.character
        if (actor && pay) {
            DSA5Payment.payMoney(actor, $(ev.currentTarget).attr("data-amount"))
        } else if (actor && !pay) {
            DSA5Payment.getMoney(actor, $(ev.currentTarget).attr("data-amount"))

        } else {
            ui.notifications.notify(game.i18n.localize("PAYMENT.onlyActors"))
        }
    }

    static _moneyToCoins(money) {
        let m = Math.round(money * 100)
        let D = Math.floor(m / 1000)
        let S = Math.floor((m - (D * 1000)) / 100)
        let H = Math.floor((m - (D * 1000) - S * 100) / 10)
        return {
            D: D,
            S: S,
            H: H,
            K: Math.round(((m - (D * 1000) - S * 100 - H * 10)))
        }
    }

    static _moneyToString(money) {
            let coins = DSA5Payment._moneyToCoins(money)
            let res = []
            for (const [key, value] of Object.entries(coins)) {
                if (value > 0) {
                    res.push(`${value} <span title="${game.i18n.localize(`Money-${key}`)}" class="chatmoney money-${key}"></span>`)
            }
        }
        return res.join(", ")

    }

    static async chatListeners(html) {
        html.on('click', '.payButton', ev => {
            DSA5Payment.handlePayAction(ev, true)
        })
        html.on('click', '.getPaidButton', ev => {
            DSA5Payment.handlePayAction(ev, false)
        })
    }
}