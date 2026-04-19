export default class DSA5ProseMirrorIntegration {
  static registered = false;

  static styleBlocks = [
    {
      action: 'maskfield',
      title: 'PROSEMIRROR.DSAStyles.Maskfield',
      className: 'maskfield',
    },
    {
      action: 'chatpaperfield',
      title: 'PROSEMIRROR.DSAStyles.Chatpaperfield',
      className: 'chatpaperfield',
    },
    {
      action: 'citefield',
      title: 'PROSEMIRROR.DSAStyles.Citefield',
      className: 'citefield',
    },
  ];

  static register() {
    if (this.registered) return;
    this.registered = true;

    Hooks.on('getProseMirrorMenuDropDowns', this._addDropDowns.bind(this));
  }

  static _localizeMenuEntry(entry) {
    const localized = {
      ...entry,
      title: game.i18n.localize(entry.title),
    };

    if (entry.children?.length) {
      localized.children = entry.children.map((child) => this._localizeMenuEntry(child));
    }

    return localized;
  }

  static _addDropDowns(menu, items) {
    const formatMenu = items.format;
    const divNode = menu?.schema?.nodes?.div;

    if (!formatMenu?.entries || !divNode) return;

    const wrapIn = foundry.prosemirror.commands.wrapIn;
    const wrapInList = foundry.prosemirror.list.wrapInList;
    const children = this.styleBlocks.map(({ action, title, className }) => ({
      action,
      title,
      node: divNode,
      attrs: { class: className },
      cmd: () => {
        menu._toggleBlock(divNode, wrapIn, { attrs: { class: className } });
        return true;
      },
    }));

    if (menu.schema.nodes.bullet_list) {
      children.push({
        action: 'dsalist',
        title: 'PROSEMIRROR.DSAStyles.DSAList',
        node: divNode,
        attrs: { class: 'dsalist' },
        cmd: () => {
          menu._toggleBlock(divNode, wrapIn, { attrs: { class: 'dsalist' } });
          menu._toggleBlock(menu.schema.nodes.bullet_list, wrapInList);
          return true;
        },
      });
    }

    formatMenu.entries.push(this._localizeMenuEntry({
      action: 'dsa5-styles',
      title: 'PROSEMIRROR.DSAStyles.Title',
      children,
    }));
  }
}