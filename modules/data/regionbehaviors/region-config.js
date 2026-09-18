export default class DSARegionConfig extends foundry.applications.sheets.RegionConfig {
  _canDragDrop() {
    return this.document.isOwner;
  }

  async _onDrop(event) {
    const TrapData = CONFIG.Item.dataModels.trap;
    if (await TrapData?.handleRegionSheetDrop(this.document, event)) return;
    return super._onDrop(event);
  }
}
