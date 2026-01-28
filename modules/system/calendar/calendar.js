import { DSAKalender } from './default.js';
import { CalendarWidget } from './calendarwidget.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import { DSACalendarEntry } from '../../data/journal/dsacalendar.js';
import { localize } from '../helpers/localizer.js';

export class DSAWorldCalendar extends foundry.data.CalendarData {
  static months = ['Praios', 'Rondra', 'Efferd', 'Travia', 'Boron', 'Hesinde', 'Firun', 'Tsa', 'Phex', 'Peraine', 'Ingerimm', 'Rahja', 'Namenloser'];

  static availableCalendars = [
    { key: 'none', name: '-' },
    { key: 'default', name: 'CALENDAR.DSA.defaultName', config: DSAKalender },
  ];

  static prepare() {
    Hooks.call('registerCalendars', this.availableCalendars);
  }

  static monthImage(index) {
    return `systems/dsa5/icons/months/${this.months[index]}.webp`;
  }

  static init() {
    const selectedCalendar = this.selectedCalendar();
    if (selectedCalendar) {
      CONFIG.time.worldCalendarConfig = selectedCalendar.config;
      CONFIG.time.worldCalendarClass = this;
    }
    CONFIG.time.roundTime = 5;
    CONFIG.time.turnTime = 0;
  }

  translate(key, basicKey = false, returnNothingIfMissing = false) {
    let translationKey = `CALENDAR.DSA.${key}`;
    if (!basicKey) {
      const customKey = `${this.translationPrefix}.${key}`;
      if (game.i18n.has(customKey)) {
        translationKey = customKey;
      }
    }
    const hasTranslation = game.i18n.has(translationKey);
    if (!hasTranslation && returnNothingIfMissing) {
      return '';
    }
    return localize(translationKey);
  }

  static async autoDayLight() {
    const selectedCalendar = this.selectedCalendar();
    if (!selectedCalendar) return;

    const settings = game.settings.get('dsa5', 'calendarSettings');
    if (!settings.lightByDayTime) return;

    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const currentGradient = CalendarWidget.dayTimeBackground(components);

    let lightLevel = settings.dayDarknessAdjust[currentGradient.key] || 0;

    if (settings.moonAddsLight && currentGradient.key === 'night' && components.moon) {
      lightLevel -= settings.moon.darknessAdjust * components.moon.phase.lightAdjust;
    }

    if (canvas.scene) {
      canvas.scene.update(
        { 'environment.darknessLevel': Math.clamp(lightLevel, 0, 1) },
        { animateDarkness: 1000 }
      );
    }
  }

  static collectCalendars() {
    return Object.fromEntries(
      this.availableCalendars.map(calendar => [
        calendar.key,
        localize(calendar.name)
      ])
    );
  }

