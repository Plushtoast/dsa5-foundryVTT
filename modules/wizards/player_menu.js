import Actordsa5 from "../actor/actor-dsa5.js";
import DSA5Dialog from "../dialog/dialog-dsa5.js";
import OpposedDsa5 from "../system/opposed-dsa5.js";
import RuleChaos from "../system/rule_chaos.js";
import DSA5_Utility from "../system/utility-dsa5.js";

//TODO magical weapon resistance

export default class PlayerMenu extends Application {
  constructor(app) {
    super(app)
    this.entityAbilities = []
    this.summoningModifiers = [
      {
        id: 1, name: 'CONJURATION.offensiveImprovement', descr: "CONJURATION.offensiveImprovementDescr", changes: [
          { key: "data.meleeStats.attack", mode: 2, value: 2 },
          { key: "data.meleeStats.damage", mode: 2, value: 4 },
          { key: "data.rangeStats.attack", mode: 2, value: 2 },
          { key: "data.rangeStats.damage", mode: 2, value: 4 }
        ]
      },
      {
        id: 2, name: 'CONJURATION.defensiveImprovement', descr: "CONJURATION.defensiveImprovementDescr", changes: [
          { key: "data.meleeStats.parry", mode: 2, value: 2 },
          { key: "data.totalArmor", mode: 2, value: 2 },
          { key: "data.status.wounds.gearmodifier", mode: 2, value: 10 }
        ]
      },
      {
        id: 3, name: 'CONJURATION.speedImprovement', descr: "CONJURATION.speedImprovementDescr", changes: [
          { key: "data.status.speed.gearmodifier", mode: 2, value: 2 },
          { key: "data.status.dodge.gearmodifier", mode: 2, value: 2 }
        ]
      },
      { id: 4, name: 'CONJURATION.magicalImprovement', descr: "CONJURATION.magicalImprovementDescr", changes: [], fun: RuleChaos.magicalImprovement },
      {
        id: 5, name: 'CONJURATION.resistanceImprovement', descr: "CONJURATION.resistanceImprovementDescr", changes: [
          { key: "data.status.soulpower.gearmodifier", mode: 2, value: 2 },
          { key: "data.status.toughness.gearmodifier", mode: 2, value: 2 }
        ]
      },
      {
        id: 6, name: 'CONJURATION.mentalImprovement', descr: "CONJURATION.mentalImprovementDescr", changes: [
          { key: "data.characteristics.mu.gearmodifier", mode: 2, value: 2 },
          { key: "data.characteristics.kl.gearmodifier", mode: 2, value: 2 },
          { key: "data.characteristics.in.gearmodifier", mode: 2, value: 2 },
          { key: "data.characteristics.ch.gearmodifier", mode: 2, value: 2 }
        ]
      },
      {
        id: 7, name: 'CONJURATION.physicalImprovement', descr: "CONJURATION.physicalImprovementDescr", changes: [
          { key: "data.characteristics.ff.gearmodifier", mode: 2, value: 2 },
          { key: "data.characteristics.ge.gearmodifier", mode: 2, value: 2 },
          { key: "data.characteristics.ko.gearmodifier", mode: 2, value: 2 },
          { key: "data.characteristics.kk.gearmodifier", mode: 2, value: 2 }
        ]
      }
    ]

    this.conjurationData = {
      qs: 0,
      consumedQS: 0,
      selectedIds: [],
      selectedEntityIds: [],
      conjurationTypes: {
        1: game.i18n.localize("CONJURATION.demon"),
        2: game.i18n.localize("CONJURATION.elemental")
      },
      rules: {
        1: { de: { pack: "dsa5-core.corerules", name: "Beschwörungen" }, en: { pack: "dsa5-core.coreenrules", name: "Summoning" } },
        2: { de: { pack: "dsa5-core.corerules", name: "Beschwörungen" }, en: { pack: "dsa5-core.coreenrules", name: "Summoning" } }
      },
      conjurationType: 1,
      skills: {
        1: ["invocatioMinima", "invocatioMinor", "invocatioMaior"].map(x => game.i18n.localize(`LocalizedIDs.${x}`)),
        2: ["manifesto", "elementalServant", "callDjinn"].map(x => game.i18n.localize(`LocalizedIDs.${x}`))
      },
      modifiers: {
        1: this.summoningModifiers,
        2: this.summoningModifiers
      }
    }
  }

