import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import { FateRolls } from '../../actor/concerns/faterolls.js';
import { tabSlider } from '../../system/helpers/view_helper.js';

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { getProperty } = foundry.utils;

export class SavantDSA5 extends HandlebarsApplicationMixin(ApplicationV2) {
    static COSTS = Object.freeze({
        reroll: 4,
        addFP: 5,
        improve: 2,
        rescue: 10,
    });

    static DEFAULT_OPTIONS = {
        id: 'savant-app',
        classes: ['dsa5'],
        window: {
            title: 'SAVANT.name',
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
            template: 'systems/dsa5/templates/dialog/rules/savant-dialog.hbs',
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
        const postFunction = getProperty(data, 'preData.extra.options.postFunction');
        const isCumulativeCheck = Boolean(postFunction?.cummulative || postFunction?.aggregatedItemId);

        if (isCumulativeCheck && successLevel >= -1) tabs.push('reroll');
        if (successLevel > 0) tabs.push('addFP');
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
        return _loc('SAVANT.name');
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
            const { changedRolls } = await FateRolls.processSelectedReroll(
                Array.from(this.selectedForReroll).sort((left, right) => left - right),
                data.preData,
                { rollContext: 'CHATCONTEXT.Reroll' }
            );
            const rollDetail = `<p><b>${_loc('Roll')}</b>: ${changedRolls.join(', ')}</p>`;
            this._addPostRollModifier(data, actionLabel, changedRolls.join(', '));
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
            this.improvedDice.forEach((value, i) => {
                const originalValue = d20s[i].results[0].result;
                if (value !== originalValue) {
                    const attr = this.chars[i] ? `${_loc(`CHARAbbrev.${this.chars[i].toUpperCase()}`)} - ` : '';
                    changedRolls.push(`${attr}${originalValue}/${value}`);
                }
                d20s[i].results[0].result = value;
            });
            const rollDetail = `<p><b>${_loc('Roll')}</b>: ${changedRolls.join(', ')}</p>`;
            this._addPostRollModifier(data, actionLabel, changedRolls.join(', '), 'roll');
            await this._createUsageMessage(actionLabel, cost, rollDetail);
        }

        await this.dsaActor[data.postData.postFunction]({ testData: data.preData, cardOptions: data }, { rerenderMessage: this.message });
        await this.message.update({ 'flags.dsa5.savantUsed': true });

        this.close();
    }

    static canUseSavant(message) {
        const data = message?.flags?.data;
        if (!data || data.postData?.rollType !== 'talent' || message.flags.dsa5?.savantUsed) return false;
        if (data.postData.successLevel === -3) return false;

        const actor = DSA5_Utility.getSpeaker(message.speaker)
            || (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null);
        if (!(actor?.isOwner || game.user.isGM)) return false;

        const sourceName = data.preData?.source?.name || data.postData?.source?.name;
        if (!sourceName) return false;

        const savantTalent = actor.getFlag('dsa5', 'savant');
        if (savantTalent) return savantTalent === sourceName && (data.postData.successLevel === -2 || this.getAvailableTabs(data).length > 0);

        const traditionName = _loc('LocalizedIDs.traditionSavant');
        const savantTradition = actor.items.find((item) => item.type === 'specialability' && item.name === traditionName);
        if (!savantTradition) return false;

        return data.postData.successLevel === -2 || this.getAvailableTabs(data).length > 0;
    }

    static async handleSavant(message) {
        const data = message.flags.data;
        const actor = DSA5_Utility.getSpeaker(message.speaker)
            || (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null);
        const roll = this._getRollFromMessage(message);
        if (!roll || !actor) return;

        const sourceName = data.preData?.source?.name || data.postData?.source?.name;
        if (!sourceName) return;

        let savantTalent = actor.getFlag('dsa5', 'savant');
        if (!savantTalent) {
            const traditionName = _loc('LocalizedIDs.traditionSavant');
            const savantTradition = actor.items.find((item) => item.type === 'specialability' && item.name === traditionName);
            if (!savantTradition) return;

            const skills = actor.items
                .filter((item) => item.type === 'skill')
                .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));
            if (!skills.length) return;

            const options = skills.map((item) => `<option value="${item.id}"${item.name === sourceName ? ' selected' : ''}>${foundry.utils.escapeHTML(item.name)}</option>`).join('');
            const content = `<form><div class="form-group"><label class="small nobr">${_loc('SAVANT.selectTalent')}</label><select name="skillId">${options}</select></div><p class="small">${_loc('SAVANT.selectTalentHint')}</p></form>`;
            const selectedSkillId = await DialogV2.prompt({
                window: { title: 'SAVANT.name' },
                content,
                ok: {
                    label: _loc('confirm'),
                    callback: (event, button) => button.form.elements.skillId.value,
                },
            });
            if (!selectedSkillId) return;

            const selectedSkill = actor.items.get(selectedSkillId);
            if (!selectedSkill) return;

            savantTalent = selectedSkill.name;
            const effectData = {
                name: _loc('SAVANT.name'),
                img: savantTradition.img,
                transfer: true,
                duration: {},
                changes: [{
                    key: 'flags.dsa5.savant',
                    type: 'override',
                    value: savantTalent,
                }],
                flags: {
                    dsa5: {
                        description: _loc('SAVANT.name'),
                        hideOnToken: true,
                        hidePlayers: false,
                    },
                },
            };

            const existingEffect = savantTradition.effects.find((effect) => effect.changes.some((change) => change.key === 'flags.dsa5.savant'));
            if (existingEffect) await existingEffect.update(effectData);
            else await savantTradition.createEmbeddedDocuments('ActiveEffect', [effectData]);
        }

        if (savantTalent !== sourceName) return;

        if (data.postData.successLevel === -2) return this._rescueBotch(message, actor);
        if (this.getAvailableTabs(data).length > 0) return new this(message, actor, roll).render(true);
    }

    static async _rescueBotch(message, actor) {
        const cost = this.COSTS.rescue;
        if (actor.getTotalAvailableAsP() < cost) {
            return ui.notifications.warn('DSAError.NotEnoughAsP', { localize: true });
        }

        const confirmed = await DialogV2.confirm({
            window: { title: 'SAVANT.name' },
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
                'flags.dsa5.savantUsed': true,
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
                label: 'SAVANT.name',
                icon: '<img src="systems/dsa5/icons/traditionen/magiedilettanten.webp" class="dsa5-chat-context-icon">',
                visible: (li) => this.canUseSavant(game.messages.get(li.dataset.messageId)),
                onClick: (_event, li) => this.handleSavant(game.messages.get(li.dataset.messageId))
            });
        });
    }
}

export default SavantDSA5;