  static selectedCalendar() {
    const calendar = game.settings.get('dsa5', 'calendar');
    if (calendar === 'none') return null;

    return this.availableCalendars.find(x => x.key === calendar) || this.availableCalendars[1]; // Default to second entry
  }

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),
      translationPrefix: new fields.StringField({ required: true, initial: '' }),
      moon: new fields.SchemaField({
        cycle: new fields.NumberField({ required: true, initial: 28 }),
        anchor: new fields.SchemaField({
          year: new fields.NumberField({ required: true, initial: 1040 }),
          month: new fields.NumberField({ required: true, initial: 3 }),
          dayOfMonth: new fields.NumberField({ required: true, initial: 1 }),
        }),
        values: new fields.ArrayField(
          new fields.SchemaField({
            name: new fields.StringField({ required: true, blank: false }),
            dayStart: new fields.NumberField({ required: true, initial: 0 }),
            lightAdjust: new fields.NumberField({ required: true, initial: 0.1 }),
          })
        ),
      }, { required: true, nullable: true, initial: null }),
    };
  }

  // Format time as "formatPraiosGefaellig"
  static formatPraiosGefaellig(calendar, components, _options) {
    const yyyy = `${components.year} ${calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix)}`;
    const month = calendar.months.values[components.month];
    const mm = calendar.translate(month.name);
    const dd = components.dayOfMonth + 1;

    let h = components.hour;
    if (h > 11) h -= 12;

    const hourIndex = h;
    const hourPart = components.hour > 11 ? "2." : "1.";
    const hourName = calendar.translate(CONFIG.time.worldCalendarConfig.months.values[hourIndex].name);
    const hourSuffix = localize('CALENDAR.DSA.hourSuffix');

    return `${hourPart} ${hourName}${hourSuffix}, ${dd}. ${mm} ${yyyy}`;
  }

  static async seasonParts(calendar, components, _options) {
    const season = calendar.seasons.values[components.season];
    const daysCount = calendar.days.values.length;
    const dayOfWeekIndex = ((components.dayOfWeek % daysCount) + daysCount) % daysCount;

    return {
      seasonName: calendar.translate(season.name),
      moon: calendar.translate(components.moon?.phase.name || ''),
      dayOfWeek: calendar.translate(calendar.days.values[dayOfWeekIndex].name),
      h: components.hour.toString().padStart(2, '0'),
      m: components.minute.toString().padStart(2, '0'),
      s: components.second.toString().padStart(2, '0'),
      holiday: await game.dsa5.apps.CalendarPicker.constructor.findHolidays(components) || null,
    };
  }

  // Format time as "formatRemaining"
  static async formatRemaining(calendar, components, options) {
    const searchParts = ['year', 'month', 'day', 'hour', 'minute'];

    for(const search of searchParts) {
      if(components[search] > 0) return `> ${components[search]} ${calendar.translate(search)}`;
    }

    if (components.second) {
      if(game.combat) {
        const rounds = Math.floor(components.second / CONFIG.time.roundTime);
        return `> ${rounds} ${localize('COMBAT.DURATION.ROUNDS.' + (rounds !== 1 ? 'many' : 'one'))}`;
      }
      return `> ${components.second} ${calendar.translate('second')}`;
    }
    
    return "?"
  }

  static async formatSeason(calendar, components, options) {
    const { seasonName, moon, dayOfWeek, h, m, s, holiday } = await calendar.constructor.seasonParts(calendar, components, options);

    const parts = [
      `${seasonName}, ${moon}`,
      `${dayOfWeek} - ${h}:${m}:${s}`
    ];

    if (holiday?.length) {
      const holidayTexts = holiday.map(h => {
        const key = `${game.time.calendar.translationPrefix}.holiday.${h.title}`;
        const name = game.i18n.has(key) ? localize(key) : h.title;
        return `<i style="color: ${DSACalendarEntry.CATEGORY_COLORS[h.category]}" class="${DSACalendarEntry.CATEGORY_ICONS[h.category]}"></i> ${name}`;
      });
      parts.push(...holidayTexts);
    }

    return `<div class="center">${parts.join('<br/>')}</div>`;
  }

  timeToComponents(time = 0) {
    const components = super.timeToComponents(time);

    const { year, month, dayOfMonth } = components;
    let season;
    for (season = this.seasons.values.length - 1; season >= 0; season--) {
      const s = this.seasons.values[season];
      if (s.monthStart == month && s.dayStart <= dayOfMonth) break;
      if (s.monthStart < month) break;
    }
    components.season = season;

    // Calculate moon phase
    components.moon = null;

    if (this.moon) {
      const { anchor, cycle, values } = this.moon;

      // Calculate total days since anchor date
      const yearDiff = year - anchor.year;
      let totalDays = yearDiff * this.days.daysPerYear;

      // Add days from current year's elapsed months
      for (let m = 0; m < month; m++) {
        totalDays += this.months.values[m].days;
      }

      // Add days in current month
      totalDays += dayOfMonth - (anchor.dayOfMonth - 1);

      // Adjust if within same year
      if (yearDiff === 0 && month >= anchor.month) {
        for (let m = 0; m < anchor.month; m++) {
          totalDays -= this.months.values[m].days;
        }
      }

      const dayInCycle = Math.abs(Math.floor(totalDays % cycle));

      // Find current moon phase
      let phaseIndex = 0;
      let currentPhase = values[0];

      for (let i = 0; i < values.length; i++) {
        if (dayInCycle >= values[i].dayStart) {
          currentPhase = values[i];
          phaseIndex = i;
        } else {
          break;
        }
      }

      components.moon = {
        phase: currentPhase,
        previousMoon: phaseIndex > 0 ? phaseIndex - 1 : values.length - 1,
        nextMoon: phaseIndex < values.length - 1 ? phaseIndex + 1 : 0,
        dayInCycle,
        cycle,
        phaseIndex,
      };
    }

    return components;
  }
}

// Set up hook to update calendar displays when world time changes
Hooks.on('updateWorldTime', () => {
  game.dsa5.apps.CalendarWidget.render(true);
  if (game.dsa5.apps.CalendarPicker) game.dsa5.apps.CalendarPicker.refreshCalendar();

  if (!DSA5_Utility.isActiveGM(true) || !game.canvas) return;

  DSAWorldCalendar.autoDayLight();
});
