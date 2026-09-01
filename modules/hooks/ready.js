import DSA5Tutorial from '../system/sidebar/tutorial.js';
import Itemdsa5 from '../item/item-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import { setEnrichers } from './texteditor.js';
import { connectHook } from './itemDrop.js';
import DidYouKnow from '../system/helpers/didyouknow.js';
import TokenHotbar2 from '../system/guiapps/tokenHotbar2.js';
import ScQuickbar from '../system/guiapps/sc-quickbar.js';
import DSAIniTracker from '../combat/dsa-ini-tracker.js';
import VehicleChase from '../combat/chase/vehicle-chase.js';
import DSATour from '../tours/dsa_tour.js';
import { initImagePopoutTochat } from './imagepopouttochat.js';
import { connectSocket } from './socket.js';
import registerGameManual from '../journal/game_manual.js';
import { showWelcomeApp } from '../system/maintenance/migrator.js';
import ShapeshiftWizard from '../wizards/shapeshift_wizard.js';

const DSA_TOKENIZER_FRAMES = {
  friendly: 'systems/dsa5/icons/backgrounds/token_green.webp',
  hostile: 'systems/dsa5/icons/backgrounds/token_black.webp',
  neutral: 'systems/dsa5/icons/backgrounds/token_blue.webp',
  red: 'systems/dsa5/icons/backgrounds/token_red.webp',
};

Hooks.on('tokenizer-2.registerFrames', (registry) => {
  registry.registerSection({
    id: 'dsa5',
    label: 'DSA5',
    subsections: [
      {
        label: null,
        frames: [
          { src: DSA_TOKENIZER_FRAMES.friendly, label: 'TOKEN.DISPOSITION.FRIENDLY' },
          { src: DSA_TOKENIZER_FRAMES.neutral, label: 'TOKEN.DISPOSITION.NEUTRAL' },
          { src: DSA_TOKENIZER_FRAMES.hostile, label: 'TOKEN.DISPOSITION.HOSTILE' },
          { src: DSA_TOKENIZER_FRAMES.red, label: 'Red' },
        ],
      },
    ],
  });
});

export default function () {
  Hooks.on('ready', async () => {
    connectSocket();

    if (DSA5_Utility.moduleEnabled('vtta-tokenizer') && !game.settings.get('dsa5', 'tokenizerSetup') && game.user.isGM) {
      await game.settings.set('vtta-tokenizer', 'default-frame-pc', `[data] ${DSA_TOKENIZER_FRAMES.friendly}`);
      await game.settings.set('vtta-tokenizer', 'default-frame-npc', `[data] ${DSA_TOKENIZER_FRAMES.hostile}`);
      await game.settings.set('vtta-tokenizer', 'default-frame-neutral', `[data] ${DSA_TOKENIZER_FRAMES.neutral}`);
      await game.settings.set('dsa5', 'tokenizerSetup', true);
    }

    if (DSA5_Utility.moduleEnabled('tokenizer-2') && !game.settings.get('dsa5', 'tokenizer2Setup') && game.user.isGM) {
      await game.settings.set('tokenizer-2', 'ring-friendly', DSA_TOKENIZER_FRAMES.friendly);
      await game.settings.set('tokenizer-2', 'ring-hostile', DSA_TOKENIZER_FRAMES.hostile);
      await game.settings.set('tokenizer-2', 'ring-neutral', DSA_TOKENIZER_FRAMES.neutral);
      await game.settings.set('tokenizer-2', 'apply-default-ring', true);
      await game.settings.set('dsa5', 'tokenizer2Setup', true);
    }

    if (DSA5_Utility.moduleEnabled('dice-so-nice') && !game.settings.get('dsa5', 'diceSetup') && game.user.isGM) {
      await game.settings.set('dice-so-nice', 'immediatelyDisplayChatMessages', true);
      await game.settings.set('dsa5', 'diceSetup', true);
    }

    await DSA5Tutorial.firstTimeMessage();

    Itemdsa5.setupSubClasses();

    DidYouKnow.showOneMessage();
    TokenHotbar2.registerTokenHotbar();
    ScQuickbar.register();

    connectHook();
    DSAIniTracker.connectHooks();
    VehicleChase.register();
    const hook = (dat) => {
      if (dat.tabName == 'settings') {
        DSATour.ensureRegistered();
        Hooks.off('changeSidebarTab', hook);
      }
    };
    Hooks.on('changeSidebarTab', hook);

    setEnrichers();
    initImagePopoutTochat();

    registerGameManual();

    if (game.settings.get('dsa5', 'calendar') !== 'none') game.dsa5.apps.CalendarWidget.render(true);

    showWelcomeApp();

    game.dsa5.config.hooks.shapeshift = new ShapeshiftWizard()

    Hooks.on("deleteActorActiveEffect", (actor, effect) => {
      if (effect.flags.dsa5 && effect.statuses.has("shapeshift")) {
        game.dsa5.config.hooks.shapeshift.restoreShape(actor, effect)
        return false
      }
    })

    Hooks.call('DSA5ready', game.dsa5);
  });
}
