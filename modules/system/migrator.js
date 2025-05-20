import { DefaultAppv2 } from '../actor/baseapp.js';
import DSA5_Utility from './utility-dsa5.js';
import { tabSlider } from './view_helper.js';
const { mergeObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

async function setupDefaulTokenConfig() {
  if (!game.settings.get('dsa5', 'defaultConfigFinished')) {
    console.log('Configuring default token settings');
    let defaultToken = game.settings.get('core', 'prototypeTokenOverrides');

    defaultToken.base.displayName = CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER;
    defaultToken.base.displayBars = CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER;
    defaultToken.base.disposition = CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    defaultToken.base.lockRotation = true;
    defaultToken.base.bar1 = { attribute: 'status.wounds' };
    defaultToken.character.sight.enabled = true;
    await game.settings.set('core', 'prototypeTokenOverrides', defaultToken);
    await game.settings.set('core', 'leftClickRelease', true);
    await game.settings.set('dsa5', 'defaultConfigFinished', true);
    await this.migrateTo33();
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
  if (currentVersion < 33) {
    await migrateTo33();
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

async function migrateTo33() {
  await game.settings.set('core', 'dynamicTokenRing', 'dsa5token');
  const combatTrackerConfig = game.settings.get('core', 'combatTrackerConfig');
  foundry.utils.mergeObject(combatTrackerConfig, {
    turnMarker: {
      src: 'systems/dsa5/icons/backgrounds/turnMarker.webp',
      animation: 'spin',
    },
  });
  await game.settings.set('core', 'combatTrackerConfig', combatTrackerConfig);
}

export async function showPatchViewer() {
  const notes = await fetch('systems/dsa5/lazy/updatenotes.json');
  const json = await notes.json();
  const patchViewer = new PatchViewer(json);
  patchViewer.render(true);
}

function betaWarning(version, version_specific = '', indef = false) {
  const indefMsg = indef ? `Foundry v${version} is still in development and so is TDE/DSA.` : 'TDE/DSA is still in development.';
  const msg = `<p>This is the beta version for DSA/TDE for Foundry v${version}. ${indefMsg} You might encounter on or more issues. Please report those on the official <a href=\"https://github.com/Plushtoast/dsa5-foundryVTT/issues\" target=\"_blank\">TDE/DSA Github</a>. Thank you.</p>${version_specific}`;
  ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
}

async function checkBetaSettings() {
  const uiConfig = game.settings.get('core', 'uiConfig');
  const dsaSkin = game.settings.get('dsa5', 'globalStyle');

  const setDefaults = dsaSkin != 'dsa5-immersive' || uiConfig.colorScheme.interface != 'light' || uiConfig.colorScheme.applications != 'light';
  if (!setDefaults) return;

  const proceed = await foundry.applications.api.DialogV2.confirm({
    content: "<p>The current beta only supports the <b>DSA5 Immersive</b> skin in light mode. Do you want to set the default skin now?</p>",
    rejectClose: false,
    modal: true
  });
  if (!proceed) return;

  await game.settings.set('dsa5', 'globalStyle', 'dsa5-immersive');
  await game.settings.set('core', 'uiConfig', {
    ...uiConfig,
    colorScheme: {
      ...uiConfig.colorScheme,
      interface: 'light',
      applications: 'light',
    },
  });
}

export default function migrateWorld() {
  Hooks.once('ready', async function () {
    if (!game.user.isGM) return;

    await setupDefaulTokenConfig();
    const currentVersion = game.settings.get('dsa5', 'migrationVersion');
    const NEEDS_MIGRATION_VERSION = 33;
    const needsMigration = currentVersion < NEEDS_MIGRATION_VERSION;

    const v13 = `<p>The currently advised foundry vtt version for DSA/TDE is v12. Please revert back unless you want to test out the newest features and provide feedback.</p><p>This is the <b>Broken Release</b> meaning everything code wise has changes to adopt to the newest technical demands of Foundry VTT. We are already working months to adapt ApplicationV2, Data Models and other things into the new DSA/TDE version. Regardless of ridiculous effort and testing you can expect a large amount of bugs</p><p>The advancement of this system is dependent on you reporting issues and providing ideas and feedback. So feel free to discuss in the DSA/TDE Foundry VTT Discord</p><p>Thank you for all your feedback.</p>`;
    betaWarning(13, v13);

    checkBetaSettings();

    if (!needsMigration) return;

    migrateDSA(currentVersion, NEEDS_MIGRATION_VERSION);
  });
}

class PatchViewer extends DefaultAppv2 {
  constructor(json, app) {
    super(app);
    this.json = json;
    this.versionIndex = 3;
  }

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'largeDialog', 'patches'],
    position: {
      width: 740,
      height: 740,
    },
    window: {
      title: 'Changelog',
      resizable: true,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/system/patchviewer.hbs',
      templates: ['systems/dsa5/templates/system/dsatabs.hbs'],
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'newcontent', label: 'News' },
        { id: 'changelog', label: 'Changelog' },
        { id: 'content', label: 'modules' },
      ],
      initial: 'newcontent',
    },
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    tabSlider(html);
    html.find('.showMore').on('click', () => this.showMore(html));
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

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    let version = this.json['notes'][this.json['notes'].length - 1];
    const patchName = this.json['default'].replace(/VERSION/g, version.version);
    let msg = `<h1>CHANGELOG</h1><p>${patchName}. </br><b>Important updates</b>: ${version.text}</p><p>For details or proposals visit our wiki page at <a href="https://github.com/Plushtoast/dsa5-foundryVTT/wiki" target="_blank">Github</a> or show the <a style="text-decoration: underline;color:#ff6400;" class="showPatchViewer">Full Changelog in Foundry</a>. Have fun.</p>`;
    await ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));

    const lang = game.i18n.lang;
    const curVersion = await this.fetchVersions([version]);
    const prevVersions = [this.json['notes'][this.json['notes'].length - 2]];
    const preVersions = await this.fetchVersions(prevVersions);
    const modules = await renderTemplate(`systems/dsa5/lazy/patchhtml/modules_${lang}.html`);

    return mergeObject(data, {
      patchName,
      changelog: curVersion.changelog[0],
      news: curVersion.news[0],
      prevVersions,
      prevChangeLogs: preVersions.changelog,
      prevNews: preVersions.news,
      modules,
    });
  }
}
