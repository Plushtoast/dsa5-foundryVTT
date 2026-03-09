/**
 * Calendar visualization using PixiJS
 * @class
 */
export class CalendarCanvas {
    static DEFAULT_SIZE = 700;

    /**
     * @param {HTMLElement} parentElement - Element to attach the canvas to
     * @param {Function} callback - Called when user clicks on a calendar element
     * @param {Function} hoverCallback - Called when user hovers over calendar elements
     */
    constructor(parent, parentElement, callback, hoverCallback) {
        this.parent = parent;
        this.element = parentElement;
        this.callback = callback;
        this.hoverCallback = hoverCallback;

        // PixiJS components
        this.app = null;
        this.stage = null;
        this.containers = {
            background: null,
            seasons: null,
            months: null,
            monthSprites: null,
            days: null,
            weekdays: null,
            moonPhase: null,
            highlights: null
        };

        // State
        this.hoveredSection = null;
        this.isDestroyed = false;
        this.spritesheet = null;
        this.initialized = false;
        this.textureCache = new Map(); // Cache for generated textures

        // Event handlers (bound once)
        this.throttledMouseMove = this._throttle(this._handleMouseMove.bind(this), 16);
        this._boundMouseLeave = this._handleMouseLeave.bind(this);
        this._boundClick = this._handleClick.bind(this);

        // Constants
        this._initializeConstants();

        // Data containers
        this.calendarData = null;
        this.precalculated = this._initializePrecalculated();
    }

    _initializeConstants() {
        const scale = Number(this.element.getAttribute('width')) / CalendarCanvas.DEFAULT_SIZE;

        this.RADIUS = Object.freeze({
            OUTER: 300 * scale,
            DAYS: 260 * scale,
            WEEKDAYS: 140 * scale,
            OUTER_FRAME: 315 * scale,
            SEASONS: 280 * scale
        });

        this.AREASIZES = Object.freeze({
            THREE: 3 * scale,
            FIVE: 5 * scale,
            SIX: 6 * scale,
            EIGHT: 8 * scale,
            NINE: 9 * scale,
            TEN: 10 * scale,
            TWENTY: 20 * scale,
            TWENTYFIVE: 25 * scale,
            FIFTEEN: 15 * scale,
            SIXTY: 60 * scale,
            HUNDRED: 100 * scale
        });

        this.COLORS = Object.freeze({
            BACKGROUND_INNER: 0x1a1a1a,
            BACKGROUND_OUTER: 0x000000,
            BORDER_OUTER: 0x888888,
            BORDER_INNER: 0x555555,
            TEXT_NORMAL: 0xe0c080,
            TEXT_HIGHLIGHT: 0xffcc00,
            DOT_NORMAL: 0xfff6d0,
            HIGHLIGHT_BG: 0xffcc00,
            HIGHLIGHT_MOON: 0xffffff,
        });

        this.SEASON_GRADIENTS = Object.freeze([
            { start: "F7E8BF", end: "E5C266" }, // Summer
            { start: "E6C7A6", end: "C4784A" }, // Fall
            { start: "CAE0F2", end: "7DA8CC" }, // Winter
            { start: "C7E8C7", end: "73BA7A" }, // Spring
            { start: "F7E8BF", end: "E5C266" }, // Summer (repeated)
            { start: "383838", end: "121212" }  // Namenlose Tage
        ]);

        this.textureMatcher = Object.freeze({
            0: 'praios',
            1: 'rondra',
            2: 'efferd',
            3: 'travia',
            4: 'boron',
            5: 'hesinde',
            6: 'firun',
            7: 'tsa',
            8: 'phex',
            9: 'peraine',
            10: 'ingerimm',
            11: 'rahja',
            12: 'namenlos'
        });

        this.MOON_POSITIONS = Object.freeze([
            { x: 0, y: 1 },                         // New Moon (bottom)
            { x: -Math.cos(Math.PI / 4), y: Math.sin(Math.PI / 4) },  // Waxing Crescent
            { x: -1, y: 0 },                        // First Quarter (left)
            { x: -Math.cos(Math.PI / 4), y: -Math.sin(Math.PI / 4) }, // Waxing Gibbous
            { x: 0, y: -1 },                        // Full Moon (top)
            { x: Math.cos(Math.PI / 4), y: -Math.sin(Math.PI / 4) },  // Waning Gibbous
            { x: 1, y: 0 },                         // Last Quarter (right)
            { x: Math.cos(Math.PI / 4), y: Math.sin(Math.PI / 4) }    // Waning Crescent
        ]);

        this.FONT_STYLE = Object.freeze({
            MONTHS: {
                fontFamily: 'Garamond',
                fontSize: Math.round(16 * scale),
                fill: this.COLORS.TEXT_NORMAL,
                align: 'center'
            },
            WEEKDAYS: {
                fontFamily: 'Garamond',
                fontSize: Math.round(14 * scale),
                fill: this.COLORS.TEXT_NORMAL,
                align: 'center'
            }
        });
    }

