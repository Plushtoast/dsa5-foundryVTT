import { DefaultAppv2 } from '../../actor/baseapp.js';
import { tabSlider } from '../helpers/view_helper.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import DSATour from '../../tours/dsa_tour.js';
import DidYouKnow from '../helpers/didyouknow.js';
import ModuleDetailsDataLoader from './module_details_loader.js';
import ModuleDetailsApp from './module_details_app.js';
const { mergeObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export class PatchViewer extends DefaultAppv2 {
    #search;
    #activeFilters = new Set();
    #lastQuery = '';
    #lastRegex = null;
    #carouselTimers = [];
    #moduleLookup = new Map();

    constructor(json, app, { initialTab } = {}) {
        super(app);
        this.json = json;
        this.versionIndex = 3;
        this._initialTab = initialTab || null;
        this._dismissOnClose = false;
    }

    static DEFAULT_OPTIONS = {
        id: 'dsa5-patch-viewer',
        classes: ['dsa5', 'largeDialog', 'patches'],
        position: {
            width: 960,
            height: 820,
        },
        window: {
            title: 'DSA5.welcomeApp.windowTitle',
            resizable: true,
            contentClasses: ['patchviewer'],
        },
        actions: {
            showMore: this.#showMore,
            scrollToCategory: this.#scrollToCategoryAction,
            closeFeatured: this.#closeFeatured,
            toggleFilter: this.#toggleFilter,
            clearFilters: this.#clearFilters,
            switchLanguage: this.#switchLanguage,
            startTour: this.#startTour,
            openGameManual: this.#openGameManual,
            switchToTab: this.#switchToTab,
            toggleDismiss: this.#toggleDismiss,
            carouselPrev: this.#carouselPrev,
            carouselNext: this.#carouselNext,
            openLibrary: this.#openLibrary,
            openJournalBrowser: this.#openJournalBrowser,
            nextTip: this.#nextTip,
            openModuleDetails: this.#openModuleDetails,
        }
    };

    static PARTS = {
        header: {
            template: 'systems/dsa5/templates/system/patchviewer/header.hbs',
        },
        tabs: {
            template: 'systems/dsa5/templates/system/dsatabs.hbs'
        },
        welcome: {
            template: 'systems/dsa5/templates/system/patchviewer/welcome.hbs',
        },
        newcontent: {
            template: 'systems/dsa5/templates/system/patchviewer/news.hbs',
        },
        changelog: {
            template: 'systems/dsa5/templates/system/patchviewer/changelog.hbs',
        },
        content: {
            template: 'systems/dsa5/templates/system/patchviewer/modules.hbs',
        },
    };

    static TABS = {
        sheet: {
            tabs: [
                { id: 'welcome', icon: 'fa-solid fa-house', label: 'DSA5.welcomeApp.tab.welcome' },
                { id: 'content', icon: 'fa-solid fa-store', label: 'DSA5.patchViewer.tab.store' },
                { id: 'newcontent', icon: 'fa-solid fa-newspaper', label: 'News' },
                { id: 'changelog', icon: 'fa-solid fa-clock-rotate-left', label: 'Changelog' },
            ],
            initial: 'newcontent',
        },
    };

    static HEADER_CONFIG = {
        welcome:    { icon: 'fa-solid fa-house',              title: 'DSA5.welcomeApp.header.welcome' },
        content:    { icon: 'fa-solid fa-store',              title: 'DSA5.welcomeApp.header.store' },
        newcontent: { icon: 'fa-solid fa-newspaper',          title: 'DSA5.welcomeApp.header.news' },
        changelog:  { icon: 'fa-solid fa-clock-rotate-left',  title: 'DSA5.welcomeApp.header.changelog' },
    };

    static WELCOME_CONFIG = {
        videoGuides: {
            de: [
                { id: 'BopJzyh8ihA', titleKey: 'DSA5.welcomeApp.videos.whatIsAventuria',     descKey: 'DSA5.welcomeApp.videos.whatIsAvDesc' },
                { id: 'M6mjmXTWvtM', titleKey: 'DSA5.welcomeApp.videos.whoAreTheTwelveGods', descKey: 'DSA5.welcomeApp.videos.whoAreTheTwelveGodsDesc' },
                { id: 'f2vQjC9lR-4', titleKey: 'DSA5.welcomeApp.videos.whatDoINeed',           descKey: 'DSA5.welcomeApp.videos.whatDoINeedDesc' },
            ],
            en: [
                { id: 'cYy-gdBF2IM', titleKey: 'DSA5.welcomeApp.videos.whatIsAventuria',     descKey: 'DSA5.welcomeApp.videos.whatIsAvDesc' },
                { id: 'HJ-IpqZPaeg', titleKey: 'DSA5.welcomeApp.videos.livePlay',             descKey: 'DSA5.welcomeApp.videos.livePlayDesc' },
            ],
        },
        moduleCards: [
            {
                hrefDe: 'https://www.f-shop.de/virtual-tabletops/das-schwarze-auge-vtt/dsa-vtt-einstiegsabenteuer/',
                hrefEn: 'https://foundryvtt.com/packages/dsa5-introduction',
                image: 'systems/dsa5/icons/modules/introduction.webp',
                titleKey: 'DSA5.welcomeApp.beginnerModules.introAdventure',
                descKey: 'DSA5.welcomeApp.beginnerModules.introAdventureDesc',
                categoryKey: 'DSA5.welcomeApp.beginnerModules.catAdventure',
                free: true,
                external: true,
            },
            {
                hrefDe: 'https://www.f-shop.de/virtual-tabletops/das-schwarze-auge-vtt/dsa-vtt-hexentanz/',
                hrefEn: 'https://foundryvtt.com/packages/dsa5-witchsdance',
                image: 'systems/dsa5/icons/modules/witchsdance.webp',
                titleKey: 'DSA5.welcomeApp.beginnerModules.witchsDance',
                descKey: 'DSA5.welcomeApp.beginnerModules.witchsDanceDesc',
                categoryKey: 'DSA5.welcomeApp.beginnerModules.catAdventure',
                free: true,
                external: true,
            },
            {
                hrefDe: 'https://www.f-shop.de/virtual-tabletops/das-schwarze-auge-vtt/dsa-vtt-drachenritter/',
                hrefEn: 'https://www.ulissesf-shop.com/virtual-tabletops/',
                image: 'systems/dsa5/icons/modules/dragonknight.webp',
                titleKey: 'DSA5.welcomeApp.beginnerModules.dragonKnight',
                descKey: 'DSA5.welcomeApp.beginnerModules.dragonKnightDesc',
                categoryKey: 'DSA5.welcomeApp.beginnerModules.catCampaign',
                external: true,
            },
            {
                hrefDe: 'https://www.f-shop.de/virtual-tabletops/das-schwarze-auge-vtt/dsa-vtt-regelwerk/',
                hrefEn: 'https://www.ulissesf-shop.com/virtual-tabletops/',
                image: 'systems/dsa5/icons/modules/core.webp',
                titleKey: 'DSA5.welcomeApp.beginnerModules.coreModule',
                descKey: 'DSA5.welcomeApp.beginnerModules.coreModuleDesc',
                categoryKey: 'DSA5.welcomeApp.beginnerModules.catRules',
                external: true,
            },
            {
                action: 'switchToTab',
                actionTab: 'content',
                icon: 'fa-solid fa-store',
                titleKey: 'DSA5.welcomeApp.beginnerModules.browseAll',
                descKey: 'DSA5.welcomeApp.beginnerModules.browseAllDesc',
            },
        ],
        gettingStartedSteps: [
            { icon: 'fa-solid fa-cube',       textKey: 'DSA5.welcomeApp.gettingStarted.step1' },
            { icon: 'fa-solid fa-book-open',  textKey: 'DSA5.welcomeApp.gettingStarted.step2' },
            { icon: 'fa-solid fa-map',        textKey: 'DSA5.welcomeApp.gettingStarted.step3' },
            { icon: 'fa-solid fa-hat-wizard', textKey: 'DSA5.welcomeApp.gettingStarted.step4' },
            { icon: 'fa-solid fa-users',      textKey: 'DSA5.welcomeApp.gettingStarted.step5' },
        ],
        starterHints: [
            { shortcut: 'L', icon: 'fa-solid fa-book-bookmark', titleKey: 'DSA5.welcomeApp.hints.library',        descKey: 'DSA5.welcomeApp.hints.libraryDesc',        action: 'openLibrary' },
            { shortcut: 'J', icon: 'fa-solid fa-book',          titleKey: 'DSA5.welcomeApp.hints.journalBrowser', descKey: 'DSA5.welcomeApp.hints.journalBrowserDesc', action: 'openJournalBrowser' },
            { shortcut: '',  icon: 'fa-solid fa-user-plus',     titleKey: 'DSA5.welcomeApp.hints.charCreation',   descKey: 'DSA5.welcomeApp.hints.charCreationDesc' },
            { shortcut: '',  icon: 'fa-solid fa-dice-d20',      titleKey: 'DSA5.welcomeApp.hints.rolling',        descKey: 'DSA5.welcomeApp.hints.rollingDesc' },
            { shortcut: '',  icon: 'fa-solid fa-swords',        titleKey: 'DSA5.welcomeApp.hints.combat',         descKey: 'DSA5.welcomeApp.hints.combatDesc' },
        ],
        links: [
            { hrefKey: '{vttInfoUrl}',                                                       icon: 'fa-solid fa-circle-info',   labelKey: 'DSA5.welcomeApp.links.vttInfo' },
            { href: 'https://github.com/Plushtoast/dsa5-foundryVTT/wiki',                    icon: 'fa-solid fa-book',          label: 'Wiki' },
            { href: 'https://www.youtube.com/channel/UCgVzSn5NkMaO-PDxhCiAAjA',              icon: 'fa-brands fa-youtube',      label: 'YouTube' },
            { href: 'https://discord.gg/4GJPAEhfMb',                                        icon: 'fa-brands fa-discord',      label: 'Discord' },
            { href: 'https://github.com/Plushtoast/dsa5-foundryVTT/issues',                  icon: 'fa-brands fa-github',       label: 'GitHub' },
            { hrefKey: '{storeCTAUrl}',                                                      icon: 'fa-solid fa-cart-shopping', label: 'F-Shop' },
        ],
    };

    async _onRender(context, options) {
        await super._onRender(context, options);
        const html = $(this.element);

        this.#updateHeader(this.tabGroups.sheet ?? 'newcontent');

        tabSlider(html);
        html.find('img').on('click', (ev) => {
            const isShopArtWork = ev.currentTarget.closest('.module-card')
            const isWelcomePage = ev.currentTarget.closest('.welcome-page')

            if (isShopArtWork || isWelcomePage) return;

            game.dsa5.apps.DSA5_Utility.showArtwork({
                name: 'Changelog',
                uuid: '',
                img: ev.currentTarget.getAttribute('src'),
            });
        });

        this.#search ??= new foundry.applications.ux.SearchFilter({
            inputSelector: "input[type=search]",
            contentSelector: ".module-grids",
            callback: this.#onSearchFilter.bind(this)
        });
        this.#search.bind(this.element);

        this.#initCarousels();
    }

    // ── Carousel logic ──

    #initCarousels() {
        this.#destroyCarousels();
        const carousels = this.element?.querySelectorAll('[data-carousel]') ?? [];
        for (const el of carousels) {
            const track = el.querySelector('.welcome-carousel__track');
            const dotsContainer = el.querySelector('.welcome-carousel__dots');
            if (!track) continue;

            const slides = track.querySelectorAll('.welcome-carousel__slide');
            const count = slides.length;
            if (count <= 1) {
                const nav = el.querySelector('.welcome-carousel__nav');
                if (nav) nav.hidden = true;
                // Single slide: show it centered without 3D
                if (count === 1) {
                    slides[0].classList.add('is-active');
                    slides[0].style.position = 'relative';
                    slides[0].style.transform = 'none';
                    slides[0].style.opacity = '1';
                }
                continue;
            }

            const state = { index: 0, count };
            el._carouselState = state;

            // Measure tallest slide to set viewport height
            const viewport = el.querySelector('.welcome-carousel__viewport');
            const measureHeight = () => {
                let maxH = 0;
                slides.forEach(s => {
                    s.style.position = 'relative';
                    s.style.opacity = '1';
                    s.style.width = '';
                    const h = s.offsetHeight;
                    if (h > maxH) maxH = h;
                });
                if (maxH > 0 && viewport) {
                    viewport.style.height = `${maxH}px`;
                    track.style.height = `${maxH}px`;
                }
                slides.forEach(s => {
                    s.style.position = '';
                    s.style.opacity = '';
                });
            };
            // Measure now, and re-measure once images finish loading
            measureHeight();
            const images = track.querySelectorAll('img');
            if (images.length) {
                let loaded = 0;
                const onLoad = () => { if (++loaded >= images.length) measureHeight(); };
                images.forEach(img => {
                    if (img.complete) { loaded++; }
                    else { img.addEventListener('load', onLoad, { once: true }); }
                });
                if (loaded >= images.length) measureHeight();
            }

            // Build dots
            dotsContainer.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = `welcome-carousel__dot${i === 0 ? ' is-active' : ''}`;
                dot.dataset.index = i;
                dot.addEventListener('click', () => this.#goToSlide(el, i));
                dotsContainer.appendChild(dot);
            }

            // Set initial positions
            this.#goToSlide(el, 0);

            // Click on neighbor slides to navigate; block link follow on non-active slides
            slides.forEach(slide => {
                slide.addEventListener('click', (e) => {
                    if (slide.classList.contains('is-active')) return; // allow normal link
                    e.preventDefault();
                    e.stopPropagation();
                    if (slide.classList.contains('is-prev')) {
                        this.#advanceCarousel(el, -1);
                    } else if (slide.classList.contains('is-next')) {
                        this.#advanceCarousel(el, 1);
                    }
                });
            });

            // Auto-advance timer
            const interval = parseInt(el.dataset.interval) || 6000;
            const timerId = setInterval(() => this.#advanceCarousel(el, 1), interval);
            this.#carouselTimers.push(timerId);
            el._carouselTimerId = timerId;

            // Pause on hover
            el.addEventListener('mouseenter', () => {
                if (el._carouselTimerId != null) {
                    clearInterval(el._carouselTimerId);
                    el._carouselTimerId = null;
                }
            });
            el.addEventListener('mouseleave', () => {
                if (el._carouselTimerId == null) {
                    const newId = setInterval(() => this.#advanceCarousel(el, 1), interval);
                    el._carouselTimerId = newId;
                    this.#carouselTimers.push(newId);
                }
            });
        }
    }

    #destroyCarousels() {
        for (const id of this.#carouselTimers) clearInterval(id);
        this.#carouselTimers = [];
    }

    #advanceCarousel(el, direction) {
        const state = el._carouselState;
        if (!state) return;
        const next = (state.index + direction + state.count) % state.count;
        this.#goToSlide(el, next);
    }

    #goToSlide(el, index) {
        const state = el._carouselState;
        if (!state) return;
        state.index = index;
        const { count } = state;

        const slides = el.querySelectorAll('.welcome-carousel__slide');
        slides.forEach((slide, i) => {
            slide.classList.remove('is-active', 'is-prev', 'is-next', 'is-hidden');

            const diff = ((i - index) % count + count) % count;   // 0 … count-1
            if (diff === 0) {
                slide.classList.add('is-active');
                slide.style.transform = 'translateX(0) rotateY(0deg) scale(1)';
                slide.style.filter = 'none';
            } else if (diff === 1 || (diff === count - 1 && count > 2)) {
                const side = diff === 1 ? 1 : -1;  // 1 = next, -1 = prev
                slide.classList.add(side === 1 ? 'is-next' : 'is-prev');
                slide.style.transform = `translateX(${side * 72}%) rotateY(${side * -35}deg) scale(0.85)`;
                slide.style.filter = 'brightness(0.6)';
            } else {
                slide.classList.add('is-hidden');
                slide.style.transform = 'translateX(0) rotateY(0deg) scale(0.7)';
                slide.style.filter = 'brightness(0.4)';
            }
        });

        const dots = el.querySelectorAll('.welcome-carousel__dot');
        dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
    }

    static #carouselPrev(event, target) {
        const carousel = target.closest('[data-carousel]');
        if (carousel) this.#advanceCarousel(carousel, -1);
    }

    static #carouselNext(event, target) {
        const carousel = target.closest('[data-carousel]');
        if (carousel) this.#advanceCarousel(carousel, 1);
    }

    changeTab(tab, group, options) {
        super.changeTab(tab, group, options);
        this.#updateHeader(tab);
    }

    #updateHeader(tab) {
        const config = PatchViewer.HEADER_CONFIG[tab];
        if (!config || !this.element) return;

        const iconEl = this.element.querySelector('.welcome-app-header__icon');
        const versionEl = this.element.querySelector('.welcome-app-header__version');

        if (iconEl) {
            iconEl.className = `welcome-app-header__icon ${config.icon}`;
        }
        if (versionEl) {
            versionEl.textContent = _loc(config.title);
        }
    }

    #onSearchFilter(_event, query, rgx, html) {
        this.#lastQuery = query ?? '';
        this.#lastRegex = rgx ?? null;
        this.#filterModuleCards(html, this.#lastQuery, this.#lastRegex);
    }

    #applyModuleFilters() {
        const html = this.element;
        if (!html) return;
        const input = html.querySelector('input[type=search]');
        const query = input?.value?.trim() ?? '';
        const cleanQuery = foundry.applications.ux.SearchFilter.cleanQuery(query);
        const rgx = cleanQuery ? new RegExp(cleanQuery, 'i') : null;
        this.#filterModuleCards(html, query, rgx);
    }

    #filterModuleCards(html, query, rgx) {
        const activeFilters = this.#activeFilters;
        const tagFilters = [...activeFilters].filter((filter) => filter !== 'not-owned');
        const requireNotOwned = activeFilters.has('not-owned');
        for (const entry of html.querySelectorAll(".module-card")) {
            const title = entry.querySelector('h3')?.textContent || '';
            const description = entry.querySelector('p')?.textContent || '';
            const tagText = entry.querySelector('.module-card__tags')?.textContent || '';
            const filterList = entry.dataset.filters ? entry.dataset.filters.split('|') : [];
            const matchesQuery = !query || (rgx && [title, description, tagText].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q))));
            const matchesTags = !tagFilters.length || filterList.some(tag => tagFilters.includes(tag));
            const matchesOwned = !requireNotOwned || !entry.classList.contains('module-card--owned');
            entry.hidden = !(matchesQuery && matchesTags && matchesOwned);
        }

        for (const section of html.querySelectorAll('.module-category')) {
            const visibleCards = section.querySelectorAll('.module-card:not([hidden])');
            const isVisible = visibleCards.length > 0;
            section.hidden = !isVisible;
            const divider = section.previousElementSibling;
            if (divider?.classList?.contains('module-category__divider')) {
                divider.hidden = !isVisible;
            }
        }
    }

    #scrollToCategory(target) {
        const container = this.element?.querySelector('.tab[data-tab="content"]');
        const targetEl = this.element?.querySelector(`#${CSS.escape(target)}`);
        if (!targetEl || !container) return;
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const offset = targetRect.top - containerRect.top + container.scrollTop - 10;
        container.scrollTo({ top: offset, behavior: 'smooth' });
    }

    static #scrollToCategoryAction(event, target) {
        const anchor = target?.dataset?.target;
        if (anchor) this.#scrollToCategory(anchor);
    }

    static #closeFeatured(event, target) {
        target?.closest('.news-featured')?.classList.add('hidden');
    }

    static #toggleFilter(event, target) {
        const button = target;
        const filter = button?.dataset?.filter;
        if (!filter) return;
        const isActive = button.classList.toggle('is-active');
        if (isActive) {
            this.#activeFilters.add(filter);
        } else {
            this.#activeFilters.delete(filter);
        }
        this.#applyModuleFilters();
    }

    static #clearFilters(event, target) {
        this.#activeFilters.clear();
        this.element?.querySelectorAll('[data-action="toggleFilter"]').forEach((btn) => btn.classList.remove('is-active'));
        this.#applyModuleFilters();
    }

    _tearDown(options) {
        super._tearDown(options);
        this.#search?.unbind();
        this.#destroyCarousels();
        if (this._dismissOnClose) {
            const migVer = game.settings.get('dsa5', 'migrationVersion');
            game.settings.set('dsa5', 'welcomeAppDismissedVersion', migVer);
        }
    }

    static async #showMore(event, target) {
        const prevVersions = [this.json['notes'][this.json['notes'].length - this.versionIndex]];
        if (prevVersions[0].version == '2.3.0') {
            target.hidden = true;
            return;
        }
        const html = $(this.element);
        const data = await this.fetchVersions(prevVersions);
        html.find('.changelogsection').append(data.changelog[0]);
        html.find('.newssection').append(data.news[0]);
        this.versionIndex += 1;
    }

    async fetchVersions(versions) {
        const lang = game.i18n.lang;
        const changelog = await Promise.all(versions.map(async (x) => await renderTemplate(`systems/dsa5/lazy/patchhtml/changelog_${lang}_${x.version}.html`)));
        const news = await Promise.all(versions.map(async (x) => await renderTemplate(`systems/dsa5/lazy/patchhtml/news_${lang}_${x.version}.html`)));
        return {
            changelog,
            news,
        };
    }

    async _prepareContext(_options) {
        const data = await super._prepareContext(_options);
        const version = this.json['notes'][this.json['notes'].length - 1];
        const patchName = this.json['default'].replace(/VERSION/g, version.version);

        const lang = game.i18n.lang;
        const curVersion = await this.fetchVersions([version]);
        const prevVersions = [this.json['notes'][this.json['notes'].length - 2]];
        const preVersions = await this.fetchVersions(prevVersions);
        const modules = await foundry.utils.fetchJsonWithTimeout(`systems/dsa5/lazy/expansions_${lang}.json`);
        const storeCTAUrl = lang === 'en'
            ? 'https://www.ulissesf-shop.com/virtual-tabletops/'
            : 'https://www.f-shop.de/virtual-tabletops/das-schwarze-auge-vtt/';
        const storeDeUrl = 'https://www.f-shop.de/virtual-tabletops/das-schwarze-auge-vtt/';
        const storeEnUrl = 'https://www.ulissesf-shop.com/virtual-tabletops/';
        const vttInfoUrl = lang === 'en'
            ? 'https://ulisses-us.com/ulisses-virtual-tabletops/virtual-tabletop-dsa-vtt/'
            : 'https://ulisses-spiele.de/game-system/das-schwarze-auge-vtt/';
        const preparedModules = this.#prepareModules(modules);

        return mergeObject(data, {
            patchName,
            changelog: curVersion.changelog[0],
            news: curVersion.news[0],
            prevVersions,
            prevChangeLogs: preVersions.changelog,
            prevNews: preVersions.news,
            modules: preparedModules,
            featuredModules: this.#pickFeaturedModules(preparedModules),
            moduleFilters: this.#collectModuleFilters(preparedModules),
            storeCTAUrl,
            storeDeUrl,
            storeEnUrl,
            vttInfoUrl,
            isEnglish: lang === 'en',
            ...this.#buildWelcomeData({ lang, storeCTAUrl, vttInfoUrl }),
            welcomeParts: await this.#buildAllWelcomeParts({ storeCTAUrl, preparedModules, version }),
            isDismissed: game.settings.get('dsa5', 'welcomeAppDismissedVersion') === game.settings.get('dsa5', 'migrationVersion'),
        });
    }

    #buildWelcomeData({ lang, storeCTAUrl, vttInfoUrl }) {
        const cfg = PatchViewer.WELCOME_CONFIG;
        const resolve = (s) => s?.replace('{storeCTAUrl}', storeCTAUrl).replace('{vttInfoUrl}', vttInfoUrl);

        const videoGuides = (cfg.videoGuides[lang] ?? cfg.videoGuides['en']).map(v => ({
            url: `https://www.youtube.com/watch?v=${v.id}`,
            thumb: `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
            title: _loc(v.titleKey),
            desc: _loc(v.descKey),
        }));

        const moduleCards = cfg.moduleCards.map(c => {
            let href = '';
            if (c.hrefDe || c.hrefEn) {
                href = lang === 'en' ? (c.hrefEn ?? c.hrefDe ?? '') : (c.hrefDe ?? c.hrefEn ?? '');
            } else {
                href = resolve(c.href) ?? '';
            }
            return {
                href,
                image: c.image ?? '',
                title: _loc(c.titleKey),
                desc: _loc(c.descKey),
                category: c.categoryKey ? _loc(c.categoryKey) : '',
                free: c.free ?? false,
                freeLabel: c.free ? _loc('DSA5.welcomeApp.beginnerModules.free') : '',
                external: c.external ?? false,
                icon: c.icon ?? '',
                action: c.action ?? '',
                actionTab: c.actionTab ?? '',
            };
        });

        const gettingStartedSteps = cfg.gettingStartedSteps.map(s => ({
            icon: s.icon,
            text: _loc(s.textKey),
        }));

        const welcomeLinks = cfg.links.map(l => ({
            href: l.href ?? resolve(l.hrefKey) ?? '',
            icon: l.icon,
            label: l.label ?? _loc(l.labelKey),
        }));

        const starterHints = cfg.starterHints.map(h => ({
            shortcut: h.shortcut ?? '',
            icon: h.icon,
            title: _loc(h.titleKey),
            desc: _loc(h.descKey),
            action: h.action ?? '',
        }));

        const vttom = lang === 'de' ? {
            href: 'https://youtube.com/c/VTTom',
            image: 'systems/dsa5/icons/modules/vttom.webp',
            title: 'VTTom',
            titleIcon: 'fa-brands fa-youtube',
            desc: _loc('DSA5.welcomeApp.vttom.desc'),
            cta: _loc('DSA5.welcomeApp.vttom.cta'),
            ctaIcon: 'fa-solid fa-external-link',
            isLink: true,
        } : {
            href: '',
            image: 'systems/dsa5/icons/splashen.webp',
            title: _loc('DSA5.welcomeApp.vttom.comingSoonTitle'),
            titleIcon: 'fa-solid fa-video',
            desc: _loc('DSA5.welcomeApp.vttom.comingSoonDesc'),
            cta: _loc('DSA5.welcomeApp.vttom.comingSoonCta'),
            ctaIcon: 'fa-solid fa-clock',
            isLink: false,
        };

        return { videoGuides, moduleCards, gettingStartedSteps, welcomeLinks, starterHints, vttom };
    }

    #prepareModules(modules) {
        this.#moduleLookup = new Map();
        for (const [categoryIndex, category] of (modules.categories ?? []).entries()) {
            const baseSlug = category.name ?? `category-${categoryIndex}`;
            category.slug = baseSlug.slugify();
            category.items = category.items?.map((item, index) => {
                const owned = item.id ? Boolean(game.modules.get(item.id)) : false;
                if (owned) {
                    item.available = true;
                }
                item.originalIndex = index;
                item.category = category.name;
                item.badges = item.badges ?? [];
                item.tags = Array.isArray(item.tags) ? item.tags : [];
                item.filters = [...item.badges, ...item.tags]
                    .map((value) => foundry.applications.ux.SearchFilter.cleanQuery(String(value)))
                    .filter(Boolean);
                item.filterString = item.filters.join('|');
                if (item.id) {
                    this.#moduleLookup.set(item.id, item);
                }
                return item;
            }) ?? [];
        }

        return modules;
    }

    #pickFeaturedModules(modules, limit = 4) {
        const teasers = [];
        for (const category of modules.categories ?? []) {
            for (const item of category.items ?? []) {
                if (!item?.image?.src || !item?.href) continue;
                if (item.available) continue;
                teasers.push(item);
                if (teasers.length >= limit) return teasers;
            }
        }
        return teasers;
    }

    #collectModuleFilters(modules) {
        const filters = new Map();
        for (const category of modules.categories ?? []) {
            for (const item of category.items ?? []) {
                for (const value of [...(item.badges ?? []), ...(item.tags ?? [])]) {
                    if (!value) continue;
                    const key = foundry.applications.ux.SearchFilter.cleanQuery(String(value));
                    if (!key) continue;
                    const existing = filters.get(key);
                    if (existing) {
                        existing.count += 1;
                    } else {
                        filters.set(key, { label: value, value: key, count: 1 });
                    }
                }
            }
        }
        return Array.from(filters.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    async #buildAllWelcomeParts({ storeCTAUrl, preparedModules, version }) {
        const parts = ['tips', 'highlights'];
        const results = [];
        for (const template of parts) {
            try {
                const templatePath = `systems/dsa5/templates/system/patchviewer/welcome/${template}.hbs`;
                const partData = await this.#prepareWelcomePartData(template, { storeCTAUrl, preparedModules, version });
                results.push(await renderTemplate(templatePath, partData));
            } catch (e) {
                console.warn(`DSA5 | Failed to render welcome part: ${template}`, e);
            }
        }
        return results;
    }

    async #prepareWelcomePartData(template, { storeCTAUrl, preparedModules, version }) {
        const data = { storeCTAUrl };
        switch (template) {
            case 'highlights':
                data.latestVersionText = version?.text ?? '';
                break;
            case 'tips': {
                data.tip = await DidYouKnow.getRandomTip();
                break;
            }
        }
        return data;
    }

    _configureRenderOptions(options) {
        super._configureRenderOptions(options);
        if (this._initialTab) {
            options.tabGroups = { sheet: this._initialTab };
            this._initialTab = null;
        }
    }

    static #switchLanguage(event, target) {
        const lang = target?.dataset?.lang;
        if (!lang) return;
        game.settings.set('dsa5', 'forceLanguage', lang);
        game.settings.set('core', 'language', lang);
        foundry.utils.debouncedReload();
    }

    static async #startTour() {
        await DSATour.ensureRegistered();
        new foundry.applications.sidebar.apps.ToursManagement().render(true);
    }

    static #openLibrary() {
        DSA5_Utility.renderToggle(game.dsa5.itemLibrary);
    }

    static #openJournalBrowser() {
        game.dsa5.apps.journalBrowser.render(true);
    }

    static async #openModuleDetails(event, target) {
        const moduleId = target?.dataset?.moduleId;
        if (!moduleId) return;

        const moduleData = this.#moduleLookup.get(moduleId);
        try {
            const payload = await ModuleDetailsDataLoader.loadData();
            if (!payload?.modules?.[moduleId]) {
                ui.notifications.warn('DSA5.patchViewer.moduleDetails.unavailableText', { localize: true });
                return;
            }
        } catch (error) {
            console.error('DSA5 | Failed to load module details dataset', error);
            ui.notifications.warn('DSA5.patchViewer.moduleDetails.unavailableText', { localize: true });
            return;
        }

        new ModuleDetailsApp(moduleId, moduleData).render(true);
    }

    static async #nextTip() {
        const el = this.element.querySelector('.welcome-tip-text');
        if (!el) return;
        el.classList.add('welcome-tip-text--out');
        await new Promise(r => setTimeout(r, 250));
        el.textContent = await DidYouKnow.getRandomTip();
        el.classList.remove('welcome-tip-text--out');
        el.classList.add('welcome-tip-text--in');
        el.addEventListener('animationend', () => el.classList.remove('welcome-tip-text--in'), { once: true });
    }

    static async #openGameManual() {
        const browser = game.dsa5.apps.journalBrowser;
        await browser.render(false);
        await browser.loadBook('Game Manual (Foundry VTT)', $(browser.element), 'manuals');
        await browser.render(true);
    }

    static #switchToTab(event, target) {
        const tab = target?.dataset?.tab;
        if (!tab) return;
        this.tabGroups.sheet = tab;
        this.render({ force: false });
    }

    static #toggleDismiss(event, target) {
        this._dismissOnClose = target?.checked ?? false;
    }

    static shouldAutoShow() {
        const dismissed = game.settings.get('dsa5', 'welcomeAppDismissedVersion');
        const current = game.settings.get('dsa5', 'migrationVersion');
        return dismissed !== current;
    }

    static getInitialTab() {
        const dismissed = game.settings.get('dsa5', 'welcomeAppDismissedVersion');
        return dismissed === 0 ? 'welcome' : 'newcontent';
    }
}