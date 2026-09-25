import ImageFramePicker from './image-frame-picker.js';

/**
 * Portrait or token image, including the hotbar avatar crop.
 * `preferImg` uses the actor image when one exists; the hotbar portrait source still applies its frame.
 */
export class ActorAvatar {
  static resolve(actor, tokenDoc = undefined, { preferImg = false } = {}) {
    if (!actor) return { src: '', style: '' };

    const config = actor.prototypeToken?.getFlag?.('dsa5', 'hotbarAvatar');
    const portrait = config?.source === 'portrait';
    if ((portrait || preferImg) && actor.img) {
      return {
        src: actor.img,
        style: portrait ? ImageFramePicker.buildStyle(config) : '',
      };
    }

    return {
      src: resolveActorTokenImage(actor, tokenDoc),
      style: '',
    };
  }
}

export function resolveHotbarActorContext() {
  const controlled = canvas?.tokens?.controlled || [];

  if (controlled.length === 1) {
    const actor = controlled[0]?.actor;
    if (actor?.isOwner) {
      return {
        actor,
        tokenId: controlled[0]?.id,
      };
    }
  }

  if (controlled.length === 0) {
    const actor = game.user?.character;
    if (actor?.isOwner) {
      return {
        actor,
        tokenId: actor?.token?.id ?? actor?.getActiveTokens?.()[0]?.id,
      };
    }
  }

  return {
    actor: undefined,
    tokenId: undefined,
  };
}

/** Token document for this actor: explicit id, else the controlled token, else the first token on the scene. */
export function sceneTokenDocument(actor, tokenId = null) {
  if (!actor) return null;
  if (actor.isToken) return actor.token ?? null;

  if (tokenId) {
    return canvas.scene?.tokens?.get(tokenId) ?? canvas.tokens?.get(tokenId)?.document ?? null;
  }

  const controlled = canvas.tokens?.controlled?.find((token) => token.actor?.id === actor.id);
  if (controlled?.document) return controlled.document;
  return actor.getActiveTokens?.()[0]?.document ?? null;
}

/**
 * Image for the actor as it appears on the canvas.
 * Pass a token document to use that token. Pass null when you already know there is no scene token.
 * Omit the argument to resolve a scene token automatically.
 * @param {Actor|null} actor
 * @param {TokenDocument|null} [tokenDoc]
 */
export function resolveActorTokenImage(actor, tokenDoc = undefined) {
  if (!actor) return '';

  let sceneSrc = '';
  if (tokenDoc) sceneSrc = tokenDoc.texture?.src || '';
  else if (tokenDoc === undefined) sceneSrc = sceneTokenDocument(actor)?.texture?.src || '';

  if (sceneSrc) return sceneSrc;
  if (actor.prototypeToken?.randomImg) return actor.img || '';
  return actor.prototypeToken?.texture?.src || actor.img || '';
}
