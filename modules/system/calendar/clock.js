import DSA5_Utility from '../helpers/utility-dsa5.js';

/**
 * Calendar clock: world-time units, calendar settings, and automatic time.
 * Does not extend Foundry's GameTime — `game.time` is a sealed core singleton.
 * Future timers and scheduled advances belong here, then call `game.time.advance`.
 */
export class DSAClock {
    static SETTING = 'calendarSettings';
    /** Game-time seconds advanced per auto-time tick (1:1 with real time). */
    static AUTO_TIME_SECONDS = 15;
    static AUTO_TIME_INTERVAL_MS = this.AUTO_TIME_SECONDS * 1000;

    static get days() {
        return game.time?.calendar?.days ?? {
            secondsPerMinute: 60,
            minutesPerHour: 60,
            hoursPerDay: 24,
        };
    }

    static get secondsPerMinute() {
        return this.days.secondsPerMinute;
    }

    static get minutesPerHour() {
        return this.days.minutesPerHour;
    }

    static get hoursPerDay() {
        return this.days.hoursPerDay;
    }

    static get secondsPerHour() {
        return this.secondsPerMinute * this.minutesPerHour;
    }

    static get secondsPerDay() {
        return this.secondsPerHour * this.hoursPerDay;
    }

    static secondsInDay(components) {
        return components.hour * this.secondsPerHour
            + components.minute * this.secondsPerMinute
            + components.second;
    }

    /** Typical overnight rest; clamped to the calendar day in {@link nightRestHours}. */
    static NIGHT_REST_HOURS = 8;

    static nightRestHours() {
        return Math.min(this.NIGHT_REST_HOURS, this.hoursPerDay);
    }

    /**
     * Convert a duration into world-time seconds using the active calendar day length.
     * @param {number|{seconds?:number, minutes?:number, hours?:number, days?:number}} amount
     * @returns {number}
     */
    static toSeconds(amount = 0) {
        if (typeof amount === 'number') return Math.round(amount) || 0;
        const seconds = Number(amount.seconds) || 0;
        const minutes = Number(amount.minutes) || 0;
        const hours = Number(amount.hours) || 0;
        const days = Number(amount.days) || 0;
        return Math.round(
            seconds
            + minutes * this.secondsPerMinute
            + hours * this.secondsPerHour
            + days * this.secondsPerDay,
        );
    }

    /**
     * Advance (or rewind) world time. Returns the seconds actually applied (0 if none).
     * Callers that should stay quiet must not post chat; this only moves `game.time`.
     * @param {number|{seconds?:number, minutes?:number, hours?:number, days?:number}} amount
     * @returns {Promise<number>}
     */
    static async advance(amount) {
        const seconds = this.toSeconds(amount);
        if (!seconds) return 0;
        await game.time.advance(seconds);
        return seconds;
    }

    static settings() {
        return game.settings.get('dsa5', this.SETTING) ?? {};
    }

    static async setSettings(settings) {
        await game.settings.set('dsa5', this.SETTING, settings);
        return settings;
    }

    static async patchSettings(patch) {
        const settings = foundry.utils.mergeObject(this.settings(), patch, { inplace: false });
        return this.setSettings(settings);
    }

    static shouldRestoreAutoTime(settings = this.settings()) {
        return !!settings.rememberAutoTime && !!settings.autoTimeEnabled;
    }

    static async persistAutoTimeEnabled(enabled) {
        const settings = foundry.utils.deepClone(this.settings());
        if (!settings.rememberAutoTime) return false;
        if (!!settings.autoTimeEnabled === !!enabled) return false;
        settings.autoTimeEnabled = !!enabled;
        await this.setSettings(settings);
        return true;
    }

    enabled = false;
    #interval;
    #initialized = false;

    get running() {
        return !!this.#interval;
    }

    ensureInitialized() {
        if (this.#initialized) return this.enabled;
        this.#initialized = true;
        return this.restoreRemembered();
    }

    restoreRemembered() {
        return this.setEnabled(this.constructor.shouldRestoreAutoTime());
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
        this.#syncInterval();
        return this.enabled;
    }

    resume() {
        if (this.enabled && !this.#interval) this.#syncInterval();
    }

    stop() {
        if (!this.#interval) return;
        clearInterval(this.#interval);
        this.#interval = undefined;
    }

    #syncInterval() {
        this.stop();
        if (!this.enabled || !DSA5_Utility.isActiveGM(true)) return;

        const { AUTO_TIME_SECONDS, AUTO_TIME_INTERVAL_MS } = this.constructor;
        this.#interval = setInterval(() => {
            if (!DSA5_Utility.isActiveGM(true) || game.paused || game.combat) return;
            game.time.advance(AUTO_TIME_SECONDS);
        }, AUTO_TIME_INTERVAL_MS);
    }
}
