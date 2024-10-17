import DSA5 from './config-dsa5.js';
import DSA5_Utility from './utility-dsa5.js';
import { showPatchViewer } from './migrator.js';
import RuleChaos from './rule_chaos.js';
import { showPopout } from '../hooks/imagepopouttochat.js';
const { duplicate } = foundry.utils;

export default class DSA5ChatListeners {
  static chatListeners(html) {
    html.on('click', '.openJournalBrowser', () =>
      game.dsa5.apps.journalBrowser.render(true),
    );
    html.on('click', '.openBookInJournalBrowser', async (ev) => {
      const book = ev.currentTarget.dataset.book;
      const bookType = ev.currentTarget.dataset.type || 'books';
      await game.dsa5.apps.journalBrowser.render(false);
      await game.dsa5.apps.journalBrowser.loadBook(
        book,
        $(game.dsa5.apps.journalBrowser._element),
        bookType,
      );
      await game.dsa5.apps.journalBrowser.render(true);
    });

    const helpButton = $(
      '<a class="button showHelp" data-tooltip="HELP.showHelp"><i class="fas fa-question"></i></a>',
    );
    helpButton.on('click', () => DSA5ChatListeners.getHelp());
    $(html.find('.control-buttons')).prepend(helpButton);
    html.on('click', '.showPatchViewer', () => showPatchViewer());
    html.on('click', '.functionswitch', (ev) =>
      RuleChaos[ev.currentTarget.dataset.function](ev),
    );
    html.on('click', '.panToToken', (ev) => DSA5ChatListeners.panToToken(ev));
    html.on('click', '.popoutImage', (ev) => showPopout(ev));
  }

  static async panToToken(ev) {
    const token = await fromUuid(ev.currentTarget.dataset.uuid);
    if (!token) return;

    canvas.animatePan({ x: token.x, y: token.y });

    if (!token.isOwner) return;

    token.object.control({ releaseOthers: true });
  }

  static postStatus(id) {
    let effect = CONFIG.statusEffects.find((x) => x.id == id);
    let msg = `<h2><a class="chat-condition chatButton" data-id="${id}"><img class="sender-image" style="background-color:black;margin-right: 8px;" src="${effect.img}"/>${game.i18n.localize(effect.name)}</h2></a><p>${game.i18n.localize(effect.description)}</p>`;
    ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
  }

  static getHelp() {
    let msg =
      DSA5.helpContent
        .map(
          (x) => `<h2>${game.i18n.localize(`HELP.${x.name}`)}</h2>
            <p><b>${game.i18n.localize('HELP.command')}</b>: ${x.command}</p>
            <p><b>${game.i18n.localize('HELP.example')}</b>: ${x.example}</p>
            <p><b>${game.i18n.localize('Description')}</b>: ${game.i18n.localize(`HELP.descr${x.name}`)}`,
        )
        .join('') +
      `<br>
            <p>${game.i18n.localize('HELP.default')}</p>`;
    ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
  }

  static showConditions() {
    let effects = duplicate(CONFIG.statusEffects)
      .map((x) => {
        x.name = game.i18n.localize(x.name);
        return x;
      })
      .sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
    let msg = effects
      .map(
        (x) =>
          `<a class="chat-condition chatButton" data-id="${x.id}"><img src="${x.img}"/>${x.name}</a>`,
      )
      .join(' ');
    ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
  }

  static async check3D20(target, skill, options = {}) {
    let attrs = 12;
    let json = {};
    if (target) {
      target = target.get(0);
      skill = await DSA5_Utility.skillByName(skill || target.textContent);
      if (target.dataset.attrs) attrs = target.dataset.attrs.split('|');
      if (target.dataset.json)
        json = JSON.parse(decodeURIComponent(target.dataset.json));
    } else if (skill) {
      skill = await DSA5_Utility.skillByName(skill);
    }
    if (skill) skill = skill.toObject();

    if (!skill) {
      skill = {
        name: '3d20',
        type: 'skill',
        system: {
          talentValue: { value: 0 },
          characteristic1: { value: 'mu' },
          characteristic2: { value: 'kl' },
          characteristic3: { value: 'in' },
          RPr: { value: 'no' },
          burden: { value: 'no' },
        },
      };
    }

    const actor = await DSA5_Utility.emptyActor(attrs);

    if (json.attrs) {
      const attrs = json.attrs.split(',');

      for (let i = 1; i <= attrs.length; i++) {
        actor.system.characteristics[
          skill.system[`characteristic${i}`].value
        ].initial = Number(attrs[i - 1]) || 12;
      }
      actor.prepareData();
    }
    skill.system.talentValue.value = Number(json.fw) || 0;

    actor.setupSkill(skill, options, 'emptyActor').then((setupData) => {
      actor.basicTest(setupData);
    });
  }

  static async showTables() {
    const msg = await renderTemplate(
      'systems/dsa5/templates/tables/systemtables.html',
      { tables: DSA5.systemTables },
    );
    ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
  }
}
