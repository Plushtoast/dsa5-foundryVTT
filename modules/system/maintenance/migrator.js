import { PatchViewer } from './patchviewer.js';
import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';

const INBETA = false;
const { NEEDS_MIGRATION_VERSION } = DSA5;

async function fetchPatchNotes() {
  const notes = await fetch('systems/dsa5/lazy/updatenotes.json');
  return await notes.json();
}

async function announceChangelog(json) {
  const version = json?.notes?.[json.notes.length - 1];
  if (!version?.version) return;

  const patchName = json['default'].replace(/VERSION/g, version.version);
  const msg = `<h1>CHANGELOG</h1><p>${patchName}. </br><b>Important updates</b>: ${version.text}</p><p>For details or proposals visit our wiki page at <a href="https://plushtoast.github.io/dsa5-foundryVTT-wiki/" target="_blank">Wiki</a> or show the <a style="text-decoration: underline;color:#ff6400;" class="showPatchViewer">Full Changelog in Foundry</a>. Have fun.</p>`;
  await ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
}

async function setupDefaulTokenConfig() {
  if (!game.settings.get('dsa5', 'defaultConfigFinished')) {
    console.log('Configuring default token settings');
    const defaultToken = game.settings.get('core', foundry.data.PrototypeTokenOverrides.SETTING);
    defaultToken.updateSource({
      base: {
        displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
        displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
        disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        bar1: { attribute: 'status.wounds' },
      },
      character: {
        sight: { enabled: true },
      },
      group: {
        sight: { enabled: true },
      }
    })
    await game.settings.set('core', foundry.data.PrototypeTokenOverrides.SETTING, defaultToken.toObject());
    await game.settings.set('core', 'leftClickRelease', true);
    await game.settings.set('dsa5', 'defaultConfigFinished', true);
    await migrateTo33();
  }
}

async function migrateDSA(currentVersion, migrationVersion) {
  const json = await fetchPatchNotes();
  await announceChangelog(json);
  await showPatchViewer(json);

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
  for (const actor of game.actors) {
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

export async function showPatchViewer(json = undefined) {
  json ??= await fetchPatchNotes();
  const patchViewer = new PatchViewer(json, undefined, { initialTab: 'newcontent' });
  patchViewer.render(true);
}

export async function showWelcomeApp() {
  if (!PatchViewer.shouldAutoShow()) return;
  const json = await fetchPatchNotes();
  const initialTab = PatchViewer.getInitialTab();
  const patchViewer = new PatchViewer(json, undefined, { initialTab });
  patchViewer.render(true);
}

function betaWarning(version, version_specific = '', indef = false) {
  const indefMsg = indef ? `Foundry v${version} is still in development and so is TDE/DSA.` : 'TDE/DSA is still in development.';
  const msg = `<p>This is the beta version for DSA/TDE for Foundry v${version}. ${indefMsg} You might encounter on or more issues. Please report those on the official <a href="https://github.com/Plushtoast/dsa5-foundryVTT/issues" target="_blank">TDE/DSA Github</a>. Thank you.</p>${version_specific}`;
  ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
}

async function setDefaultSkin() {
  const uiConfig = game.settings.get('core', 'uiConfig');
  const dsaSkin = game.settings.get('dsa5', 'globalStyle');

  if (!Object.hasOwn(DSA5.baseStyles ?? {}, dsaSkin)) return;

  const setDefaults = dsaSkin !== 'dsa5-immersive' || uiConfig.colorScheme.interface !== 'light' || uiConfig.colorScheme.applications !== 'light';
  if (!setDefaults) return;

  const proceed = await foundry.applications.api.DialogV2.confirm({
    content: `<p>${_loc('DSAError.invalidSkinCombination')}</p>`,
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
    setDefaultSkin();

    if (!game.user.isGM) return;

    await setupDefaulTokenConfig();
    const currentVersion = game.settings.get('dsa5', 'migrationVersion');
    const needsMigration = currentVersion < NEEDS_MIGRATION_VERSION;

    if (INBETA) {
      const version = 14;
      const msg = `<p>Foundry v${version} support for DSA/TDE will soon be ready while we are finalizing the testing phase. Please use this beta to test the newest features and provide feedback.</p><p>The advancement of this system is dependent on you reporting issues and providing ideas and feedback. So feel free to discuss in the DSA/TDE Foundry VTT Discord.</p><p>Thank you for all your feedback.</p>`;
      betaWarning(version, msg);
    }

    if (!needsMigration) return;

    migrateDSA(currentVersion, NEEDS_MIGRATION_VERSION);
  });
}