    _initializePrecalculated() {
        return {
            monthAngles: [],
            dayAngles: [],
            weekdayAngles: [],
            seasonAngles: [],
            moonAngles: [],
            angleOffsets: {
                month: 0,
                day: 0,
                weekday: 0
            },
            hitRegions: {
                month: { min: this.RADIUS.OUTER - this.AREASIZES.TEN, max: this.RADIUS.OUTER + this.AREASIZES.TEN },
                day: { center: this.RADIUS.DAYS, tolerance: this.AREASIZES.TEN },
                weekday: { center: this.RADIUS.WEEKDAYS, tolerance: this.AREASIZES.TEN },
                moon: { centerX: 0, centerY: 0, radius: this.AREASIZES.TWENTY }
            }
        };
    }

    /**
     * Throttle function execution
     * @private
     */
    _throttle(func, limit) {
        let lastCall = 0;
        return (...args) => {
            const now = Date.now();
            if (now - lastCall >= limit) {
                lastCall = now;
                func.apply(this, args);
            }
        };
    }

    /**
     * Render the calendar
     * @async
     */
    async render() {
        try {
            this._setupPixiApp();
            await this._prepareData();
            this._precalculateValues();
            await this._loadTextures();
            this._createContainers();
            this._renderStaticElements();
            this._setupEventListeners();
            this.initialized = true;
        } catch (error) {
            console.error('Error rendering calendar:', error);
            throw error;
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.isDestroyed = true;
        this.initialized = false;

        this._removeEventListeners();

        // Clear texture cache
        this.textureCache.forEach(texture => texture.destroy(true));
        this.textureCache.clear();

        if (this.app) {
            this.app.destroy(true, {
                children: true,
            });
            this.app = null;
        }
    }

    _setupPixiApp() {
        if (this.app) return;

        const dpr = 1; //window.devicePixelRatio || 1;
        const options = {
            width: Number(this.element.getAttribute('width')) * dpr,
            height: Number(this.element.getAttribute('height')) * dpr,
            backgroundColor: this.COLORS.BACKGROUND_OUTER,
            antialias: true,
            resolution: dpr,
            autoDensity: true,
            powerPreference: "high-performance",
            autoStart: true
        };

        this.app = new PIXI.Application(options);
        this.element.appendChild(this.app.view);
        this.stage = this.app.stage;
        this.centerX = this.app.screen.width / 2;
        this.centerY = this.app.screen.height / 2;
    }

    _removeEventListeners() {
        if (!this.app?.view) return;

        this.app.view.removeEventListener('mousemove', this.throttledMouseMove);
        this.app.view.removeEventListener('mouseleave', this._boundMouseLeave);
        this.app.view.removeEventListener('click', this._boundClick);
    }

    async _prepareData() {
        const calendar = game.time.calendar;
        const components = this.parent.actualTimeComponents();
        const daysPerYear = calendar.days.daysPerYear;

        // Calculate seasons
        const seasons = this._calculateSeasons(calendar, daysPerYear);

        this.calendarData = {
            months: this._getLocalizedArray(calendar.months.values, calendar.translationPrefix),
            weekdays: this._getLocalizedArray(calendar.days.values, calendar.translationPrefix),
            currentMonth: components.month,
            currentDay: components.dayOfMonth,
            currentWeekday: components.dayOfWeek,
            currentMoon: components.moon.phaseIndex || 0,
            daysInMonth: calendar.months.values[components.month].days,
            seasons: this._adjustSeasonsForRotation(seasons, components, calendar, daysPerYear),
            moons: calendar.moon.values.map(moon => moon.name),
        };

        // Rotate arrays to start with current elements
        this.calendarData.months = this._rotateArray(this.calendarData.months, this.calendarData.currentMonth);
        this.calendarData.weekdays = this._rotateArray(this.calendarData.weekdays, this.calendarData.currentWeekday);
        this.calendarData.moons = this._rotateArray(this.calendarData.moons, components.moon?.phase?.index || 0);
    }

    _getLocalizedArray(values, translationPrefix) {
        return values.map(item => _loc(`${translationPrefix}.${item.name}`));
    }

    _calculateSeasons(calendar, daysPerYear) {
        const seasons = new Array(calendar.seasons.values.length);
        let cumulativeAngle = 0;

        for (let i = 0; i < calendar.seasons.values.length; i++) {
            const season = calendar.seasons.values[i];
            const nextSeason = calendar.seasons.values[i + 1];

            const days = this._calculateSeasonDays(season, nextSeason, calendar);
            const angle = days / daysPerYear * 2 * Math.PI;
            const startAngle = cumulativeAngle;
            cumulativeAngle += angle;

            seasons[i] = {
                angle,
                startAngle,
                endAngle: cumulativeAngle,
                gradient: this.SEASON_GRADIENTS[i]
            };
        }

        return seasons;
    }

    _calculateSeasonDays(season, nextSeason, calendar) {
        if (!nextSeason) {
            return calendar.months.values[season.monthStart].days;
        }

        let days = calendar.months.values[season.monthStart].days - season.dayStart;

        for (let j = season.monthStart + 1; j < nextSeason.monthStart; j++) {
            days += calendar.months.values[j].days;
        }

        return days + nextSeason.dayStart;
    }

    _adjustSeasonsForRotation(seasons, components, calendar, daysPerYear) {
        // Pre-calculate current month start angle once
        let currentMonthStartAngle = 0;
        for (let i = 0; i < components.month; i++) {
            currentMonthStartAngle += (calendar.months.values[i].days / daysPerYear) * 2 * Math.PI;
        }

        const TWO_PI = 2 * Math.PI;

        return seasons.map(season => {
            const startAngle = (season.startAngle - currentMonthStartAngle + TWO_PI) % TWO_PI;
            const endAngle = (season.endAngle - currentMonthStartAngle + TWO_PI) % TWO_PI;

            return {
                ...season,
                startAngle,
                endAngle
            };
        });
    }

    _rotateArray(array, startIndex) {
        if (startIndex === 0) return array;
        return [...array.slice(startIndex), ...array.slice(0, startIndex)];
    }

    _precalculateValues() {
        const { months, weekdays, daysInMonth } = this.calendarData;

        // Cache angle offsets
        this.precalculated.angleOffsets = {
            month: Math.PI / months.length,
            day: Math.PI / daysInMonth,
            weekday: Math.PI / weekdays.length
        };

        // Precalculate all positions at once
        this.precalculated.monthAngles = this._calculateMonthAngles(months.length);
        this.precalculated.dayAngles = this._calculateDayAngles(daysInMonth);
        this.precalculated.weekdayAngles = this._calculateWeekdayAngles(weekdays.length);
        this.precalculated.seasonAngles = this._calculateSeasonAngles();
        this.precalculated.moonAngles = this._calculateMoonAngles(this.calendarData.moons.length);

        // Precalculate hit detection lookup tables
        this._precalculateHitDetection();
    }

    _precalculateHitDetection() {
        const SEGMENTS = 360;
        const TWO_PI = 2 * Math.PI;

        // Use typed arrays for better performance
        this.hitDetectionLookup = {
            month: new Int16Array(SEGMENTS),
            day: new Int16Array(SEGMENTS),
            weekday: new Int16Array(SEGMENTS)
        };
        const angleOffsets = this.precalculated.angleOffsets;
        // Generate month hit detection
        const monthCount = this.calendarData.months.length;
        const monthStep = TWO_PI / monthCount;
        for (let i = 0; i < SEGMENTS; i++) {
            const angle = (i / SEGMENTS) * TWO_PI + angleOffsets.month;
            this.hitDetectionLookup.month[i] = Math.floor(angle / monthStep) % monthCount;
        }

        // Generate day hit detection
        const dayCount = this.calendarData.daysInMonth;
        const dayStep = TWO_PI / dayCount;
        for (let i = 0; i < SEGMENTS; i++) {
            const angle = (i / SEGMENTS) * TWO_PI + angleOffsets.day;
            this.hitDetectionLookup.day[i] = Math.floor(angle / dayStep) % dayCount;
        }

        // Generate weekday hit detection
        const weekdayCount = this.calendarData.weekdays.length;
        const weekdayStep = TWO_PI / weekdayCount;
        for (let i = 0; i < SEGMENTS; i++) {
            const angle = (i / SEGMENTS) * TWO_PI + angleOffsets.weekday;
            this.hitDetectionLookup.weekday[i] = Math.floor(angle / weekdayStep) % weekdayCount;
        }
    }

    _calculateMoonAngles(moonCount) {
        const angles = new Array(moonCount);
        const angleStep = 2 * Math.PI / moonCount;
        const moonOffset = Math.PI / 2;

        for (let i = 0; i < moonCount; i++) {
            const angle = angleStep * i - moonOffset;
            angles[i] = {
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.OUTER,
                y: this.centerY + Math.sin(angle) * this.RADIUS.OUTER
            };
        }

        return angles;
    }

    _calculateMonthAngles(monthCount) {
        const angles = new Array(monthCount);
        const angleStep = 2 * Math.PI / monthCount;
        const currentMonth = this.calendarData.currentMonth;

        for (let i = 0; i < monthCount; i++) {
            const angle = angleStep * i - Math.PI / 2;
            const startAngle = angleStep * i;
            const endAngle = angleStep * (i + 1);
            const originalIndex = (currentMonth + i) % monthCount;

            angles[i] = {
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.OUTER,
                y: this.centerY + Math.sin(angle) * this.RADIUS.OUTER,
                startAngle,
                endAngle,
                originalIndex
            };
        }

        return angles;
    }

    _calculateDayAngles(dayCount) {
        const angles = new Array(dayCount);
        const angleStep = 2 * Math.PI / dayCount;

        for (let i = 0; i < dayCount; i++) {
            const angle = angleStep * i - Math.PI / 2;
            angles[i] = {
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.DAYS,
                y: this.centerY + Math.sin(angle) * this.RADIUS.DAYS
            };
        }

        return angles;
    }

    _calculateWeekdayAngles(weekdayCount) {
        const angles = new Array(weekdayCount);
        const angleStep = 2 * Math.PI / weekdayCount;

        for (let i = 0; i < weekdayCount; i++) {
            const angle = angleStep * i - Math.PI / 2;
            angles[i] = {
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.WEEKDAYS,
                y: this.centerY + Math.sin(angle) * this.RADIUS.WEEKDAYS,
                startAngle: angleStep * i,
                endAngle: angleStep * (i + 1)
            };
        }

        return angles;
    }

    _calculateSeasonAngles() {
        const seasonAngleOffset = 15 / 365 * 2 * Math.PI;
        const HALF_PI = Math.PI / 2;

        return this.calendarData.seasons.map(season => ({
            startAngle: season.startAngle - HALF_PI - seasonAngleOffset,
            endAngle: season.endAngle - HALF_PI - seasonAngleOffset,
            gradient: season.gradient
        }));
    }

    async _loadTextures() {
        if (this.spritesheet) return;

        this.spritesheet = {};

        try {
            const toLoad = ["systems/dsa5/icons/textures/calendar.json"];
            await foundry.canvas.TextureLoader.loader.load(toLoad);

            for (const path of toLoad) {
                const spritesheet = foundry.canvas.getTexture(path);
                if (spritesheet && spritesheet.textures) {
                    Object.assign(this.spritesheet, spritesheet.textures);
                }
            }
        } catch (error) {
            console.warn('Failed to load textures:', error);
        }
    }

    _createContainers() {
        if (this.containers.background) return;

        // Create container hierarchy with appropriate z-index
        const containerOrder = [
            'background',
            'seasons',
            'monthSprites',
            'months',
            'days',
            'weekdays',
            'moonPhase',
            'highlights'
        ];

        const containers = {};
        for (const key of containerOrder) {
            containers[key] = new PIXI.Container();
            this.stage.addChild(containers[key]);
        }

        this.containers = containers;
    }

    _renderStaticElements() {
        if (!this.initialized) {
            this._drawBackground();
            this._drawBorders();
            this._drawNorthMarker();
        }

        this._drawSeasons();
        this._drawMonths();
        this._drawMoonPhase();
        this._drawWeekdays();
        this._drawDays();
    }

    _drawBackground() {
        const background = new PIXI.Graphics();
        this.containers.background.addChild(background);

        // Add background image if available
        if (this.spritesheet) {
            const bgSprite = new PIXI.Sprite(this.spritesheet.bg_goetterkreis);
            bgSprite.anchor.set(0.5);
            bgSprite.width = bgSprite.height = this.RADIUS.OUTER * 2;
            bgSprite.position.set(this.centerX, this.centerY + this.AREASIZES.EIGHT);

            const godring = new PIXI.Sprite(this.spritesheet.rad_goetterkreis);
            godring.anchor.set(0.5);
            godring.width = godring.height = this.RADIUS.WEEKDAYS * 4.2;
            godring.position.set(this.centerX + 1, this.centerY + this.AREASIZES.NINE);

            const godringMask = new PIXI.Graphics();
            godringMask.beginFill(0x000000);
            godringMask.drawCircle(this.centerX, this.centerY, this.RADIUS.WEEKDAYS + this.AREASIZES.FIFTEEN);
            godringMask.endFill();

            godring.mask = godringMask;

            // Create a blend mask for the background image
            const blendMask = new PIXI.Graphics();
            blendMask.beginFill(0x000000);
            blendMask.drawCircle(this.centerX, this.centerY, this.RADIUS.WEEKDAYS + this.AREASIZES.FIFTEEN);
            blendMask.endFill();
            blendMask.beginHole();
            blendMask.drawCircle(this.centerX, this.centerY, this.RADIUS.WEEKDAYS - this.AREASIZES.FIFTEEN);
            blendMask.endHole();

            this.containers.background.addChild(godringMask);
            this.containers.background.addChild(bgSprite);
            this.containers.background.addChild(godring);
            this.containers.background.addChild(blendMask);
        }
    }

    _drawSeasons() {
        this.containers.seasons.removeChildren();
        const HALF_PI = Math.PI / 2;

        for (const season of this.precalculated.seasonAngles) {
            const seasons = new PIXI.Graphics();
            this._drawArcSegment(
                seasons,
                this.RADIUS.SEASONS - this.AREASIZES.SIX,
                this.RADIUS.SEASONS + this.AREASIZES.SIX,
                season.startAngle + HALF_PI,
                season.endAngle + HALF_PI,
                season.gradient,
                1
            );
            this.containers.seasons.addChild(seasons);
        }
    }

    /**
     * Draw an arc segment with optional gradient
     * @private
     */
    _drawArcSegment(graphics, innerRadius, outerRadius, startAngle, endAngle, gradient = null, alpha = 0.3) {
        const startAngleAdjusted = startAngle - Math.PI / 2;
        const endAngleAdjusted = endAngle - Math.PI / 2;

        graphics.beginFill(0xFFFFFF, alpha);
        graphics.moveTo(
            this.centerX + outerRadius * Math.cos(startAngleAdjusted),
            this.centerY + outerRadius * Math.sin(startAngleAdjusted)
        );
        graphics.arc(this.centerX, this.centerY, outerRadius, startAngleAdjusted, endAngleAdjusted);
        graphics.lineTo(
            this.centerX + innerRadius * Math.cos(endAngleAdjusted),
            this.centerY + innerRadius * Math.sin(endAngleAdjusted)
        );
        graphics.arc(this.centerX, this.centerY, innerRadius, endAngleAdjusted, startAngleAdjusted, true);
        graphics.closePath();
        graphics.endFill();

        if (!gradient) return;

        // Cache gradient textures for reuse
        const gradientKey = `${gradient.start}_${gradient.end}_${outerRadius}_${innerRadius}`;

        let gradientTexture = this.textureCache.get(gradientKey);
        if (!gradientTexture) {
            gradientTexture = this._createRingGradientTexture(outerRadius, innerRadius, [
                { offset: 0, color: `#${gradient.start}` },
                { offset: 1, color: `#${gradient.end}` }
            ]);
            this.textureCache.set(gradientKey, gradientTexture);
        }

        const gradientSprite = new PIXI.Sprite(gradientTexture);
        gradientSprite.anchor.set(0.5);
        gradientSprite.position.set(this.centerX, this.centerY);
        gradientSprite.width = gradientSprite.height = outerRadius * 2;
        gradientSprite.alpha = alpha;
        gradientSprite.mask = graphics; // Use the drawn arc as a mask
        this.containers.seasons.addChild(gradientSprite);
    }

    /**
     * Create a ring-shaped gradient texture
     * @private
     */
    _createRingGradientTexture(radius, innerRadius, colorStops) {
        const canvasSize = radius * 2;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(
            radius, radius, innerRadius,  // Inner circle (center, radius a)
            radius, radius, radius        // Outer circle (center, radius b)
        );

        colorStops.forEach(stop => {
            gradient.addColorStop(stop.offset, stop.color);
        });

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        return PIXI.Texture.from(canvas);
    }

    _drawBorders() {
        const borders = new PIXI.Graphics();

        const borderConfigs = [
            { radius: this.RADIUS.OUTER_FRAME, color: this.COLORS.BORDER_OUTER, width: 2 },
            { radius: this.RADIUS.DAYS, color: this.COLORS.BORDER_INNER, width: 1 },
            { radius: this.RADIUS.WEEKDAYS + this.AREASIZES.FIFTEEN, color: this.COLORS.BORDER_INNER, width: 1 },
            { radius: this.RADIUS.WEEKDAYS - this.AREASIZES.FIFTEEN, color: this.COLORS.BORDER_INNER, width: 1 }
        ];

        for (const config of borderConfigs) {
            borders.lineStyle(config.width, config.color);
            borders.drawCircle(this.centerX, this.centerY, config.radius);
        }

        this.containers.background.addChild(borders);
    }

    _drawNorthMarker() {
        const marker = new PIXI.Graphics();
        const markerHeight = 10;
        const markerWidth = 16;
        const topY = this.centerY - this.RADIUS.OUTER_FRAME;

        marker.beginFill(this.COLORS.TEXT_HIGHLIGHT);
        marker.moveTo(this.centerX, topY - markerHeight);
        marker.lineTo(this.centerX - markerWidth / 2, topY);
        marker.lineTo(this.centerX + markerWidth / 2, topY);
        marker.endFill();

        this.containers.background.addChild(marker);
    }

    _drawMonths() {
        const { months } = this.calendarData;
        this.containers.months.removeChildren();
        this.containers.monthSprites.removeChildren();

        // Use a Container for batch rendering
        const monthTextsContainer = new PIXI.Container();
        const spriteContainer = new PIXI.ParticleContainer(months.length, {
            position: true,
            rotation: true,
            uvs: true,
            alpha: true,
            scale: true
        });

        this.containers.months.addChild(monthTextsContainer);
        this.containers.monthSprites.addChild(spriteContainer);

        // Create all month texts and sprites in a single pass
        for (let i = 0; i < months.length; i++) {
            const { x, y, angle, originalIndex } = this.precalculated.monthAngles[i];

            const isCurrentMonth = originalIndex === this.calendarData.currentMonth;
            const style = {
                ...this.FONT_STYLE.MONTHS,
                fill: isCurrentMonth ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL
            };

            const text = new PIXI.Text(months[i], style);
            text.anchor.set(0.5);
            text.position.set(x, y);
            text.rotation = angle + Math.PI / 2;
            text.resolution = 2; // Higher resolution for sharper text
            text.originalIndex = originalIndex;

            // Create sprite if texture exists
            if (this.spritesheet && this.textureMatcher[originalIndex]) {
                const monthSprite = new PIXI.Sprite(this.spritesheet[this.textureMatcher[originalIndex]]);
                monthSprite.anchor.set(0.5);
                const radiusOffset = this.RADIUS.OUTER - this.AREASIZES.HUNDRED;
                monthSprite.position.set(
                    this.centerX + Math.cos(angle) * radiusOffset,
                    this.centerY + Math.sin(angle) * radiusOffset
                );
                monthSprite.width = monthSprite.height = this.AREASIZES.SIXTY;
                monthSprite.rotation = angle + Math.PI / 2;

                spriteContainer.addChild(monthSprite);
            }

            monthTextsContainer.addChild(text);
        }
    }

    _drawWeekdays() {
        const { weekdays } = this.calendarData;
        this.containers.weekdays.removeChildren();

        const weekdayTextsContainer = new PIXI.Container();
        this.containers.weekdays.addChild(weekdayTextsContainer);

        // Create all weekday texts in a single batch
        for (let i = 0; i < weekdays.length; i++) {
            const { x, y, angle } = this.precalculated.weekdayAngles[i];
            const isCurrentWeekday = i === 0;

            const style = {
                ...this.FONT_STYLE.WEEKDAYS,
                fill: isCurrentWeekday ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL
            };

            const text = new PIXI.Text(weekdays[i], style);
            text.anchor.set(0.5);
            text.position.set(x, y);
            text.rotation = angle + Math.PI / 2;
            text.resolution = 2;

            weekdayTextsContainer.addChild(text);
        }
    }

    _drawMoonPhase() {
        this.containers.moonPhase.removeChildren();

        const { currentMoon } = this.calendarData;
        const moonSize = 30; // Size of the moon
        const distanceFromCenter = this.RADIUS.WEEKDAYS - this.AREASIZES.TWENTYFIVE - moonSize / 2;
        let moonX = this.centerX;
        let moonY = this.centerY;
        const actualMoon = currentMoon % 8;
        const PI_4 = Math.PI / 4;

        switch (actualMoon) {
            case 0: // New Moon
                moonY += distanceFromCenter;
                break;
            case 1: // Waxing Crescent
                moonX -= distanceFromCenter * Math.cos(PI_4);
                moonY += distanceFromCenter * Math.sin(PI_4);
                break;
            case 2: // First Quarter
                moonX -= distanceFromCenter;
                break;
            case 3: // Waxing Gibbous
                moonX -= distanceFromCenter * Math.cos(PI_4);
                moonY -= distanceFromCenter * Math.sin(PI_4);
                break;
            case 4: // Full Moon
                moonY -= distanceFromCenter;
                break;
            case 5: // Waning Gibbous
                moonX += distanceFromCenter * Math.cos(PI_4);
                moonY -= distanceFromCenter * Math.sin(PI_4);
                break;
            case 6: // Last Quarter
                moonX += distanceFromCenter;
                break;
            case 7: // Waning Crescent
                moonX += distanceFromCenter * Math.cos(PI_4);
                moonY += distanceFromCenter * Math.sin(PI_4);
                break;

        }

        this.precalculated.hitRegions.moon.centerX = moonX;
        this.precalculated.hitRegions.moon.centerY = moonY;

        // Create container for the moon
        const moonContainer = new PIXI.Container();
        moonContainer.position.set(moonX, moonY);

        // Draw base moon (full circle with glow)
        const baseMoon = new PIXI.Graphics();
        baseMoon.beginFill(0xfffdeb);
        baseMoon.drawCircle(0, 0, moonSize / 2);
        baseMoon.endFill();

        const shadowMask = new PIXI.Graphics();
        shadowMask.beginFill(0x000000);
        shadowMask.drawCircle(0, 0, moonSize / 2);
        shadowMask.endFill();

        // Create a glow effect using a cached filter for better performance
        let blurFilter = this.textureCache.get('moonGlowFilter');
        if (!blurFilter) {
            blurFilter = new PIXI.BlurFilter(4);
            this.textureCache.set('moonGlowFilter', blurFilter);
        }

        // Add glow effect
        const moonGlow = new PIXI.Graphics();
        moonGlow.beginFill(0, 0.5);
        moonGlow.drawCircle(0, 0, moonSize / 2 + 4);
        moonGlow.endFill();
        moonGlow.filters = [blurFilter];

        // Add the glow first (behind the moon)
        moonContainer.addChild(moonGlow);

        const moonBorder = new PIXI.Graphics();
        moonBorder.lineStyle(1, this.COLORS.BORDER_INNER);
        moonBorder.drawCircle(0, 0, moonSize / 2);
        moonBorder.endFill();

        // Create shadow overlay based on phase
        const shadowOverlay = new PIXI.Graphics();
        shadowOverlay.beginFill(0x394f57);

        const radius = moonSize / 2;
        const moonPart = moonSize * 0.2;

        switch (actualMoon) {
            case 0: // New Moon (completely dark)
                shadowOverlay.drawCircle(0, 0, radius);
                break;
            case 1: // Waxing Crescent
                shadowOverlay.drawCircle(0, -moonPart, radius);
                shadowOverlay.closePath();
                shadowOverlay.mask = shadowMask;
                break;
            case 2: // First Quarter
                shadowOverlay.arc(0, 0, radius, -Math.PI, 0, false);
                shadowOverlay.lineTo(-radius, 0);
                shadowOverlay.lineTo(radius, 0);
                shadowOverlay.closePath();
                break;
            case 3: // Waxing Gibbous
                shadowOverlay.arc(0, moonPart, radius, -Math.PI, 0, false);
                shadowOverlay.arc(0, 0, radius, 0, -Math.PI, true);
                shadowOverlay.closePath();
                break;
            case 4: // Full Moon (no shadow)
                // No shadow for full moon
                break;
            case 5: // Waning Gibbous
                shadowOverlay.arc(0, 0, radius, 0, Math.PI, false);
                shadowOverlay.arc(0, -moonPart, radius, Math.PI, 0, true);
                shadowOverlay.closePath();
                break;
            case 6: // Last Quarter
                shadowOverlay.arc(0, 0, radius, 0, Math.PI, false);
                shadowOverlay.lineTo(radius, 0);
                shadowOverlay.lineTo(-radius, 0);
                shadowOverlay.closePath();
                break;
            case 7: // Waning Crescent
                shadowOverlay.drawCircle(0, moonPart, radius);
                shadowOverlay.closePath();
                shadowOverlay.mask = shadowMask;
                break;
        }
        shadowOverlay.endFill();

        // Add moon components to container
        moonContainer.addChild(shadowMask);
        moonContainer.addChild(baseMoon);
        moonContainer.addChild(shadowOverlay);
        moonContainer.addChild(moonBorder);

        // Add moon container to the main container
        this.containers.moonPhase.addChild(moonContainer);
    }

    _drawDays() {
        const daysContainer = new PIXI.Container();
        const { currentDay } = this.calendarData;
        this.containers.days.removeChildren();

        const dotsGraphics = new PIXI.Graphics();
        const highlightedDotsGraphics = new PIXI.Graphics();

        // Draw regular dots
        dotsGraphics.beginFill(this.COLORS.DOT_NORMAL);

        // Draw highlighted dot
        highlightedDotsGraphics.beginFill(this.COLORS.TEXT_HIGHLIGHT);

        const dayAngles = this.precalculated.dayAngles;
        for (let i = 0; i < dayAngles.length; i++) {
            const { x, y } = dayAngles[i];
            const isCurrentDay = i === currentDay;

            if (isCurrentDay) {
                highlightedDotsGraphics.drawCircle(x - this.centerX, y - this.centerY, this.AREASIZES.FIVE);
            } else {
                dotsGraphics.drawCircle(x - this.centerX, y - this.centerY, this.AREASIZES.THREE);
            }
        }

        dotsGraphics.endFill();
        highlightedDotsGraphics.endFill();

        dotsGraphics.position.set(this.centerX, this.centerY);
        highlightedDotsGraphics.position.set(this.centerX, this.centerY);

        daysContainer.addChild(dotsGraphics);
        daysContainer.addChild(highlightedDotsGraphics);

        const interactiveLayer = new PIXI.Sprite(PIXI.Texture.WHITE);
        interactiveLayer.width = this.app.screen.width;
        interactiveLayer.height = this.app.screen.height;
        interactiveLayer.alpha = 0.001; // Almost invisible
        interactiveLayer.interactive = true;

        daysContainer.addChild(interactiveLayer);
        this.containers.days.addChild(daysContainer);
    }

    _setupEventListeners() {
        if (this.initialized) return;

        this.app.view.addEventListener('mousemove', this.throttledMouseMove);
        this.app.view.addEventListener('mouseleave', this._boundMouseLeave);
        this.app.view.addEventListener('click', this._boundClick);
    }

    _getMousePosition(event) {
        const rect = this.app.view.getBoundingClientRect();
        return {
            mouseX: event.clientX - rect.left,
            mouseY: event.clientY - rect.top
        };
    }

    _handleMouseMove(event) {
        const { mouseX, mouseY } = this._getMousePosition(event);
        const { distance, angle } = this._calculateMouseMetrics(mouseX, mouseY);

        const previousHovered = this.hoveredSection;
        this.hoveredSection = this._detectHoveredSection(distance, angle);

        // Update highlights if changed
        if (!previousHovered || !this.hoveredSection ||
            previousHovered.type !== this.hoveredSection.type ||
            previousHovered.index !== this.hoveredSection.index) {
            this._updateHighlights();
            this.hoverCallback(this.hoveredSection ? this._collectSliceData() : null);
        }
    }

    _calculateMouseMetrics(mouseX, mouseY) {
        const dx = mouseX - this.centerX;
        const dy = mouseY - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx) + Math.PI / 2;

        if (angle < 0) angle += 2 * Math.PI;

        return { distance, angle };
    }

