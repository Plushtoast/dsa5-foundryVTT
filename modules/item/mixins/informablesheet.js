import InformableTemplate, { INFORMABLE_INFO_REFS_TEMPLATE } from '../../data/item/templates/informable.js';
import InformationData from '../../data/item/information.js';
import { itemFromDrop } from '../../system/helpers/view_helper.js';

const { renderTemplate } = foundry.applications.handlebars;
const { duplicate } = foundry.utils;

export const InformableSheet = (superclass) =>
  class extends superclass {
    static DEFAULT_OPTIONS = {
      ownerActions: {
        infoRefUnlink: this._infoRefUnlink,
        infoShow: this._infoShow,
        infoPost: this._infoPost,
      },
    };

    static async _infoRefUnlink(ev, target) {
      const refId = target.dataset.refId ?? target.closest('[data-ref-id]')?.dataset.refId;
      if (!refId) return;
      await InformableTemplate.removeInformationRef(this.item, refId);
    }

    static async _infoShow(ev, target) {
      await InformationData.showPreviewItem(target.dataset.uuid, {
        parentUuid: this.item.uuid,
      });
    }

    static async _infoPost(ev, target) {
      await InformationData.postPreviewItem(target);
    }

    _configureRenderParts(options) {
      const parts = super._configureRenderParts(options);
      if (parts.details) {
        parts.details = duplicate(parts.details);
        parts.details.templates = [
          ...(parts.details.templates || []),
          INFORMABLE_INFO_REFS_TEMPLATE,
        ];
      }
      return parts;
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      await this.#syncInfoRefs(this.element, context);
    }

    #getDetailsTab(root) {
      return root.querySelector('.tab[data-tab="details"]');
    }

    #removeInfoRefsRoot(detailsTab) {
      detailsTab?.querySelectorAll('.informable-info-refs-root').forEach((element) => element.remove());
    }

    async #syncInfoRefs(root, context) {
      const detailsTab = this.#getDetailsTab(root);
      if (!detailsTab) return;

      this.#removeInfoRefsRoot(detailsTab);
      if (!game.user.isGM || !context.hasInformationRef) return;
      await this.#injectInfoRefs(detailsTab, context);
    }

    async #injectInfoRefs(detailsTab, context) {
      const refsHtml = await renderTemplate(INFORMABLE_INFO_REFS_TEMPLATE, context);
      const wrapper = document.createElement('div');
      wrapper.className = 'informable-info-refs-root';
      wrapper.innerHTML = refsHtml;

      const plantCenter = detailsTab.querySelector(':scope > .center');
      if (plantCenter) plantCenter.after(wrapper);
      else detailsTab.prepend(wrapper);
    }

    async _handleDrop(dragData) {
      if (await this._linkInformationRef(dragData)) return;
      await super._handleDrop(dragData);
    }

    async _linkInformationRef(dragData) {
      if (!game.user.isGM) return false;
      const { item, typeClass } = await itemFromDrop(dragData, undefined, false);
      if (typeClass !== 'information' || !item) return false;

      const uuid = dragData.uuid || item.uuid;
      if (InformableTemplate.listRefs(this.item).some((ref) => ref.uuid === uuid)) return true;

      await InformableTemplate.addInformationRef(this.item, uuid);
      return true;
    }
  };
