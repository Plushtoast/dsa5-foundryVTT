import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import DiceDSA5 from "../system/dice-dsa5.js"

export default class Actordsa5 extends Actor {
    static async create(data, options) {
        if (data instanceof Array)
            return super.create(data, options);

        if (data.items)
            return super.create(data, options);

        // Initialize empty items
        data.items = [];

        data.flags =
        {

        }

        let skills = await DSA5_Utility.allSkills() || [];

        if (data.type == "character") {
            data.items = data.items.concat(skills);


            super.create(data, options); // Follow through the the rest of the Actor creation process upstream
        }
    }

    prepareBaseData() {
        for (let ch of Object.values(this.data.data.characteristics)) {
            ch.value = ch.initial + ch.advances + (ch.modifier || 0);
            ch.bonus = Math.floor(ch.value / 10)
            ch.cost = DSA5_Utility._calculateAdvCost(ch.advances, "characteristic")
        }
    }

    //prepare calculated attributes
    prepareData() {
        try {
            super.prepareData();
            const data = this.data;

            if (this.data.type == "character")
                this.prepareCharacter();



        }
        catch (error) {
            console.error("Something went wrong with preparing actor data: " + error)
            ui.notifications.error(game.i18n.localize("ACTOR.PreparationError") + error)
        }
    }



    prepareCharacter() {
        if (this.data.type != "character")
            return;

        //calculate some attributes
    }


    prepare() {
        let preparedData = duplicate(this.data)
        // Call prepareItems first to organize and process OwnedItems
        mergeObject(preparedData, this.prepareItems())

        // Add speciality functions for each Actor type
        if (preparedData.type == "character") {
            this.prepareCharacter(preparedData)
        }

        //if (preparedData.type == "npc")
        //this.prepareNPC(preparedData)

        //if (preparedData.type == "creature")
        //this.prepareCreature(preparedData)

        return preparedData;
    }

    prepareItems() {
        let actorData = duplicate(this.data)
        let bodySkills = [];
        let socialSkills = [];
        let knowledgeSkills = [];
        let tradeSkills = [];
        let natureSkills = [];
        console.log("preparing items")
        for (let i of actorData.items) {
            try {
                i.img = i.img || DEFAULT_TOKEN;

                // *********** TALENTS ***********
                if (i.type === "skill") {
                    console.log("preparing skill")
                    this.prepareSkill(i);
                    switch (i.data.group.value) {
                        case "body":
                            bodySkills.push(i);
                            break;
                        case "social":
                            socialSkills.push(i);
                            break;
                        case "knowledge":
                            knowledgeSkills.push(i);
                            break;
                        case "trade":
                            tradeSkills.push(i);
                            break;
                        case "nature":
                            natureSkills.push(i);
                            break;
                    }
                }
            }
            catch (error) {
                console.error("Something went wrong with preparing item " + i.name + ": " + error)
                ui.notifications.error("Something went wrong with preparing item " + i.name + ": " + error)
                // ui.notifications.error("Deleting " + i.name);
                // this.deleteEmbeddedEntity("OwnedItem", i._id);
            }
        }
        return {
            bodySkills: bodySkills,
            socialSkills: socialSkills,
            knowledgeSkills: knowledgeSkills,
            tradeSkills: tradeSkills,
            natureSkills: natureSkills
        }
    }
    setupSkill(skill, options = {}) {
        let title = skill.name + " " + game.i18n.localize("Test");
        let testData = {
          target: this.data.data.characteristics[skill.data.characteristic.value].value + skill.data.advances.value,
          extra: {
            actor : this.data,
            options: options,
            skill: skill
          }
        };
    
        
    
        // Setup dialog data: title, template, buttons, prefilled data   
        let dialogOptions = {
          title: title,
          template: "/systems/dsa5/templates/dialog/skill-dialog.html",
          // Prefilled dialog data
    
          data: {
            characteristicList: WFRP4E.characteristics,
            characteristicToUse: skill.data.characteristic.value,
            advantage: this.data.data.status.advantage.value || 0,
            rollMode: options.rollMode
          },
          callback: (html) => {
            // When dialog confirmed, fill testData dialog information
            // Note that this does not execute until DiceWFRP.setupDialog() has finished and the user confirms the dialog
            cardOptions.rollMode = html.find('[name="rollMode"]').val();
            testData.testModifier = Number(html.find('[name="testModifier"]').val());
            testData.testDifficulty = WFRP4E.difficultyModifiers[html.find('[name="testDifficulty"]').val()];
            testData.successBonus = Number(html.find('[name="successBonus"]').val());
            testData.slBonus = Number(html.find('[name="slBonus"]').val());
            let characteristicToUse = html.find('[name="characteristicToUse"]').val();
            // Target value is the final value being tested against, after all modifiers and bonuses are added
            testData.target =
              this.data.data.characteristics[characteristicToUse].value
              + testData.testModifier
              + testData.testDifficulty
              + skill.data.advances.value
              + skill.data.modifier.value
    
            testData.hitLocation = html.find('[name="hitLocation"]').is(':checked');
            let talentBonuses = html.find('[name = "talentBonuses"]').val();
    
            // Combine all Talent Bonus values (their times taken) into one sum
            testData.successBonus += talentBonuses.reduce(function (prev, cur) {
              return prev + Number(cur)
            }, 0)
    
            return { testData, cardOptions };
          }
        };

    
        // Call the universal cardOptions helper
        let cardOptions = this._setupCardOptions("systems/dsa/templates/chat/roll/skill-card.html", title)
  
    
        // Provide these 3 objects to setupDialog() to create the dialog and assign the roll function
        return DiceDSA5.setupDialog({
          dialogOptions: dialogOptions,
          testData: testData,
          cardOptions: cardOptions
        });
      }

    prepareSkill(skill) {

    }
}