  async rollConjuration(ev) {
    const itemId = $(ev.currentTarget).closest('.item').attr("data-item-id")
    const skill = this.actor.items.find(i => i.data._id == itemId);
    const moreModifiers = [
      { name: game.i18n.localize("conjuringDifficulty"), value: this.conjuration.data.data.conjuringDifficulty.value, selected: true }
    ]
    this.actor.setupSkill(skill.data, { moreModifiers, subtitle: ` (${this.conjuration.name})` }, undefined).then(async (setupData) => {
      const res = await this.actor.basicTest(setupData)
      this.conjurationData.qs = res.result.qualityStep
      this.render(true)
    })
  }

  activateListeners(html) {
    super.activateListeners(html)

    html.find('.conjurationData').change(ev => {
      const elem = $(ev.currentTarget)
      setProperty(this.conjurationData, elem.attr("name"), elem.val())

      if (elem.attr("data-refresh")) this.render()
    })
    html.find('.skill-select').click(ev => {
      this.rollConjuration(ev)
    })
    html.find('.initLibrary').click(async(ev) => {
      $(ev.currentTarget).html('<i class="fas fa-spin fa-spinner"></i>')
      await game.dsa5.itemLibrary.buildEquipmentIndex()
      this.render()
    })
    html.find('.item-edit').click(ev => {
      const itemId = $(ev.currentTarget).closest('.item').attr("data-item-id")
      const item = this.actor.items.find(i => i.data._id == itemId)
      item.sheet.render(true);
    })
    html.find('.selectableRow').click(ev => this.selectImprovement(ev))
    html.find('.finalizeConjuration').click(() => this.finalizeConjuration())
    html.find('.ruleLink').click(() => this.openRules())
    html.find('.showEntity').click(ev => {
      ev.stopPropagation()
      const fun = async() => {
        (await fromUuid(ev.currentTarget.dataset.uuid)).sheet.render(true)
      }
      fun()
    })
  }

  async openRules() {
    const rule = this.conjurationData.rules[this.conjurationData.conjurationType][game.i18n.lang]
    const fun = async () => {
      const pack = game.packs.get(rule.pack)
      const docs = await pack.getDocuments({ name: rule.name })
      for (let doc of docs) {
        doc.sheet.render(true)
      }
    }
    fun()
  }

  finalizeConjuration() {
    if (!this.conjurationData) return

    if (!this.conjuration) return ui.notifications.warn(game.i18n.localize('DSAError.noConjurationActive'))

    const payload = {
      source: this.conjuration.toObject(), creationData: {
        type: this.conjurationData.conjurationType,
        typeName: this.conjurationData.conjurationTypes[this.conjurationData.conjurationType],
        qs: this.conjurationData.qs,
        consumedQS: this.conjurationData.consumedQS,
        modifiers: this.conjurationData.modifiers[this.conjurationData.conjurationType].filter(x => this.conjurationData.selectedIds.includes(x.id)),
        entityIds: this.conjurationData.selectedEntityIds
      }, summoner: { name: this.actor.name, img: this.actor.img }
    }

    if (game.user.isGM) {
      PlayerMenu.createConjuration(payload)
    } else {
      game.socket.emit("system.dsa5", {
        type: "summonCreature",
        payload
      })
    }
  }

  static createConjuration({ source, creationData, summoner }) {
    new ConjurationRequest(source, summoner, creationData).render(true)
  }

