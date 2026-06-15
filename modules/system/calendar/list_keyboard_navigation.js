export default class ListKeyboardNavigation {
    #controller;
    #detailTabsSelector;
    #getItems;
    #parent;
    #selectItem;
    #tabId;

    constructor({ parent, tabId, getItems, selectItem, detailTabsSelector = null }) {
        this.#parent = parent;
        this.#tabId = tabId;
        this.#getItems = getItems;
        this.#selectItem = selectItem;
        this.#detailTabsSelector = detailTabsSelector;
    }

    bind(element) {
        this.unbind();
        this.#controller = new AbortController();
        element.addEventListener('keydown', event => this.#onKeyDown(event), { signal: this.#controller.signal });
    }

    unbind() {
        this.#controller?.abort();
        this.#controller = null;
    }

    static #isEditableKeyboardTarget(target) {
        return target?.isContentEditable || !!target?.closest('input, select, textarea, button, prose-mirror, [contenteditable="true"], .editor');
    }

    async #selectAdjacent(event, direction) {
        const items = this.#getItems();
        if (!items.length) return;

        const selected = items.find(item => item.classList.contains('selected'));
        const selectedIndex = Math.max(items.indexOf(selected), direction > 0 ? -1 : 0);
        const nextIndex = Math.clamp(selectedIndex + direction, 0, items.length - 1);
        const next = items[nextIndex];
        if (!next || next === selected) return;

        event.preventDefault();
        event.stopPropagation();
        next.focus({ preventScroll: true });
        next.scrollIntoView({ block: 'nearest' });
        await this.#selectItem(event, next);
    }

    #cycleDetailTab(event, direction) {
        if (!this.#detailTabsSelector) return;

        const tabs = Array.from(this.#parent.element.querySelectorAll(this.#detailTabsSelector));
        if (tabs.length < 2) return;

        const activeIndex = Math.max(tabs.findIndex(tab => tab.classList.contains('active')), 0);
        const next = tabs[(activeIndex + direction + tabs.length) % tabs.length];
        if (!next) return;

        event.preventDefault();
        event.stopPropagation();
        this.#parent.changeTab(next.dataset.tab, next.dataset.group, { event, navElement: next, force: true, updatePosition: false });
        next.focus?.({ preventScroll: true });
    }

    async #onKeyDown(event) {
        if (event.defaultPrevented || event.isComposing || this.#parent.tabGroups.sheet !== this.#tabId) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (ListKeyboardNavigation.#isEditableKeyboardTarget(event.target)) return;

        switch (event.key) {
            case 'ArrowUp':
                await this.#selectAdjacent(event, -1);
                break;
            case 'ArrowDown':
                await this.#selectAdjacent(event, 1);
                break;
            case 'ArrowLeft':
                this.#cycleDetailTab(event, -1);
                break;
            case 'ArrowRight':
                this.#cycleDetailTab(event, 1);
                break;
            case 'Tab':
                this.#cycleDetailTab(event, event.shiftKey ? -1 : 1);
                break;
        }
    }
}
