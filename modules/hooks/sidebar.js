import DSA5_Utility from '../system/utility-dsa5.js';

const { getProperty } = foundry.utils;

export default function () {
  Hooks.on('renderSettings', (app, html, data) => {
    const jHtml = $(html);
    const documentation = jHtml.find('.documentation');
    const button1 = $(`<button id="reportADSABug"><i class="fas fa-bug"></i> ${game.i18n.localize('DSA5Error')}</button>`);
    button1.on('click', () => {
      window.open('https://github.com/Plushtoast/dsa5-foundryVTT/issues', '_blank');
    });
    const button2 = $(`<button><i class="fas fa-info-circle"></i> ${game.i18n.localize('DSA5Wiki')}</button>`);
    button2.on('click', () => {
      window.open('https://github.com/Plushtoast/dsa5-foundryVTT/wiki', '_blank');
    });
    const button3 = $(`<button class="fshopButton"><div></div> F-Shop</button>`);
    button3.on('click', () => {
      window.open(game.i18n.localize('fshopLink'), '_blank');
    });
    documentation.append(button1, button2, button3);

    const systemName = game.system.title.split('/')[game.i18n.lang == 'de' ? 0 : 1];
    jHtml.find('.system .label').text(systemName);
  });

  Hooks.on('renderCompendiumDirectory', (app, html, data) => {
    const button = $(`<button type="button"><i class="fas fa-university"></i> <span>${game.i18n.localize('ItemLibrary')}</span></button>`);
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
    for (let act of app.documents.filter((x) => x.isMerchant() && x.system.merchant.hidePlayer)) {
      jHtml.find(`[data-entry-id="${act.id}"]`).remove();
    }
  });
}