  selectImprovement(ev) {
    $(ev.currentTarget).toggleClass("selected")
    const selectedIds = []
    const selectedEntityIds = []
    let entityCost = 0
    $(this._element).find('.selectableRow.selected').each((index, element) => {
      if (element.dataset.entityid) {
        selectedEntityIds.push(element.dataset.id)
        entityCost += (Number(element.dataset.qs) || 0) * -1
      }
      else selectedIds.push(Number(element.dataset.id))
    })
    this.conjurationData.selectedIds = selectedIds
    this.conjurationData.selectedEntityIds = selectedEntityIds
    this.conjurationData.consumedQS = selectedIds.length + entityCost
    this.render()
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "main" }]
    mergeObject(options, {
      classes: options.classes.concat(["dsa5", "largeDialog", "playerMenu"]),
      width: 470,
      height: 740,
      title: game.i18n.localize("PLAYER.title"),
      dragDrop: [{ dragSelector: null, dropSelector: null }]
    });
    options.template = 'systems/dsa5/templates/system/playermenu.html'
    options.resizable = true
    return options;
  }

  _canDragDrop(selector) {
    return true
  }

  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      return false;
    }
    if (data.type == "Actor") {
      const actor = game.actors.get(data.id)

      if (actor.data.type == "creature") {
        this.conjuration = actor
        this.conjurationData.selectedIds = []
        this.conjurationData.selectedEntityIds = []
        for (const key of Object.keys(this.conjurationData.conjurationTypes)) {
          if (actor.data.data.creatureClass.value.includes(this.conjurationData.conjurationTypes[key])) {
            this.conjurationData.conjurationType = key
            break
          }
        }
      } else {
        this.trackedId = data.id
        this.actor = actor
      }
      this.render(true)
    }
  }

  async prepareEntityAbilities(){
    if (game.dsa5.itemLibrary.equipmentBuild){
      const entitiesToSearch = [game.i18n.localize("all"), this.conjurationData.conjurationTypes[this.conjurationData.conjurationType]]
      const items = await Promise.all((await game.dsa5.itemLibrary.getCategoryItems("trait", false)).map(x => x.getItem()))

      return items.filter(x => {
        return x.data.data.distribution && entitiesToSearch.some(y =>  x.data.data.distribution.includes(y))
      })
    }
    return []
  }

  async getData(options) {
    const data = await super.getData(options);

    if (!game.user.isGM && !this.actor) this.actor = game.user.character

    if (this.actor) {
      const services = this.conjurationData.qs - this.conjurationData.consumedQS + 1
      const equipmentIndexLoaded = game.dsa5.itemLibrary.equipmentBuild
      const conjurationSheet = await renderTemplate("systems/dsa5/templates/system/conjuration/summoning.html",
        {
          actor: this.actor,
          conjuration: this.conjuration || { name: game.i18n.localize('CONJURATION.dragConjuration'), img: "icons/svg/mystery-man-black.svg" },
          conjurationData: this.conjurationData,
          services,
          conjurationModifiers: this.conjurationData.modifiers[this.conjurationData.conjurationType],
          equipmentIndexLoaded,
          entityAbilities: await this.prepareEntityAbilities()
        }
      )
      const conjurationskills = this.actor.items.filter(x => this.conjurationData.skills[this.conjurationData.conjurationType].includes(x.name) && ["liturgy", "ceremony", "spell", "ritual"].includes(x.type)).map(x => x.toObject())
      mergeObject(data, {
        conjurationSheet,
        conjurationskills
      })
    }

    mergeObject(data, {
      actor: this.actor || { name: game.i18n.localize("CONJURATION.dragActor"), img: "icons/svg/mystery-man-black.svg" },
      conjurationData: this.conjurationData,
      conjurationTypes: this.conjurationData.conjurationTypes
    })
    return data
  }

}

class ConjurationRequest extends DSA5Dialog {
  constructor(conjuration, summoner, creationData) {
    super({
      title: `${game.i18n.localize("CONJURATION.request")} (${summoner.name})`,
      default: 'ok',
      buttons: {}
    }
    )
    this.conjuration = conjuration
    this.summoner = summoner
    this.creationData = creationData
    this.confirmed = false
  }

