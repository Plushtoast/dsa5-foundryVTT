# Foundry V14 Token Transition API

Foundry V14 ships `TextureTransitionFilter` for animated texture transitions on tokens.

## Public API — Token.animate()

The easiest way to trigger a transition is through `Token.animate()`:

```js
tokenObject.animate(
  { texture: { src: 'path/to/new-texture.webp' } },
  { transition: 'swirl', duration: 1000 }
);
```

This only fires when `texture.src` actually changes.
Available transition types: `fade`, `swirl`, `waterDrop`, `morph`, `crosshatch`,
`wind`, `waves`, `whiteNoise`, `hologram`, `hole`, `holeSwirl`, `glitch`, `dots`.

## Manual Filter Usage

For effects that don't involve a `texture.src` change (appear/disappear),
you must drive `TextureTransitionFilter` manually:

```js
const Filter = foundry.canvas.rendering.filters.TextureTransitionFilter;
const CanvasAnimation = foundry.canvas.animation.CanvasAnimation;

const filter = Filter.create();
filter.type = Filter.TYPES.SWIRL;

// Render the target into a RenderTexture (raw PIXI.Texture won't work on PrimarySpriteMesh)
const targetRT = canvas.app.renderer.generateTexture(mesh, { resolution: mesh.texture.resolution });
filter.targetTexture = targetRT;

mesh.filters ??= [];
mesh.filters.unshift(filter);

const promise = CanvasAnimation.animate(
  [{ attribute: 'progress', parent: filter.uniforms, to: 1 }],
  { name: 'myTransition', duration: 800, context: mesh }
);

promise.finally(() => {
  mesh.filters?.findSplice(f => f === filter);
  targetRT.destroy(true);
});
```

Key gotchas:
- The `TextureTransitionFilter.animate()` static helper exists but is not used
  internally by Foundry and doesn't work reliably on `PrimarySpriteMesh`.
- Targets must be `RenderTexture` instances, not raw `PIXI.Texture` references.
- Setting `mesh.texture = PIXI.Texture.EMPTY` collapses the mesh geometry
  (1×1 orig rect), breaking filter UV mapping.
- `PrimarySpriteMesh` is a child of the `PrimaryCanvasGroup` (a `CachedContainer`),
  so filters on it are rendered through the cached pipeline.
