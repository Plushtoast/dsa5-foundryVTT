import { DefaultAppv2 } from '../../actor/baseapp.js';
import { tabSlider } from '../helpers/view_helper.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
const { mergeObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export class PatchViewer extends DefaultAppv2 {
    #search;
    #activeFilters = new Set();
    #lastQuery = '';
    #lastRegex = null;

    constructor(json, app) {
        super(app);
        this.json = json;
        this.versionIndex = 3;
    }

    static DEFAULT_OPTIONS = {
        classes: ['dsa5', 'largeDialog', 'patches'],
        position: {
            width: 810,
            height: 740,
        },
        window: {
            title: 'Changelog',
            resizable: true,
            contentClasses: ['patchviewer'],
        },
        actions: {
            showMore: this.#showMore,
            scrollToCategory: this.#scrollToCategoryAction,
            closeFeatured: this.#closeFeatured,
            toggleFilter: this.#toggleFilter,
            clearFilters: this.#clearFilters
        }
    };

    static PARTS = {
        header: {
            template: 'systems/dsa5/templates/system/patchviewer/header.hbs',
        },
        tabs: {
            template: 'systems/dsa5/templates/system/dsatabs.hbs'
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
                { id: 'newcontent', label: 'News' },
                { id: 'changelog', label: 'Changelog' },
                { id: 'content', label: 'DSA5.patchViewer.tab.store' },
            ],
            initial: 'newcontent',
        },
    };

    async _onRender(context, options) {
        await super._onRender(context, options);
        const html = $(this.element);

        tabSlider(html);
        html.find('img').on('click', (ev) => {
            const isShopArtWork = ev.currentTarget.closest('.module-card')

            if (isShopArtWork) return;

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
        let version = this.json['notes'][this.json['notes'].length - 1];
        const patchName = this.json['default'].replace(/VERSION/g, version.version);
        let msg = `<h1>CHANGELOG</h1><p>${patchName}. </br><b>Important updates</b>: ${version.text}</p><p>For details or proposals visit our wiki page at <a href="https://github.com/Plushtoast/dsa5-foundryVTT/wiki" target="_blank">Github</a> or show the <a style="text-decoration: underline;color:#ff6400;" class="showPatchViewer">Full Changelog in Foundry</a>. Have fun.</p>`;
        await ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));

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
            isEnglish: lang === 'en',
        });
    }

    #prepareModules(modules) {
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
}