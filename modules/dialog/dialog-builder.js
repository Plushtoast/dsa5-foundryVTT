/**
 * Factory for creating item test dialogs
 */
export class RollDialogBuilder {
    /**
     * Build speaker object for chat
     * @param {Object} actor - Actor
     * @param {string} tokenId - Token ID
     * @returns {Object} Speaker object
     */
    static buildSpeaker(actor, tokenId) {
        const speaker = {
            token: tokenId,
            actor: actor?.id,
            scene: canvas.scene?.id,
        };
        if (speaker.token == 'emptyActor') speaker.emptyActor = actor.emptyActor;
        return speaker
    }
    /**
     * Create base dialog configuration
     * @param {Object} item - Item
     * @param {Object} actor - Actor
     * @param {string} tokenId - Token ID
     * @param {Object} options - Options
     * @returns {Object} Base dialog configuration
     */
    static createBaseConfig(item, actor, tokenId, options, template, title) {
        return {
            testData: {
                source: item,
                extra: {
                    options,
                    speaker: this.buildSpeaker(actor, tokenId),
                },
            },
            cardOptions: this._setupCardOptions(template, title, tokenId, actor)
        };
    }

    static _setupCardOptions(template, title, tokenId, actor) {
        const token = game.canvas?.tokens?.get(tokenId);
        const cardOptions = {
            speaker: {
                alias: token ? token.name : actor.prototypeToken.name,
                actor: actor.id,
            },
            title,
            template,
            flags: {
                img: { src: actor.prototypeToken.randomImg ? actor.img : actor.prototypeToken.texture.src },
            },
        };
        if (actor.token) {
            cardOptions.speaker.alias = actor.token.name;
            cardOptions.speaker.token = actor.token.id;
            cardOptions.speaker.scene = canvas.scene.id;
            cardOptions.flags.img.src = actor.token.texture.src;
        } else {
            const speaker = ChatMessage.getSpeaker();
            if (speaker.actor == actor.id) {
                cardOptions.speaker.alias = speaker.alias;
                cardOptions.speaker.token = speaker.token;
                cardOptions.speaker.scene = speaker.scene;
                cardOptions.flags.img.src = speaker.token ? canvas.tokens.get(speaker.token).document.texture.src : cardOptions.flags.img.src;
            }
        }
        return cardOptions;
    }

    /**
     * Setup card options for chat
     * @param {string} template - Template path
     * @param {string} title - Card title
     * @param {string} tokenId - Token ID
     * @returns {Object} Card options
     */
    static _setupItemCardOptions(template, title, tokenId) {
        const speaker = ChatMessage.getSpeaker();
        return {
            speaker: {
                alias: speaker.alias,
                scene: speaker.scene,
            },
            flags: {
                img: { src: speaker.token ? canvas.tokens.get(speaker.token).document.texture.src : this.img },
            },
            title,
            template,
        };
    }
}
