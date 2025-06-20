import DSA5ChatListeners from './chat_listeners.js';
import RequestRoll from '../rolls/request-roll.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import { UserMultipickDialog } from '../../dialog/addTargetDialog.js';

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
    this.filtering = false;
    this.combatConstants = {
      dodge: game.i18n.localize('dodge'),
      parryWeaponless: game.i18n.localize('parryWeaponless'),
      attackWeaponless: game.i18n.localize('attackWeaponless'),
    };
    
    this.initializeSkills();
  }

  async initializeSkills() {
    if (DSA5ChatAutoCompletion.skills.length === 0) {
      try {
        const skillItems = await DSA5_Utility.allSkills();
        
        const skillOptions = skillItems.map(x => ({ 
          name: x.name, 
          type: 'skill' 
        }));
        
        const attributeOptions = Object.values(game.dsa5.config.characteristics)
          .map(x => ({ 
            name: game.i18n.localize(x), 
            type: 'attribute' 
          }));
        
        const specialOptions = [
          { name: game.i18n.localize('regenerate'), type: 'regeneration' },
          { name: game.i18n.localize('fallingDamage'), type: 'fallingDamage' }
        ];
        
        DSA5ChatAutoCompletion.skills = [
          ...skillOptions,
          ...attributeOptions,
          ...specialOptions
        ];
      } catch (error) {
        console.error("Failed to initialize DSA5ChatAutoCompletion skills:", error);
      }
    }
  }

  get regex() {
    return new RegExp(`^/(${DSA5ChatAutoCompletion.cmds.join(' |')})`);
  }

  async chatListeners(html) {
    const chatInput = document.querySelector('.chat-input');
    chatInput.addEventListener('keyup', this._parseInput.bind(this));

    $(document.querySelector('#chat-notifications .chat-input')).on('blur', (ev) => {      
      if ($(ev.relatedTarget).closest('.quick-item').length || $(ev.relatedTarget).hasClass('quick-item')) return;
      this._closeQuickfind(ev);
    });
  }

  _parseInput(ev) {
    const val = ev.target.value;
    const keyCode = ev.which;

    if (this.filtering && [DSA5ChatAutoCompletion.KEY.UP, DSA5ChatAutoCompletion.KEY.DOWN, 
                          DSA5ChatAutoCompletion.KEY.ENTER, DSA5ChatAutoCompletion.KEY.TAB].includes(keyCode)) {
      return this._navigateQuickFind(ev);
    }

    if (keyCode === DSA5ChatAutoCompletion.KEY.ESC) {
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
    const container = this.getContainer(target);
    const chatbox = container.find('.chat-input');
    const cmdText = chatbox.val().split(' ')[0];

    let newVal = cmdText + ' ';
    if (/^\/w$/i.test(cmdText)) {
      newVal += `[${target.text()}] `;
    } else {
      newVal += target.text();
    }

    chatbox.val(newVal);
  }

  getContainer(target) {
    let element = target.closest('.chat-form');
    if (!element || !element.length) {
      element = document.querySelector('#chat-notifications');
    }
    return $(element);
  }

  _closeQuickfind(ev) {
    this.filtering = false;
    this.getContainer(ev.currentTarget).find('.quickfind').remove();
  }

  _filterW(search, ev) {
    const result = game.users.contents
      .filter(user => user.active && user.name.toLowerCase().includes(search))
      .map(user => ({ name: user.name, type: 'user' }));
    
    this._setFilteredList(result, 'W', ev);
  }

  _filterAT(search, ev) {
    const { actor } = DSA5ChatAutoCompletion._getActor();
    if (!actor) return;

    const types = ['meleeweapon', 'rangeweapon'];
    const traitTypes = ['meleeAttack', 'rangeAttack'];
    
    const itemResults = actor.items
      .filter(item => {
        return (
          ((types.includes(item.type) && item.system.worn.value) || 
           (item.type === 'trait' && traitTypes.includes(item.system.traitType.value))) &&
          item.name.toLowerCase().includes(search)
        );
      })
      .slice(0, 5)
      .map(item => ({ name: item.name, type: 'item' }));
    
    const specialAttacks = [
      { name: this.combatConstants.attackWeaponless, type: 'item' }
    ].filter(x => x.name.toLowerCase().includes(search));
    
    const result = [...itemResults, ...specialAttacks];
    this._setFilteredList(result, 'AT', ev);
  }

  _filterPA(search, ev) {
    const { actor } = DSA5ChatAutoCompletion._getActor();
    if (!actor) return;

    const wornMeleeWeapons = actor.items
      .filter(item => 
        item.type === 'meleeweapon' && 
        item.system.worn.value && 
        item.name.toLowerCase().includes(search)
      )
      .slice(0, 5)
      .map(item => ({ name: item.name, type: 'item' }));
    
    const specialDefenses = [
      { name: this.combatConstants.dodge, type: 'item' },
      { name: this.combatConstants.parryWeaponless, type: 'item' },
    ].filter(x => x.name.toLowerCase().includes(search));
    
    const result = [...wornMeleeWeapons, ...specialDefenses];
    this._setFilteredList(result, 'PA', ev);
  }

  _filterSP(search, ev) {
    const { actor } = DSA5ChatAutoCompletion._getActor();
    if (!actor) return;

    const result = actor.items
      .filter(item => 
        ['spell', 'ritual'].includes(item.type) && 
        item.name.toLowerCase().includes(search)
      )
      .slice(0, 5)
      .map(item => ({ name: item.name, type: 'item' }));
    
    this._setFilteredList(result, 'SP', ev);
  }

  _filterLI(search, ev) {
    const { actor } = DSA5ChatAutoCompletion._getActor();
    if (!actor) return;

    const result = actor.items
      .filter(item => 
        ['liturgy', 'ceremony'].includes(item.type) && 
        item.name.toLowerCase().includes(search)
      )
      .slice(0, 5)
      .map(item => ({ name: item.name, type: 'item' }));
    
    this._setFilteredList(result, 'LI', ev);
  }

  _setFilteredList(result, cmd, ev) {
    if (!result.length) {
      result.push({
        name: game.i18n.localize('DSAError.noMatch'),
        type: 'none',
      });
    }
    this._setList(result, cmd, ev);
  }

  _getSkills(search, type) {
    search = search.replace(/(-|\+)?\d+/g, '').trim();
    
    const result = DSA5ChatAutoCompletion.skills
      .filter(skill => 
        skill.name.toLowerCase().includes(search) && 
        (type === undefined || type === skill.type)
      )
      .slice(0, 5);
    
    if (!result.length) {
      result.push({
        name: game.i18n.localize('DSAError.noMatch'),
        type: 'none',
      });
    }
    
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
      `<div class="quickfind dsalist"><ul>${
        result.map(x => `<li data-type="${x.type}" data-category="${cmd}" class="quick-item">${x.name}</li>`).join('')
      }</ul></div>`
    );

    html.find(`.quick-item:first`).addClass('focus');
    html.find('.quick-item').on('click', ev => this._quickSelect($(ev.currentTarget)));
    
    const container = this.getContainer(ev.currentTarget);
    const existing = container.find('.quickfind');
    
    if (existing.length) {
      existing.replaceWith(html);
    } else {
      container.append(html);
    }
  }

  _navigateQuickFind(ev) {
    if (!this.filtering) return true;

    const container = this.getContainer(ev.currentTarget);
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
    let actor = null;
    
    //todo sth odd here
    if (speaker.token) {
      actor = game.actors.tokens[speaker.token];
    }
    
    if (!actor) {
      actor = game.actors.get(speaker.actor);
    }

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
    const cmd = target.attr('data-category');
    
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

  _quickCH(target) {
    DSA5ChatListeners.check3D20(target);
    this._resetChatAutoCompletion(target);
  }

  _quickSK(target, actor, tokenId) {
    const type = target.attr('data-type');
    const text = target.text();
    
    switch (type) {
      case 'skill':
        const skill = actor.items.find(i => i.name === text && i.type === 'skill');
        if (skill) {
          actor.setupSkill(skill, {}, tokenId)
            .then(setupData => actor.basicTest(setupData));
        }
        break;
      case 'attribute':
        const characteristic = Object.keys(game.dsa5.config.characteristics)
          .find(key => game.i18n.localize(game.dsa5.config.characteristics[key]) === text);
        actor.setupCharacteristic(characteristic, {}, tokenId)
          .then(setupData => actor.basicTest(setupData));
        break;
      case 'regeneration':
        actor.setupRegeneration('regenerate', {}, tokenId)
          .then(setupData => actor.basicTest(setupData));
        break;
    }
  }

  _resetChatAutoCompletion(target) {
    const container = this.getContainer(target);
    container.find('.chat-input').val('');
    container.find('.quickfind').remove();
  }

  getNumberFromChat(target) {
    const container = this.getContainer(target);
    const val = container.find('.chat-input').val();
    return Number(val.match(/(-|\+)?\d+/g)) || 0;
  }

  _quickGC(target) {
    const modifier = this.getNumberFromChat(target);
    this._resetChatAutoCompletion(target);
    RequestRoll.showGCMessage(target.text(), modifier);
  }

  _quickRQ(target) {
    const modifier = this.getNumberFromChat(target);
    this._resetChatAutoCompletion(target);
    RequestRoll.showRQMessage(target.text(), modifier);
  }

  _quickPA(target, actor, tokenId) {
    const text = target.text();

    if (this.combatConstants.dodge === text) {
      actor.setupDodge({}, tokenId)
        .then(setupData => actor.basicTest(setupData));
    } else if (this.combatConstants.parryWeaponless === text) {
      actor.setupWeaponless('parry', {}, tokenId)
        .then(setupData => actor.basicTest(setupData));
    } else {
      const weapon = actor.items.find(item => 
        item.type === 'meleeweapon' && item.name === text
      );
      
      if (weapon) {
        actor.setupWeapon(weapon, 'parry', {}, tokenId)
          .then(setupData => actor.basicTest(setupData));
      }
    }
  }

  _quickAT(target, actor, tokenId) {
    const text = target.text();
    
    if (this.combatConstants.attackWeaponless === text) {
      actor.setupWeaponless('attack', {}, tokenId)
        .then(setupData => actor.basicTest(setupData));
      return;
    }
    
    const types = ['meleeweapon', 'rangeweapon'];
    const traitTypes = ['meleeAttack', 'rangeAttack'];
    
    let item = actor.items.find(i => types.includes(i.type) && i.name === text);
    
    if (!item) {
      item = actor.items.find(i => 
        i.type === 'trait' && 
        i.name === text && 
        traitTypes.includes(i.system.traitType.value)
      );
    }

    if (item) {
      actor.setupWeapon(item, 'attack', {}, tokenId)
        .then(setupData => actor.basicTest(setupData));
    }
  }

  _quickSP(target, actor, tokenId) {
    const types = ['ritual', 'spell'];
    const spell = actor.items.find(item => 
      types.includes(item.type) && item.name === target.text()
    );
    
    if (spell) {
      actor.setupSpell(spell, {}, tokenId)
        .then(setupData => actor.basicTest(setupData));
    }
  }

  _quickLI(target, actor, tokenId) {
    const types = ['liturgy', 'ceremony'];
    const liturgy = actor.items.find(item => 
      types.includes(item.type) && item.name === target.text()
    );
    
    if (liturgy) {
      actor.setupSpell(liturgy, {}, tokenId)
        .then(setupData => actor.basicTest(setupData));
    }
  }

  static async infoItemAsync(uuid) {
    const item = await fromUuid(uuid);
    if (item) item.postItem();
  }

  static bindRollCommands(html) {
    html.on('click', '.request-roll', (ev) => {
      const { name, modifier, label } = ev.currentTarget.dataset;
      RequestRoll.showRQMessage(name, Number(modifier) || 0, label);
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
      DSA5ChatListeners.check3D20($(ev.currentTarget), ev.currentTarget.dataset.name, { 
        modifier: Number(ev.currentTarget.dataset.modifier) || 0 
      });
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
      const { type, uuid } = event.currentTarget.dataset;
      if (!uuid || !type) return;

      event.originalEvent.dataTransfer.setData(
        'text/plain',
        JSON.stringify({ type, uuid })
      );
    };

    const showItems = html.find('.show-item');
    showItems.on('click', async (ev) => {
      const item = await fromUuid(ev.currentTarget.dataset.uuid);
      item.sheet.render(true);
    });
    
    showItems.attr('draggable', true).on('dragstart', itemDragStart);

    html.on('click', '.actorEmbeddedAbility', async (ev) => {
      const actor = await fromUuid(ev.currentTarget.dataset.actor);
      const item = actor.items.get(ev.currentTarget.dataset.id);
      if (item) item.sheet.render(true);
    });
  }
}
