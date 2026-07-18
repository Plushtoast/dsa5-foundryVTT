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
    {
      action: 'einfach',
      title: 'PROSEMIRROR.DSAStyles.Einfach',
      className: 'einfach',
    },
    {
      action: 'schwierig',
      title: 'PROSEMIRROR.DSAStyles.Schwierig',
      className: 'schwierig',
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

  static _findStyleBlock($pos, node, classNames) {
    for (let depth = $pos.depth; depth > 0; depth--) {
      const currentNode = $pos.node(depth);
      const currentClass = currentNode.attrs?.classes;
      if (currentNode.type === node && classNames.has(currentClass)) {
        return { className: currentClass, node: currentNode, pos: $pos.before(depth) };
      }
    }

    return undefined;
  }

  static _toggleStyleBlock(menu, node, wrap, className, classNames, { replaceOnLift = false } = {}) {
    const { state } = menu.view;
    const { $from, $to } = state.selection;
    const range = $from.blockRange($to);
    if (!range) return;

    const styleBlock = this._findStyleBlock($from, node, classNames);
    if (styleBlock?.className === className) {
      if (replaceOnLift) {
        menu.view.dispatch(state.tr.replaceWith(styleBlock.pos, styleBlock.pos + styleBlock.node.nodeSize, styleBlock.node.content));
      }
      else {
        const target = foundry.prosemirror.transform.liftTarget(range);
        if (target != null) menu.view.dispatch(state.tr.lift(range, target));
      }
    } else if (styleBlock) {
      menu.view.dispatch(state.tr.setNodeMarkup(styleBlock.pos, null, { ...styleBlock.node.attrs, classes: className }));
    } else {
      foundry.prosemirror.commands.autoJoin(wrap(node, { classes: className }), [node.name])(state, menu.view.dispatch);
    }
  }

  static _addDropDowns(menu, items) {
    const formatMenu = items.format;
    const divNode = menu?.schema?.nodes?.div;

    if (!formatMenu?.entries || !divNode) return;

    const wrapIn = foundry.prosemirror.commands.wrapIn;
    const wrapInList = foundry.prosemirror.list.wrapInList;
    const divStyleClasses = new Set(this.styleBlocks.map((block) => block.className));
    const listStyleClasses = new Set(['dsalist']);
    const children = this.styleBlocks.map(({ action, title, className }) => ({
      action,
      title,
      node: divNode,
      attrs: { classes: className },
      cmd: () => {
        this._toggleStyleBlock(menu, divNode, wrapIn, className, divStyleClasses, { replaceOnLift: true });
        return true;
      },
    }));

    if (menu.schema.nodes.bullet_list) {
      children.push({
        action: 'dsalist',
        title: 'PROSEMIRROR.DSAStyles.DSAList',
        node: menu.schema.nodes.bullet_list,
        attrs: { classes: 'dsalist' },
        cmd: () => {
          this._toggleStyleBlock(menu, menu.schema.nodes.bullet_list, wrapInList, 'dsalist', listStyleClasses);
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