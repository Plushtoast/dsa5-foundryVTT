import { delay } from '../system/helpers/view_helper.js';

export default class DSATour extends foundry.nue.Tour {
  static tours = ['systems/dsa5/modules/tours/lang/initial', 'systems/dsa5/modules/tours/lang/library', 'systems/dsa5/modules/tours/lang/actor'];
  static gmTours = ['systems/dsa5/modules/tours/lang/mastermenu'];

  static async ensureRegistered() {
    if (![...game.tours.keys()].some(k => k.startsWith('dsa5.'))) {
      await this.travelAgency();
    }
  }

  static async travelAgency() {
    const lang = game.i18n.lang == 'de' ? 'de' : 'en';
    console.log('Adding DSA/TDE Tours');
    for (const tour of this.tours) {
      const obj = await game.dsa5.apps.DSATour.fromJSON(`${tour.replace('/lang/', `/${lang}/`)}.json`);
      game.tours.register(obj.config.module, obj.id, obj);
    }
    if (!game.user.isGM) return;

    for (const tour of this.gmTours) {
      const obj = await game.dsa5.apps.DSATour.fromJSON(`${tour.replace('/lang/', `/${lang}/`)}.json`);
      game.tours.register(obj.config.module, obj.id, obj);
    }
  }

  async _preStep() {
    if (this.currentStep.changeTab) {
      ui.sidebar.changeTab(this.currentStep.changeTab, 'primary');
    } else if (this.currentStep.activateLayer && ui.controls.control.name != this.currentStep.activateLayer) {
      await ui.controls.activate({control: this.currentStep.activateLayer})
      await delay(100);
    } else if (this.currentStep.appTab) {
      const tabGroup = Object.keys(this.app.tabGroups)[0]
      this.app.changeTab(this.currentStep.appTab, tabGroup);
    }
  }

  async start() {
    if (this.config.preCommand) {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(this.config.preCommand);
      await fn.call(this);
    }
    if (this.app) {
      await this.app.render(true, { focus: true });
      while (!this.app.rendered) await delay(50);
    }
    let tries = 100;
    if (this.app || this.config.preCommand) {
      while (!$(this.steps[this.stepIndex + 1].selector + ':visible').length) {
        await delay(50);
        tries--;
        if (tries <= 0) {
          console.warn(`DSATour: Step ${this.stepIndex + 1} not visible, aborting tour.`);
          return;
        }
      }
    }

    const res = await super.start();
    $('#tooltip').show();
    return res;
  }
}
