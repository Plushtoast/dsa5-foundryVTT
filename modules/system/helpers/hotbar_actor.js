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
