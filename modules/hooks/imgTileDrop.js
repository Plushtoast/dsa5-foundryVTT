export function bindImgToCanvasDragStart(html, selector = "img") {
    if (!game.user.isGM) return

    html.find(selector).each(function(i, img) {
        img.setAttribute("draggable", true);
        img.addEventListener("dragstart", ev => dragTileImg(ev))
    })
}

const dragTileImg = (event) => {
    canvas.tiles.activate()
    const imgPath = event.currentTarget.src
    const img = event.currentTarget
    const ratioY = canvas.dimensions.sceneHeight / img.naturalHeight
    const ratioX = canvas.dimensions.sceneWidth / img.naturalWidth
    const ratio = Math.min(1, ratioX, ratioY)
    const tileSize = Math.round(canvas.dimensions.size / ratio);
    let dragData = {
        type: "Tile",
        texture: {src: imgPath},
        tileSize
    };
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    const w = img.naturalWidth * ratio * canvas.stage.scale.x;
    const h = img.naturalHeight * ratio * canvas.stage.scale.y;
    const preview = DragDrop.createDragImage(img, w, h);
    event.dataTransfer.setDragImage(preview, w / 2, h / 2)
}