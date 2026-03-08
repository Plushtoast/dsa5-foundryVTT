const { renderTemplate } = foundry.applications.handlebars;

export const ItemSheetObfuscation = (superclass) =>
  class extends superclass {
    async obfuscateItem(ev) {
      ev.stopPropagation();
      ev.preventDefault();
      const section = ev.currentTarget.dataset.obfuscate;
      await this.item.update({
        [`system.obfuscation.${section}`]: !this.isObfuscated(section),
      });
    }

    isObfuscated(section) {
      return this.item.system.obfuscation[section];
    }

    async _onRender(context, options) {
      await super._onRender(context, options);

      const html = $(this.element);
      html.on('click', '.obfuscateSection', (ev) => this.obfuscateItem(ev));
      this.obfuscateTabs(options);
    }

    obfuscationCss(section) {
      return this.isObfuscated(section) ? '' : ' pale';
    }

    async obfuscateTabs(options) {
      const tabs = ['details', 'effects', 'description', 'enchantment', 'work'];
      const html = $(this.element);
      let swaptab = false;
      for (let tab of tabs) {
        const ele = html.find(`nav [data-tab="${tab}"]`);
        if (!ele.length) continue;

        const invisible = options.tabsinvisible || this.isObfuscated(tab);
        const tooltip = game.i18n.localize(`SHEET.${invisible ? 'deobfuscateItem' : 'obfuscateItem'}`);
        if (game.user.isGM) {
          const sectionName = `obfuscateSection${this.obfuscationCss(tab)}`;
          const existingElem = ele.find(`.${sectionName}`);
          const btn = `<a data-tooltip="${tooltip}" class="obfuscationBtn ${sectionName}" data-obfuscate="${tab}"><i class="fas fa-mask"></i></a>`;
          if (existingElem.length) {
            existingElem.replaceWith(btn);
          } else {
            ele.append(` ${btn}`);
          }
        } else if (invisible) {
          if (ele.hasClass('active')) swaptab = true;
          ele.remove();

          if (tab == 'details') {
            html.find('[name="system.price.value"],[name="system.price.raw"]').replaceWith('<label>?</label>');
          }
        }
      }
      if (swaptab) {
        let tabs = html.find('nav .item:first-child');
        if (!tabs.length) tabs = html.find('nav .tabelement:first-child');
        if (tabs.length) {
          this.changeTab(tabs[0].dataset.tab, tabs[0].dataset.group);
        } else {
          html.find('.tab.active').removeClass('active');
          const templ = await renderTemplate('systems/dsa5/templates/items/obfuscatedItem.hbs', { item: this.item });
          html.find('.window-content').append(templ);
        }
      }
    }
  };
