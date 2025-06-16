export const DSAKalender = {
  name: 'Der Zwölfgöttliche Kalender',
  description: 'Der allgemein verbreitete Kalender in Aventurien.',
  translationPrefix: 'CALENDAR.DSA',
  years: {
    yearSuffix: 'YearSuffix',
    yearZero: 0,
    firstWeekday: 0,
    leapYear: {
      leapStart: 1000000,
      leapInterval: 4,
    },
  },
  months: {
    values: [
      { name: 'July', abbreviation: 'JulyAbbr', ordinal: 1, days: 30 },
      { name: 'August', abbreviation: 'AugustAbbr', ordinal: 2, days: 30 },
      { name: 'September', abbreviation: 'SeptemberAbbr', ordinal: 3, days: 30 },
      { name: 'October', abbreviation: 'OctoberAbbr', ordinal: 4, days: 30 },
      { name: 'November', abbreviation: 'NovemberAbbr', ordinal: 5, days: 30 },
      { name: 'December', abbreviation: 'DecemberAbbr', ordinal: 6, days: 30 },
      { name: 'NamenloseTage', abbreviation: 'NamenloseTageAbbr', ordinal: 7, days: 5 },
      { name: 'January', abbreviation: 'JanuaryAbbr', ordinal: 8, days: 30 },
      { name: 'February', abbreviation: 'FebruaryAbbr', ordinal: 9, days: 30 },
      { name: 'March', abbreviation: 'MarchAbbr', ordinal: 10, days: 30 },
      { name: 'April', abbreviation: 'AprilAbbr', ordinal: 11, days: 30 },
      { name: 'May', abbreviation: 'MayAbbr', ordinal: 12, days: 30 },
      { name: 'June', abbreviation: 'JuneAbbr', ordinal: 13, days: 30 }
    ],
  },
  days: {
    values: [
      { name: 'Monday', abbreviation: 'MondayAbbr', ordinal: 1 },
      { name: 'Tuesday', abbreviation: 'TuesdayAbbr', ordinal: 2 },
      { name: 'Wednesday', abbreviation: 'WednesdayAbbr', ordinal: 3 },
      { name: 'Thursday', abbreviation: 'ThursdayAbbr', ordinal: 4 },
      { name: 'Friday', abbreviation: 'FridayAbbr', ordinal: 5 },
      { name: 'Saturday', abbreviation: 'SaturdayAbbr', ordinal: 6, isRestDay: true },
      { name: 'Sunday', abbreviation: 'SundayAbbr', ordinal: 7, isRestDay: true }
    ],
    daysPerYear: 365,
    hoursPerDay: 24,
    minutesPerHour: 60,
    secondsPerMinute: 60,
  },
  seasons: {
    values: [
      { name: 'Summer', monthStart: 0, dayStart: 0 },
      { name: 'Fall', monthStart: 2, dayStart: 21 },
      { name: 'Winter', monthStart: 5, dayStart: 20 },
      { name: 'Spring', monthStart: 8, dayStart: 19 },
      { name: 'Summer', monthStart: 11, dayStart: 20 }
    ],
  },
  moon: {
    values: [
      { name: 'ToteMada', dayStart: 0, lightAdjust: 0 },
      { name: 'AuffuellenderKelch', dayStart: 1, lightAdjust: 0.25 },
      { name: 'Kelch', dayStart: 7, lightAdjust: 0.5 },
      { name: 'ZunehmendesRad', dayStart: 8, lightAdjust: 0.75 },
      { name: 'Rad', dayStart: 14, lightAdjust: 1 },
      { name: 'AbnehmendesRad', dayStart: 15, lightAdjust: 0.75 },
      { name: 'Helm', dayStart: 21, lightAdjust: 0.5 },
      { name: 'AbnehmenderHelm', dayStart: 22, lightAdjust: 0.25 },
    ]
  },
  holidays: {
    values: [
      { name: 'Sommersonnenwende', month: 0, dayStart: 0 },
      { name: 'Greifenfest', month: 0, dayStart: 1, dayEnd: 2 },
      { name: 'Tag des Schwurs', month: 1, dayStart: 4 },
      { name: 'Schwertfest', month: 1, dayStart: 14, dayEnd: 15 },
      { name: 'Tag des Wassers', month: 2, dayStart: 0 },
      { name: 'Fischerfest', month: 2, dayStart: 29 },
      { name: 'Tag der Heimkehr', month: 3, dayStart: 0 },
      { name: 'Tag der Treue', month: 3, dayStart: 11 },
      { name: 'Totenfest', month: 4, dayStart: 0 },
      { name: 'Allaventurisches Gauklertreffen', month: 4, dayStart: 1, dayEnd: 7 },
      { name: 'Opersaison in Vinsalt', month: 5, dayStart: 19 },
      { name: 'Erleuchtungsfest', month: 5, dayStart: 29 },
      { name: 'Wintersonnenwende', month: 7, dayStart: 0 },
      { name: 'Tag der Erneuerung', month: 8, dayStart: 29 },
      { name: 'Tag des Phex', month: 9, dayStart: 15 },
      { name: 'Tag der Saat', month: 10, dayStart: 0 },
      { name: 'Bardentreffen', month: 10, dayStart: 6, dayEnd: 11 },
      { name: 'Tag des Feuers', month: 11, dayStart: 0 },
      { name: 'Tag der Waffenschmiede', month: 11, dayStart: 20 },
      { name: 'Fest der Freuden', month: 12, dayStart: 0, dayEnd: 6 }
    ]
  }
};
