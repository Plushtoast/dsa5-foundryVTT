import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import { FateRolls } from '../../actor/concerns/faterolls.js';
import { tabSlider } from '../../system/helpers/view_helper.js';

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MagicalAlchemistDSA5 extends HandlebarsApplicationMixin(ApplicationV2) {
    static COSTS = Object.freeze({
        reroll: 4,
        addFP: 5,
        improve: 2,
        rescue: 10,
    });

    static USED_FLAG = 'magicalAlchemistUsed';

    static ANALYSIS_COST_OPTION = 'magicalAlchemistAnalysisCost';

    static DEFAULT_OPTIONS = {
        id: 'magical-alchemist-app',
        classes: ['dsa5'],
        window: {
            title: 'MAGICAL_ALCHEMIST.name',
            resizable: true,
        },
        position: { width: 450, height: 'auto' },
        actions: {
            toggleDie: this.#onToggleDie,
            adjustDie: this.#onAdjustDie,
            adjustFP: this.#onAdjustFP,
            confirm: this.#onConfirm,
        }
    };

    static PARTS = {
        main: {
            template: 'systems/dsa5/templates/dialog/rules/alchimist-dialog.hbs',
            templates: ['systems/dsa5/templates/system/dsatabs.hbs'],
        },
    };

    static TABS = {
        sheet: {
            tabs: [
                { id: 'reroll', label: 'SAVANT.reroll' },
                { id: 'addFP', label: 'SAVANT.addFP' },
                { id: 'improve', label: 'SAVANT.improveRoll' },
            ],
            initial: 'reroll',
        }
    };

    constructor(message, actor, roll, options) {
        super(options);
        this.message = message;
        this.dsaActor = actor;
        this.originalRoll = roll;
        this.selectedForReroll = new Set();
        this.improvedDice = this.d20s.map((term) => term.results[0].result);
        this.tabGroups = {
            sheet: this.availableTabs[0] || this.constructor.TABS.sheet.initial,
        };
        this.addedFP = this.activeTab === 'addFP' && this._getMaxAddFP() > 0 ? 1 : 0;
    }

    static getAvailableTabs(data) {
        const tabs = [];
        const successLevel = data?.postData?.successLevel;

        if (successLevel > 0) {
            tabs.push('reroll');
            tabs.push('addFP');
        }
        if (successLevel >= -1) tabs.push('improve');

        return tabs;
    }

    get activeTab() {
        return this.tabGroups.sheet;
    }

    get availableTabs() {
        return this.constructor.getAvailableTabs(this.message.flags.data);
    }

    get source() {
        const data = this.message.flags.data;
        return data.postData.source?.system ? data.postData.source : data.preData.source;
    }

    get chars() {
        return [
            this.source.system.characteristic1.value,
            this.source.system.characteristic2.value,
            this.source.system.characteristic3.value,
        ];
    }

    get d20s() {
        return this.originalRoll.terms.filter((term) => term.faces === 20);
    }

    _getImprovedDieIndex() {
        return this.improvedDice.findIndex((value, index) => value !== this.d20s[index].results[0].result);
    }

    _getImproveSavedPoints() {
        let savedPoints = 0;

        this.improvedDice.forEach((current, i) => {
            const original = this.d20s[i].results[0].result;
            const target = this.message.flags.data.postData.characteristics[i].tar;
            if (original > current) {
                savedPoints += Math.max(0, original - target) - Math.max(0, current - target);
            }
        });

        return savedPoints;
    }

    _getCost() {
        if (this.activeTab === 'reroll') {
            return this.selectedForReroll.size > 0 ? this.constructor.COSTS.reroll : 0;
        }

        if (this.activeTab === 'addFP') {
            return this.addedFP > 0 ? this.addedFP * this.constructor.COSTS.addFP : 0;
        }

        if (this.activeTab === 'improve') {
            return this._getImprovedDieIndex() >= 0 ? this.constructor.COSTS.improve : 0;
        }

        return 0;
    }

    _getMaxAddFP() {
        const maxByResult = Math.max(0, 18 - this.message.flags.data.postData.result);
        const maxByAsP = Math.floor((Number(this.dsaActor.system.status.astralenergy.value) || 0) / this.constructor.COSTS.addFP);
        return Math.min(maxByResult, maxByAsP);
    }

    _getPreviewFW() {
        let previewFW = this.message.flags.data.postData.result;

        if (this.activeTab === 'addFP') {
            previewFW += this.addedFP;
        } else if (this.activeTab === 'improve') {
            previewFW += this._getImproveSavedPoints();
        }

        return previewFW;
    }

    _hasPendingChange() {
        return this._getCost() > 0;
    }

    _resetTabChanges() {
        this.selectedForReroll.clear();
        this.addedFP = this.activeTab === 'addFP' && this._getMaxAddFP() > 0 ? 1 : 0;
        this.improvedDice = this.d20s.map((term) => term.results[0].result);
    }

    _getActionLabel() {
        return _loc('MAGICAL_ALCHEMIST.name');
    }

    _getModifierName(actionLabel) {
        return `${this._getActionLabel()}: ${actionLabel}`;
    }

    _addPostRollModifier(data, actionLabel, value, type = '') {
        if (!data.preData.situationalModifiers) data.preData.situationalModifiers = [];
        data.preData.situationalModifiers.push({
            name: this._getModifierName(actionLabel),
            value,
            type,
        });
    }

    async _createUsageMessage(actionLabel, cost, detail = '') {
        const content = `<h5 class="center"><b>${this._getActionLabel()}</b></h5>
            <p><b>${foundry.utils.escapeHTML(this.dsaActor.name)}</b>: ${actionLabel} (${_loc('cost')}: ${cost} ${_loc('AsP')})</p>
            ${detail}`;
        await ChatMessage.create(DSA5_Utility.chatDataSetup(content));
    }

    _canDecreaseDie(idx) {
        const original = this.d20s[idx].results[0].result;
        const current = this.improvedDice[idx];
        const changedIdx = this._getImprovedDieIndex();

        if (current !== original) return false;
        if (changedIdx !== -1 && changedIdx !== idx) return false;
        if (original <= 1) return false;

        if (original === 2) {
            const otherOnes = this.d20s.filter((term, index) => index !== idx && term.results[0].result === 1).length;
            if (otherOnes > 0) return false;
        }

        return true;
    }

    _canIncreaseDie(idx) {
        return this.improvedDice[idx] < this.d20s[idx].results[0].result;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const tabs = Object.fromEntries(Object.entries(context.tabs).filter(([id]) => this.availableTabs.includes(id)));
        const previewFW = this._getPreviewFW();

        const dice = this.d20s.map((term, i) => {
            const originalVal = term.results[0].result;
            const currentVal = this.activeTab === 'improve' ? this.improvedDice[i] : originalVal;
            const target = this.message.flags.data.postData.characteristics[i].tar;
            return {
                index: i,
                currentValue: currentVal,
                attr: this.chars[i].toLowerCase(),
                cssClass: currentVal <= target ? 'suc' : 'fail',
                tooltip: `${_loc(`CHAR.${this.chars[i].toUpperCase()}`)} vs ${target}`,
                selected: this.activeTab === 'reroll' && this.selectedForReroll.has(i),
                canIncrease: this.activeTab === 'improve' && this._canIncreaseDie(i),
                canDecrease: this.activeTab === 'improve' && this._canDecreaseDie(i),
            };
        });

        return {
            ...context,
            tabs,
            activeTab: this.activeTab,
            isRerollTab: this.activeTab === 'reroll',
            isImproveTab: this.activeTab === 'improve',
            isAddFPTab: this.activeTab === 'addFP',
            dice,
            addedFP: this.addedFP,
            previewFW,
            previewQS: previewFW >= 0 ? Math.max(1, Math.min(6, Math.ceil(previewFW / 3))) : 0,
            cost: this._getCost(),
            currentAsP: this.dsaActor.system.status.astralenergy.value
        };
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        tabSlider($(this.element));
    }

    _onClickTab(event) {
        const nextTab = event.target.closest('[data-tab]')?.dataset.tab;
        const changed = Boolean(nextTab && nextTab !== this.activeTab);
        super._onClickTab(event);
        if (!changed) return;

        this._resetTabChanges();
        this.render({ force: true });
    }

    static #onToggleDie(event, target) {
        if (this.activeTab !== 'reroll') return;
        const idx = parseInt(target.closest('[data-index]').dataset.index);
        if (this.selectedForReroll.has(idx)) this.selectedForReroll.delete(idx);
        else this.selectedForReroll.add(idx);
        this.render();
    }

    static #onAdjustDie(event, target) {
        if (this.activeTab !== 'improve') return;
        const idx = parseInt(target.closest('[data-index]').dataset.index);
        const delta = parseInt(target.closest('[data-delta]').dataset.delta);
        const original = this.d20s[idx].results[0].result;
        const current = this.improvedDice[idx];

        if (delta === 1 && current < original) {
            this.improvedDice[idx] = original;
        } else if (delta === -1 && this._canDecreaseDie(idx)) {
            this.improvedDice[idx] = original - 1;
        }

        this.render();
    }

    static #onAdjustFP(event, target) {
        if (this.activeTab !== 'addFP') return;
        const delta = parseInt(target.closest('[data-delta]').dataset.delta);
        const max = this._getMaxAddFP();
        const val = this.addedFP + delta;
        const min = max > 0 ? 1 : 0;

        this.addedFP = Math.min(Math.max(min, val), max);
        this.render();
    }

    static async #onConfirm() {
        if (!this._hasPendingChange()) return;

        const cost = this._getCost();
        const paid = await this.dsaActor.applyMana(cost, 'AsP');
        if (!paid) return;

        const data = foundry.utils.duplicate(this.message.flags.data);
        const originalRollData = this.originalRoll.toJSON();

        if (this.activeTab === 'reroll') {
            const actionLabel = _loc('SAVANT.reroll');
            data.preData.roll = originalRollData;
            const { changedRolls, changedRollsText } = await FateRolls.processSelectedReroll(
                Array.from(this.selectedForReroll).sort((left, right) => left - right),
                data.preData,
                { rollContext: 'CHATCONTEXT.Reroll' }
            );
            const rollDetail = FateRolls.formatDieChangesHtml(changedRolls);
            this._addPostRollModifier(data, actionLabel, changedRollsText.join(', '));
            await this._createUsageMessage(actionLabel, cost, rollDetail);
        } else if (this.activeTab === 'addFP') {
            const actionLabel = _loc('SAVANT.addFP');
            this._addPostRollModifier(data, actionLabel, this.addedFP, 'FP');
            await this._createUsageMessage(actionLabel, cost, `<p><b>${_loc('MODS.FP')}</b>: +${this.addedFP}</p>`);
        } else if (this.activeTab === 'improve') {
            const actionLabel = _loc('SAVANT.improveRoll');
            data.preData.roll = Roll.fromData(originalRollData);
            const d20s = data.preData.roll.terms.filter((term) => term.faces === 20);
            const changedRolls = [];
            const changedRollsText = [];
            this.improvedDice.forEach((value, i) => {
                const originalValue = d20s[i].results[0].result;
                if (value !== originalValue) {
                    const formatted = FateRolls.formatDieChange(originalValue, value, { char: this.chars[i], faces: 20 });
                    changedRolls.push(formatted.html);
                    changedRollsText.push(formatted.text);
                }
                d20s[i].results[0].result = value;
            });
            const rollDetail = FateRolls.formatDieChangesHtml(changedRolls);
            this._addPostRollModifier(data, actionLabel, changedRollsText.join(', '), 'roll');
            await this._createUsageMessage(actionLabel, cost, rollDetail);
        }

        await this.dsaActor[data.postData.postFunction]({ testData: data.preData, cardOptions: data }, { rerenderMessage: this.message });
        await this.message.update({ [`flags.dsa5.${this.constructor.USED_FLAG}`]: true });

        this.close();
    }

    static canUseMagicalAlchemist(message) {
        const data = message?.flags?.data;
        if (!data || data.postData?.rollType !== 'talent' || message.flags.dsa5?.[this.USED_FLAG]) return false;
        if (data.postData.successLevel === -3) return false;

        const actor = DSA5_Utility.getSpeaker(message.speaker)
            || (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null);
        if (!(actor?.isOwner || game.user.isGM)) return false;

        const sourceName = data.preData?.source?.name || data.postData?.source?.name;
        if (sourceName !== _loc('LocalizedIDs.alchemy')) return false;

        const traditionName = _loc('LocalizedIDs.traditionMagicalAlchemist');
        const alchemistTradition = actor.items.find((item) => item.type === 'specialability' && item.name === traditionName);
        if (!alchemistTradition) return false;

        return data.postData.successLevel === -2 || this.getAvailableTabs(data).length > 0;
    }

    static canUseAnalysisModifier(dialogState) {
        const actor = dialogState?.actor;
        if (!(actor?.isOwner || game.user.isGM)) return false;
        if (dialogState?.source?.type !== 'skill' || dialogState.source.name !== _loc('LocalizedIDs.alchemy')) return false;

        const traditionName = _loc('LocalizedIDs.traditionMagicalAlchemist');
        return actor.items.some((item) => item.type === 'specialability' && item.name === traditionName);
    }

    static getAnalysisModifierItems(dialogState) {
        return [1, 2].map((bonus) => {
            const cost = bonus * 4;
            return {
                label: game.i18n.format('MAGICAL_ALCHEMIST.analysisModifier', { bonus, cost }),
                icon: '<i class="fas fa-flask"></i>',
                onClick: async () => this.applyAnalysisModifier(dialogState, bonus, cost),
            };
        });
    }

    static applyAnalysisModifier(dialogState, bonus, cost) {
        const { actor, dialog } = dialogState;
        if ((Number(actor.system.status.astralenergy.value) || 0) < cost) {
            ui.notifications.warn('DSAError.NotEnoughAsP', { localize: true });
            return;
        }

        const widget = dialog?.getSituationalModifiersWidget?.();
        if (!widget) return;

        const label = _loc('MAGICAL_ALCHEMIST.name');
        const modifier = {
            name: label,
            value: bonus,
            selected: true,
            source: _loc('LocalizedIDs.traditionMagicalAlchemist'),
        };
        const modifiers = widget.getModifiers();
        const updated = modifiers.some((existing) => existing.name === label)
            ? modifiers.map((existing) => existing.name === label ? { ...existing, ...modifier } : existing)
            : [...modifiers, modifier];
        widget.setModifiers(updated);

        dialogState.testData.extra.options[this.ANALYSIS_COST_OPTION] = cost;
        dialog?.element?.querySelector?.('form')?.dispatchEvent(new Event('change', { bubbles: true }));
    }

    static async consumeAnalysisCost(chatOptions, testData, rerenderMessage) {
        if (rerenderMessage) return;

        const cost = Number(testData?.preData?.extra?.options?.[this.ANALYSIS_COST_OPTION]) || 0;
        if (cost <= 0) return;

        const modifierName = _loc('MAGICAL_ALCHEMIST.name');
        const selectedModifier = testData.preData.situationalModifiers?.find((modifier) => modifier.name === modifierName);
        if (!selectedModifier || Number(selectedModifier.value) !== cost / 4) return;

        const actor = DSA5_Utility.getSpeaker(testData.preData.extra.speaker);
        if (!actor) return;

        if (actor.getTotalAvailableAsP() < cost) {
            ui.notifications.warn('DSAError.NotEnoughAsP', { localize: true });
            return;
        }

        foundry.utils.mergeObject(chatOptions, { flags: { dsa5: { [this.USED_FLAG]: true } } });
        const actionLabel = _loc('MAGICAL_ALCHEMIST.analysisModifier', { bonus: selectedModifier.value, cost });
        const content = `<h5 class="center"><b>${_loc('MAGICAL_ALCHEMIST.name')}</b></h5>
            <p><b>${foundry.utils.escapeHTML(actor.name)}</b>: ${actionLabel} (${_loc('cost')}: ${cost} ${_loc('AsP')})</p>`;
        ChatMessage.create(DSA5_Utility.chatDataSetup(content));
        await actor.applyMana(cost, 'AsP');
    }

    static async handleMagicalAlchemist(message) {
        const data = message.flags.data;
        const actor = DSA5_Utility.getSpeaker(message.speaker)
            || (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null);
        const roll = this._getRollFromMessage(message);
        if (!roll || !actor) return;

        const sourceName = data.preData?.source?.name || data.postData?.source?.name;
        if (sourceName !== _loc('LocalizedIDs.alchemy')) return;

        const traditionName = _loc('LocalizedIDs.traditionMagicalAlchemist');
        const alchemistTradition = actor.items.find((item) => item.type === 'specialability' && item.name === traditionName);
        if (!alchemistTradition) return;

        if (data.postData.successLevel === -2) return this._rescueBotch(message, actor);
        if (this.getAvailableTabs(data).length > 0) return new this(message, actor, roll).render(true);
    }

    static async _rescueBotch(message, actor) {
        const cost = this.COSTS.rescue;
        if (actor.getTotalAvailableAsP() < cost) {
            return ui.notifications.warn('DSAError.NotEnoughAsP', { localize: true });
        }

        const confirmed = await DialogV2.confirm({
            window: { title: 'MAGICAL_ALCHEMIST.name' },
            content: `<p>${_loc('SAVANT.botchRescue')}</p>`,
            modal: true
        });

        if (confirmed) {
            const paid = await actor.applyMana(cost, 'AsP');
            if (!paid) return;
            const failureLabel = _loc('Failure');
            const updateData = {
                'flags.data.postData.successLevel': -1,
                'flags.data.postData.description': failureLabel,
                [`flags.dsa5.${this.USED_FLAG}`]: true,
                'content': message.content.replace(/Patzer|Botch/g, failureLabel)
            };
            await message.update(updateData);
        }
    }

    static _getRollFromMessage(message) {
        const rollData = message.flags.data.postData?.roll || message.flags.data.preData?.roll;
        if (!rollData) return null;
        return rollData instanceof Roll ? rollData : Roll.fromData(rollData);
    }

    static registerHooks() {
        Hooks.on('getChatMessageContextOptions', (app, options, c) => {
            options.push({
                label: 'MAGICAL_ALCHEMIST.name',
                icon: '<img src="systems/dsa5/icons/traditionen/zauberalchimisten.webp" class="dsa5-chat-context-icon">',
                visible: (li) => this.canUseMagicalAlchemist(game.messages.get(li.dataset.messageId)),
                onClick: (_event, li) => this.handleMagicalAlchemist(game.messages.get(li.dataset.messageId))
            });
        });

        Hooks.on('dsa5.getRollDialogContextOptions', (dialogState, menuItems) => {
            if (!this.canUseAnalysisModifier(dialogState)) return;
            menuItems.push(...this.getAnalysisModifierItems(dialogState));
        });

        Hooks.on('postProcessDSARoll', (chatOptions, testData, rerenderMessage) => {
            this.consumeAnalysisCost(chatOptions, testData, rerenderMessage);
        });
    }
}

export default MagicalAlchemistDSA5;