    _detectHoveredSection(distance, angle) {
        const { hitRegions } = this.precalculated;
        const angleDegrees = Math.floor((angle * 180 / Math.PI) % 360);

        const moonRegion = hitRegions.moon;
        const mouseX = this.centerX + Math.cos(angle - Math.PI / 2) * distance;
        const mouseY = this.centerY + Math.sin(angle - Math.PI / 2) * distance;
        const dx = mouseX - moonRegion.centerX;
        const dy = mouseY - moonRegion.centerY;
        const distanceToMoon = Math.sqrt(dx * dx + dy * dy);

        if (distanceToMoon <= moonRegion.radius) {
            return { type: 'moon', index: this.calendarData.currentMoon };
        }

        // Fast hit detection using precalculated lookup tables
        if (distance >= hitRegions.month.min && distance <= hitRegions.month.max) {
            return { type: 'month', index: this.hitDetectionLookup.month[angleDegrees] };
        }

        if (Math.abs(distance - hitRegions.day.center) <= hitRegions.day.tolerance) {
            return { type: 'day', index: this.hitDetectionLookup.day[angleDegrees] };
        }

        if (Math.abs(distance - hitRegions.weekday.center) <= hitRegions.weekday.tolerance) {
            return { type: 'weekday', index: this.hitDetectionLookup.weekday[angleDegrees] };
        }

        return null;
    }

