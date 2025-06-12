import { DSAWorldCalendar } from '../system/calendar/calendar.js';

function getCurrentMonth() {
  const calendar = game.settings.get('dsa5', 'calendar');

  if (calendar == 'none') {
    const date = new Date();
    const monthIndex = date.getMonth();      
    const shiftedIndex = (monthIndex + 6) % 12;
    return DSAWorldCalendar.months[shiftedIndex];
  } else {
    const gameMonth = game.time.calendar.timeToComponents(game.time.worldTime).month;
    return DSAWorldCalendar.months[gameMonth];
  }
  
}

function getCurrentMonthImage() {
  const month = getCurrentMonth();
  return `systems/dsa5/icons/months/${month}.webp`;
}

Hooks.on('renderGamePause', (app, html, data, options) => {
  if (!game.settings.get('dsa5', 'enablePauseIcon')) return;
  if (data.cssClass !== 'paused') return;

  const img = html.querySelector('img');
  img.style = '--fa-animation-duration: 10s;';
  img.src = getCurrentMonthImage();
});
