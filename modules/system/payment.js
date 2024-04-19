import DSA5SoundEffect from "./dsa-soundeffect.js";
import DSA5_Utility from "./utility-dsa5.js";

export default class DSA5Payment {
    static async payMoney(actor, moneyString, silent = false, render = true) {
        const canPay = await DSA5Payment.canPay(actor, moneyString, silent)
        if (canPay.success)
            await DSA5Payment._updateMoney(actor, canPay.actorsMoney.money, canPay.actorsMoney.sum - canPay.money, render)

        if (!silent && canPay.msg != "")
            ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${canPay.msg}</p>`, "roll"))

        return canPay.success
    }

    static async canPay(actor, moneyString, silent) {
        let money = this._getPaymoney(moneyString)
        let result = { success: false, msg: "", money: money }

        if (money) {
            result.actorsMoney = this._actorsMoney(actor)
            if (result.actorsMoney.sum >= money) {
                result.msg = game.i18n.format("PAYMENT.pay", { actor: actor.name, amount: await DSA5Payment._moneyToString(money) })
                result.success = true
            } else {
                result.msg = game.i18n.format("PAYMENT.cannotpay", { actor: actor.name, amount: await DSA5Payment._moneyToString(money) })
                if (silent) {
                    ui.notifications.notify(result.msg)
                }
            }
        }
        return result
    }

    static async getMoney(actor, moneyString, silent = false, render = true) {
        let money = this._getPaidmoney(moneyString)

        if (money) {
            let actorsMoney = this._actorsMoney(actor)
            await DSA5Payment._updateMoney(actor, actorsMoney.money, actorsMoney.sum + money, render)
            let msg = `<p>${game.i18n.format("PAYMENT.getPaid", {actor: actor.name, amount: await DSA5Payment._moneyToString(money)})}</p>`
            if (!silent) {
                ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
            }
            return true
        }
    }

    static async createGetPaidChatMessage(moneyString, whisper = undefined) {
        let money = this._getPaidmoney(moneyString)

        if (money) {
            const whisp = whisper ? ` (${whisper})` : ""
            let msg = `<p><b>${game.i18n.localize("PAYMENT.wage")}</b></p><p>${game.i18n.format("PAYMENT.getPaidSum", { amount: await DSA5Payment._moneyToString(money) })}${whisp}</p><button class="payButton" data-pay="1" data-amount="${money}">${game.i18n.localize("PAYMENT.getPaidButton")}</button>`
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
        }
    }

    static async createPayChatMessage(moneyString, whisper = undefined) {
        let money = this._getPaymoney(moneyString)

        if (money) {
            const whisp = whisper ? ` (${whisper})` : ""
            let msg = `<p><b>${game.i18n.localize("PAYMENT.bill")}</b></p>${game.i18n.format("PAYMENT.paySum", { amount: await DSA5Payment._moneyToString(money) })}${whisp}</p><button class="payButton" data-pay="0" data-amount="${money}">${game.i18n.localize("PAYMENT.payButton")}</button>`
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

    static async handlePayAction(elem, pay, amount, actor = undefined) {
        if (game.user.isGM && !actor) {
            ui.notifications.notify(game.i18n.localize("PAYMENT.onlyActors"))
            return
        }
        if (actor) DSA5SoundEffect.playMoneySound(true)
        else actor = game.user.character

        let result = false
        if (actor && pay) {
            result = await DSA5Payment.payMoney(actor, amount)
        } else if (actor && !pay) {
            result = await DSA5Payment.getMoney(actor, amount)
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

    static async _moneyToCoins(money, currencies = undefined) {
        const availableCurrencies = (currencies || (await DSA5_Utility.allMoneyItems()).filter(x => x.system.subcategory != 1))
            .sort((a, b) => b.system.price.value - a.system.price.value)

        const res = []
        let remainingSum = money
        for (let currency of availableCurrencies) {
            let amount = Math.floor(remainingSum / currency.system.price.value)
            if (amount > 0 || money == 0) {
                res.push({
                    name: currency.name,
                    amount,
                    img: currency.img
                })
                remainingSum -= amount * currency.system.price.value
            }
        }

        if(remainingSum > 0.001)    
            res[res.length - 1].amount += 1

        return res
    }

    static _parseMoneyString(moneyString) {
        const match = moneyString.replace(",", ".").match(/\d{1,}(\.\d{1,3}|,\d{1,3})?/)
        if (match) {
            return Number(match[0])
        } else {
            return false
        }
    }

    static _actorsMoney(actor) {
        const money = actor.items.filter(i => i.type == "money" && i.system.subcategory != 1)

        return {
            money: money,
            sum: money.reduce((total, current) => total + Number(current.system.quantity.value) * Number(current.system.price.value), 0)
        }
    }

    static async _replaceMoney(actor){
        const money = DSA5Payment._actorsMoney(actor)
        const standardMoney = await DSA5_Utility.allMoneyItems()

        await actor.deleteEmbeddedDocuments("Item", money.money.map(x => x.id), {render: false})
        await actor.createEmbeddedDocuments("Item", standardMoney, {render: false})
        await DSA5Payment._updateMoney(actor, DSA5Payment._actorsMoney(actor).money, money.sum)
    }

    static async _updateMoney(actor, money, newSum, render = true) {
        const coins = await DSA5Payment._moneyToCoins(newSum, money)
        const update = []
        for (let m of money) {
            const coin = coins.find(x => x.name == m.name)
            if(coin == undefined) continue

            update.push({
                _id: m.id,
                "system.quantity.value": coin.amount
            })
        }

        await actor.updateEmbeddedDocuments("Item", update, { render })
    }

    static async _moneyToString(money) {
        const coins = await DSA5Payment._moneyToCoins(money)
        const res = []

        for (const mon of coins) {
            if (mon.amount > 0)
                res.push(`<span class="nobr">${mon.amount} <span data-tooltip="${mon.name}" style="background-image:url('${mon.img}')" class="chatmoney"></span></span>`)
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