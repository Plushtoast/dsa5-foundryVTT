export function bindImgToCanvasDragStart(html, selector = "img"){
    if(!game.user.isGM) return

    html.find(selector).each(function(i, img) {
        img.setAttribute("draggable", true);
        img.addEventListener("dragstart", ev => dragTileImg(ev))
    })
}

const dragTileImg = (event) => {
    console.log("ye", event)
    canvas.activateLayer("background")
    const imgPath = event.currentTarget.src 
    const tileSize = 50;
    let dragData = { 
        type: "Tile", 
        img: imgPath,
        tileSize
    };
    const ratio = canvas.dimensions.size / tileSize;
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    const img = event.currentTarget
    const w = img.naturalWidth * ratio * canvas.stage.scale.x;
    const h = img.naturalHeight * ratio * canvas.stage.scale.y;
    const preview = DragDrop.createDragImage(img, w, h);
    event.dataTransfer.setDragImage(preview, w/2, h/2)
}