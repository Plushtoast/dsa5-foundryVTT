import MoneyTracker from '../orwell/money-tracker.js';
import DSA5SoundEffect from '../helpers/dsa-soundeffect.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';

export default class DSA5Payment {
  static async executePayment(actor, mode, moneyString, options = {}) {
    const { silent = false, render = true, showChatMessage = !silent, notifyOnFailure = silent } = options;

    if (!actor) {
      return {
        success: false,
        msg: _loc('PAYMENT.onlyActors'),
        money: 0,
      };
    }

    if (mode === 'pay') {
      const canPay = await DSA5Payment.canPay(actor, moneyString, notifyOnFailure);
      if (canPay.success) await DSA5Payment._updateMoney(actor, canPay.actorsMoney.money, canPay.actorsMoney.sum - canPay.money, render, silent);

      if (showChatMessage && canPay.msg != '') ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${canPay.msg}</p>`, 'roll'));

      return canPay;
    }

    const money = this._getPaidmoney(moneyString, showChatMessage);
    if (!money) {
      return {
        success: false,
        msg: _loc('PAYMENT.error'),
        money: 0,
      };
    }

    const actorsMoney = this._actorsMoney(actor);
    await DSA5Payment._updateMoney(actor, actorsMoney.money, actorsMoney.sum + money, render, silent);
    const msg = `<p>${_loc('PAYMENT.getPaid', { actor: actor.name, amount: await DSA5Payment._moneyToString(money) })}</p>`;
    if (showChatMessage) {
      ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
    }
    return {
      success: true,
      msg: _loc('PAYMENT.getPaid', { actor: actor.name, amount: await DSA5Payment._moneyToString(money) }),
      money,
      actorsMoney,
    };
  }

  static async payMoney(actor, moneyString, silent = false, render = true) {
    const result = await DSA5Payment.executePayment(actor, 'pay', moneyString, {
      silent,
      render,
      showChatMessage: !silent,
      notifyOnFailure: silent,
    });

    return result.success;
  }

  static async canPay(actor, moneyString, silent) {
    const money = this._getPaymoney(moneyString);
    const result = { success: false, msg: '', money: money };

    if (money) {
      result.actorsMoney = this._actorsMoney(actor);
      if (result.actorsMoney.sum >= money) {
        result.msg = _loc('PAYMENT.pay', {
          actor: actor.name,
          amount: await DSA5Payment._moneyToString(money),
        });
        result.success = true;
      } else {
        result.msg = _loc('PAYMENT.cannotpay', {
          actor: actor.name,
          amount: await DSA5Payment._moneyToString(money),
        });
        if (silent) {
          ui.notifications.info(result.msg);
        }
      }
    }
    return result;
  }

  static async getMoney(actor, moneyString, silent = false, render = true) {
    const result = await this.executePayment(actor, 'getPaid', moneyString, {
      silent,
      render,
      showChatMessage: !silent,
      notifyOnFailure: false,
    });
    return result.success;
  }

  static parsePaymentAmount(moneyString, mode = 'pay', announceError = true) {
    return mode === 'pay' ? this._getPaymoney(moneyString, announceError) : this._getPaidmoney(moneyString, announceError);
  }

  static async createGetPaidChatMessage(moneyString, whisper = undefined) {
    const money = this._getPaidmoney(moneyString);

    if (money) {
      const whisp = whisper ? ` (${whisper})` : '';
      const msg = `<p><b>${_loc('PAYMENT.wage')}</b></p><p>${_loc('PAYMENT.getPaidSum', { amount: await DSA5Payment._moneyToString(money) })}${whisp}</p><div class="flexrow"><button class="payButton" data-pay="1" data-amount="${money}">${_loc('PAYMENT.getPaidButton')}</button></div>`;
      ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
    }
  }

  static async createPayChatMessage(moneyString, whisper = undefined) {
    const money = this._getPaymoney(moneyString);

    if (money) {
      const whisp = whisper ? ` (${whisper})` : '';
      const msg = `<p><b>${_loc('PAYMENT.bill')}</b></p>${_loc('PAYMENT.paySum', { amount: await DSA5Payment._moneyToString(money) })}${whisp}</p><div class="flexrow"><button class="payButton" data-pay="0" data-amount="${money}">${_loc('PAYMENT.payButton')}</button></div>`;
      ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
    }
  }

  static parseChatCommand(content) {
    const command = content.replace(/^\/(pay|getPaid)\s*/i, '').trim();
    const separatorIndex = command.search(/\s/);

    if (separatorIndex === -1) {
      return {
        moneyString: command,
        description: undefined,
      };
    }

    const moneyString = command.slice(0, separatorIndex);
    const rawDescription = command.slice(separatorIndex).trim();
    const description = rawDescription?.match(/^\((.*)\)$/)?.[1]?.trim() || rawDescription;

    return {
      moneyString,
      description,
    };
  }

  static _getPaidmoney(moneyString, announceError = true) {
    const money = this._parseMoneyString(moneyString);

    if (!money) {
      if (announceError) {
        const msg = `<p><b>${_loc('PAYMENT.error')}</b></p><p><i>${_loc('PAYMENT.getPaidexample')}</i></p>`;
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
      }
      return false;
    }
    return money;
  }

  static _getPaymoney(moneyString, announceError = true) {
    const money = this._parseMoneyString(moneyString);

    if (!money) {
      if (announceError) {
        const msg = `<p><b>${_loc('PAYMENT.error')}</b></p><p><i>${_loc('PAYMENT.payexample')}</i></p>`;
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
      }
      return false;
    }
    return money;
  }

  static async handlePayAction(elem, pay, amount, actor = undefined) {
    if (game.user.isGM && !actor) {
      ui.notifications.info('PAYMENT.onlyActors', { localize: true });
      return;
    }
    if (actor) DSA5SoundEffect.playMoneySound(true);
    else actor = game.user.character;

    let result = false;
    if (actor && pay) {
      result = await DSA5Payment.payMoney(actor, amount);
    } else if (actor && !pay) {
      result = await DSA5Payment.getMoney(actor, amount);
    } else {
      ui.notifications.info('PAYMENT.onlyActors', { localize: true });
    }
    if (result && elem) {
      elem.fadeOut();
      game.socket.emit('system.dsa5', {
        type: 'updateMsg',
        payload: {
          id: elem.closest('.message').attr('data-message-id'),
          updateData: {
            [`flags.dsa5.userHidden.${game.user.id}`]: true,
          },
        },
      });
    }
  }

  static async _moneyToCoins(money, currencies = undefined) {
    const availableCurrencies = (currencies || (await DSA5_Utility.allMoneyItems()).filter((x) => x.system.subcategory != 1)).sort(
      (a, b) => b.system.price.value - a.system.price.value,
    );

    const res = [];
    let remainingSum = money;
    for (const currency of availableCurrencies) {
      const amount = Math.floor(remainingSum / currency.system.price.value);
      res.push({
        name: currency.name,
        amount,
        img: currency.img,
      });
      remainingSum -= amount * currency.system.price.value;
    }

    if (remainingSum > 0.001) res[res.length - 1].amount += 1;

    return res;
  }

  static _parseMoneyString(moneyString) {
    if (typeof moneyString === 'number') {
      return Number.isFinite(moneyString) && moneyString > 0 ? moneyString : false;
    }

    if (moneyString == null) return false;

    const normalizedMoneyString = String(moneyString).trim();
    if (!normalizedMoneyString) return false;

    const match = normalizedMoneyString.replace(',', '.').match(/\d{1,}(\.\d{1,3}|,\d{1,3})?/);
    if (match) {
      return Number(match[0]);
    } else {
      return false;
    }
  }

  static _actorsMoney(actor) {
    const money = actor.items.filter((i) => i.type == 'money' && i.system.subcategory != 1);

    return {
      money: money,
      sum: money.reduce((total, current) => {
        return total + Number(current.system.quantity.value) * Number(current.system.price.value);
      }, 0.0),
    };
  }

  static async _replaceMoney(actor) {
    const money = DSA5Payment._actorsMoney(actor);
    const standardMoney = await DSA5_Utility.allMoneyItems();

    await actor.deleteEmbeddedDocuments(
      'Item',
      money.money.map((x) => x.id),
      { render: false },
    );
    await actor.createEmbeddedDocuments('Item', standardMoney, {
      render: false,
    });
    await DSA5Payment._updateMoney(actor, DSA5Payment._actorsMoney(actor).money, money.sum);
  }

  static async _updateMoney(actor, money, newSum, render = true, silent = false) {
    const coins = await DSA5Payment._moneyToCoins(newSum, money);
    const update = [];
    let oldSum = 0;
    for (const m of money) {
      oldSum += m.system.quantity.value * m.system.price.value;
      const coin = coins.find((x) => x.name == m.name);
      if (coin == undefined) continue;

      update.push({
        _id: m.id,
        'system.quantity.value': coin.amount,
      });
    }

    await actor.updateEmbeddedDocuments('Item', update, { render });
    if (!silent) await MoneyTracker.track(actor, { type: 'payment', previous: oldSum, next: newSum }, newSum - oldSum);
  }

  static async _moneyToString(money) {
    const coins = await DSA5Payment._moneyToCoins(money);
    const res = [];

    for (const mon of coins) {
      if (mon.amount > 0) res.push(`<span class="nobr">${mon.amount} <span data-tooltip="${mon.name}" style="background-image:url('${mon.img}')" class="chatmoney"></span></span>`);
    }

    if (res.length == 0) return '-';
    return res.join(', ');
  }

  static async chatListeners(html) {
    html.on('click', '.payButton', (ev) => {
      const elem = $(ev.currentTarget);
      DSA5Payment.handlePayAction(elem, Number(elem.attr('data-pay')) != 1, elem.attr('data-amount'));
      DSA5SoundEffect.playMoneySound();
    });
  }
}
