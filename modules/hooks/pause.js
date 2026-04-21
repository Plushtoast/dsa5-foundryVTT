import { DSAWorldCalendar } from '../system/calendar/calendar.js';

function getCurrentMonthImage() {
  const calendar = game.settings.get('dsa5', 'calendar');

  if (calendar == 'none') {
    const date = new Date();
    const monthIndex = date.getMonth();      
    const shiftedIndex = (monthIndex + 6) % 12;
    return DSAWorldCalendar.monthImage(shiftedIndex);
  }

  const gameMonth = game.time.calendar.timeToComponents(game.time.worldTime).month;
  return DSAWorldCalendar.monthImage(gameMonth);
}

Hooks.on('renderGamePause', (app, html, data, options) => {
  if (!game.settings.get('dsa5', 'enablePauseIcon')) return;
  if (data.cssClass !== 'paused') return;

  const img = html.querySelector('img');
  img.style = '--fa-animation-duration: 12s;';
  img.src = getCurrentMonthImage();
  html.classList.add('dsa5Pause');
});
