const { getProperty } = foundry.utils;
const { TextEditor } = foundry.applications.ux;
import { DefaultAppv2 } from '../../actor/baseapp.js';

export default class ForeignFieldEditor extends DefaultAppv2 {
  constructor(actorId, field, name, options = {}) {
    super(options);
    this.editfield = field;
    this.actorId = actorId;
    this.fieldname = name;
  }

  static PARTS = {
    main: { template: 'systems/dsa5/templates/dialog/foreignfieldeditor.hbs' },
  };

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'foreign-field-editor'],
    tag: 'form',
    window: {
      resizable: true,
    },
    position: {
      width: 600,
    },
    actions: {
      save: ForeignFieldEditor.#save,
      cancel: ForeignFieldEditor.#cancel,
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

  static async #save(_event) {
    const editor = this.element?.querySelector('prose-mirror');
    editor?.save();
    const updateData = editor?.value ?? '';
    game.socket.emit('system.dsa5', {
      type: 'updateKeepField',
      payload: {
        actorId: this.actorId,
        field: this.editfield,
        updateData,
      },
    });
    await this.close();
  }

  static async #cancel(_event) {
    await this.close();
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
