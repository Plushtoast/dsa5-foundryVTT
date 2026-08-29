import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import { tabSlider } from '../system/helpers/view_helper.js';
import { FateRolls } from '../actor/concerns/faterolls.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ROLLABLE_TYPES = ['skill', 'spell', 'liturgy', 'ritual', 'ceremony'];
const COMBAT_TYPES = ['meleeweapon', 'rangeweapon', 'dodge', 'trait'];
const COMBAT_MODES = ['attack', 'parry', 'range'];

export default class UnifiedFateDSA5 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: 'unified-fate-app',
        classes: ['dsa5'],
        window: { title: 'CHATCONTEXT.UseSchip', resizable: true },
        position: { width: 570, height: 'auto' },
        actions: {
            toggleDie: function (e, t) { this._onToggleDie(e, t); },
            toggleDamageDie: function (e, t) { this._onToggleDamageDie(e, t); },
            toggleImprove: function (e, t) { this._onToggleImprove(e, t); },
            toggleSpecialDie: function (e, t) { this._onToggleSpecialDie(e, t); },
            confirm: function (e, t) { this._onConfirm(e, t, false); },
            cheat: function (e, t) { this._onConfirm(e, t, true); },
            close: function () { this.close(); },
        },
    };

    static PARTS = {
        main: {
            template: 'systems/dsa5/templates/dialog/unified-fate-dialog.hbs',
            templates: ['systems/dsa5/templates/system/dsatabs.hbs'],
        },
    };

    static isPartyMember(actor) {
        if (!actor) return false;
        let groupActor = null;
        const partyUuid = game.settings.get('dsa5', 'primaryParty');
        if (partyUuid) groupActor = fromUuidSync(partyUuid);
        if (!groupActor) groupActor = game.actors.find((a) => a.type === 'group');
        const members = groupActor?.system?.members;
        if (!members) return false;
        return Object.values(members).some((member) => member.uuid === actor.uuid);
    }

    static openFromLi(li) {
        const el = li.length ? li[0] : li;
        const message = game.messages.get(el.dataset?.messageId);
        if (!message) return;
        const actor = message.speaker?.actor ? game.actors.get(message.speaker.actor) : null;
        const rollData = message.flags?.data?.postData?.roll || message.flags?.data?.preData?.roll;
        if (!actor) return;
        const roll = rollData ? (rollData instanceof Roll ? rollData : Roll.fromData(rollData)) : null;
        this.open(message, actor, roll);
    }

    static open(message, actor, roll) {
        const registry = { AppClass: this };
        Hooks.call('dsa5.getFateSpendApp', registry);
        new registry.AppClass(message, actor, roll).render(true);
    }

    constructor(message, actor, roll, options) {
        super(options);
        this.message = message;
        this.dsaActor = actor;
        this.originalRoll = roll;
        this.selectedForReroll = new Set();
        this.selectedForDamageReroll = new Set();
        this.selectedForImprove = -1;
        this.selectedForSpecialReroll = -1;
        this.tabGroups = { sheet: 'reroll' };
        this.selectedPool = actor.system.status?.fatePoints?.value > 0 ? 'personal' : 'group';
        this.selectedSpecialKey = null;
    }

    async _prepareContext(options) {
        const baseContext = await super._prepareContext(options);
        const context = await this._buildFateContext(baseContext);
        Hooks.call('dsa5.prepareFateSpendContext', this, context);
        return context;
    }

    async _buildFateContext(baseContext) {
        return this._buildCoreContext(baseContext);
    }

    _buildCoreContext(baseContext) {
        const data = this.message.flags.data;
        const postData = data.postData;
        const preData = data.preData;

        const usedReroll = !!data.fatePointRerollUsed;
        const usedDamageReroll = !!data.fatePointDamageRerollUsed;
        const usedImprove = !!data.fateImproved;
        const usedAddQS = !!data.fatePointAddQSUsed;

        const successLevel = postData.successLevel || 0;
        const type = preData.source?.type;
        const mode = preData.mode;
        const isCombatRoll = COMBAT_TYPES.includes(type) || COMBAT_MODES.includes(mode);
        const hasD20Roll = !!postData.characteristics || !!preData.roll;
        const hasDamageRoll = !!postData.damageRoll;
        const canAddQS = successLevel > 0 && !usedAddQS && postData.qualityStep !== undefined && !isCombatRoll;
        const canImprove = this._canImprove(preData, postData);

        const tabs = {};
        if (hasD20Roll && !usedReroll && postData.rollType !== 'regenerate') {
            tabs.reroll = { id: 'reroll', group: 'sheet', label: 'CHATFATE.tabReroll', cssClass: this.tabGroups.sheet === 'reroll' ? 'active' : '' };
        }
        if (hasDamageRoll && !usedDamageReroll) {
            tabs.rerollDamage = { id: 'rerollDamage', group: 'sheet', label: 'CHATFATE.tabRerollDamage', cssClass: this.tabGroups.sheet === 'rerollDamage' ? 'active' : '' };
        }
        if (hasD20Roll && canImprove && !usedImprove && successLevel > -2) {
            tabs.improve = { id: 'improve', group: 'sheet', label: 'CHATFATE.tabImprove', cssClass: this.tabGroups.sheet === 'improve' ? 'active' : '' };
        }
        if (canAddQS) {
            tabs.addQS = { id: 'addQS', group: 'sheet', label: 'CHATFATE.tabAddQS', cssClass: this.tabGroups.sheet === 'addQS' ? 'active' : '' };
        }

        if (!tabs[this.tabGroups.sheet]) {
            this.tabGroups.sheet = Object.keys(tabs)[0];
            if (tabs[this.tabGroups.sheet]) tabs[this.tabGroups.sheet].cssClass = 'active';
        }

        const dice = (postData.characteristics || [])
            .filter((item) => item.char !== 'damage')
            .map((item, i) => {
                let attr = item.char || 'd20';
                if (isCombatRoll) {
                    attr = mode || type;
                    if (type === 'dodge') attr = 'dodge';
                }
                return {
                    index: i,
                    currentValue: item.res,
                    attr,
                    cssClass: item.suc ? 'suc' : 'fail',
                    tooltip: item.tar ? `${_loc(item.char === 'attack' ? 'Attack' : item.char === 'parry' ? 'Parry' : `CHAR.${item.char.toUpperCase()}`)} vs ${item.tar}` : '',
                    selected: this.tabGroups.sheet === 'reroll' ? this.selectedForReroll.has(i) : this.selectedForImprove === i,
                };
            });

        const damageDice = this._buildDamageDice(postData);

        const fateMax = this.dsaActor.system.status.fatePoints.current || 0;
        const fateAvailable = this.dsaActor.system.status.fatePoints.value || 0;
        const personalTooltip = _loc('FORMULA.fatePoints');
        const personalSchips = Array.from({ length: fateMax }, (_, i) => ({
            val: i + 1,
            cssClass: i < fateAvailable ? 'fullSchip' : 'emptySchip',
            tooltip: personalTooltip,
        }));

        const [grpCur, grpMax] = (game.settings.get('dsa5', 'groupschips') || '0/0').split('/').map(Number);
        const groupTooltip = _loc('FORMULA.groupFatePoints');
        const groupSchips = Array.from({ length: grpMax || grpCur || 0 }, (_, i) => ({
            val: i + 1,
            cssClass: i < grpCur ? 'fullSchip' : 'emptySchip',
            tooltip: groupTooltip,
        }));

        const groupActor = this._resolveGroupActor();
        const hasPersonal = personalSchips.length > 0;
        const hasGroup = groupSchips.length > 0 && UnifiedFateDSA5.isPartyMember(this.dsaActor);

        const poolAvailable = { personal: hasPersonal, group: hasGroup };
        if (!poolAvailable[this.selectedPool]) {
            this.selectedPool = ['personal', 'group'].find((pool) => poolAvailable[pool]) ?? this.selectedPool;
        }

        return {
            ...baseContext,
            tabs,
            dice,
            damageDice,
            actorImg: this.dsaActor.img || 'icons/svg/mystery-man-black.svg',
            groupImg: groupActor?.img || 'icons/svg/mystery-man-black.svg',
            personalSchips,
            groupSchips,
            isPersonalPool: this.selectedPool === 'personal',
            isGroupPool: this.selectedPool === 'group',
            addQSDesc: _loc('CHATFATE.AddQSDesc'),
            hasPersonal,
            hasGroup,
            hasMultiplePools: Number(hasPersonal) + Number(hasGroup) > 1,
            isGM: game.user.isGM,
            poolHint: '',
        };
    }

    _buildDamageDice(postData) {
        if (!postData.damageRoll) return [];
        const rollInstance = postData.damageRoll instanceof Roll ? postData.damageRoll : Roll.fromData(postData.damageRoll);
        const damageDice = [];
        let dieIndex = 0;
        for (const term of rollInstance.terms) {
            if (!term.results) continue;
            for (const res of term.results) {
                damageDice.push({
                    index: dieIndex,
                    currentValue: res.result,
                    faces: term.faces || 6,
                    tooltip: _loc('Trefferpunkte'),
                    selected: this.selectedForDamageReroll.has(dieIndex),
                });
                dieIndex++;
            }
        }
        return damageDice;
    }

    _resolveGroupActor() {
        const partyUuid = game.settings.get('dsa5', 'primaryParty');
        if (partyUuid) {
            const fromParty = fromUuidSync(partyUuid);
            if (fromParty) return fromParty;
        }
        return game.actors.find((a) => a.type === 'group');
    }

    _canImprove(preData, postData) {
        const type = preData.source?.type;
        const mode = preData.mode || '';
        const isAttack = mode === 'attack' || postData.characteristics?.some((c) => c.char === 'attack');
        const isParry = mode === 'parry' || postData.characteristics?.some((c) => c.char === 'parry');
        const isRange = type === 'rangeweapon' || mode === 'range';
        const isDodge = type === 'dodge' || preData.source?.name === _loc('Dodge');

        let improveSkill = null;
        if (isAttack) improveSkill = 'SCHIPSKILLS.meleeweaponattack';
        else if (isRange) improveSkill = 'SCHIPSKILLS.rangeweaponattack';
        else if (isDodge) improveSkill = 'SCHIPSKILLS.dodge';
        else if (isParry) improveSkill = 'SCHIPSKILLS.meleeweaponparry';
        else if (type === 'attribute' || FateRolls.MULTI_DIE_ROLL_TYPES.includes(type) || ROLLABLE_TYPES.includes(type)) {
            improveSkill = 'SCHIPSKILLS.char';
        }
        if (!improveSkill) return false;
        const locName = _loc(improveSkill);
        return this.dsaActor.items.some((item) => item.name === locName && item.system?.category?.value === 'fatePoints')
            || !!this.dsaActor.items.getName(locName);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        const html = this.element;
        tabSlider($(html));

        html.querySelectorAll('.pool-icon').forEach((img) => {
            img.addEventListener('click', (ev) => {
                const pool = ev.currentTarget.dataset.pool;
                if (!this._canSelectPool(pool)) return;
                this.selectedPool = pool;
                this.selectedSpecialKey = null;
                this.render({ force: true });
            });
        });

        html.querySelectorAll('.schip-btn').forEach((btn) => {
            btn.addEventListener('click', (ev) => this._onSchipButtonClick(ev.currentTarget));
        });

        html.querySelectorAll('nav.tabs .item, nav.tabs .tabelement').forEach((el) => {
            el.addEventListener('click', this._onClickTab.bind(this));
        });
    }

    _canSelectPool(pool, _key) {
        return pool === 'personal' || pool === 'group';
    }

    _onClickTab(event) {
        const nextTab = event.target.closest('[data-tab]')?.dataset.tab;
        if (!nextTab || nextTab === this.tabGroups.sheet) return;
        this.tabGroups.sheet = nextTab;
        this.selectedForReroll.clear();
        this.selectedForDamageReroll.clear();
        this.render({ force: true });
    }

    _onToggleDie(event, target) {
        const idx = parseInt(target.closest('[data-index]').dataset.index);
        if (this.selectedForReroll.has(idx)) this.selectedForReroll.delete(idx);
        else this.selectedForReroll.add(idx);
        this.render();
    }

    _onToggleDamageDie(event, target) {
        const idx = parseInt(target.closest('[data-index]').dataset.index);
        if (this.selectedForDamageReroll.has(idx)) {
            this.selectedForDamageReroll.delete(idx);
        } else {
            if (this.tabGroups.sheet === 'rerollDamage') this.selectedForDamageReroll.clear();
            this.selectedForDamageReroll.add(idx);
        }
        this.render();
    }

    _onSchipButtonClick(target) {
        const pool = target.dataset.pool;
        if (!this._canSelectPool(pool, target.dataset.key)) return;
        this.selectedPool = pool;
        this.selectedSpecialKey = target.dataset.key || null;
        this.render({ force: true });
    }

    _onToggleImprove(event, target) {
        const idx = parseInt(target.closest('[data-index]').dataset.index);
        this.selectedForImprove = this.selectedForImprove === idx ? -1 : idx;
        this.render();
    }

    _onToggleSpecialDie(_event, _target) {}

    _validateSelectedPool() {
        if (this.selectedPool === 'personal') {
            if ((this.dsaActor.system.status.fatePoints.value || 0) <= 0) {
                ui.notifications.error(_loc('DSAError.noPersonalSchips'));
                return false;
            }
            return true;
        }
        if (this.selectedPool === 'group') {
            const current = Number((game.settings.get('dsa5', 'groupschips') || '0/0').split('/')[0]);
            if (current <= 0) {
                ui.notifications.error(_loc('DSAError.noGroupSchips'));
                return false;
            }
            return true;
        }
        ui.notifications.error(_loc('DSAError.NotEnoughFate'));
        return false;
    }

    _warnNoDieSelected() {
        ui.notifications.warn(_loc('DSAError.noDieSelected'));
        return false;
    }

    _validateDieSelection() {
        switch (this.tabGroups.sheet) {
            case 'reroll':
                if (this.selectedForReroll.size === 0) return this._warnNoDieSelected();
                return true;
            case 'rerollDamage':
                if (this.selectedForDamageReroll.size === 0) return this._warnNoDieSelected();
                if (this.selectedForDamageReroll.size > 1) {
                    ui.notifications.warn(_loc('DSAError.maxOneDie'));
                    return false;
                }
                return true;
            case 'improve':
                return this._validateImproveDieSelection();
            default:
                return true;
        }
    }

    _validateImproveDieSelection() {
        const multiDie = (this.message.flags.data.postData.characteristics?.length ?? 0) > 1;
        if (multiDie && this.selectedForImprove < 0) return this._warnNoDieSelected();
        return true;
    }

    _schipSource() {
        return this.selectedPool === 'group' ? FateRolls.SCHIP_SOURCES.GROUP : FateRolls.SCHIP_SOURCES.PERSONAL;
    }

    _buildCardOptions(data) {
        const cardOptions = FateRolls.preparePostRollAction(this.message);
        if (data.startMessagesList) cardOptions.startMessagesList = data.startMessagesList;
        return cardOptions;
    }

    async _executeSheetAction({ data, newTestData, cardOptions, isCheat }) {
        const tab = this.tabGroups.sheet;
        switch (tab) {
            case 'reroll':
                return this._executeReroll(data, newTestData, isCheat);
            case 'rerollDamage':
                return this._executeDamageReroll(data, newTestData, isCheat);
            case 'addQS':
                return this._executeAddQS(newTestData, cardOptions);
            case 'improve':
                return this._executeImprove(newTestData, data);
            default:
                return null;
        }
    }

    async _executeReroll(data, newTestData, isCheat) {
        if (this.selectedForReroll.size === 0) {
            ui.notifications.warn(_loc('DSAError.noDieSelected'));
            return null;
        }
        const isPhex = this.dsaActor.items.some((item) => item.type === 'specialability' && item.name === _loc('LocalizedIDs.traditionPhex'));
        const rerollData = await FateRolls.processSelectedReroll(
            Array.from(this.selectedForReroll).sort((a, b) => a - b),
            newTestData,
            {
                rollContext: 'CHATCONTEXT.Reroll',
                actor: this.dsaActor,
                isPhex,
                cheat: isCheat,
            },
        );
        if (!rerollData) return null;
        if (data.postData?.characteristics) {
            rerollData.changes.forEach((change) => {
                const charObj = data.postData.characteristics[change.index];
                if (!charObj) return;
                charObj.res = change.val;
                if (charObj.tar !== undefined) charObj.suc = change.val <= charObj.tar;
            });
        }
        newTestData.fateUsed = true;
        return {
            chatType: 'reroll',
            chatRollDetails: FateRolls.formatDieChangesHtml(rerollData.changedRolls),
            flagToUpdate: [FateRolls.FLAGS.FATE_REROLL],
        };
    }

    async _executeDamageReroll(data, newTestData, isCheat) {
        if (this.selectedForDamageReroll.size === 0) {
            ui.notifications.warn(_loc('DSAError.noDieSelected'));
            return null;
        }
        if (this.selectedForDamageReroll.size > 1) {
            ui.notifications.warn(_loc('DSAError.maxOneDie'));
            return null;
        }

        const origDamageData = data.postData.damageRoll || data.preData.damageRoll;
        const originalRoll = origDamageData instanceof Roll ? origDamageData : Roll.fromData(origDamageData);
        const selectedIndices = Array.from(this.selectedForDamageReroll).sort((a, b) => a - b);
        const rerollFormulas = [];
        const diceMapping = [];
        let globalIndex = 0;
        for (let termIdx = 0; termIdx < originalRoll.terms.length; termIdx++) {
            const term = originalRoll.terms[termIdx];
            if (!term.results) continue;
            for (let resIdx = 0; resIdx < term.results.length; resIdx++) {
                if (selectedIndices.includes(globalIndex)) {
                    rerollFormulas.push(`1d${term.faces}`);
                    diceMapping.push({ termIdx, resIdx, originalResult: term.results[resIdx].result });
                }
                globalIndex++;
            }
        }

        let newRerollDie = await new Roll(rerollFormulas.join(' + ')).evaluate();
        newRerollDie = await DiceDSA5.manualRolls(newRerollDie, 'CHATCONTEXT.rerollDamage', { cheat: isCheat });
        newRerollDie.dice.forEach((die) => { die.options.colorset = FateRolls.DICE_COLOR_BLACK; });
        await DiceDSA5.showDiceSoNice(newRerollDie, data.messageMode);

        let finalRoll = Roll.fromData(originalRoll.toJSON());
        let newResultFlatIndex = 0;
        const damageChangesHtml = [];
        newRerollDie.terms.forEach((term) => {
            if (!term.results) return;
            term.results.forEach((res) => {
                const map = diceMapping[newResultFlatIndex];
                const faces = originalRoll.terms[map.termIdx].faces;
                const formatted = FateRolls.formatDieChange(map.originalResult, res.result, { char: 'damage', faces });
                damageChangesHtml.push(formatted.html);
                finalRoll.terms[map.termIdx].results[map.resIdx].result = res.result;
                newResultFlatIndex++;
            });
        });
        if (typeof finalRoll._evaluateTotal === 'function') finalRoll._total = finalRoll._evaluateTotal();
        foundry.utils.setProperty(finalRoll, 'options.diceSoNice', false);
        newTestData.damageRoll = finalRoll.toJSON();
        newTestData.damageRoll.options = newTestData.damageRoll.options || {};
        newTestData.damageRoll.options.diceSoNice = false;

        return {
            chatType: 'rerollDamage',
            chatRollDetails: FateRolls.formatDieChangesHtml(damageChangesHtml),
            flagToUpdate: [FateRolls.FLAGS.FATE_DAMAGE_REROLL],
            damageContext: true,
        };
    }

    _executeAddQS(newTestData, cardOptions) {
        DSA5_Utility.clearUserTargets();
        cardOptions.fatePointAddQSUsed = true;
        newTestData.qualityStep = 1;
        return {
            chatType: 'addQS',
            chatRollDetails: '',
            flagToUpdate: [FateRolls.FLAGS.FATE_ADD_QS],
        };
    }

    _executeImprove(newTestData, data) {
        const multiDie = (data.postData.characteristics?.length ?? 0) > 1;
        const dieIndex = multiDie ? this.selectedForImprove : 0;
        if (multiDie && dieIndex < 0) {
            ui.notifications.warn(_loc('DSAError.noDieSelected'));
            return null;
        }
        FateRolls.applyImprovement(newTestData, dieIndex, FateRolls.IMPROVEMENT_VALUE, { multiDie });
        newTestData.fateUsed = true;
        return {
            chatType: 'Improve',
            chatRollDetails: '',
            flagToUpdate: [FateRolls.FLAGS.FATE_IMPROVED],
        };
    }

    async _onConfirm(event, target, isCheat = false) {
        event?.preventDefault?.();
        if (!this._validateSelectedPool()) return;
        if (!this._validateDieSelection()) return;

        const data = this.message.flags.data;
        const newTestData = data.preData;
        const cardOptions = this._buildCardOptions(data);
        const isDamageContext = this.tabGroups.sheet === 'rerollDamage';
        const hasOpposed = !!(data.startMessagesList?.length || data.defenderMessage || data.attackerMessage || data.unopposedStartMessage);

        if (isDamageContext || hasOpposed) {
            DSA5_Utility.clearUserTargets();
        } else if (data.originalTargets?.size) {
            game.user.targets = data.originalTargets;
            game.user.targets.user = game.user;
        }

        const actionResult = await this._executeSheetAction({ data, newTestData, cardOptions, isCheat });
        if (!actionResult) return;

        if (!cardOptions.skipNativePostFunction) {
            await this.dsaActor[data.postData.postFunction]({ testData: newTestData, cardOptions }, { rerenderMessage: this.message });
        }

        const infoMsg = FateRolls.buildUsageMessage(this.dsaActor, actionResult.chatType, this._schipSource());
        await ChatMessage.create(DSA5_Utility.chatDataSetup(`${infoMsg}${actionResult.chatRollDetails || ''}`));

        const updatedMessage = game.messages.get(this.message.id);
        const updates = {};
        for (const flag of actionResult.flagToUpdate || []) updates[`flags.data.${flag}`] = true;
        if (Object.keys(updates).length) await updatedMessage.update(updates);

        await FateRolls.reduceSchips(this.dsaActor, this._schipSource());
        this.close();
    }
}
