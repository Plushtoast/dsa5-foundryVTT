import { DefaultAppv2 } from '../../actor/baseapp.js';
import { tabSlider } from '../helpers/view_helper.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
const { mergeObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export class PatchViewer extends DefaultAppv2 {
    constructor(json, app) {
        super(app);
        this.json = json;
        this.versionIndex = 3;
    }

    static DEFAULT_OPTIONS = {
        classes: ['dsa5', 'largeDialog', 'patches'],
        position: {
            width: 740,
            height: 740,
        },
        window: {
            title: 'Changelog',
            resizable: true,
            contentClasses: ['patchviewer'],
        },
        actions: {
            showMore: PatchViewer.showMore,
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
                { id: 'content', label: 'modules' },
            ],
            initial: 'newcontent',
        },
    };

    async _onRender(context, options) {
        await super._onRender(context, options);
        const html = $(this.element);

        tabSlider(html);
        html.find('img').on('click', (ev) => {
            game.dsa5.apps.DSA5_Utility.showArtwork({
                name: 'Changelog',
                uuid: '',
                img: ev.currentTarget.getAttribute('src'),
            });
        });
    }

    static async showMore(event, target) {
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

        return mergeObject(data, {
            patchName,
            changelog: curVersion.changelog[0],
            news: curVersion.news[0],
            prevVersions,
            prevChangeLogs: preVersions.changelog,
            prevNews: preVersions.news,
            modules,
        });
    }
}