  async getData(options) {
    const data = await super.getData(options)
    mergeObject(data, {
      conjuration: this.conjuration,
      summoner: this.summoner,
      confirmed: this.confirmed,
      services: this.creationData.qs - this.creationData.consumedQS + 1,
      creationData: this.creationData,
      conjurationModifiers: this.creationData.modifiers,
      entityModifiers: await Promise.all(this.creationData.entityIds.map(x => fromUuid(x))),
      actor: this.actor
    })
    return data
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "main" }]
    mergeObject(options, {
      classes: options.classes.concat(["dsa5", "largeDialog"]),
      width: 470,
    });
    options.template = 'systems/dsa5/templates/system/conjuration/request.html'
    return options;
  }

  async createActor() {
    this.confirmed = true
    const head = await DSA5_Utility.getFolderForType("Actor", null, game.i18n.localize('PLAYER.conjuration'))
    const folder = await DSA5_Utility.getFolderForType("Actor", head.id, this.creationData.typeName)
    const services = this.creationData.qs - this.creationData.consumedQS + 1
    this.conjuration.folder = folder.id
    if (!this.conjuration.effects) this.conjuration.effects = []

    for (let modifier of this.creationData.modifiers) {
      this.conjuration.effects.push({
        "changes": modifier.changes,
        "duration": {},
        "icon": "icons/svg/aura.svg",
        "label": game.i18n.localize(modifier.name),
        "flags": {
          "dsa5": {
            "value": null,
            "editable": true,
            "description": `${game.i18n.localize('PLAYER.conjuration')} ${game.i18n.localize('extensions')}`,
            "custom": true,
            "auto": null,
            "manual": 0,
            "hideOnToken": true,
            "hidePlayers": false
          }
        }
      })
      if (modifier.fun) {
        modifier.fun(this.conjuration, this.creationData)
      }
    }
    const entityAbilities = (await Promise.all(this.creationData.entityIds.map(x => fromUuid(x)))).map(x => x.toObject(false))
    this.conjuration.items.push(...entityAbilities)
    this.conjuration.effects.push({
      "changes": [],
      "duration": {},
      "icon": "icons/svg/aura.svg",
      "label": game.i18n.localize('PLAYER.services'),
      "flags": {
        "dsa5": {
          "value": services,
          "editable": true,
          "max": 500,
          "description": `${game.i18n.localize('PLAYER.conjuration')} ${game.i18n.localize('PLAYER.services')}`,
          "manual": services,
          "auto": 0,
          "hideOnToken": true,
          "hidePlayers": false
        },
        "core": {
          "statusId": "services"
        }
      }
    })

    this.actor = await Actordsa5.create(this.conjuration)

    const chatmsg = await renderTemplate("systems/dsa5/templates/system/conjuration/chat.html",
      {
        actor: this.actor,
        modifiers: this.creationData.modifiers,
        summoner: this.summoner,
        summonerImg: OpposedDsa5.videoOrImgTag(this.summoner.img),
        conjureImg: OpposedDsa5.videoOrImgTag(this.actor.img),
        services
      })
    await ChatMessage.create(DSA5_Utility.chatDataSetup(chatmsg));
    this.render()
  }

  activateListeners(html) {
    super.activateListeners(html)

    html.find('.createActor').click(() => {
      this.createActor()
    })

    html.on('mousedown', '.newNPC', async (ev) => {
      const id = $(ev.currentTarget).attr("data-id")
      if (ev.button == 2) {
        game.actors.get(id).delete()
        $(ev.currentTarget).remove()
      }
    })
    html.on('click', '.newNPC', async (ev) => {
      const id = $(ev.currentTarget).attr("data-id")
      game.actors.get(id).sheet.render(true)
    })

    html.on("dragstart", ".newNPC", event => {
      event.stopPropagation();
      const a = event.currentTarget;
      let dragData = { type: "Actor", id: a.dataset.id };
      event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    })
  }
}
