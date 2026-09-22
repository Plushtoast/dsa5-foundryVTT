import DSA5 from '../config/config-dsa5.js';
import InformationData from '../data/item/information.js';
import DSA5Payment from '../system/payment/payment.js';

const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

const modRegex = /(-|\+)?\d+/;
const optionRegex = /options=\{[0-9a-zA-ZöüäÖÜÄß: ",&;()+.\-]+\}/;
const innerRegex = /(?:\[)(.*?)(?=\])/;

function formatEnricherMod(modifier) {
  if (modifier < 0) return ` ${modifier}`;
  if (modifier > 0) return ` +${modifier}`;
  return '';
}

function parseSkillModSegment(segment) {
  const modMatch = segment.match(modRegex);
  const mod = modMatch ? Number(modMatch[0]) : 0;
  const skill = segment.replace(modRegex, '').trim();
  return { skill, mod };
}

export function parseEnricherOptions(text) {
  const match = String(text ?? '').match(optionRegex);
  if (!match) return {};
  return JSON.parse(match[0].replace(/options=/, ''));
}

function parseEnricherInner(inner) {
  const options = parseEnricherOptions(inner);
  const { skill, mod } = parseSkillModSegment(inner.replace(optionRegex, '').trim());
  return { skill, mod, options };
}

function appendAttrsLabel(label, options = {}) {
  if (!options.attrs) return label;
  return `${label} (${options.attrs.split(',').join('/')}, ${_loc('CHARAbbrev.FW')} ${options.fw || 0})`;
}

function parseGcRollOptions(inner) {
  if (optionRegex.test(inner) || !inner.includes(',')) return null;

  return inner.split(',').map((segment) => {
    const { skill, mod } = parseSkillModSegment(segment.trim());
    return { target: skill, modifier: mod, type: 'skill' };
  });
}

export function formatGcEnricherLabel(skill, mod, options = {}) {
  const extended = Boolean(options.interval || options.maxRolls != null || options.targetQs != null);
  let label = `${skill || ''}${formatEnricherMod(mod)}`;

  const extras = [];
  if (options.interval) extras.push(options.interval);
  if (options.maxRolls === 0) extras.push(_loc('GROUPCHECK.unlimitedAttempts'));
  else if (options.maxRolls != null) extras.push(_loc('GROUPCHECK.attempts', { count: options.maxRolls }));
  if (extras.length) label += `, ${extras.join(', ')}`;

  return { label, extended };
}

export function parseGcEnricher(inner) {
  const rollOptions = parseGcRollOptions(inner);
  if (rollOptions?.length) return { rollOptions };

  const parsed = parseEnricherInner(inner);
  return { ...parsed, ...formatGcEnricherLabel(parsed.skill, parsed.mod, parsed.options) };
}

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
  const payRegex = /(-|\+)?\d+(\.\d+)?/;
  const payStrings = {
    Pay: _loc('PAYMENT.payButton'),
    GetPaid: _loc('PAYMENT.getPaidButton'),
    AP: _loc('MASTER.awardXP'),
  };
  const tooltips = {
    Rq: _loc('TT.enricherRq'),
    Gc: _loc('TT.enricherGc'),
    Ch: _loc('TT.enricherCh'),
    AP: _loc('TT.enricherAP'),
    Pay: _loc('TT.enricherPay'),
    GetPaid: _loc('TT.enricherGetPaid'),
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
      pattern: /@Gc\[([^\]]+)\]({[a-zA-ZöüäÖÜÄß()&; -]+})?/g,
      enricher: (match) => {
        const [, inner, customTextMatch] = match;
        const customTextOverride = customTextMatch ? customTextMatch.replace(/[{}]/g, '') : null;
        const parsed = parseGcEnricher(inner);
        const { escapeHTML } = foundry.utils;

        if (parsed.rollOptions?.length) {
          const label =
            customTextOverride || parsed.rollOptions.map((optn) => `${optn.target}${formatEnricherMod(optn.modifier)}`).join(', ');
          const rollOptionsData = encodeURIComponent(JSON.stringify(parsed.rollOptions));
          return $(
            `<a class="roll-button request-${rolls.Gc}" data-tooltip="${tooltips.Gc}" data-type="skill" data-roll-options="${rollOptionsData}" data-label="${escapeHTML(label)}"><em class="fas fa-${icons.Gc}"></em>${titles.Gc}${escapeHTML(label)}</a>`,
          )[0];
        }

        const { skill, mod, options } = parsed;
        let label = customTextOverride || parsed.label;
        if (!customTextOverride) label = appendAttrsLabel(label, options);
        const title = !customTextOverride && parsed.extended ? '' : titles.Gc;
        const data = encodeURIComponent(JSON.stringify(options || {}));

        return $(
          `<a class="roll-button request-${rolls.Gc}" data-tooltip="${tooltips.Gc}" data-type="skill" data-json="${data}" data-modifier="${mod}" data-name="${escapeHTML(skill)}" data-label="${escapeHTML(label)}"><em class="fas fa-${icons.Gc}"></em>${title}${escapeHTML(label)}</a>`,
        )[0];
      },
    },
    {
      pattern: /@(Rq|Ch)\[([^\]]+)\]({[a-zA-ZöüäÖÜÄß()&; -]+})?/g,
      enricher: (match) => {
        const [, type, inner, customTextMatch] = match;
        const { skill, mod, options } = parseEnricherInner(inner);
        const data = encodeURIComponent(JSON.stringify(options));
        let customText = customTextMatch ? customTextMatch.replace(/[{}]/g, '') : skill;
        if (!customTextMatch) customText = appendAttrsLabel(customText, options);

        return $(
          `<a class="roll-button request-${rolls[type]}" data-tooltip="${tooltips[type]}" data-type="skill" data-json="${data}" data-modifier="${mod}" data-name="${skill}" data-label="${customText}"><em class="fas fa-${icons[type]}"></em>${titles[type]}${customText}${formatEnricherMod(mod)}</a>`,
        )[0];
      },
    },
    {
      pattern: /@(Pay|GetPaid)\[([^\]]+)\]({[a-zA-ZöüäÖÜÄß()&; -0-9]+})?/g,
      enricher: async (match) => {
        const [, type, amountRaw, customTextMatch] = match;
        const amount = amountRaw.trim();
        const customText = customTextMatch ? customTextMatch.replace(/[{}]/g, '') : payStrings[type];
        const roll = DSA5Payment.paymentRoll(amount);
        const numeric = roll?.terms.length === 1 && roll.terms[0] instanceof foundry.dice.terms.NumericTerm;
        const amountLabel = numeric ? await DSA5Payment._moneyToString(roll.terms[0].number) : foundry.utils.escapeHTML(amount);
        return $(
          `<a class="roll-button request-${type}" data-tooltip="${tooltips[type]}" data-type="skill" data-modifier="${encodeURIComponent(amount)}" data-label="${customText}"><em class="fas fa-${icons[type]}"></em>${titles[type]}${customText} (${amountLabel})</a>`,
        )[0];
      },
    },
    {
      pattern: /@AP\[(-|\+)?\d+(\.\d+)?\]({[a-zA-ZöüäÖÜÄß()&; -0-9]+})?/g,
      enricher: async (match) => {
        const [str, , , customTextMatch] = match;
        const mod = Number(str.match(payRegex)[0]);
        const customText = customTextMatch ? customTextMatch.replace(/[{}]/g, '') : payStrings.AP;
        return $(
          `<a class="roll-button request-AP" data-tooltip="${tooltips.AP}" data-type="skill" data-modifier="${mod}" data-label="${customText}"><em class="fas fa-${icons.AP}"></em>${titles.AP}${customText} (${mod})</a>`,
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

        const templ = await InformationData.renderInfoPreview(document, { isGM: game.user.isGM });
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
    await Promise.all(Array.from(packs, ([pack, ids]) => pack.getDocuments({ _id__in: ids })));
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
