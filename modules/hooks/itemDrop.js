import DSA5 from '../config/config-dsa5.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
const { getProperty } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export const dropToGround = async (sourceActor, item, data, formOptions) => {
  const amount = formOptions.count.value;
  const isBag = formOptions.isBag?.value;

  if (game.user.isGM) {
    let items = await game.dsa5.apps.DSA5_Utility.allMoneyItems();
    let folder = await DSA5_Utility.getFolderForType('Actor', null, 'Dropped Items');
    const userIds = game.users.filter((x) => !x.isGM).map((x) => x.id);

    const ownership = userIds.reduce(
      (prev, cur) => {
        prev[cur] = 1;
        return prev;
      },
      { default: 0 },
    );

    const newItem = item.toObject();
    newItem.system.quantity.value = amount;
    RuleChaos.obfuscateDropData(newItem, data.tabsinvisible);

    if (getProperty(newItem, 'system.worn.value')) newItem.system.worn.value = false;

    let bagItems = [];
    if (isBag) {
      bagItems = fetchBagItems(item, sourceActor).map((i) => i.toObject());
      items.push(...bagItems);
    }

    const actor = {
      type: 'npc',
      name: item.name,
      img: item.img,
      prototypeToken: {
        texture: {
          scaleX: 1,
          scaleY: 1,
          src: item.img,
        },
        width: 0.4,
        height: 0.4,
      },
      ownership,
      items: [...items, newItem],
      flags: { core: { sheetClass: 'dsa5.MerchantSheetDSA5' } },
      folder,
      system: {
        merchant: {
          merchantType: 'loot',
          temporary: true,
          hidePlayer: 1,
        },
        status: { wounds: { value: 16 } },
      },
    };
    const finalActor = await game.dsa5.entities.Actordsa5.create(actor);
    const td = await finalActor.getTokenDocument({
      x: data.x,
      y: data.y,
      hidden: false,
    });
    if (!canvas.dimensions.rect.contains(td.x, td.y)) return false;

    if (sourceActor) {
      await canvas.scene.createEmbeddedDocuments('Token', [td], {
        noHook: true,
      });
      const newCount = item.system.quantity.value - amount;
      if (newCount < 1) {
        await sourceActor.deleteEmbeddedDocuments('Item', [item.id]);
      } else {
        await sourceActor.updateEmbeddedDocuments('Item', [{ _id: item.id, 'system.quantity.value': newCount }]);
      }
      if (bagItems.length > 0) {
        await sourceActor.deleteEmbeddedDocuments('Item', bagItems.map((i) => i._id));
      }
    } else {
      await canvas.scene.createEmbeddedDocuments('Token', [td]);
    }
  } else {
    const payload = {
      itemId: item.uuid,
      sourceActorId: sourceActor?.id,
      data,
      amount,
      isBag
    };
    game.socket.emit('system.dsa5', {
      type: 'itemDrop',
      payload,
    });
  }
};

function fetchBagItems(item, sourceActor) {
  const bagItems = [];
  for (let i of sourceActor.items) {
    if (i.system.parent_id == item.id) {
      bagItems.push(i);
      if (i.system.isBagWithContents) {
        const bagItems2 = fetchBagItems(i, sourceActor);
        bagItems.push(...bagItems2);
      }
    }
  }
  return bagItems;
}

const handleItemDrop = async (canvas, data) => {
  const item = await Item.implementation.fromDropData(data);

  if (!(game.settings.get('dsa5', 'enableItemDropToCanvas') || game.user.isGM || data.tokenId)) return;

  const sourceActor = item.parent;

  if (item.type == 'trap') {
    await item.system.createRegionBehavior(data);
    return;
  }

  if (!DSA5.equipmentCategories.has(item.type)) return;

  const callback = async (formOptions) => {
    dropToGround(sourceActor, item, data, formOptions);
  };

  const isBag = item.system.isBagWithContents && sourceActor;

  RangeSelectDialog.create('DSASETTINGS.enableItemDropToCanvas', callback, {
    name: _loc('MERCHANT.dropGround', { name: item.name }),
    count: item.system.quantity.value,
    isBag
  });
};

const handleGroupDrop = async (canvas, data) => {
  let x = data.x;
  let y = data.y;
  let count = 0;
  const gridSize = canvas.grid.size;
  const rowLength = Math.ceil(Math.sqrt(data.ids.length));
  for (let id of data.ids) {
    const actor = game.actors.get(id);
    if (!actor) continue;

    const td = await actor.getTokenDocument({ x, y, hidden: false });
    td.constructor.create(td, { parent: canvas.scene });
    if (rowLength % count == 0 && count > 0) {
      y += gridSize;
      x = data.x;
    } else {
      x += gridSize;
    }
    count++;
  }
};

export const connectHook = () => {
  Hooks.on('dropCanvasData', async (canvas, data) => {
    if (data.type == 'GroupDrop') {
      handleGroupDrop(canvas, data);
      return false;
    } else if (data.type == 'Item') {
      handleItemDrop(canvas, data);
      return false;
    }
  });
};

export class RangeSelectDialog extends foundry.applications.api.DialogV2 {
  static async content(data) {
    return await renderTemplate('systems/dsa5/templates/dialog/dropToGround.hbs', data);
  }

  static async create(title, callback, data) {
    if (!data.min) data.min = 1;
    if (!data.max) data.max = data.count;
    const content = await this.content(data)

    new RangeSelectDialog({
      window: {
        title,
      },
      content,
      buttons: [
        {
          action: 'yes',
          icon: 'fa fa-check',
          label: 'yes',
          default: true,
          callback: (event, button, dialog) => {
            callback(button.form.elements);
          },
        },
        {
          action: 'no',
          icon: 'fas fa-times',
          label: 'cancel',
        },
      ],
    }).render(true);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    html.find('input[type="range"]').on('change', (ev) => {
      $(ev.currentTarget).closest('.row-section').find('.range-value').html($(ev.currentTarget).val());
    });
  }
}
