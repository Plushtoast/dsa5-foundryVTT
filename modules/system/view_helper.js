export function svgAutoFit(elem, width = 320, height = 40) {
    elem.attr({
        'width': width * 0.8,
        'viewBox': `0 0 ${width} ${height}`
    })
    const text = elem.find('text')
    const bb = text.get(0).getBBox();
    const widthTransform = width / bb.width;
    const heightTransform = height / bb.height;
    const transformW = widthTransform < heightTransform
    const value = transformW ? widthTransform : heightTransform;
    if (isFinite(value)) {
        text.attr({
            "transform": "matrix(" + value + ", 0, 0, " + value + ", 0,0)",
            "x": Math.max(0, (width - bb.width) / 2),
            "y": height * 0.75 / (transformW ? 1 : value)
        });
    }
}

export async function itemFromDrop(dragData, actorId, toObject = true) {
    let item
    let selfTarget
    if (dragData.type == "Actor") {
        item = await Actor.implementation.fromDropData(dragData)
        selfTarget = actorId === item.id
    } else {
        item = await Item.implementation.fromDropData(dragData)
        selfTarget = actorId === item.parent?.uuid
    }
    let typeClass = item?.type

    if (toObject) {
        item = item.toObject()
    }

    if (dragData.amount) item.system.quantity.value = Number(dragData.amount)

    return { item, typeClass, selfTarget }
}

export function slist(html, target, callback, itemTag = "div") {
    target = html.find(target)[0];
    if (!target) return

    target.classList.add("slist");

    let items = target.querySelectorAll(itemTag),
        current = null;
    for (let i of items) {
        i.draggable = true;

        i.addEventListener("dragstart", function (ev) {
            current = this;
        });

        i.addEventListener("dragover", function (evt) {
            evt.preventDefault();
        });

        i.addEventListener("drop", async function (evt) {
            evt.preventDefault();
            if (this != current) {
                let currentpos = 0,
                    droppedpos = 0;
                for (let it = 0; it < items.length; it++) {
                    if (current == items[it]) { currentpos = it; }
                    if (this == items[it]) { droppedpos = it; }
                }
                if (currentpos < droppedpos) {
                    this.parentNode.insertBefore(current, this.nextSibling);
                } else {
                    this.parentNode.insertBefore(current, this);
                }
                await callback(target)
            }
        });
    }
}

export function tinyNotification(message) {
    let container = $('.tinyNotifications')
    if (!container.length) {
        $('body').append('<ul class="tinyNotifications"></ul>')
        container = $('.tinyNotifications')
    }
    const elem = $(`<li>${message}</li>`)
    container.prepend(elem)
    setTimeout(function () { elem.remove() }, 1500)
}

function IconVisibility(html, menu, btnLeft, btnRight){
    let scrollLeftValue = Math.ceil(menu.scrollLeft)
    let scrollableWidth = menu.scrollWidth - menu.clientWidth

    btnLeft.style.display = scrollLeftValue > 0 ? "block" : "none"
    btnRight.style.display = scrollableWidth > scrollLeftValue ? "block" : "none"

    columnLayout(html)
}

function columnLayout(html){
    const width = html.width()
    const minWidth = Number(getComputedStyle(document.body).getPropertyValue('--minColumnWidth').replace("px", ""))
    const width60 = Number(getComputedStyle(document.body).getPropertyValue('--minColumnWidth60').replace("px", ""))
    const borderWidth = + 6

    if(width  >= minWidth * 2 + borderWidth){
        html.removeClass("singleColumnLayout")
    }else{
        html.addClass("singleColumnLayout")
    }
    if(width <= width60){
        html.addClass("minimumColumnLayout")
    }else{
        html.removeClass("minimumColumnLayout")
    }
}


export function tabSlider(html) {
    const sliders = html.find(".navWrapper")
    
    for(let slider of sliders){
        const btnLeft = slider.querySelector('.left-btn')
        const btnRight = slider.querySelector('.right-btn')
        const menu = slider.querySelector('.sheet-tabs')
        let activeDrag = false

        btnRight.addEventListener("click", () => {
            menu.scrollLeft += 150
            setTimeout(() => IconVisibility(html, menu, btnLeft, btnRight), 500)
        })
        btnLeft.addEventListener("click", () => {
            menu.scrollLeft -= 150
            setTimeout(() => IconVisibility(html, menu, btnLeft, btnRight), 500)
        })
 
        new ResizeObserver(() => IconVisibility(html, menu, btnLeft, btnRight)).observe(slider)

        menu.addEventListener("mousemove", (drag) => {
            if(!activeDrag) return

            menu.scrollLeft -= drag.movementX            
            setTimeout(() => IconVisibility(html, menu, btnLeft, btnRight), 500)
        })
        menu.addEventListener("mousedown", () => {
            activeDrag = true
            menu.classList.add("dragging")
            document.addEventListener("mouseup", () => {
                activeDrag = false
                menu.classList.remove("dragging")
            }, { once: true })
        })
    }    
}

const appHeight = () => {
    const doc = document.documentElement
    doc.style.setProperty('--app-height', `${window.innerHeight}px`)
}
window.addEventListener('resize', appHeight)
appHeight()
