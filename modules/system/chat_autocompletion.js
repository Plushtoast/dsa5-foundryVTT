import DSA5ChatListeners from './chat_listeners.js';
import RequestRoll from './request-roll.js';
import DSA5_Utility from './utility-dsa5.js';
import { UserMultipickDialog } from '../dialog/addTargetDialog.js';
import DSA5Payment from './payment.js';

export default class DSA5ChatAutoCompletion {
  static skills = [];
  static cmds = ['sk', 'at', 'pa', 'sp', 'li', 'rq', 'gc', 'w', 'ch'];
  static KEY = {
    UP: 38,
    DOWN: 40,
    ENTER: 13,
    TAB: 9,
    ESC: 27
  };

  constructor() {
    if (DSA5ChatAutoCompletion.skills.length == 0) {
      DSA5_Utility.allSkills().then((res) => {
        DSA5ChatAutoCompletion.skills = res
          .map((x) => {
            return { name: x.name, type: 'skill' };
          })
          .concat(
            Object.values(game.dsa5.config.characteristics)
              .map((x) => {
                return { name: game.i18n.localize(x), type: 'attribute' };
              })
              .concat([
                {
                  name: game.i18n.localize('regenerate'),
                  type: 'regeneration',
                },
                {
                  name: game.i18n.localize('fallingDamage'),
                  type: 'fallingDamage',
                },
              ]),
          );
      });
    }

    this.filtering = false;
    this.combatConstants = {
      dodge: game.i18n.localize('dodge'),
      parryWeaponless: game.i18n.localize('parryWeaponless'),
      attackWeaponless: game.i18n.localize('attackWeaponless'),
    };
  }

  get regex() {
    ///^\/(sk |at |pa |sp |li |rq |gc |w |ch)/
    return new RegExp(`^/(${DSA5ChatAutoCompletion.cmds.join(' |')})`);
  }

  async chatListeners(html) {
    /*html.on('keyup', '#chat-message', (ev) => {
      this._parseInput(ev);
    });*/

    document.querySelector('.chat-input').addEventListener('keyup', (ev) => {
      this._parseInput(ev);
    });

    html.on('click', '.quick-item', (ev) => {
      this._quickSelect($(ev.currentTarget));
    });

    //TODO: Fix this
    /*$(document.querySelector('#chat-notifications')).on('click', '.quick-item', (ev) => {
      this._quickSelect($(ev.currentTarget));
    });*/

    $(document.querySelector('#chat-notifications .chat-input')).on('blur', (ev) => {
      this._closeQuickfind(ev);
    });
  }

  _parseInput(ev) {
    const val = ev.target.value;

    if (this.filtering && [DSA5ChatAutoCompletion.KEY.UP, DSA5ChatAutoCompletion.KEY.DOWN, DSA5ChatAutoCompletion.KEY.ENTER, DSA5ChatAutoCompletion.KEY.TAB].includes(ev.which)) {
      return this._navigateQuickFind(ev);
    }

    if (ev.which === DSA5ChatAutoCompletion.KEY.ESC) {
      this._closeQuickfind(ev);
      return false;
    }

    if (!this.regex.test(val)) {
      this._closeQuickfind(ev);
      return true;
    }

    const cmd = this._getCmd(val);
    const search = val.substring(1 + cmd.length).toLowerCase().trim();

    const filterMethod = `_filter${cmd}`;
    if (typeof this[filterMethod] === 'function') {
      this[filterMethod](search, ev);
      this.filtering = true;
    }

    return true;
  }

  _getCmd(val) {
    return val.substring(1, 3).toUpperCase().trim();
  }

  _completeCurrentEntry(target) {
    const container = this.#getContainer(target);
    const chatbox = container.find('.chat-input');
    const cmd = [chatbox.val().split(' ')[0], ' ']

    if (/^\/w$/.test(cmd[0])) cmd.push(`[${target.text()}] `)
    else cmd.push(target.text())

    chatbox.val(cmd.join(''));
  }

