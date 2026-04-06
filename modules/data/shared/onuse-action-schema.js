const { SchemaField, StringField, TypedObjectField } = foundry.data.fields;
const { renderTemplate } = foundry.applications.handlebars;

export function onUseActionsField() {
  return new TypedObjectField(
    new SchemaField({
      name: new StringField({ initial: '' }),
      img: new StringField({ initial: '' }),
      macro: new StringField({ initial: '' }),
    }),
  );
}

export const OnUseActionMixin = (Base) =>
  class extends Base {
    async addOnUseAction({ name = this.parent.name, img = this.parent.img, macro = '' } = {}) {
      const id = foundry.utils.randomID();
      await this.parent.update({
        [`system.onUseActions.${id}`]: { name, img, macro },
      });
      return id;
    }

    async removeOnUseAction(id) {
      if (!id) return;
      await this.parent.update({ [`system.onUseActions.${id}`]: _del });
    }

    async updateOnUseAction(id, { name = this.parent.name, img = this.parent.img, macro = '' } = {}) {
      if (!id) return;
      await this.parent.update({
        [`system.onUseActions.${id}`]: { name, img, macro },
      });
    }

    async createOnUseAction() {
      const action = await this.openOnUseActionDialog();
      if (!action) return;
      return await this.addOnUseAction(action);
    }

    async editOnUseAction(id) {
      const action = Object.entries(this.onUseActions || {}).find(([key]) => key === id);
      if (!action) return;

      const update = await this.openOnUseActionDialog({
        id: action[0],
        ...action[1],
      });
      if (!update) return;

      await this.updateOnUseAction(id, update);
    }

    async openOnUseActionDialog(action = undefined) {
      const content = await renderTemplate('systems/dsa5/templates/dialog/on-use-action-edit.hbs', {
        action: action || {
          name: this.parent.name,
          img: this.parent.img,
          macro: '',
        },
      });

      return await foundry.applications.api.DialogV2.input({
        window: {
          title: action ? _loc('SHEET.editOnUseAction') : _loc('SHEET.addOnUseAction'),
        },
        position: {
          width: 520,
        },
        content,
        ok: {
          label: action ? 'update' : 'SHEET.addOnUseAction',
        },
      });
    }
  };
