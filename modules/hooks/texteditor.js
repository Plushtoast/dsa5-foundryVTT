import DSA5 from '../config/config-dsa5.js';

const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

export function setEnrichers() {
  const rolls = { Rq: 'roll', Gc: 'GC', Ch: 'CH' };
  const icons = {
    Rq: 'dice',
    Gc: 'dice',
    Ch: 'user-shield',
    AP: 'trophy',
    Pay: 'coins',
    GetPaid: 'piggy-bank',
  };
  const titles = {
    Rq: '',
    Gc: `${_loc('HELP.groupcheck')} `,
    Ch: '',
    AP: '',
    Pay: '',
    GetPaid: '',
  };
  const modRegex = /(-|\+)?\d+/;
  const payRegex = /(-|\+)?\d+(\.\d+)?/;
  const optionRegex = /options={[0-9a-zA-Z: ",]+}/;
  const innerRegex = /(?:\[)(.*?)(?=\])/;
  const payStrings = {
    Pay: _loc('PAYMENT.payButton'),
    GetPaid: _loc('PAYMENT.getPaidButton'),
    AP: _loc('MASTER.awardXP'),
  };

  if (!DSA5.statusRegex) {
    const effects = DSA5.statusEffects.map((x) => _loc(x.name).toLowerCase());
    const keywords = ['status', 'condition', 'level', 'levels'].map((x) => _loc(x)).join('|');
    DSA5.statusRegex = {
      effects: effects,
      regex: new RegExp(`(${keywords}) (${effects.join('|')})`, 'gi'),
    };
  }

  CONFIG.TextEditor.enrichers.push(
    {
      pattern: /@(Rq|Gc|Ch)\[[a-zA-ZöüäÖÜÄ&; -]+ (-|\+)?\d+( options={[0-9a-zA-Z: ",]+})?\]({[a-zA-ZöüäÖÜÄß()&; -]+})?/g,
      enricher: (match, options) => {
        const str = match[0];
        const type = match[1];
        const mod = Number(str.match(modRegex)[0]);
        const json = str.match(optionRegex) ? JSON.parse(str.match(optionRegex)[0].replace(/options=/, '')) : {};
        const data = encodeURIComponent(JSON.stringify(json));
        const skill = str.match(innerRegex)[1].replace(mod, '').replace(optionRegex, '').trim();
        let customText = str.match(/\]\{.*\}/) ? str.match(/\]\{.*\}/)[0].replace(/[\]{}]/g, '') : skill;

        if (json.attrs) {
          customText += ` (${json.attrs.split(',').join('/')}, ${_loc('CHARAbbrev.FW')} ${json.fw || 0})`;
        }

        return $(
          `<a class="roll-button request-${rolls[type]}" data-type="skill" data-json='${data}' data-modifier="${mod}" data-name="${skill}" data-label="${customText}"><em class="fas fa-${icons[type]}"></em>${titles[type]}${customText} ${mod}</a>`,
        )[0];
      },
    },
    {
      pattern: /@(Pay|GetPaid|AP)\[(-|\+)?\d+(\.\d+)?\]({[a-zA-ZöüäÖÜÄß()&; -0-9]+})?/g,
      enricher: (match, options) => {
        const str = match[0];
        const type = match[1];
        const mod = Number(str.match(payRegex)[0]);
        const customText = str.match(/\{.*\}/) ? str.match(/\{.*\}/)[0].replace(/[{}]/g, '') : payStrings[type];
        return $(
          `<a class="roll-button request-${type}" data-type="skill" data-modifier="${mod}" data-label="${customText}"><em class="fas fa-${icons[type]}"></em>${titles[type]}${customText} (${mod})</a>`,
        )[0];
      },
    },
    {
      pattern: DSA5.statusRegex.regex,
      enricher: (match, options) => {
        return $(conditionsMatcher(match))[0];
      },
    },
    {
      pattern: /@Info\[[a-zA-ZöüäÖÜÄ&; -.0-9]+\]/g,
      enricher: async (match, options) => {
        const uuid = match[0].match(innerRegex)[0].slice(1);
        const document = await fromUuid(uuid);

        if (!document || document.type != 'information') return $('<a class="content-link broken"><i class="fas fa-unlink"></i>info</a>')[0];
        if (!game.user.isGM) {
          const templ = await renderTemplate('systems/dsa5/templates/items/infopreview-player.hbs', {
            uuid,
            document
          });
          return $(templ)[0];
        }

        const enriched = await document.system.enrichedProperties({ document });
        const templ = await renderTemplate('systems/dsa5/templates/items/infopreview.hbs', { document, enriched });
        return $(templ)[0];
      },
    },
    {
      pattern: /@EmbedItem\[[a-zA-ZöüäÖÜÄÔ&ë;'()„“:,’ -.0-9›‹áâïîëßôñûé/]+\]({[a-zA-Z=]+})?/g,
      enricher: async (match, options) => {
        const uuid = match[0].match(innerRegex)[0].slice(1);
        let document;

        try {
          document = await fromUuid(uuid);
        } catch (e) {
          document = null;
        }

        if (!document) {
          const parts = uuid.split('.');
          const pack = game.packs.get(parts[0] + '.' + parts[1]);
          if (pack) {
            document = await pack.getDocuments({ name: parts[2] });
            document = document[0];
          }
        }

        if (!document) return $('<a class="content-link broken"><i class="fas fa-unlink"></i></a>')[0];

        const str = match[0];
        const customText = str.match(/\{.*\}/) ? str.match(/\{.*\}/)[0].replace(/[{}]/g, '') : '';

        const customOptions = {};
        if (customText) {
          for (const el of customText.split(' ')) {
            const parts = el.split('=');
            if (parts.length == 2) customOptions[parts[0]] = parts[1];
          }
        }
        return await document._buildEmbedHTML({ values: [] }, customOptions);
      },
    },
    {
      pattern: /@PostChat\[(.*?)\]/g,
      enricher: async (match, options) => {
        const content = match[1];
        return $(
          `<div class="row-section wrap maskfield postChatSection">
              <div class="col ninety"></div>
              <div class="col ten center postContentChat" data-tooltip="SHEET.PostItem"><i class="far fa-comment-dots"></i></div>
              <div class="col postChatContent">${content}</div>
          </div>`,
        )[0];
      },
      /*id: 'postChat',
      onRender: (html) => {
        console.log(html)
      }*/
    },
  );

  const basePrimer = TextEditor._primeCompendiums;
  TextEditor._primeCompendiums = async function (text) {
    const rgx = /@EmbedItem\[[a-zA-ZöüäÖÜÄÔ&ë;'()„“:,’ -.0-9›‹âïîëßôñûé/]+\]/g;
    const packs = new Map();
    for (const t of text) {
      for (const [match] of t.textContent.matchAll(rgx)) {
        const uuid = match.match(innerRegex)[0].slice(1).split('.');

        const name = uuid.pop();
        const pack = uuid.join('.');

        const collection = game.packs.get(pack);
        if (!collection) continue;

        const documentId = collection.index.find((x) => x.name == name)?._id;

        if (!documentId) continue;

        if (!packs.has(collection)) packs.set(collection, []);
        packs.get(collection).push(documentId);
      }
    }
    for (const [pack, ids] of packs.entries()) {
      await pack.getDocuments({ _id__in: ids });
    }
    basePrimer.call(this, text);
  };
}

export function conditionsMatcher(match) {
  const str = match[0];
  let parts = str.split(' ');
  const elem = parts.shift();
  parts = parts.join(' ');
  const cond = DSA5.statusEffects[DSA5.statusRegex.effects.indexOf(parts.toLowerCase())];
  return `<span>${elem} <a class="chatButton chat-condition" data-id="${cond.id}"><img src="${cond.img}"/>${parts}</a></span>`;
}
