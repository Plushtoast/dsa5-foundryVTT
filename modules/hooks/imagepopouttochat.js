import DSA5_Utility from '../system/utility-dsa5.js';
const { renderTemplate } = foundry.applications.handlebars;

export function initImagePopoutTochat() {
  Hooks.on('getImagePopoutHeaderButtons', (app, buttons) => {
    buttons.unshift({
      class: 'posttochat',
      icon: `fas fa-comment`,
      onclick: async () => postImage(app),
    });
  });
}

async function postImage(app) {
  const image = app.object;
  const template = await renderTemplate('systems/dsa5/templates/chat/imagetochat.hbs', { image });
  ChatMessage.create(DSA5_Utility.chatDataSetup(template));
}

export function showPopout(ev) {
  const dataset = ev.currentTarget.dataset;
  DSA5_Utility.showArtwork(dataset, false);
}
