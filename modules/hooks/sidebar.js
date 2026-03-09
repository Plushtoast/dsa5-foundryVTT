import DSA5_Utility from '../system/helpers/utility-dsa5.js';

const { getProperty } = foundry.utils;

export default function () {
  Hooks.on('renderSettings', (app, html, data) => {
    const jHtml = $(html);
    const documentation = jHtml.find('.documentation');
    const buttons = [
      {
        icon: '<i class="fas fa-bug"></i>',
        label: _loc('DSA5Error'),
        link: 'https://github.com/Plushtoast/dsa5-foundryVTT/issues',
        attrs: { id: 'reportADSABug' },
      },
      {
        icon: '<i class="fas fa-info-circle"></i>',
        label: _loc('DSA5Wiki'),
        link: `https://github.com/Plushtoast/dsa5-foundryVTT/wiki${game.i18n.lang == 'de' ? '/de-Home' : ''}`,
      },
      {
        icon: '<div></div>',
        label: 'F-Shop',
        link: _loc('fshopLink'),
        attrs: { class: 'fshopButton' }
      }
    ]

    buttons.forEach(({ icon, label, link, attrs }) => {
      const joined_attrs = Object.entries(attrs || {}).map(([key, value]) => `${key}="${value}"`).join(' ');
      const button = $(`<button ${joined_attrs}>${icon} ${label}</button>`);
      button.on('click', () => window.open(link, '_blank'));
      documentation.append(button);
    });

    const systemName = game.system.title.split('/')[game.i18n.lang == 'de' ? 0 : 1];
    jHtml.find('.system .label').text(systemName);
  });

  Hooks.on('renderCompendiumDirectory', (app, html, data) => {
    const button = $(`<button type="button"><i class="fas fa-university"></i> <span>${_loc('ItemLibrary')}</span></button>`);
    const headerActions = $(html).find('.header-actions');
    const container = $('<div class="header-actions action-buttons flexrow"></div>');
    container.append(button);
    headerActions.before(container);
    button.on('click', () => DSA5_Utility.renderToggle(game.dsa5.itemLibrary));
  });

  Hooks.once('renderCompendiumDirectory', (app, html, data) => {
    const toRemove = game.i18n.lang == 'de' ? 'en' : 'de';
    const packsToRemove = game.packs.filter((p) => getProperty(p.metadata, 'flags.dsalang') == toRemove);

    for (let pack of packsToRemove) {
      const id = pack.metadata.id;
      game.packs.delete(id);
      game.data.packs = game.data.packs.filter((x) => x.id != id);
      $(html).find(`li[data-pack="${id}"]`).remove();
    }
  });

  Hooks.on('renderActorDirectory', (app, html, data) => {
    if (game.user.isGM) return;

    const jHtml = $(html);
    for (let act of app.options.collection.filter((x) => x.isMerchant() && x.system.merchant.hidePlayer)) {
      jHtml.find(`[data-entry-id="${act.id}"]`).remove();
    }
  });
}
