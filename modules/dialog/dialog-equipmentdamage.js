import EquipmentDamage from '../system/equipment-damage.js';

export default class EquipmentDamageDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    window: {
      title: 'WEAR.checkShort',
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/dialog-reaction-attack.html',
    },
  };

  constructor(items) {
    super();
    this.items = items;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.items = this.items.map((x) => {
      return { name: x.name, id: x.id, img: x.img };
    });
    data.title = 'WEAR.checkShort';
    return data;
  }

  _onRender(context, options) {
    super._onRender((context, options));

    const html = $(this.element);
    html.find('.reactClick').on('click', (ev) => {
      this.callbackResult(ev);
      this.close();
    });
  }

  static async showDialog(items) {
    const dialog = new EquipmentDamageDialog(items);
    dialog.render(true);
  }

  callbackResult(ev) {
    EquipmentDamage.breakingTest(
      this.items.find((x) => x.id == ev.currentTarget.dataset.value),
    );
  }
}
