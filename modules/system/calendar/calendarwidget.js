import DSA5_Utility from "../helpers/utility-dsa5.js";

export class CalendarWidget extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static SECONDS_PER_HOUR = 3600;
    static SECONDS_PER_DAY = 24 * this.SECONDS_PER_HOUR;
    static ADVANCE_MENU_LEAVE_MS = 350;
    /** Floor for scrub length so tiny advances still read as motion */
    static ANIMATION_MS_MIN = 400;
    /** Soft cap so week/month jumps don't drag */
    static ANIMATION_MS_MAX = 10000;
    /** duration ≈ this * √(hours advanced) */
    static ANIMATION_MS_PER_SQRT_HOUR = 1800;
    /** Skip scrub animation for tiny advances (auto-time ticks, etc.) */
    static MIN_ANIMATION_DELTA_SECONDS = 60;
    static ANIMATION_NAME = 'DSACalendarClock';
    static LIGHT_SCRUB_MS = 200;

    static timeGradients = [
        { from: 'dayStart', to: 'dawn', gradient: 'linear-gradient(to top, #0d1b2a, #1b263b)', textColor: '#e0e6ed', fillColor: '#7a8a9a', key: 'night', icon: 'fas fa-moon' },
        { from: 'dawn', to: 'morning', gradient: 'linear-gradient(to top, #2c3e50, #f39c12)', textColor: '#fffbe6', fillColor: '#d4a05a', key: 'dawn', icon: 'fas fa-cloud-sun' },
        { from: 'morning', to: 'noon', gradient: 'linear-gradient(to top, #87ceeb, #f1f2b5)', textColor: '#1a1a1a', fillColor: '#c8b38a', key: 'morning', icon: 'fas fa-sun' },
        { from: 'noon', to: 'afternoon', gradient: 'linear-gradient(to top, #87cefa, #ffffff)', textColor: '#111111', fillColor: '#ddd0a8', key: 'noon', icon: 'fas fa-sun' },
        { from: 'afternoon', to: 'sunset', gradient: 'linear-gradient(to top, #f1f2b5, #ff9966)', textColor: '#222', fillColor: '#c9a878', key: 'afternoon', icon: 'fas fa-sun' },
        { from: 'sunset', to: 'night', gradient: 'linear-gradient(to top, #654ea3, #eaafc8)', textColor: '#fefefe', fillColor: '#c49a8e', key: 'sunset', icon: 'fas fa-cloud-moon' },
        { from: 'night', to: 'dayEnd', gradient: 'linear-gradient(to top, #0f2027, #2c5364)', textColor: '#f0f8ff', fillColor: '#7a8a9a', key: 'night', icon: 'fas fa-moon' }
    ];

    static SEVERE_WIND = new Set(['HIGH_WIND', 'GALE', 'SEVERE_GALE', 'STORM', 'HURRICANE']);

    static FEATURE_TABS = ['calendar', 'events', 'questlog', 'personae'];

    static DEFAULT_OPTIONS = {
        id: 'dsa-calendar-widget',
        window: {
            frame: false,
            positioned: false,
        },
        classes: ['dsaCalendarWidget', 'faded-ui'],
        actions: {
            edit: this.editCalendar,
            openAlmanac: this.openAlmanac,
            openEvents: this.openEvents,
            toggleAutoLight: this.toggleAutoLight,
            toggleAutoTime: this.onToggleAutoTime,
            toggleAutoWeather: this.toggleAutoWeather,
            weekBack: this.#timeStep(this.weekBack),
            dayBack: this.#timeStep(this.dayBack),
            hours6Back: this.#timeStep(this.hours6Back),
            hourBack: this.#timeStep(this.hourBack),
            mins30Back: this.#timeStep(this.mins30Back),
            minBack: this.#timeStep(this.minBack),
            minForward: this.#timeStep(this.minForward),
            mins30Forward: this.#timeStep(this.mins30Forward),
            hourForward: this.#timeStep(this.hourForward),
            hours6Forward: this.#timeStep(this.hours6Forward),
            dayForward: this.#timeStep(this.dayForward),
            weekForward: this.#timeStep(this.weekForward),
        },
    };

    static PARTS = {
        main: {
            root: true,
            template: 'systems/dsa5/templates/system/calendar/widget.hbs',
        },
    };

    static #timeStep(handler) {
        return { handler, buttons: [0, 2] };
    }

    isAnimatingTime = false;
    _animationToken = 0;
    _animationTime = null;

    static get dayTimes() {
        const calendarConfig = game.settings.get('dsa5', 'calendarSettings');
        const autoTimes = calendarConfig.autoDayTimes && DSA5_Utility.moduleEnabled('dsa5-atlas');

        if (autoTimes) return game.dsa5.atlas.seasonsCalculator.autoDayTimes();

        return calendarConfig;
    }

    static dayTimeBackground(components) {
        const maxHoursPerDay = game.time.calendar.days.hoursPerDay;
        const calendarConfig = this.dayTimes;
        const timeGradientsConfig = foundry.utils.mergeObject({
            'dayStart': 0,
            'dayEnd': maxHoursPerDay,
        }, calendarConfig);

        const comparisonTime = components.hour + (components.minute / 60) + (components.second / 3600);

        return CalendarWidget.timeGradients.find(g => {
            const from = timeGradientsConfig[g.from] || 0;
            const to = timeGradientsConfig[g.to] || maxHoursPerDay;
            return comparisonTime >= from && comparisonTime < to;
        }) || CalendarWidget.timeGradients[0];
    }

    static resolveWeatherIcon(weather) {
        if (!weather) {
            return {
                icon: 'fas fa-cloud-sun',
                available: false,
                tooltip: game.i18n.localize('CALENDAR.DSA.weatherUnavailable'),
            };
        }

        const precip = String(weather.precipitation?.category || 'NONE').toUpperCase();
        const clouds = String(weather.cloudCover?.category || 'CLEAR').toUpperCase();
        const wind = String(weather.wind?.category || 'CALM').toUpperCase();
        const severeWind = this.SEVERE_WIND.has(wind);

        let icon = 'fas fa-cloud-sun';
        if (severeWind && (precip.includes('SNOW') || precip === 'SLEET')) icon = 'fas fa-icicles';
        else if (severeWind || precip === 'DOWNPOUR' || precip === 'HEAVY_RAIN') icon = 'fas fa-bolt';
        else if (precip.includes('SNOW') || precip === 'SLEET') icon = 'fas fa-snowflake';
        else if (precip === 'HAIL') icon = 'fas fa-cloud-meatball';
        else if (precip === 'RAIN' || precip === 'LIGHT_RAIN' || precip === 'DRIZZLE') icon = 'fas fa-cloud-rain';
        else if (precip === 'MIST' || clouds === 'FOGGY') icon = 'fas fa-smog';
        else if (severeWind || wind === 'STRONG_BREEZE' || wind === 'FRESH_BREEZE') icon = 'fas fa-wind';
        else if (clouds === 'OVERCAST' || clouds === 'MOSTLY_CLOUDY') icon = 'fas fa-cloud';
        else if (clouds === 'PARTLY_CLOUDY') icon = 'fas fa-cloud-sun';
        else if (clouds === 'CLEAR' && precip === 'NONE') icon = 'fas fa-sun';

        const tooltipParts = [];
        if (clouds) tooltipParts.push(game.i18n.localize(`DSA5.WeatherGen.cloudCover.${clouds}.name`));
        if (precip && precip !== 'NONE') tooltipParts.push(game.i18n.localize(`DSA5.WeatherGen.precipitation.${precip}.name`));
        const tooltip = tooltipParts.filter(t => t && !t.startsWith('DSA5.WeatherGen.')).join(' · ')
            || game.i18n.localize('CALENDAR.DSA.weather');

        return { icon, available: true, tooltip };
    }

    /**
     * CSS classes for the calendar weather bookend icon.
     * Auto-weather on/off uses is-active (sidebar aria-pressed parity); is-muted is only for missing weather data.
     * @param {{ icon: string, available: boolean }} info
     * @param {{ canToggle?: boolean, autoWeatherEnabled?: boolean }} [options]
     */
    static weatherIconClassName(info, { canToggle = false, autoWeatherEnabled = true } = {}) {
        return [
            info.icon,
            'calendar-bookend',
            'calendar-weather-icon',
            !info.available ? 'is-muted' : null,
            canToggle ? 'is-toggle' : null,
            canToggle && autoWeatherEnabled ? 'is-active' : null,
        ].filter(Boolean).join(' ');
    }

    static currentWeather() {
        const persistor = game.dsa5?.atlas?.weatherPersistor;
        if (!persistor) return null;
        return persistor.getCurrentWeather?.() ?? persistor.snapshot?.()?.currentWeather ?? null;
    }

    /**
     * Optional one-shot duration override (e.g. atlas travel/rest matching token motion).
     * Consumed by the next scrub started via maybeAnimateTimeChange.
     * @type {number|null}
     */
    static pendingAnimationDurationMs = null;
    /** When true, next scrub uses linear easing to match constant token travel speed */
    static pendingAnimationLinear = false;
    /** When true, the next world-time jump skips the clock scrub and snaps to the end. */
    static skipNextTimeAnimation = false;

    /**
     * Scrub duration from √hours — snappy for short steps, soft-capped for long jumps.
     * Travel should prefer {@link animationDurationMsLinear} so map motion stays even.
     * @param {number} deltaSeconds
     * @returns {number}
     */
    static animationDurationMs(deltaSeconds) {
        if (Number.isFinite(this.pendingAnimationDurationMs)) {
            const pending = this.pendingAnimationDurationMs;
            this.pendingAnimationDurationMs = null;
            return pending;
        }
        const hours = Math.abs(deltaSeconds) / this.SECONDS_PER_HOUR;
        const raw = this.ANIMATION_MS_PER_SQRT_HOUR * Math.sqrt(hours);
        return Math.clamp(raw, this.ANIMATION_MS_MIN, this.ANIMATION_MS_MAX);
    }

    /**
     * Linear scrub duration: real_ms ≈ hours * msPerHour (clamped).
     * Keeps token travel speed proportional to game-time, not path leaf length.
     * @param {number} deltaSeconds
     * @param {number} [msPerGameHour=2500]
     * @param {{ minMs?: number, maxMs?: number }} [limits]
     * @returns {number}
     */
    static animationDurationMsLinear(deltaSeconds, msPerGameHour = 2500, { minMs, maxMs } = {}) {
        const hours = Math.abs(deltaSeconds) / this.SECONDS_PER_HOUR;
        return Math.clamp(
            hours * msPerGameHour,
            minMs ?? this.ANIMATION_MS_MIN,
            maxMs ?? this.ANIMATION_MS_MAX
        );
    }

    /**
     * Whether a world-time delta should scrub instead of instant-refresh.
     * @param {number} dt
     * @returns {boolean}
     */
    static shouldAnimateTimeChange(dt) {
        return Number.isFinite(dt) && Math.abs(dt) >= this.MIN_ANIMATION_DELTA_SECONDS;
    }

    /**
     * Resolve once the active calendar scrub finishes (or immediately if idle).
     * Yields a frame first so an just-fired updateWorldTime can start the anim.
     * Prefer {@link watchTimeAnimation} when you can subscribe before advancing time.
     * @param {{ timeoutMs?: number }} [options]
     * @returns {Promise<void>}
     */
    static async waitForTimeAnimation({ timeoutMs } = {}) {
        await Promise.resolve();
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));

        const widget = game.dsa5?.apps?.CalendarWidget;
        if (!widget?.isAnimatingTime) return;

        await this.watchTimeAnimation({ timeoutMs, assumeStarted: true });
    }

    /**
     * Subscribe to the next calendar scrub completion before (or while) advancing time.
     * Avoids missing `dsa5.calendarTimeAnimationComplete` when the scrub ends in the same tick.
     * @param {{ timeoutMs?: number, assumeStarted?: boolean }} [options]
     * @returns {Promise<void>}
     */
    static watchTimeAnimation({ timeoutMs, assumeStarted = false } = {}) {
        const timeout = timeoutMs ?? (Math.max(this.ANIMATION_MS_MAX, 12000) + 1500);
        const widget = game.dsa5?.apps?.CalendarWidget;

        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                Hooks.off('dsa5.calendarTimeAnimationComplete', onComplete);
                clearTimeout(timer);
                resolve();
            };

            const onComplete = () => finish();
            Hooks.on('dsa5.calendarTimeAnimationComplete', onComplete);
            const timer = setTimeout(finish, timeout);

            const checkIdle = () => {
                if (settled) return;
                if (!widget?.isAnimatingTime) finish();
            };

            if (assumeStarted) {
                checkIdle();
            } else {
                // Allow updateWorldTime → maybeAnimateTimeChange to mark animating first.
                queueMicrotask(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(checkIdle);
                    });
                });
            }
        });
    }

    /**
     * Start a display-time scrub when world time jumps. World time is already committed.
     * @param {number} worldTime
     * @param {number} dt
     * @returns {boolean} True when animation owns the refresh path
     */
    maybeAnimateTimeChange(worldTime, dt) {
        const skipAnimation = this.constructor.skipNextTimeAnimation;
        if (skipAnimation) this.constructor.skipNextTimeAnimation = false;

        if (!this.rendered || !this.element) {
            this.constructor.pendingAnimationDurationMs = null;
            this.constructor.pendingAnimationLinear = false;
            return false;
        }

        if (skipAnimation) {
            this.constructor.pendingAnimationDurationMs = null;
            this.constructor.pendingAnimationLinear = false;
            if (this.isAnimatingTime) this.terminateTimeAnimation();
            return false;
        }

        const hasPendingDuration = Number.isFinite(this.constructor.pendingAnimationDurationMs);
        if (!hasPendingDuration && !this.constructor.shouldAnimateTimeChange(dt)) return false;

        const endTime = Number(worldTime);
        if (!Number.isFinite(endTime)) {
            this.constructor.pendingAnimationDurationMs = null;
            this.constructor.pendingAnimationLinear = false;
            return false;
        }

        const startTime = this.isAnimatingTime && Number.isFinite(this._animationTime)
            ? this._animationTime
            : endTime - dt;

        this.isAnimatingTime = true;
        void this._runTimeAnimation(startTime, endTime);
        return true;
    }

    async _runTimeAnimation(from, to) {
        const CanvasAnimation = foundry.canvas.animation.CanvasAnimation;
        const duration = this.constructor.animationDurationMs(to - from);
        const useLinear = this.constructor.pendingAnimationLinear;
        this.constructor.pendingAnimationLinear = false;
        const time = { t: from };
        const token = ++this._animationToken;

        this.isAnimatingTime = true;
        this._animationTime = from;
        this._scrubDayTimeKey = null;
        this._scrubWeatherKey = null;
        this._scrubMoonKey = null;
        this._scrubLightKey = null;

        try {
            await CanvasAnimation.animate([{
                parent: time,
                attribute: 't',
                from,
                to,
            }], {
                name: this.constructor.ANIMATION_NAME,
                context: this,
                duration,
                // Linear matches constant-speed token.move; cosine drifts mid-leg vs the map.
                easing: useLinear ? ((t) => t) : CanvasAnimation.easeInOutCosine,
                ontick: () => this._scrubToTime(time.t),
            });
        } catch (error) {
            if (token === this._animationToken) {
                console.warn('dsa5 | Calendar time animation ended early', error);
            }
        } finally {
            if (token !== this._animationToken) return;

			this._scrubToTime(to);
            this.isAnimatingTime = false;
            this._animationTime = null;
            this._scrubDayTimeKey = null;
            this._scrubWeatherKey = null;
            this._scrubMoonKey = null;
            this._scrubLightKey = null;

            // Signal waiters before the remount so travel/rest pacing isn't blocked on render.
            Hooks.callAll('dsa5.calendarTimeAnimationComplete');

            if (this.rendered) await this.render({ force: true });

            // A newer scrub (or terminate) may have started while we remounted.
            if (token !== this._animationToken) return;

            if (DSA5_Utility.isActiveGM(true) && game.canvas) {
                game.time.calendar.constructor.autoDayLight?.();
            }
        }
    }

    /**
     * Abort an in-flight scrub immediately (atlas stop travel / pause).
     * Snaps the widget display to committed world time.
     */
    terminateTimeAnimation() {
        if (!this.isAnimatingTime && this._animationTime == null) return;

        this._animationToken += 1;
        try {
            foundry.canvas.animation.CanvasAnimation.terminate?.(this.constructor.ANIMATION_NAME);
        } catch (error) {
            console.warn('dsa5 | Failed to terminate calendar time animation', error);
        }

        const worldTime = Number(game.time?.worldTime);
        const snapTo = Number.isFinite(worldTime) ? worldTime : this._animationTime;
        this.isAnimatingTime = false;
        this._animationTime = null;
        this._scrubDayTimeKey = null;
        this._scrubWeatherKey = null;
        this._scrubMoonKey = null;
        this._scrubLightKey = null;

        if (Number.isFinite(snapTo) && this.element) {
            this._scrubToTime(snapTo);
        }

        Hooks.callAll('dsa5.calendarTimeAnimationComplete');
    }

    _scrubToTime(animationTime) {
        if (!this.element) return;

        // CanvasAnimation interpolates floats; display/weather keys need whole seconds.
        const scrubTime = Math.floor(animationTime);
        this._animationTime = animationTime;
        const calendar = game.time.calendar;
        const components = calendar.timeToComponents(scrubTime);
        const dayTimeBackground = this.constructor.dayTimeBackground(components);
        const secondsInDay = this.constructor.calculateSecondsInDay(components);
        const progress = Math.round(secondsInDay / this.constructor.SECONDS_PER_DAY * 100);

        const dayProgress = this.element.querySelector('.dayProgress');
        if (dayProgress) {
            dayProgress.style.setProperty('--p', `${progress}%`);
            dayProgress.style.setProperty('--fill-tint', dayTimeBackground.fillColor);
        }

        this._scrubDateLabel(components, dayTimeBackground);
        this._scrubDayTimeIcon(dayTimeBackground);
        this._scrubMoons(components);
        this._scrubWeather(scrubTime, components);
        this._scrubLighting(components, dayTimeBackground);
    }

    _scrubDateLabel(components, dayTimeBackground) {
        const dateLabel = this.element.querySelector('.calendar-date-label');
        if (!dateLabel) return;

        const calendar = game.time.calendar;
        const CalendarClass = calendar.constructor;
        const use24HourFormat = game.settings.get('dsa5', 'calendarSettings').use24HourFormat;
        let dateString = use24HourFormat
            ? CalendarClass.format24Hour(calendar, components)
            : CalendarClass.formatPraiosGefaellig(calendar, components);

        if (!game.user.isGM) {
            const visibility = game.settings.get('dsa5', 'calendarPlayerDateVisibility');
            if (visibility !== 'exact') {
                const datePart = dateString.split(', ').slice(1).join(', ');
                if (visibility === 'rough-time') {
                    const dayTimeLabel = game.i18n.localize(`CALENDAR.DSA.dayTimes.${dayTimeBackground.key}`);
                    dateString = `${dayTimeLabel}, ${datePart}`;
                } else if (visibility === 'date-only') {
                    dateString = datePart;
                }
            }
        }

        dateLabel.textContent = dateString;
    }

    _scrubDayTimeIcon(dayTimeBackground) {
        if (dayTimeBackground.key === this._scrubDayTimeKey) return;
        this._scrubDayTimeKey = dayTimeBackground.key;

        const dayTimeIcon = this.element.querySelector('.calendar-daytime-icon');
        if (dayTimeIcon && dayTimeBackground.icon) {
            dayTimeIcon.className = `${dayTimeBackground.icon} calendar-bookend calendar-daytime-icon`;
            dayTimeIcon.dataset.tooltip = game.i18n.localize(`CALENDAR.DSA.dayTimes.${dayTimeBackground.key}`);
        }
    }

    _scrubMoons(components) {
        const moon = components.moon;
        if (!moon) return;

        const key = `${moon.phaseIndex}:${moon.previousMoon}:${moon.nextMoon}`;
        if (key === this._scrubMoonKey) return;
        this._scrubMoonKey = key;

        const prev = this.element.querySelector('.moon-phase.previous .disc');
        const curr = this.element.querySelector('.moon-phase:not(.previous):not(.next) .disc');
        const next = this.element.querySelector('.moon-phase.next .disc');
        if (prev) prev.className = `disc phase${moon.previousMoon}`;
        if (curr) {
            curr.className = `disc phase${moon.phaseIndex}`;
            if (moon.phase?.name) curr.dataset.tooltip = moon.phase.name;
        }
        if (next) next.className = `disc phase${moon.nextMoon}`;
    }

    _scrubWeather(animationTime, components) {
        const persistor = game.dsa5?.atlas?.weatherPersistor;
        if (!persistor?.peekWeatherAtWorldTime) return;

        const weather = persistor.peekWeatherAtWorldTime(animationTime);
        const phase = weather?.location?.timeOfDay
            ?? `${components.day ?? components.dayOfYear}-${components.hour}`;
        const day = weather?.location?.dayOfYear ?? components.day ?? components.dayOfYear;
        const key = `${day}|${phase}|${weather?.precipitation?.category}|${weather?.cloudCover?.category}|${weather?.wind?.category}`;
        if (key === this._scrubWeatherKey) return;
        this._scrubWeatherKey = key;

        const info = this.constructor.resolveWeatherIcon(weather);
        const weatherIcon = this.element.querySelector('.calendar-weather-icon');
        if (weatherIcon) {
            const canToggle = weatherIcon.dataset.action === 'toggleAutoWeather';
            const autoWeatherEnabled = !canToggle
                || (game.dsa5?.atlas?.shouldAutoUpdateWeather?.() ?? false);
            weatherIcon.className = this.constructor.weatherIconClassName(info, { canToggle, autoWeatherEnabled });
            if (canToggle) weatherIcon.setAttribute('aria-pressed', autoWeatherEnabled ? 'true' : 'false');
            weatherIcon.dataset.tooltip = canToggle
                ? this.constructor.composeWeatherToggleTooltip(info.tooltip, autoWeatherEnabled)
                : info.tooltip;
        }

        if (weather) {
            void game.dsa5?.atlas?.sfx?.control?.(weather);
        }
    }

    _scrubLighting(components, dayTimeBackground) {
        if (!DSA5_Utility.isActiveGM(true) || !game.canvas) return;
        if (dayTimeBackground.key === this._scrubLightKey) return;
        this._scrubLightKey = dayTimeBackground.key;

        game.time.calendar.constructor.autoDayLight?.({
            components,
            animateDarkness: this.constructor.LIGHT_SCRUB_MS,
        });
    }

    async _prepareContext(_options) {
        const data = await super._prepareContext(_options);
        const components = game.time.calendar.timeToComponents(game.time.worldTime);
        const secondsInDay = this.constructor.calculateSecondsInDay(components);

        data.components = components;
        const use24HourFormat = game.settings.get('dsa5', 'calendarSettings').use24HourFormat;
        const dateFormat = use24HourFormat ? 'format24Hour' : 'formatPraiosGefaellig';
        data.dateString = await game.time.calendar.format(game.time.worldTime, dateFormat);
        data.dateTooltip = await game.time.calendar.format(game.time.worldTime, 'formatSeason');
        data.autoLightEnabled = game.settings.get('dsa5', 'calendarSettings').lightByDayTime;
        data.isGM = game.user.isGM;
        data.dayTimeBackground = this.constructor.dayTimeBackground(components);
        data.dayTimeIcon = data.dayTimeBackground.icon || 'fas fa-sun';
        data.dayTimeTooltip = game.i18n.localize(`CALENDAR.DSA.dayTimes.${data.dayTimeBackground.key}`);
        const weatherInfo = this.constructor.resolveWeatherIcon(this.constructor.currentWeather());
        data.weatherIcon = weatherInfo.icon;
        data.weatherAvailable = weatherInfo.available;
        data.canToggleAutoWeather = data.isGM && DSA5_Utility.moduleEnabled('dsa5-atlas')
            && typeof game.dsa5?.atlas?.setAutoWeather === 'function';
        data.autoWeatherEnabled = data.canToggleAutoWeather
            ? (game.dsa5.atlas.shouldAutoUpdateWeather?.() ?? false)
            : true;
        data.weatherIconClass = this.constructor.weatherIconClassName(weatherInfo, {
            canToggle: data.canToggleAutoWeather,
            autoWeatherEnabled: data.autoWeatherEnabled,
        });
        data.dayProgress = Math.round(secondsInDay / this.constructor.SECONDS_PER_DAY * 100);
        data.toggleAutoTime = this.toggleAutoTime;

        if (!data.isGM) {
            const visibility = game.settings.get('dsa5', 'calendarPlayerDateVisibility');
            if (visibility !== 'exact') {
                const datePart = data.dateString.split(', ').slice(1).join(', ');
                if (visibility === 'rough-time') {
                    const dayTimeLabel = game.i18n.localize(`CALENDAR.DSA.dayTimes.${data.dayTimeBackground.key}`);
                    data.dateString = `${dayTimeLabel}, ${datePart}`;
                    data.dateTooltip = data.dateTooltip.replace(/\d{2}:\d{2}:\d{2}/, dayTimeLabel);
                } else if (visibility === 'date-only') {
                    data.dateString = datePart;
                    data.dateTooltip = data.dateTooltip.replace(/ - \d{2}:\d{2}:\d{2}/, '');
                }
            }
            const featureVisibility = game.settings.get('dsa5', 'calendarFeatureVisibility');
            data.canOpenCalendarPicker = this.constructor.FEATURE_TABS.some(tab => featureVisibility[tab]);
            data.canOpenAlmanac = !!featureVisibility.personae;
            data.canOpenEvents = !!featureVisibility.events;
        } else {
            data.canOpenCalendarPicker = true;
            data.canOpenAlmanac = true;
            data.canOpenEvents = true;
        }

        Hooks.call('dsa5.calendarWidgetDataReady', data, this);

        // Prefer the atlas-enriched date tooltip on the weather icon; append sidebar-equivalent toggle hint for GMs.
        data.weatherTooltip = data.canToggleAutoWeather
            ? this.constructor.composeWeatherToggleTooltip(data.dateTooltip, data.autoWeatherEnabled)
            : data.dateTooltip;

        return data;
    }

    static calculateSecondsInDay(components) {
        return components.hour * this.SECONDS_PER_HOUR +
            components.minute * 60 +
            components.second;
    }

    /**
     * Resolve which picker tab to open for the current user.
     * @param {string|null} [preferredTab] Explicit tab (shortcut buttons), or null for first allowed.
     * @param {object} [featureVisibility]
     * @returns {string|null}
     */
    static resolveOpenTab(preferredTab = null, featureVisibility = game.settings.get('dsa5', 'calendarFeatureVisibility')) {
        if (game.user.isGM) return preferredTab || 'calendar';

        if (preferredTab) return featureVisibility[preferredTab] ? preferredTab : null;

        return this.FEATURE_TABS.find(tab => featureVisibility[tab]) ?? null;
    }

    static editCalendar(ev, target) {
        if (this.wasDragging) {
            this.wasDragging = false;
            return;
        }

        this.constructor.openCalendarPicker(null);
    }

    static openAlmanac() {
        this.constructor.openCalendarPicker('personae');
    }

    static openEvents() {
        this.constructor.openCalendarPicker('events');
    }

    static async openCalendarPicker(tab = null) {
        const resolvedTab = this.resolveOpenTab(tab);
        if (!resolvedTab) return;

        const picker = game.dsa5.apps.CalendarPicker;
        picker.tabGroups.sheet = resolvedTab;
        await picker.render({ force: true });
        if (picker.rendered) picker.changeTab(resolvedTab, 'sheet');
    }

    timeAdvance(seconds, ev) {
        this._pinAdvanceMenu = true;
        if (ev?.button === 2) {
            ev.preventDefault?.();
            this.constructor.skipNextTimeAnimation = true;
        }
        const components = game.time.calendar.timeToComponents(game.time.worldTime);
        const adjustment = components.second;
        game.time.advance(seconds + - adjustment);
    }

    static weekBack(ev) { this.timeAdvance(-this.constructor.SECONDS_PER_DAY * 7, ev); }
    static dayBack(ev) { this.timeAdvance(-this.constructor.SECONDS_PER_DAY, ev); }
    static hours6Back(ev) { this.timeAdvance(-6 * this.constructor.SECONDS_PER_HOUR, ev); }
    static hourBack(ev) { this.timeAdvance(-this.constructor.SECONDS_PER_HOUR, ev); }
    static mins30Back(ev) { this.timeAdvance(-1800, ev); }
    static minBack(ev) { this.timeAdvance(-60, ev); }
    static minForward(ev) { this.timeAdvance(60, ev); }
    static mins30Forward(ev) { this.timeAdvance(1800, ev); }
    static hourForward(ev) { this.timeAdvance(this.constructor.SECONDS_PER_HOUR, ev); }
    static hours6Forward(ev) { this.timeAdvance(6 * this.constructor.SECONDS_PER_HOUR, ev); }
    static dayForward(ev) { this.timeAdvance(this.constructor.SECONDS_PER_DAY, ev); }
    static weekForward(ev) { this.timeAdvance(this.constructor.SECONDS_PER_DAY * 7, ev); }

    static onToggleAutoTime(ev, target) {
        if (!DSA5_Utility.isActiveGM()) return;

        this.toggleAutoTime = !this.toggleAutoTime;

        target.classList.toggle('fas', this.toggleAutoTime);
        target.classList.toggle('far', !this.toggleAutoTime);
        target.classList.toggle('is-active', this.toggleAutoTime);
        target.setAttribute('aria-pressed', this.toggleAutoTime ? 'true' : 'false');

        this.autoInterval = this.toggleAutoTime ? setInterval(() => {
            if (!game.paused && !game.combat) game.time.advance(15);
        }, 15000) : clearInterval(this.autoInterval);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        if (!game.user.isGM) return;

        this._setupDragHandlers();
        this.element.querySelectorAll('.calendar-step').forEach((el) => {
            el.addEventListener('contextmenu', (ev) => ev.preventDefault());
        });
        this._restoreAdvanceMenuAfterRerender();
    }

    static async toggleAutoLight(ev, target) {
        const calendarSettings = game.settings.get('dsa5', 'calendarSettings');
        calendarSettings.lightByDayTime = !calendarSettings.lightByDayTime;

        await game.settings.set('dsa5', 'calendarSettings', calendarSettings);
        target.classList.toggle('fa-toggle-on', calendarSettings.lightByDayTime);
        target.classList.toggle('fa-toggle-off', !calendarSettings.lightByDayTime);
    }

    static composeWeatherToggleTooltip(weatherTooltip, autoWeatherEnabled) {
        const status = game.i18n.localize(autoWeatherEnabled
            ? 'DEREATLAS.CONTROLS.AutoWeatherEnabled'
            : 'DEREATLAS.CONTROLS.AutoWeatherDisabled');
        const action = game.i18n.localize('DEREATLAS.CONTROLS.ToggleAutoWeather');
        return [weatherTooltip, `${action} (${status})`].filter(Boolean).join(' — ');
    }

    static async toggleAutoWeather(ev, target) {
        if (!DSA5_Utility.isActiveGM()) return;

        const atlas = game.dsa5?.atlas;
        if (typeof atlas?.setAutoWeather !== 'function') return;

        // Same semantics as the sidebar tool: onChange(event, active) with the desired next state.
        const next = !(atlas.shouldAutoUpdateWeather?.() ?? false);
        const enabled = await atlas.setAutoWeather(next);
        if (enabled == null) return;

        const info = this.constructor.resolveWeatherIcon(this.constructor.currentWeather());
        target.className = this.constructor.weatherIconClassName(info, {
            canToggle: true,
            autoWeatherEnabled: enabled,
        });
        target.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        target.dataset.tooltip = this.constructor.composeWeatherToggleTooltip(info.tooltip, enabled);
    }

    /**
     * After a time-step remount, CSS :hover may not apply until the next pointer move.
     * Briefly force-open, then drop the class so only real :hover keeps the menu open.
     */
    _restoreAdvanceMenuAfterRerender() {
        const root = this.element.querySelector('.calendar-widget-content');
        if (!root || !this._pinAdvanceMenu) return;
        this._pinAdvanceMenu = false;

        root.classList.add('is-expanded');

        const releasePin = () => {
            if (root.isConnected) root.classList.remove('is-expanded');
        };

        requestAnimationFrame(() => requestAnimationFrame(releasePin));
        clearTimeout(this._advanceMenuLeaveTimer);
        this._advanceMenuLeaveTimer = setTimeout(releasePin, this.constructor.ADVANCE_MENU_LEAVE_MS);
        root.addEventListener('pointerleave', releasePin, { once: true });
    }

    _teardownDragHandlers() {
        const doc = this.element?.ownerDocument;
        if (this._onDocumentMouseMove) {
            doc?.removeEventListener('mousemove', this._onDocumentMouseMove);
            this._onDocumentMouseMove = null;
        }
        if (this._onDocumentMouseUp) {
            doc?.removeEventListener('mouseup', this._onDocumentMouseUp);
            this._onDocumentMouseUp = null;
        }
        if (this._onDocumentContextMenu) {
            doc?.removeEventListener('contextmenu', this._onDocumentContextMenu);
            this._onDocumentContextMenu = null;
        }
    }

    _setupDragHandlers() {
        this._teardownDragHandlers();

        const indicator = this.element.querySelector('.slideIndicator');
        const container = this.element.querySelector('.dayProgress');
        if (!indicator || !container) return;

        indicator.addEventListener('mousedown', this._handleMouseDown.bind(this));
        indicator.addEventListener('contextmenu', (e) => e.preventDefault());
        // Keep scrubbing even if the pointer leaves the small icon while dragging
        this._onDocumentMouseMove = (e) => this._handleMouseMove(container, indicator, e);
        this._onDocumentMouseUp = (e) => this._handleMouseUp(e);
        this._onDocumentContextMenu = (e) => {
            if (!this.isDragging && !this._suppressContextMenu) return;
            e.preventDefault();
            this._suppressContextMenu = false;
        };
        this.element.ownerDocument.addEventListener('mousemove', this._onDocumentMouseMove);
        this.element.ownerDocument.addEventListener('mouseup', this._onDocumentMouseUp);
        this.element.ownerDocument.addEventListener('contextmenu', this._onDocumentContextMenu);
    }

    _handleMouseDown(e) {
        if (e.button !== 0 && e.button !== 2) return;

        this.isDragging = true;
        this.wasDragging = false;
        this._skipTimeAnimation = e.button === 2;
        this._suppressContextMenu = e.button === 2;
        e.preventDefault();
        e.stopPropagation();
    }

    _handleMouseMove(container, _indicator, e) {
        if (!this.isDragging) return;

        this.wasDragging = true;

        const containerRect = container.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(100, ((e.clientX - containerRect.left) / containerRect.width) * 100));

        container.style.setProperty('--p', `${percentage}%`);
        this.currentPercentage = percentage;

        this._updateTimeIndicator(container, percentage);
    }

    _updateTimeIndicator(container, percentage) {
        const secondsInDay = this.constructor.SECONDS_PER_DAY * percentage / 100.0;
        const hour = Math.floor(secondsInDay / this.constructor.SECONDS_PER_HOUR) || 0;
        const minute = Math.floor((secondsInDay % this.constructor.SECONDS_PER_HOUR) / 60) || 0;
        const second = Math.floor(secondsInDay % 60) || 0;

        const dayTimeBackground = this.constructor.dayTimeBackground({ hour, minute, second });
        const use24HourFormat = game.settings.get('dsa5', 'calendarSettings').use24HourFormat;
        let timeString;
        if (use24HourFormat) {
            timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
        } else {
            const fullComponents = game.time.calendar.timeToComponents(game.time.worldTime);
            fullComponents.hour = hour;
            fullComponents.minute = minute;
            fullComponents.second = second;
            timeString = game.time.calendar.constructor.formatPraiosGefaellig(game.time.calendar, fullComponents).split(', ')[0];
        }

        container.style.setProperty('--fill-tint', dayTimeBackground.fillColor);
        const dateLabel = this.element.querySelector('.calendar-date-label');
        if (dateLabel) {
            const current = dateLabel.textContent || '';
            const comma = current.indexOf(', ');
            dateLabel.textContent = comma >= 0 ? `${timeString}${current.slice(comma)}` : timeString;
        }
        const dayTimeIcon = this.element.querySelector('.calendar-daytime-icon');
        if (dayTimeIcon && dayTimeBackground.icon) {
            dayTimeIcon.className = `${dayTimeBackground.icon} calendar-bookend calendar-daytime-icon`;
        }
    }

    _handleMouseUp(ev) {
        if (!this.isDragging) return;

        this.isDragging = false;
        const skipAnimation = this._skipTimeAnimation;
        this._skipTimeAnimation = false;
        if (this._suppressContextMenu) {
            setTimeout(() => { this._suppressContextMenu = false; }, 0);
        }
        ev.preventDefault();
        ev.stopPropagation();

        const components = game.time.calendar.timeToComponents(game.time.worldTime);
        const currentSeconds = this.constructor.calculateSecondsInDay(components);
        const newSeconds = this.constructor.SECONDS_PER_DAY * this.currentPercentage / 100.0;

        if (isNaN(newSeconds)) return;

        const advanceTime = Math.floor(newSeconds - currentSeconds);
        if (advanceTime === 0) return;

        if (skipAnimation) this.constructor.skipNextTimeAnimation = true;
        game.time.advance(advanceTime);
    }
}
