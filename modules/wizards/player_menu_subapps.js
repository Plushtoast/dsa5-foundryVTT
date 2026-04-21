export class PlayerMenuSubApp {
  static template = '';
  static rulePath = {};

  async _getData(data) {
    return {};
  }

  get name() {
    return `PLAYER.${this.tabName}`;
  }

  get tabName() {
    return this.constructor.name;
  }

  get part() {
    return {
      template: this.constructor.template,
      scrollable: ['']
    }
  }

  addTab(tabs, activeTab, group) {
    const active = activeTab === this.tabName;
    tabs[this.tabName] = {
      id: this.tabName,
      label: this.name,
      group,
      icon: this.icon,
      active,
      cssClass: active ? "active" : ""
    };
  }

  async _onRender(html) {}

  async render() {
    await game.dsa5.apps.playerMenu.render(true);
  }

  async activateTab() {
    await game.dsa5.apps.playerMenu.changeTab(this.tabName, 'sheet');
  }

  get actor() {
    return game.dsa5.apps.playerMenu.actor;
  }

  async _onDrop(data) {}
}
