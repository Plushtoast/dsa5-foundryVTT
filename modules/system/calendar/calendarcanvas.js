/**
 * Calendar visualization using PixiJS
 * @class
 */
export class CalendarCanvas {
    /**
     * @param {HTMLElement} parentElement - Element to attach the canvas to
     * @param {Function} callback - Called when user clicks on a calendar element
     * @param {Function} hoverCallback - Called when user hovers over calendar elements
     */
    constructor(parentElement, callback, hoverCallback) {
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
            highlights: null
        };

        // State
        this.hoveredSection = null;
        this.isDestroyed = false;
        this.spritesheet = null;
        this.initialized = false;

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
        this.RADIUS = Object.freeze({
            OUTER: 300,
            DAYS: 260,
            WEEKDAYS: 140,
            OUTER_FRAME: 315,
            SEASONS: 280
        });

        this.COLORS = Object.freeze({
            BACKGROUND_INNER: 0x1a1a1a,
            BACKGROUND_OUTER: 0x000000,
            BORDER_OUTER: 0x888888,
            BORDER_INNER: 0x555555,
            TEXT_NORMAL: 0xe0c080,
            TEXT_HIGHLIGHT: 0xffcc00,
            DOT_NORMAL: 0xfff6d0,
            HIGHLIGHT_BG: 0xffcc00
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

        this.FONT_STYLE = Object.freeze({
            MONTHS: {
                fontFamily: 'Garamond',
                fontSize: 16,
                fill: this.COLORS.TEXT_NORMAL,
                align: 'center'
            },
            WEEKDAYS: {
                fontFamily: 'Garamond',
                fontSize: 14,
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
            angleOffsets: {
                month: 0,
                day: 0,
                weekday: 0
            },
            hitRegions: {
                month: { min: this.RADIUS.OUTER - 10, max: this.RADIUS.OUTER + 10 },
                day: { center: this.RADIUS.DAYS, tolerance: 10 },
                weekday: { center: this.RADIUS.WEEKDAYS, tolerance: 15 }
            }
        };
    }

    /**
     * Throttle function execution
     * @private
     */
    _throttle(func, limit) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
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

        if (this.app) {
            this.app.destroy(true, {
                children: true,
            });
            this.app = null;
        }
    }

    _setupPixiApp() {
        if (this.app) return;

        const dpr = window.devicePixelRatio || 1;
        this.app = new PIXI.Application({
            width: this.element.clientWidth,
            height: this.element.clientHeight,
            backgroundColor: this.COLORS.BACKGROUND_OUTER,
            antialias: true,
            resolution: dpr,
            autoDensity: true
        });

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
        const components = calendar.timeToComponents(game.time.worldTime);
        const daysPerYear = calendar.days.daysPerYear;

        // Calculate seasons
        const seasons = this._calculateSeasons(calendar, daysPerYear);

        this.calendarData = {
            months: this._getLocalizedArray(calendar.months.values, calendar.translationPrefix),
            weekdays: this._getLocalizedArray(calendar.days.values, calendar.translationPrefix),
            currentMonth: components.month,
            currentDay: components.dayOfMonth,
            currentWeekday: components.dayOfWeek,
            daysInMonth: calendar.months.values[components.month].days,
            seasons: this._adjustSeasonsForRotation(seasons, components, calendar, daysPerYear)
        };

        // Rotate arrays to start with current elements
        this.calendarData.months = this._rotateArray(this.calendarData.months, this.calendarData.currentMonth);
        this.calendarData.weekdays = this._rotateArray(this.calendarData.weekdays, this.calendarData.currentWeekday);
    }

    _getLocalizedArray(values, translationPrefix) {
        return values.map(item => game.i18n.localize(`${translationPrefix}.${item.name}`));
    }

    _calculateSeasons(calendar, daysPerYear) {
        const seasons = [];
        let cumulativeAngle = 0;

        for (let i = 0; i < calendar.seasons.values.length; i++) {
            const season = calendar.seasons.values[i];
            const nextSeason = calendar.seasons.values[i + 1];

            const days = this._calculateSeasonDays(season, nextSeason, calendar);

            const angle = days / daysPerYear * 2 * Math.PI;
            const startAngle = cumulativeAngle;

            cumulativeAngle += angle;

            seasons.push({
                angle,
                startAngle,
                endAngle: cumulativeAngle,
                gradient: this.SEASON_GRADIENTS[i]
            });
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
        let currentMonthStartAngle = 0;

        for (let i = 0; i < components.month; i++) {
            currentMonthStartAngle += (calendar.months.values[i].days / daysPerYear) * 2 * Math.PI;
        }

        return seasons.map(season => ({
            ...season,
            startAngle: (season.startAngle - currentMonthStartAngle + 2 * Math.PI) % (2 * Math.PI),
            endAngle: (season.endAngle - currentMonthStartAngle + 2 * Math.PI) % (2 * Math.PI)
        }));
    }

    _rotateArray(array, startIndex) {
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

        // Precalculate all positions
        this.precalculated.monthAngles = this._calculateMonthAngles(months.length);
        this.precalculated.dayAngles = this._calculateDayAngles(daysInMonth);
        this.precalculated.weekdayAngles = this._calculateWeekdayAngles(weekdays.length);
        this.precalculated.seasonAngles = this._calculateSeasonAngles();
    }

    _calculateMonthAngles(monthCount) {
        const angles = [];
        const angleStep = 2 * Math.PI / monthCount;

        for (let i = 0; i < monthCount; i++) {
            const angle = angleStep * i - Math.PI / 2;
            const startAngle = angleStep * i;
            const endAngle = angleStep * (i + 1);
            const originalIndex = (this.calendarData.currentMonth + i) % monthCount;

            angles.push({
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.OUTER,
                y: this.centerY + Math.sin(angle) * this.RADIUS.OUTER,
                startAngle,
                endAngle,
                originalIndex
            });
        }

        return angles;
    }

    _calculateDayAngles(dayCount) {
        const angles = [];
        const angleStep = 2 * Math.PI / dayCount;

        for (let i = 0; i < dayCount; i++) {
            const angle = angleStep * i - Math.PI / 2;
            angles.push({
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.DAYS,
                y: this.centerY + Math.sin(angle) * this.RADIUS.DAYS
            });
        }

        return angles;
    }

    _calculateWeekdayAngles(weekdayCount) {
        const angles = [];
        const angleStep = 2 * Math.PI / weekdayCount;

        for (let i = 0; i < weekdayCount; i++) {
            const angle = angleStep * i - Math.PI / 2;
            const startAngle = angleStep * i;
            const endAngle = angleStep * (i + 1);

            angles.push({
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.WEEKDAYS,
                y: this.centerY + Math.sin(angle) * this.RADIUS.WEEKDAYS,
                startAngle,
                endAngle
            });
        }

        return angles;
    }

    _calculateSeasonAngles() {
        const seasonAngleOffset = 15 / 365 * 2 * Math.PI;

        return this.calendarData.seasons.map(season => ({
            startAngle: season.startAngle - Math.PI / 2 - seasonAngleOffset,
            endAngle: season.endAngle - Math.PI / 2 - seasonAngleOffset,
            gradient: season.gradient
        }));
    }

    async _loadTextures() {
        if (this.spritesheet) return;

        this.spritesheet = {}

        try {
            const toLoad = ["systems/dsa5/icons/textures/calendar.json"];
            await foundry.canvas.TextureLoader.loader.load(toLoad);
            for (const path of toLoad) {
                const spritesheet = foundry.canvas.getTexture(path);
                const spritesheets = [spritesheet];
                for (const sheet of spritesheets) {
                    for (const [asset, texture] of Object.entries(sheet.textures)) {
                        this.spritesheet[asset] = texture;
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to load background image:', error);
            // Continue without background
        }
    }

    _createContainers() {
        if (this.containers.background) return;

        // Create container hierarchy
        const containerKeys = Object.keys(this.containers);
        containerKeys.forEach(key => {
            this.containers[key] = new PIXI.Container();
            // Add non-background containers to stage in correct order
            if (key !== 'background') {
                this.stage.addChild(this.containers[key]);
            }
        });

        // Add background first
        this.stage.addChildAt(this.containers.background, 0);
    }

    _renderStaticElements() {
        if (!this.initialized) {
            this._drawBackground();
            this._drawBorders();
            this._drawNorthMarker();
        }

        this._drawSeasons();
        this._drawMonths();
        this._drawWeekdays();
        this._drawDays();
    }

    _drawBackground() {
        const background = new PIXI.Graphics();
        this.containers.background.addChild(background);

        // Add background image if available
        if (this.spritesheet) {
            // Create background sprite
            console.log(this.spritesheet.bg_goetterkreis, this.spritesheet.rad_goetterkreis);
            const bgSprite = new PIXI.Sprite(this.spritesheet.bg_goetterkreis);
            bgSprite.anchor.set(0.5);
            bgSprite.width = bgSprite.height = this.RADIUS.OUTER * 2;
            bgSprite.position.set(this.centerX, this.centerY + 8);

            

            const godring = new PIXI.Sprite(this.spritesheet.rad_goetterkreis);
            godring.anchor.set(0.5);
            godring.width = godring.height = this.RADIUS.WEEKDAYS * 4.2;
            godring.position.set(this.centerX + 1, this.centerY + 9);

            const godringMask = new PIXI.Graphics();
            godringMask.beginFill(0x000000);
            godringMask.drawCircle(this.centerX, this.centerY, this.RADIUS.WEEKDAYS + 15);
            godringMask.endFill();
            
            godring.mask = godringMask;

            // Create a blend mask for the background image
            const blendMask = new PIXI.Graphics();
            blendMask.beginFill(0x000000);
            blendMask.drawCircle(this.centerX, this.centerY, this.RADIUS.WEEKDAYS + 15);
            blendMask.endFill();
            blendMask.beginHole();
            blendMask.drawCircle(this.centerX, this.centerY, this.RADIUS.WEEKDAYS - 15);
            blendMask.endHole();

            this.containers.background.addChild(godringMask);
            this.containers.background.addChild(bgSprite);
            this.containers.background.addChild(godring);
            this.containers.background.addChild(blendMask);
        }
    }

    _drawSeasons() {
        this.containers.seasons.removeChildren();

        for (const season of this.precalculated.seasonAngles) {
            const seasons = new PIXI.Graphics();
            this._drawArcSegment(
                seasons,
                this.RADIUS.SEASONS - 6,
                this.RADIUS.SEASONS + 6,
                season.startAngle + Math.PI / 2,
                season.endAngle + Math.PI / 2,
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

        const gradientTexture = this._createRingGradientTexture(outerRadius, innerRadius, [
            { offset: 0, color: `#${gradient.start}` },
            { offset: 1, color: `#${gradient.end}` }
        ]);

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

        // Create a radial gradient that starts at innerRadius and ends at radius
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

        // Draw circular borders
        const borderConfigs = [
            { radius: this.RADIUS.OUTER_FRAME, color: this.COLORS.BORDER_OUTER, width: 2 },
            { radius: this.RADIUS.DAYS, color: this.COLORS.BORDER_INNER, width: 1 },
            { radius: this.RADIUS.WEEKDAYS + 15, color: this.COLORS.BORDER_INNER, width: 1 },
            { radius: this.RADIUS.WEEKDAYS - 15, color: this.COLORS.BORDER_INNER, width: 1 }
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

        months.forEach((month, i) => {
            const { x, y, angle, originalIndex } = this.precalculated.monthAngles[i];

            const isCurrentMonth = originalIndex === this.calendarData.currentMonth;
            const style = {
                ...this.FONT_STYLE.MONTHS,
                fill: isCurrentMonth ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL
            };

            const text = new PIXI.Text(month, style);
            text.anchor.set(0.5);
            text.position.set(x, y);
            text.rotation = angle + Math.PI / 2;
            text.resolution = 2; // Higher resolution for sharper text
            text.originalIndex = originalIndex;

            const monthSprite = new PIXI.Sprite(this.spritesheet[this.textureMatcher[originalIndex]]);
            monthSprite.anchor.set(0.5);
            // 100px inwards from the edge
            const radiusOffset = this.RADIUS.OUTER - 100; // Adjust as needed
            monthSprite.position.set(
                this.centerX + Math.cos(angle) * radiusOffset,
                this.centerY + Math.sin(angle) * radiusOffset
            );
            monthSprite.width = monthSprite.height = 60; // Adjust size as needed
            monthSprite.rotation = angle + Math.PI / 2;
            
            this.containers.monthSprites.addChild(monthSprite);
            this.containers.months.addChild(text);
        });
    }

    _drawWeekdays() {
        const { weekdays } = this.calendarData;
        this.containers.weekdays.removeChildren();

        weekdays.forEach((day, i) => {
            const { x, y, angle } = this.precalculated.weekdayAngles[i];
            const isCurrentWeekday = i === 0;

            const style = {
                ...this.FONT_STYLE.WEEKDAYS,
                fill: isCurrentWeekday ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL
            };

            const text = new PIXI.Text(day, style);
            text.anchor.set(0.5);
            text.position.set(x, y);
            text.rotation = angle + Math.PI / 2;
            text.resolution = 2;

            this.containers.weekdays.addChild(text);
        });
    }

    _drawDays() {
        const daysContainer = new PIXI.Container();
        const { currentDay } = this.calendarData;
        this.containers.days.removeChildren();

        // Draw all day dots
        this.precalculated.dayAngles.forEach((pos, i) => {
            const { x, y } = pos;
            const isCurrentDay = i === currentDay;

            const dot = new PIXI.Graphics();
            dot.beginFill(isCurrentDay ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.DOT_NORMAL);
            dot.drawCircle(0, 0, isCurrentDay ? 5 : 3);
            dot.endFill();
            dot.position.set(x, y);
            dot.interactive = true;
            dot.dayIndex = i;

            daysContainer.addChild(dot);
        });

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
        if (JSON.stringify(previousHovered) !== JSON.stringify(this.hoveredSection)) {
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

        if (distance >= hitRegions.month.min && distance <= hitRegions.month.max) {
            return this._getMonthSection(angle);
        }

        if (Math.abs(distance - hitRegions.day.center) <= hitRegions.day.tolerance) {
            return this._getDaySection(angle);
        }

        if (Math.abs(distance - hitRegions.weekday.center) <= hitRegions.weekday.tolerance) {
            return this._getWeekdaySection(angle);
        }

        return null;
    }

    _getMonthSection(angle) {
        const { month } = this.precalculated.angleOffsets;
        const adjustedAngle = angle + month;
        const monthIndex = Math.floor((adjustedAngle / (2 * Math.PI)) * this.calendarData.months.length) % this.calendarData.months.length;
        return { type: 'month', index: monthIndex };
    }

    _getDaySection(angle) {
        const { day } = this.precalculated.angleOffsets;
        const adjustedAngle = angle + day;
        const dayIndex = Math.floor((adjustedAngle / (2 * Math.PI)) * this.calendarData.daysInMonth) % this.calendarData.daysInMonth;
        return { type: 'day', index: dayIndex };
    }

    _getWeekdaySection(angle) {
        const { weekday } = this.precalculated.angleOffsets;
        const adjustedAngle = angle + weekday;
        const weekdayIndex = Math.floor((adjustedAngle / (2 * Math.PI)) * this.calendarData.weekdays.length) % this.calendarData.weekdays.length;
        return { type: 'weekday', index: weekdayIndex };
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
                this.RADIUS.OUTER - 15,
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
                this.RADIUS.WEEKDAYS - 15,
                this.RADIUS.WEEKDAYS + 15,
                startAngle - offset,
                endAngle - offset
            );

            this._updateTextHighlight('weekday', index);
        }
        else if (type === 'day') {
            const { x, y } = this.precalculated.dayAngles[index];
            highlight.drawCircle(x, y, 8);
        }

        this.containers.highlights.addChild(highlight);
    }

    _updateTextHighlight(type, index) {
        const container = this.containers[type + 's'];

        container.children.forEach((text, i) => {
            if (type === 'month') {
                const isCurrentMonth = text.originalIndex === this.calendarData.currentMonth;
                text.style.fill = (i === index || isCurrentMonth) ?
                    this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL;
            } else {
                const isCurrentElement = i === 0; // First element is current for rotated arrays
                text.style.fill = (i === index || isCurrentElement) ?
                    this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL;
            }
        });
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
        }

        return clickData;
    }

    _handleClick() {
        if (this.hoveredSection) {
            this.callback(this._collectSliceData());
        }
    }
}