  #getContainer(target) {
    let element = target.closest('.chat-form')
    if (!element || !element.length) {
      element = document.querySelector('#chat-notifications')
    }
    return $(element);
  }

  _closeQuickfind(ev) {
    this.filtering = false;
    this.#getContainer(ev.currentTarget).find('.quickfind').remove();
  }

  _filterW(search, ev) {
    let result = game.users.contents
      .filter((x) => x.active && x.name.toLowerCase().trim().indexOf(search) != -1)
      .map((x) => {
        return { name: x.name, type: 'user' };
      });
    this._checkEmpty(result);
    this._setList(result, 'W', ev);
  }

  _filterAT(search, ev) {
    const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
    if (actor) {
      let types = ['meleeweapon', 'rangeweapon'];
      let traitTypes = ['meleeAttack', 'rangeAttack'];
      let result = actor.items
        .filter((x) => {
          return (
            ((types.includes(x.type) && x.system.worn.value == true) || (x.type == 'trait' && traitTypes.includes(x.system.traitType.value))) &&
            x.name.toLowerCase().trim().indexOf(search) != -1
          );
        })
        .slice(0, 5)
        .map((x) => {
          return { name: x.name, type: 'item' };
        })
        .concat([{ name: this.combatConstants.attackWeaponless, type: 'item' }].filter((x) => x.name.toLowerCase().trim().indexOf(search) != -1));
      this._checkEmpty(result);
      this._setList(result, 'AT', ev);
    }
  }

  _filterPA(search, ev) {
    const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
    if (actor) {
      let types = ['meleeweapon'];
      let result = actor.items
        .filter((x) => {
          return types.includes(x.type) && x.name.toLowerCase().trim().indexOf(search) != -1 && x.system.worn.value == true;
        })
        .slice(0, 5)
        .map((x) => {
          return { name: x.name, type: 'item' };
        })
        .concat(
          [
            { name: this.combatConstants.dodge, type: 'item' },
            { name: this.combatConstants.parryWeaponless, type: 'item' },
          ].filter((x) => x.name.toLowerCase().trim().indexOf(search) != -1),
        );
      this._checkEmpty(result);
      this._setList(result, 'PA', ev);
    }
  }

  _filterSP(search, ev) {
    const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
    if (actor) {
      let types = ['spell', 'ritual'];
      let result = actor.items
        .filter((x) => {
          return types.includes(x.type) && x.name.toLowerCase().trim().indexOf(search) != -1;
        })
        .slice(0, 5)
        .map((x) => {
          return { name: x.name, type: 'item' };
        });
      this._checkEmpty(result);
      this._setList(result, 'SP', ev);
    }
  }

  _checkEmpty(result) {
    if (!result.length)
      result.push({
        name: game.i18n.localize('DSAError.noMatch'),
        type: 'none',
      });
  }

  _filterLI(search, ev) {
    const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
    if (actor) {
      let types = ['liturgy', 'ceremony'];
      let result = actor.items
        .filter((x) => {
          return types.includes(x.type) && x.name.toLowerCase().trim().indexOf(search) != -1;
        })
        .slice(0, 5)
        .map((x) => {
          return { name: x.name, type: 'item' };
        });
      this._checkEmpty(result);
      this._setList(result, 'LI', ev);
    }
  }

  _getSkills(search, type = undefined) {
    search = search.replace(/(-|\+)?\d+/g, '').trim();
    let result = DSA5ChatAutoCompletion.skills
      .filter((x) => {
        return x.name.toLowerCase().trim().indexOf(search) != -1 && (type == undefined || type == x.type);
      })
      .slice(0, 5);
    this._checkEmpty(result);
    return result;
  }

  _filterCH(search, ev) {
    this._setList(this._getSkills(search), 'CH', ev);
  }

  _filterSK(search, ev) {
    this._setList(this._getSkills(search), 'SK', ev);
  }

  _filterRQ(search, ev) {
    this._setList(this._getSkills(search), 'RQ', ev);
  }

  _filterGC(search, ev) {
    this._setList(this._getSkills(search, 'skill'), 'GC', ev);
  }

  _setList(result, cmd, ev) {
    const html = $(
      `<div class="quickfind dsalist"><ul>${result.map((x) => `<li data-type="${x.type}" data-category="${cmd}" class="quick-item">${x.name}</li>`).join('')}</ul></div>`,
    );

    html.find(`.quick-item:first`).addClass('focus');
    const par = this.#getContainer(ev.currentTarget);
    let quick = par.find('.quickfind');
    if (quick.length) {
      quick.replaceWith(html);
    } else {
      par.append(html);
    }
  }

  _navigateQuickFind(ev) {
    if (!this.filtering) return true;

    const container = this.#getContainer(ev.currentTarget);
    const target = container.find('.focus');

    if (!target.length) return true;

    switch (ev.which) {
      case DSA5ChatAutoCompletion.KEY.UP:
        if (target.prev('.quick-item').length) {
          target.removeClass('focus');
          target.prev('.quick-item').addClass('focus');
        }
        ev.preventDefault();
        return false;

      case DSA5ChatAutoCompletion.KEY.DOWN:
        if (target.next('.quick-item').length) {
          target.removeClass('focus');
          target.next('.quick-item').addClass('focus');
        }
        ev.preventDefault();
        return false;

      case DSA5ChatAutoCompletion.KEY.ENTER:
        if (target.attr('data-category') !== 'W') {
          ev.stopPropagation();
          ev.preventDefault();
          this._quickSelect(target);
          return false;
        }
        break;

      case DSA5ChatAutoCompletion.KEY.TAB:
        ev.stopPropagation();
        ev.preventDefault();
        this._completeCurrentEntry(target);
        this._closeQuickfind(ev);
        return false;
    }

    return true;
  }

  static _getActor() {
    const speaker = ChatMessage.getSpeaker();
    let actor;
    if (speaker.token) actor = game.actors.tokens[speaker.token];
    if (!actor) actor = game.actors.get(speaker.actor);

    if (!actor) {
      ui.notifications.error('DSAError.noProperActor', { localize: true });
      return {};
    }
    return {
      actor,
      tokenId: speaker.token,
    };
  }

  _quickSelect(target) {
    let cmd = target.attr('data-category');
    switch (cmd) {
      case 'NM':
      case 'GC':
      case 'RQ':
      case 'CH':
        this[`_quick${cmd}`](target);
        break;
      case 'W':
        this._completeCurrentEntry(target);
        break;
      default:
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
        if (actor) {
          this._resetChatAutoCompletion(target);
          this[`_quick${cmd}`](target, actor, tokenId);
        }
    }
  }

  _quickW(target, actor, tokenId) { }

  _quickCH(target) {
    DSA5ChatListeners.check3D20(target);
    this._resetChatAutoCompletion(target);
  }

  _quickSK(target, actor, tokenId) {
    switch (target.attr('data-type')) {
      case 'skill':
        let skill = actor.items.find((i) => i.name == target.text() && i.type == 'skill');
        if (skill)
          actor.setupSkill(skill, {}, tokenId).then((setupData) => {
            actor.basicTest(setupData);
          });
        break;
      case 'attribute':
        let characteristic = Object.keys(game.dsa5.config.characteristics).find((key) => game.i18n.localize(game.dsa5.config.characteristics[key]) == target.text());
        actor.setupCharacteristic(characteristic, {}, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
        break;
      case 'regeneration':
        actor.setupRegeneration('regenerate', {}, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
        break;
    }
  }

  _resetChatAutoCompletion(target) {
    const par = this.#getContainer(target);
    par.find('.chat-input').val('');
    par.find('.quickfind').remove();
  }

  #getNumberFromChat(target) {
    const par = this.#getContainer(target);
    const val = par.find('.chat-input').val();
    return Number(val.match(/(-|\+)?\d+/g)) || 0;
  }

  _quickGC(target) {
    const modifier = this.#getNumberFromChat(target);
    this._resetChatAutoCompletion(target);
    RequestRoll.showGCMessage(target.text(), modifier);
  }

  _quickRQ(target) {
    const modifier = this.#getNumberFromChat(target);
    this._resetChatAutoCompletion(target);
    RequestRoll.showRQMessage(target.text(), modifier);
  }

  _quickPA(target, actor, tokenId) {
    let text = target.text();

    if (this.combatConstants.dodge == text) {
      actor.setupDodge({}, tokenId).then((setupData) => {
        actor.basicTest(setupData);
      });
    } else if (this.combatConstants.parryWeaponless == text) {
      actor.setupWeaponless('parry', {}, tokenId).then((setupData) => {
        actor.basicTest(setupData);
      });
    } else {
      let types = ['meleeweapon'];
      let result = actor.items.find((x) => {
        return types.includes(x.type) && x.name == target.text();
      });
      if (result) {
        actor.setupWeapon(result, 'parry', {}, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
      }
    }
  }

  _quickAT(target, actor, tokenId) {
    let text = target.text();
    if (this.combatConstants.attackWeaponless == text) {
      actor.setupWeaponless('attack', {}, tokenId).then((setupData) => {
        actor.basicTest(setupData);
      });
    } else {
      const types = ['meleeweapon', 'rangeweapon'];
      const traitTypes = ['meleeAttack', 'rangeAttack'];
      let result = actor.items.find((x) => {
        return types.includes(x.type) && x.name == target.text();
      });
      if (!result)
        result = actor.items.find((x) => {
          return x.type == 'trait' && x.name == target.text() && traitTypes.includes(x.system.traitType.value);
        });

      if (result) {
        actor.setupWeapon(result, 'attack', {}, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
      }
    }
  }
  _quickSP(target, actor, tokenId) {
    const types = ['ritual', 'spell'];
    const result = actor.items.find((x) => {
      return types.includes(x.type) && x.name == target.text();
    });
    if (result) {
      actor.setupSpell(result, {}, tokenId).then((setupData) => {
        actor.basicTest(setupData);
      });
    }
  }
  _quickLI(target, actor, tokenId) {
    const types = ['liturgy', 'ceremony'];
    const result = actor.items.find((x) => {
      return types.includes(x.type) && x.name == target.text();
    });
    if (result) {
      actor.setupSpell(result, {}, tokenId).then((setupData) => {
        actor.basicTest(setupData);
      });
    }
  }

  static async infoItemAsync(uuid) {
    const item = await fromUuid(uuid);
    item.postItem();
  }

  static bindRollCommands(html) {
    html.on('click', '.request-roll', (ev) => {
      const dataset = ev.currentTarget.dataset;
      RequestRoll.showRQMessage(dataset.name, Number(dataset.modifier) || 0, dataset.label);
      ev.stopPropagation();
      return false;
    });
    html.on('click', '.postInfo', (ev) => {
      const item = fromUuidSync(ev.currentTarget.dataset.uuid);
      if (item) {
        if (typeof item.postItem === 'function') {
          item.postItem();
        } else {
          this.infoItemAsync(ev.currentTarget.dataset.uuid);
        }
      }

      ev.stopPropagation();
      return false;
    });
    html.on('click', '.postContentChat', async (ev) => {
      const content = $(ev.currentTarget).closest('.postChatSection').find('.postChatContent').html();
      UserMultipickDialog.getDialog(content);
    });
    html.on('click', '.request-GC', (ev) => {
      RequestRoll.showGCMessage(ev.currentTarget.dataset.name, Number(ev.currentTarget.dataset.modifier) || 0);
      ev.stopPropagation();
      return false;
    });
    html.on('click', '.request-CH', (ev) => {
      DSA5ChatListeners.check3D20($(ev.currentTarget), ev.currentTarget.dataset.name, { modifier: Number(ev.currentTarget.dataset.modifier) || 0 });
      ev.stopPropagation();
      return false;
    });
    html.on('click', '.request-Pay', (ev) => {
      if (!game.user.isGM) return;

      const master = game.dsa5.apps.gameMasterMenu;
      master.doPayment(master.selectedIDs(), true, ev.currentTarget.dataset.modifier);
    });
    html.on('click', '.request-GetPaid', (ev) => {
      if (!game.user.isGM) return;

      const master = game.dsa5.apps.gameMasterMenu;
      master.doPayment(master.selectedIDs(), false, ev.currentTarget.dataset.modifier);
    });
    html.on('click', '.request-AP', (ev) => {
      if (!game.user.isGM) return;

      const master = game.dsa5.apps.gameMasterMenu;
      master.getExp(master.selectedIDs(), ev.currentTarget.dataset.modifier);
    });
    const itemDragStart = (event) => {
      event.stopPropagation();
      const type = event.currentTarget.dataset.type;
      const uuid = event.currentTarget.dataset.uuid;
      if (!uuid || !type) return;

      event.originalEvent.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          type,
          uuid,
        }),
      );
    };
    const showItem = html.find('.show-item');
    showItem.on('click', async (ev) => {
      let itemId = ev.currentTarget.dataset.uuid;
      const item = await fromUuid(itemId);
      item.sheet.render(true);
    });
    showItem.attr('draggable', true).on('dragstart', (event) => itemDragStart(event));

    html.on('click', '.actorEmbeddedAbility', async (ev) => {
      const actor = await fromUuid(ev.currentTarget.dataset.actor);
      const item = actor.items.get(ev.currentTarget.dataset.id);
      if (item) item.sheet.render(true);
    });
  }
}
