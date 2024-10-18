import DSA5_Utility from './utility-dsa5.js';
import { tabSlider } from './view_helper.js';
const { mergeObject } = foundry.utils;

async function setupDefaulTokenConfig() {
  if (!game.settings.get('dsa5', 'defaultConfigFinished')) {
    console.log('Configuring default token settings');
    let defaultToken = game.settings.get('core', 'defaultToken');

    defaultToken.displayName = CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER;
    defaultToken.displayBars = CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER;
    defaultToken.disposition = CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    defaultToken.bar1 = { attribute: 'status.wounds' };
    await game.settings.set('core', 'defaultToken', defaultToken);
    await game.settings.set('core', 'leftClickRelease', true);
    await game.settings.set('dsa5', 'defaultConfigFinished', true);
  }
}

async function migrateDSA(currentVersion, migrationVersion) {
  await showPatchViewer();

  if (currentVersion < 24) {
    await migratTo24();
  }
  if (currentVersion < 27) {
    await migrateTo26();
  }

  await game.settings.set('dsa5', 'migrationVersion', migrationVersion);
}

async function migratTo24() {
  for (let actor of game.actors) {
    const removeEffects = actor.effects.filter((x) => ['inpain', 'encumbered'].includes(x.getFlag('core', 'statusId')));

    if (removeEffects.length)
      await actor.deleteEmbeddedDocuments(
        'ActiveEffect',
        removeEffects.map((x) => x.id),
      );
  }
}

async function migrateTo26() {
  game.settings.set('dsa5', 'disableTokenhotbar', true);
}

export async function showPatchViewer() {
  const notes = await fetch('systems/dsa5/lazy/updatenotes.json');
  const json = await notes.json();
  const patchViewer = new PatchViewer(json);
  patchViewer.render(true);
}

function betaWarning(version) {
  const msg = `This is the beta version for DSA/TDE for Foundry v${version}. Foundry v${version} is still in development and so is TDE/DSA. You might encounter on or more issues. Please report those on the official TDE/DSA Github. Thank you.`;
  ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
}

export default function migrateWorld() {
  Hooks.once('ready', async function () {
    if (!game.user.isGM) return;

    await setupDefaulTokenConfig();
    const currentVersion = game.settings.get('dsa5', 'migrationVersion');
    const NEEDS_MIGRATION_VERSION = 31;
    const needsMigration = currentVersion < NEEDS_MIGRATION_VERSION;

    //betaWarning(12)

    if (!needsMigration) return;

    migrateDSA(currentVersion, NEEDS_MIGRATION_VERSION);
  });
}

class PatchViewer extends Application {
  constructor(json, app) {
    super(app);
    this.json = json;
    this.versionIndex = 3;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.tabs = [
      {
        navSelector: '.tabs',
        contentSelector: '.content',
        initial: 'newcontent',
      },
    ];
    mergeObject(options, {
      classes: options.classes.concat(['dsa5', 'largeDialog', 'patches']),
      width: 740,
      height: 740,
      title: 'Changelog',
    });
    options.template = 'systems/dsa5/templates/system/patchviewer.html';
    options.resizable = true;
    return options;
  }

  activateListeners(html) {
    super.activateListeners(html);

    tabSlider(html);
    html.find('.showMore').click((ev) => this.showMore(html));
  }

  async showMore(html) {
    const prevVersions = [this.json['notes'][this.json['notes'].length - this.versionIndex]];
    if (prevVersions[0].version == '2.3.0') {
      html.find('.showMore').hide();
      return;
    }

    const data = await this.fetchVersions(prevVersions);
    html.find('.changelogsection').append(data.changelog[0]);
    html.find('.newssection').append(data.news[0]);
    this.versionIndex += 1;
  }

  async fetchVersions(versions) {
    const lang = game.i18n.lang;
    const changelog = await Promise.all(versions.map(async (x) => await renderTemplate(`systems/dsa5/lazy/patchhtml/changelog_${lang}_${x.version}.html`)));
    const news = await Promise.all(versions.map(async (x) => await renderTemplate(`systems/dsa5/lazy/patchhtml/news_${lang}_${x.version}.html`)));
    return {
      changelog,
      news,
    };
  }

  async getData() {
    let version = this.json['notes'][this.json['notes'].length - 1];
    const patchName = this.json['default'].replace(/VERSION/g, version.version);
    let msg = `<h1>CHANGELOG</h1><p>${patchName}. </br><b>Important updates</b>: ${version.text}</p><p>For details or proposals visit our wiki page at <a href="https://github.com/Plushtoast/dsa5-foundryVTT/wiki" target="_blank">Github</a> or show the <a style="text-decoration: underline;color:#ff6400;" class="showPatchViewer">Full Changelog in Foundry</a>. Have fun.</p>`;
    await ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));

    const lang = game.i18n.lang;
    const curVersion = await this.fetchVersions([version]);
    const prevVersions = [this.json['notes'][this.json['notes'].length - 2]];
    const preVersions = await this.fetchVersions(prevVersions);
    const modules = await renderTemplate(`systems/dsa5/lazy/patchhtml/modules_${lang}.html`);

    return {
      patchName,
      changelog: curVersion.changelog[0],
      news: curVersion.news[0],
      prevVersions,
      prevChangeLogs: preVersions.changelog,
      prevNews: preVersions.news,
      modules,
    };
  }
}
