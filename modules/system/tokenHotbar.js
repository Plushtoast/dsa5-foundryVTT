export default class DSA5Hotbar extends Hotbar{
  constructor(options) {
    super(options);

    this.quickButtons = []
    this.combatSkills = [game.i18n.localize("LocalizedIDs.selfControl"), game.i18n.localize("LocalizedIDs.featOfStrength"), game.i18n.localize("LocalizedIDs.perception")]
    this.defaultSkills = [game.i18n.localize("LocalizedIDs.perception")]
    Hooks.on("controlToken", (elem, controlTaken) => {
      this.updateDSA5Hotbar()
    })
  }

  async _render(force = false, options = {}) {
    await super._render(force, options);
    $(this._element).append($('<div class="tokenQuickHot"><ul></ul></div>'))
    this.addContextColor()
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on('click','.tokenQuickHot li', ev => {
      this.executeQuickButton(ev)
      return false
    })
    html.on('mouseenter', '.tokenQuickHot li', ev => {
      const li = $(ev.currentTarget)
      const id = li.attr("data-id")
      let tooltip = li.find(".tooltip");
      if (tooltip) tooltip.remove();
      let item = this.quickButtons.find(x => x.id == id)
      tooltip = document.createElement("SPAN");
      tooltip.classList.add("tooltip");
      tooltip.textContent = item.name;
      li.append($(tooltip));
    })
    html.on('mouseout', '.tokenQuickHot li', ev => {
      const li = $(ev.currentTarget)
      let tooltip = li.find(".tooltip");
      if (tooltip) tooltip.remove();
    })
  }

  executeQuickButton(ev){
    const actor = canvas.tokens.controlled[0].actor
    const tokenId = canvas.tokens.controlled[0].id
    const id = $(ev.currentTarget).attr("data-id")
    if ("attackWeaponless" == id) {
      actor.setupWeaponless("attack", {}, tokenId).then(setupData => {
        actor.basicTest(setupData)
      });
    } else {
      let result = actor.items.get(id)
      if (result) {
        switch(result.type){
          case "meleeweapon":
          case "rangeweapon":
          case "trait":
            actor.setupWeapon(result, "attack", {}, tokenId).then(setupData => {
              actor.basicTest(setupData)
            });
            break
          case "liturgy":
          case "spell":
            actor.setupSpell(result.data, {}, tokenId).then(setupData => {
              actor.basicTest(setupData)
            });
            break
          case "skill":
            actor.setupSkill(result.data, {}, tokenId).then(setupData => {
              actor.basicTest(setupData)
            });
            break
        }

      }
    }
  }

  addContextColor(){
    const parry = new RegExp(` ${game.i18n.localize('CHAR.PARRY')}$`)
    const attack = new RegExp(` ${game.i18n.localize('CHAR.ATTACK')}$`)
    const macroList = $(this._element).find('#macro-list')
    for(const macro of this.macros){
      if(!macro.macro) continue

      if(parry.test(macro.macro.data.name)){
        macroList.find(`[data-macro-id="${macro.macro.data._id}"]`).addClass("parry")
      }else if(attack.test(macro.macro.data.name)){
        macroList.find(`[data-macro-id="${macro.macro.data._id}"]`).addClass("attack")
      }
    }
  }

  updateDSA5Hotbar(){
    if(canvas.tokens.controlled.length == 1){
      const actor = canvas.tokens.controlled[0].actor
      if(actor.isOwner){
        this.updateIcons(actor)
        this.toggleBar(false)
      }else{
        this.toggleBar(true)
      }
    }else{
      this.toggleBar(true)
    }
  }

  updateIcons(actor){
    let items = []
    if(game.combat){
      items.push({
        name: game.i18n.localize("attackWeaponless"),
        id: "attackWeaponless",
        icon: "systems/dsa5/icons/categories/attack_weaponless.webp"
      })

      let types = ["meleeweapon", "rangeweapon"]
      let traitTypes = ["meleeAttack", "rangeAttack"]
      let attacks = actor.data.items.filter(x => {
        return (types.includes(x.type) && x.data.data.worn.value == true) || (x.type == "trait" && traitTypes.includes(x.data.data.traitType.value))
      })
      for (let res of attacks) {
        items.push({
          name: res.name,
          id: res.id,
          icon: res.img,
          cssClass: "",
          abbrev: res.name[0]
        })
      }
      types = ["liturgy", "spell"]
      let spells = actor.data.items.filter(x => types.includes(x.type) && x.data.data.effectFormula.value)
      for (let res of spells) {
        items.push({
          name: res.name,
          id: res.id,
          icon: res.img,
          cssClass: "spell",
          abbrev: res.name[0]
        })
      }
      let skills = actor.data.items.filter(x => ["skill"].includes(x.type) && this.combatSkills.includes(x.name))
      for (let res of skills) {
        items.push({
          name: `${res.name} (${res.data.data.talentValue.value})`,
          id: res.id,
          icon: res.img,
          cssClass: "skill",
          abbrev: res.name[0]
        })
      }
    }else{
      let skills = actor.data.items.filter(x => ["skill"].includes(x.type) && this.defaultSkills.includes(x.name))
      for (let res of skills) {
        items.push({
          name: `${res.name} (${res.data.data.talentValue.value})`,
          id: res.id,
          icon: res.img,
          cssClass: "skill",
          abbrev: res.name[0]
      })
    }
      skills = actor.data.items.filter(x => ["skill"].includes(x.type) && !this.defaultSkills.includes(x.name) && x.data.data.talentValue.value > 0)
      skills = skills.sort((a, b) => { return b.data.data.talentValue.value - a.data.data.talentValue.value}).slice(0, 10)
      for (let res of skills) {
        items.push({
          name: `${res.name} (${res.data.data.talentValue.value})`,
          id: res.id,
          icon: res.img,
          cssClass: "skill",
          abbrev: res.name[0]
        })
      }



    }
    this.quickButtons = items
    $(this._element).find('.tokenQuickHot ul').html(items.map(x => { return `<li class="${x.cssClass}" data-id="${x.id}"><div style="background-image:url(${x.icon})">${x.abbrev || ""}</div></li>` }).join(""))

  }

  toggleBar(hide){
    const elem = $(this._element).find('.tokenQuickHot')
    if(hide){
      elem.removeClass("expanded")
    }else{
      elem.addClass("expanded")
    }
  }
}

