import DSA5_Utility from '../system/helpers/utility-dsa5.js';
const { renderTemplate } = foundry.applications.handlebars;

export function initImagePopoutTochat() {
  Hooks.on('renderImagePopout', (app, html) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'header-control icon fas fa-comment';
    button.dataset.tooltip = 'SHEET.PostItem';
    button.dataset.action = 'posttochat';
    button.addEventListener('click', (ev) => {
      ev.preventDefault();
      postImage(app);
    });

    const button2 = document.createElement('button');
    button2.type = 'button';
    button2.className = 'header-control icon fas fa-eye';
    button2.dataset.tooltip = 'JOURNAL.ActionShow';
    button2.dataset.action = 'shareImage';

    const ellipsisButton = html.querySelector('.window-header .header-control.fa-ellipsis-vertical');
    ellipsisButton.parentNode.insertBefore(button, ellipsisButton);
    ellipsisButton.parentNode.insertBefore(button2, ellipsisButton);
  });
}

async function postImage(app) {
  const image = app.options.src
  const template = await renderTemplate('systems/dsa5/templates/chat/imagetochat.hbs', { image });
  ChatMessage.create(DSA5_Utility.chatDataSetup(template));
}

export function showPopout(ev) {
  DSA5_Utility.showArtwork(ev.currentTarget.dataset, false);
}
