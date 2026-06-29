const { getProperty, expandObject } = foundry.utils;
const { TextEditor } = foundry.applications.ux;
import { FormAppv2 } from '../../actor/formapp.js';

export default class ForeignFieldEditor extends FormAppv2 {
  constructor(actorId, field, name) {
    super();
    this.editfield = field;
    this.actorId = actorId;
    this.fieldname = name;
  }

  static PARTS = {
    main: { template: 'systems/dsa5/templates/dialog/foreignfieldeditor.hbs' },
  };

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'foreign-field-editor'],
    window: {
      resizable: true,
    },
    position: {
      width: 600,
      height: 600,
    },
    form: {
      handler: ForeignFieldEditor.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static #schemaFieldPath(systemPath) {
    const parts = systemPath.replace(/^system\./, '').split('.');
    if (parts.length < 2) return parts.join('.');
    let path = parts[0];
    for (let i = 1; i < parts.length; i++) {
      path += `.fields.${parts[i]}`;
    }
    return path;
  }

  get title() {
    const actor = game.actors.get(this.actorId);
    return `${actor?.name ?? ''} - ${_loc(this.fieldname)}`;
  }

  static async #onSubmitForm(_event, _form, formData) {
    const updateData = expandObject(formData.object).fieldContent;
    game.socket.emit('system.dsa5', {
      type: 'updateKeepField',
      payload: {
        actorId: this.actorId,
        field: this.editfield,
        updateData,
      },
    });
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const actor = game.actors.get(this.actorId);
    const fieldContent = getProperty(actor, this.editfield) ?? '';
    const schemaPath = ForeignFieldEditor.#schemaFieldPath(this.editfield);
    data.fieldContent = fieldContent;
    data.notesField = getProperty(actor.system.schema.fields, schemaPath);
    data.enrichedContent = await TextEditor.enrichHTML(fieldContent, { secrets: false });
    return data;
  }
}
