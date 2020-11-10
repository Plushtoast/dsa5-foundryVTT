import Itemdsa5 from "./item-dsa5.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"



export default class ItemSheetdsa5 extends ItemSheet{
    constructor(item, options) {
        super(item, options);
        this.mce = null;
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "description" }]
        return options;
      }

      _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        // Add "Post to chat" button
        // We previously restricted this to GM and editable items only. If you ever find this comment because it broke something: eh, sorry!
        /*buttons.push(
          {
            class: "post",
            icon: "fas fa-comment",
            onclick: ev => new ItemWfrp4e(this.item.data).postItem()
          })*/
        return buttons
      }

      async _render(force = false, options = {}) {
        await super._render(force, options);
        /*$(this._element).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        $(this._element).find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
        $(this._element).find(".post").attr("title", game.i18n.localize("SHEET.Post"));
        $(this._element).find(".import").attr("title", game.i18n.localize("SHEET.Import"));*/
      }

      get template() {
        let type = this.item.type;
        return `systems/wfrp4e/templates/items/item-${type}-sheet.html`;
      }

      activateListeners(html){
          super.activateListeners(html);
      }

      getData() {
        const data = super.getData();
        return data;
      }
}

Items.unregisterSheet("core", ItemSheet);
Items.registerSheet("dsa5", ItemSheetdsa5,
  {
    makeDefault: true
  });