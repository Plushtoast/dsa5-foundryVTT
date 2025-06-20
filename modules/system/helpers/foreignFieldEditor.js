const { getProperty } = foundry.utils;
import { FormAppv2 } from '../../actor/formapp.js';

export default class ForeignFieldEditor extends FormAppv2 {
  constructor(actorId, field, name) {
    super();
    this.editfield = field;
    this.actorId = actorId;
    this.fieldname = name;
    const actor = game.actors.get(this.actorId);
    this.object = {
      fieldContent: getProperty(actor, this.editfield),
    };
  }

  static PARTS = {
    main: {template: 'systems/dsa5/templates/dialog/foreignfieldeditor.hbs'},
  };

  static DEFAULT_OPTIONS = {
    window: {
      resizable: true,
    },
    position: {
      width: 600,
      height: 600,
    },
  };

  get title() {
    const actor = game.actors.get(this.actorId);
    return `${actor.name} - ${game.i18n.localize(this.fieldname)}`;
  }

  async _updateObject(event, formData) {
    game.socket.emit('system.dsa5', {
      type: 'updateKeepField',
      payload: {
        actorId: this.actorId,
        field: this.editfield,
        updateData: formData.fieldContent,
      },
    });
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.fieldContent = this.object.fieldContent;
    return data;
  }
}
