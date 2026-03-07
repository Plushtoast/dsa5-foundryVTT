/**
 * Automatisierung der Pflanzenhaltbarkeit bei Zeitfortschritt
 *
 */
 

/**
 * Registriert den Zeit-Hook für die Pflanzenhaltbarkeit
 */
export function registerPlantTimeHooks() {
    Hooks.on("updateWorldTime", async (worldTime, delta) => {
        // Nur verarbeiten, wenn die Zeit vorwärts läuft und ein GM eingeloggt ist
        if (delta <= 0 || !game.user.isGM) return;

        const secondsPerDay = 86400;
        const daysBefore = Math.floor((worldTime - delta) / secondsPerDay);
        const daysNow = Math.floor(worldTime / secondsPerDay);
        const dayDelta = daysNow - daysBefore;

        if (dayDelta <= 0) return;

        // Nur Spieler-Charaktere durchsuchen
        const playerActors = game.actors.filter(a => a.hasPlayerOwner);

        for (let actor of playerActors) {
            const plants = actor.items.filter(i => i.type === "plant");
            
            for (let plant of plants) {
                let currentValue = Number(plant.system.remaining?.shelfLife?.value ?? 0);
                let newValue = currentValue - dayDelta;

                let updateData = { "system.remaining.shelfLife.value": newValue };

                // Prüfen, ob die Pflanze durch diesen Zeitsprung verdirbt
                if (newValue <= 0 && !plant.system.isSpoiled) {
                    updateData["system.isSpoiled"] = true;

                    // Würfeln für das Verderben-Ergebnis
                    const roll = await new Roll("1d20").evaluate();
                    let res = String(roll.total);
                    const v = roll.total;
                    
                    // Ergebnis-Mapping (identisch zur item-sheet.js Logik)
                    if (v >= 3 && v <= 5) res = "3_5"; 
                    else if (v >= 6 && v <= 7) res = "6_7"; 
                    else if (v >= 8 && v <= 9) res = "8_9"; 
                    else if (v >= 11 && v <= 12) res = "11_12"; 
                    else if (v >= 14 && v <= 15) res = "14_15";

                    updateData["flags.dsa5.spoiledResult"] = res;

                    // --- REPLIZIERTE CHAT-NACHRICHT (Direkt-Logik) ---
                    const actorName = actor.name;
                    const effectText = game.i18n.localize(`PLANT.spoiledRows.R${res}`);
                    const localizedMessage = game.i18n.format("PLANT.spoiledChatMessage", { 
                        itemName: plant.name, 
                        actorName: actorName 
                    });

                    const content = `
                        <div style="display: flex; justify-content: center; margin-bottom: 15px;">
                            <div class="spoiled-plant-image-click" 
                                 data-uuid="${plant.uuid}" 
                                 title="${plant.name} öffnen" 
                                 style="width: 55px; height: 55px; background-image: url('${plant.img}'); background-size: contain; background-repeat: no-repeat; background-position: center; cursor: pointer;">
                            </div>
                        </div>
                        <p>${localizedMessage}</p>
                        <p><i>${effectText}</i></p>
                    `;

                    await ChatMessage.create({
                        content: content,
                        whisper: ChatMessage.getWhisperRecipients("GM")
                    });
                }

                // Item aktualisieren
                await plant.update(updateData);
            }
        }
    });
}