    _updateHighlights() {
        // Clear previous highlights
        this.containers.highlights.removeChildren();

        if (!this.hoveredSection) return;

        const { type, index } = this.hoveredSection;
        const highlight = new PIXI.Graphics();

        highlight.beginFill(this.COLORS.HIGHLIGHT_BG, 0.6);

        if (type === 'month') {
            const { startAngle, endAngle } = this.precalculated.monthAngles[index];
            const { month: offset } = this.precalculated.angleOffsets;

            this._drawArcSegment(
                highlight,
                this.RADIUS.OUTER - this.AREASIZES.FIFTEEN,
                this.RADIUS.OUTER_FRAME,
                startAngle - offset,
                endAngle - offset
            );

            this._updateTextHighlight('month', index);
        }
        else if (type === 'weekday') {
            const { startAngle, endAngle } = this.precalculated.weekdayAngles[index];
            const { weekday: offset } = this.precalculated.angleOffsets;

            this._drawArcSegment(
                highlight,
                this.RADIUS.WEEKDAYS - this.AREASIZES.FIFTEEN,
                this.RADIUS.WEEKDAYS + this.AREASIZES.FIFTEEN,
                startAngle - offset,
                endAngle - offset
            );

            this._updateTextHighlight('weekday', index);
        }
        else if (type === 'day') {
            const { x, y } = this.precalculated.dayAngles[index];
            highlight.drawCircle(x, y, this.AREASIZES.EIGHT);
        }
        else if (type === 'moon') {
            highlight.beginFill(this.COLORS.HIGHLIGHT_MOON, 0.1);
            const { centerX, centerY, radius } = this.precalculated.hitRegions.moon;
            highlight.drawCircle(centerX, centerY, radius + 1);
        }

        this.containers.highlights.addChild(highlight);
    }

