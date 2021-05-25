/*export default function(){
  Hooks.on("renderHotbar", )
  Hooks.on("controlToken", (elem, controlTaken) => {
    console.log("hooked")
    console.log(elem, controlTaken)
  })
}*/
export default class DSA5Hotbar extends Hotbar{
  constructor(options) {
    super(options);

    this.quickButtons = []
    Hooks.on("controlToken", (elem, controlTaken) => {
      this.updateDSA5Hotbar()
    })
  }

  async _render(force = false, options = {}) {
    await super._render(force, options);
    $(this._element).append($('<div class="tokenQuickHot"><ul></ul></div>'))
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on('click','.tokenQuickHot li', ev => {
      this.executeQuickButton(ev)
      return false
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
        actor.setupWeapon(result, "attack", {}, tokenId).then(setupData => {
          actor.basicTest(setupData)
        });
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
      console.log("should show one bar")
    }else{
      this.toggleBar(true)
    }
  }

  updateIcons(actor){
    let items = [{
      name: game.i18n.localize("attackWeaponless"),
      id: "attackWeaponless",
      icon: ""
    }]

    let types = ["meleeweapon", "rangeweapon"]
    let traitTypes = ["meleeAttack", "rangeAttack"]
    let result = actor.data.items.filter(x => {
      return (types.includes(x.type) && x.data.data.worn.value == true) || (x.type == "trait" && traitTypes.includes(x.data.data.traitType.value))
    })
    for (let res of result) {
      items.push({
        name: res.name,
        id: res.id,
        icon: res.img
      })
    }
    this.quickButtons = items

    $(this._element).find('.tokenQuickHot ul').html(items.map(x => { return `<li title="${x.name}" data-id="${x.id}"><div style="background-image:url(${x.icon})"></div></li>`}).join(""))
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

