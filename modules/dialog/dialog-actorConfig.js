import { DefaultAppv2 } from '../actor/baseapp.js';
import Migrakel from '../system/migrakel.js';

export default class DialogActorConfig extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    actions: {
      updateElements: DialogActorConfig.updateWrapper
    },
    position: {
      width: 320
    }
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/actors/parts/actorConfig.hbs',
    },
  };

  get title() {
    return `${game.i18n.localize('Migrakel.Migration')} - ${this.actor.name}`;
  }

  constructor(actor, options) {
    super(options);
    this.actor = actor;
    this.lock = false;
  }

  static async updateWrapper(ev, target) {
    if (this.lock) return;

    const fnct = target.dataset.target;
    this.lock = true;
    
    const spinner = document.createElement('i');
    spinner.className = 'fas fa-spinner fa-spin';
    target.prepend(spinner);
    
    await Migrakel[fnct](this.actor);
    
    if (spinner.parentNode) {
      spinner.parentNode.removeChild(spinner);
    }
    
    this.lock = false;
  }
}