    _updateTextHighlight(type, index) {
        const container = this.containers[type + 's'];
        const texts = container.children[0].children; // Get texts from the batch container

        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            let isHighlighted = false;

            if (type === 'month') {
                const isCurrentMonth = text.originalIndex === this.calendarData.currentMonth;
                isHighlighted = (i === index || isCurrentMonth);
            } else {
                const isCurrentElement = i === 0; // First element is current for rotated arrays
                isHighlighted = (i === index || isCurrentElement);
            }

            text.style.fill = isHighlighted ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL;
        }
    }

    _handleMouseLeave() {
        this.hoveredSection = null;
        this._updateHighlights();
        this.hoverCallback(null);
    }

    _collectSliceData() {
        if (!this.hoveredSection) return null;

        const { type, index } = this.hoveredSection;
        const clickData = { type, index };

        switch (type) {
            case 'month':
                clickData.name = this.calendarData.months[index];
                clickData.originalIndex = this.precalculated.monthAngles[index].originalIndex;
                break;
            case 'day':
                clickData.day = index + 1;
                clickData.isCurrentDay = index === this.calendarData.currentDay;
                break;
            case 'weekday':
                clickData.name = this.calendarData.weekdays[index];
                clickData.originalIndex = (this.calendarData.currentWeekday + index) % this.calendarData.weekdays.length;
                break;
            case 'moon':
                clickData.phase = index;
                clickData.name = this.calendarData.moons[index % 8];
                break;
        }

        return clickData;
    }

    _handleClick() {
        if (this.hoveredSection) {
            this.callback(this._collectSliceData());
        }
    }
}