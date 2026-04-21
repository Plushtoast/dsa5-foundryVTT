import { DSADataModel } from '../abstract.js';
import { JournalEntryTargetHelper } from '../../system/calendar/journalentrytargethelper.js';

export class JournalListDataModel extends DSADataModel {
    static createDateSnapshot(dateContext, { includeDay = false } = {}) {
        const snapshot = {
            dayOfMonth: dateContext.dayOfMonth + 1,
            month: dateContext.month,
            year: dateContext.year,
        };

        if (includeDay) snapshot.day = dateContext.day;
        return snapshot;
    }

    static async createEntry(page, entryOptions) {
        const { entryCollection } = this.CREATION_CONFIG;
        const currentKey = foundry.utils.randomID();
        await page.update({
            system: {
                [entryCollection]: {
                    [currentKey]: this.createEntryData(entryOptions),
                },
            },
        });
        return currentKey;
    }

    static async startCreation(picker, entryOptions) {
        if (!game.user.isGM) return;

        const config = this.CREATION_CONFIG;
        const defaultName = _loc(config.defaultName);

        if (picker?.rendered) {
            await picker.close();
        }

        const target = await JournalEntryTargetHelper.chooseTarget({
            pageType: config.pageType,
            defaultName,
            dialogTitle: _loc(config.dialogTitle),
        });
        if (!target) return;

        const { journal, page } = await JournalEntryTargetHelper.ensureTarget(target, {
            pageType: config.pageType,
            defaultName,
        });
        if (!journal || !page) {
            ui.notifications.error('DSAJOURNALTARGET.targetCreationFailed', { localize: true });
            return;
        }

        await JournalEntryTargetHelper.registerJournal(journal, {
            settingName: this.SETTING_NAME,
            refresh: () => game.dsa5?.apps?.CalendarPicker?.refreshParts?.(config.refreshParts || []),
        });

        const currentKey = await this.createEntry(page, entryOptions);
        page.sheet.render({ force: true, currentKey });
    }
}