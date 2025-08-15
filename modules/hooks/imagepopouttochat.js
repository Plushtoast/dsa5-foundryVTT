import DSA5_Utility from '../system/helpers/utility-dsa5.js';
const { renderTemplate } = foundry.applications.handlebars;

export function initImagePopoutTochat() {
  Hooks.on('renderImagePopout', (app, html) => {
    html = $(html);
    const button = $('<button type="button" class="header-control icon fas fa-comment" data-tooltip="SHEET.PostItem" aria-label="Post to Chat" data-action="posttochat"></button>');
    button.on('click', (ev) => {
      ev.preventDefault();
      postImage(app);
    });
    const ellipsisbutton = html.find('.window-header .header-control.fa-ellipsis-vertical')
    const button2 = $('<button type="button" class="header-control icon fas fa-eye" data-tooltip="JOURNAL.ActionShow" aria-label="Post to Chat" data-action="shareImage"></button>');
    ellipsisbutton.before(button);
    ellipsisbutton.before(button2);
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
