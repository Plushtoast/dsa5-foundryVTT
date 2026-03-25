import { DSACalendarEntry } from '../../data/journal/dsacalendar.js';
import { JournalEntryTargetHelper } from './journalentrytargethelper.js';

export class CalendarEventCreation {
  static HOTBAR_ID = 'createCalendarEvent';

  static async startFromHotbar() {
    return this.#startEventCreation({
      dateContext: game.time.calendar.timeToComponents(game.time.worldTime),
    });
  }

  static async startFromCalendarPicker(picker) {
    const dateContext = picker?.actualTimeComponents?.() ?? game.time.calendar.timeToComponents(game.time.worldTime);
    if (picker?.rendered) {
      await picker.close();
    }

    return this.#startEventCreation({ dateContext });
  }

  static #defaultCalendarName() {
    return _loc('dsacalendar.defaultJournalName');
  }

  static async #refreshCalendarRegistrationUI() {
    const picker = game.dsa5?.apps?.CalendarPicker;
    if (picker?.rendered) {
      await picker.render({ force: true, parts: ['events', 'config'] });
    }
  }

  static async #registerJournalInCalendar(journal) {
    await JournalEntryTargetHelper.registerJournal(journal, {
      settingName: DSACalendarEntry.SETTING_NAME,
      refresh: () => this.#refreshCalendarRegistrationUI(),
    });
  }

  static async #chooseCalendarTarget() {
    return JournalEntryTargetHelper.chooseTarget({
      pageType: 'dsacalendar',
      defaultName: this.#defaultCalendarName(),
      dialogTitle: _loc('dsacalendar.addEventDialogTitle'),
      labels: {
        hint: _loc('dsacalendar.addEventDialogHint'),
        addToExistingPage: _loc('dsacalendar.addEventToExistingPage'),
        addToNewPage: _loc('dsacalendar.addEventToNewPage'),
        addToNewJournal: _loc('dsacalendar.addEventToNewJournal'),
        targetMode: _loc('dsacalendar.targetMode'),
        selectPage: _loc('dsacalendar.selectPage'),
        selectJournalForPage: _loc('dsacalendar.selectJournalForPage'),
        pageName: _loc('dsacalendar.pageName'),
        journalName: _loc('dsacalendar.journalName'),
      },
    });
  }

  static async #ensureCalendarTarget(target) {
    return JournalEntryTargetHelper.ensureTarget(target, {
      pageType: 'dsacalendar',
      defaultName: this.#defaultCalendarName(),
    });
  }

  static async #createEntry(page, dateContext) {
    const currentKey = foundry.utils.randomID();
    await page.update({
      system: {
        calendarentries: {
          [currentKey]: DSACalendarEntry.createEntryData(dateContext),
        },
      },
    });
    return currentKey;
  }

  static async #startEventCreation({ dateContext, picker } = {}) {
    if (!game.user.isGM) return;

    const target = await this.#chooseCalendarTarget();
    if (!target) return;

    const { journal, page } = await this.#ensureCalendarTarget(target);
    if (!journal || !page) {
      ui.notifications.error('dsacalendar.targetCreationFailed', { localize: true });
      return;
    }

    await this.#registerJournalInCalendar(journal);
    const currentKey = await this.#createEntry(page, dateContext);
    page.sheet.render({ force: true, currentKey });

    if (picker?.rendered) {
      await picker.render({ force: true, parts: ['events', 'config'] });
    }
  }
}