import DSA5 from "./config-dsa5.js"
import DiceDSA5 from "./dice-dsa5.js"
import DSA5_Utility from "./utility-dsa5.js"

export default class EquipmentDamage {
  static armorWearModifier(armorData, armorValue) {
    if (game.settings.get("dsa5", "armorAndWeaponDamage")) {
      switch (EquipmentDamage.calculateWear(armorData)) {
        case 1:
        case 2:
          armorValue -= 1
          break
        case 3:
        case 4:
          armorValue = 0
      }
    }
    return Math.max(0, Number(armorValue))
  }

  static armorEncumbranceModifier(armor){
    if (game.settings.get("dsa5", "armorAndWeaponDamage")) {
      if (EquipmentDamage.calculateWear(armor) > 1) return 1
    }
    return 0
  }

  static async showDamageToGear(preData, testData){
    if (game.settings.get("dsa5", "armorAndWeaponDamage")) {
      const source = preData.source
      if(testData.successLevel < -1 && ["meleeweapon","rangeweapon","armor"].includes(source.type)){
        const actor = await DSA5_Utility.getSpeaker(testData.speaker)
        return actor.items.get(source._id).uuid
      }
    }
    return undefined
  }

  static breakingTest(item){
    if(item.data.data.structure.max <= 0 || !item) return

    let breakingResistance = 0
    let category
    if(item.type=="armor"){
      category = game.i18n.localize(`ARMORSUBCATEGORIES.${item.data.data.subcategory}`)
      breakingResistance = DSA5.armorSubcategories[item.data.data.subcategory]
    }else{
      category = item.data.data.combatskill.value
      breakingResistance = DSA5.weaponStabilities[game.i18n.localize(`LocalizedCTs.${category}`)]
    }
    if(!breakingResistance){
      ui.notifications.error(game.i18n.format("DSAError.noBreakingResistance", {item: item.name}))
      return
    }

    new Dialog({
      title: game.i18n.localize("DSASETTINGS.armorAndWeaponDamage"),
      content: `<label for="threshold">${game.i18n.format('WEAR.check', {category})}</label>: <input style="width:80px" dtype="number" name="threshold" type="number" value="${breakingResistance}"/>`,
      buttons: {
        Yes: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: game.i18n.localize("Roll"),
          callback: (dlg) => {
            EquipmentDamage.resolveBreakingTest(item, Number(dlg.find('[name="threshold"]').val()), category)
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("cancel")
        }
      },
      default: 'Yes'
    }).render(true)
  }

  static async applyDamageLevelToItem(item, amount){
    const damage = Math.floor(item.data.data.structure.max * 0.25) * amount
    await item.update({ "data.structure.value": Math.max(0, item.data.data.structure.value - damage) })
  }

  static async resolveBreakingTest(item, threshold, category){
    const roll = await DiceDSA5.manualRolls(new Roll("1d20").evaluate({ async: false }), game.i18n.format('WEAR.check', { category }))
    DiceDSA5.showDiceSoNice(roll, await game.settings.get("core", "rollMode"))
    const damage = roll.total > threshold ? 1 : 0
    await this.applyDamageLevelToItem(item, damage)
    const wear = EquipmentDamage.calculateWear(item.data)
    let infoMsg = `<h3><b>${item.name}</b></h3>
    <p>${game.i18n.format('WEAR.check', {category})}</p>
    <b>${game.i18n.localize('Roll')}</b>: ${roll.total}<br/>
    <b>${game.i18n.localize('target')}</b>: ${threshold}<br/>
    <b>${game.i18n.localize('result')}</b>: ${game.i18n.localize(`WEAR.${item.type}.${wear}`)}`
    ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
  }

  static damageTooltip(item){
    if (game.settings.get("dsa5", "armorAndWeaponDamage")) {
      return game.i18n.localize(`WEAR.${item.type}.${this.calculateWear(item)}`)
    }
    return ""
  }

  static weaponWearModifier(weaponData) {
    if (game.settings.get("dsa5", "armorAndWeaponDamage")) {
      switch (EquipmentDamage.calculateWear(weaponData)) {
        case 1:
          weaponData.attack -= 1
          if (weaponData.parry) weaponData.parry -= 1
          break
        case 2:
          weaponData.attack -= 2
          if (weaponData.parry) weaponData.parry -= 2
          break
        case 3:
        case 4:
          weaponData.attack = 0
          if (weaponData.parry) weaponData.parry = 0
      }
    }
  }

  static calculateWear(itemData) {
    if (Number(itemData.data.structure.max <= 0)) return 0

    return Math.floor((1 - itemData.data.structure.value / itemData.data.structure.max) * 4)
  }

}