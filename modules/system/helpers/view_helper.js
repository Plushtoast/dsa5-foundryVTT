export function svgAutoFit(elem, width = 320, height = 40) {
  elem.attr({
    width,
    viewBox: `0 0 ${width} ${height}`,
  });
  const text = elem.find('text')[0];
  let bbox = text.getBBox();
  let textWidth = bbox.width;
  let textHeight = bbox.height;
  let scaleX = width / textWidth;
  let scaleY = height / textHeight;
  let scale = Math.min(scaleX, scaleY);
  
  let centerX = width / 2 - (textWidth * scale) / 2 - bbox.x * scale;
  let centerY = height / 2 - (textHeight * scale) / 2 - bbox.y * scale;
  if (isFinite(scale)) {
    text.setAttribute("transform", `matrix(${scale}, 0, 0, ${scale}, ${centerX}, ${centerY})`);
  }
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function itemFromDrop(dragData, actorId, toObject = true) {
  let item;
  let selfTarget;
  if (dragData.type == 'Actor') {
    item = await Actor.implementation.fromDropData(dragData);
    selfTarget = actorId === item.id;
  } else if (dragData.type == 'Item') {
    item = await Item.implementation.fromDropData(dragData);
    selfTarget = actorId === item.parent?.uuid;
  } else {
    item = await fromUuid(dragData.uuid);
  }
  let typeClass = item?.type;

  if (toObject) {
    item = item.toObject();
  }

  if (dragData.amount) item.system.quantity.value = Number(dragData.amount);

  return { item, typeClass, selfTarget };
}

export function slist(html, target, callback, itemTag = 'div') {
  target = html.find(target)[0];
  if (!target) return;

  target.classList.add('slist');

  let items = target.querySelectorAll(itemTag),
    current = null;
  for (let i of items) {
    i.draggable = true;

    i.addEventListener('dragstart', function (ev) {
      current = this;
    });

    i.addEventListener('dragover', function (evt) {
      evt.preventDefault();
    });

    i.addEventListener('drop', async function (evt) {
      evt.preventDefault();
      if (this != current) {
        let currentpos = 0,
          droppedpos = 0;
        for (let it = 0; it < items.length; it++) {
          if (current == items[it]) {
            currentpos = it;
          }
          if (this == items[it]) {
            droppedpos = it;
          }
        }
        if (currentpos < droppedpos) {
          this.parentNode.insertBefore(current, this.nextSibling);
        } else {
          this.parentNode.insertBefore(current, this);
        }
        await callback(target);
      }
    });
  }
}

export function tinyNotification(message) {
  let container = $('.tinyNotifications');
  if (!container.length) {
    $('body').append('<ul class="tinyNotifications"></ul>');
    container = $('.tinyNotifications');
  }
  const elem = $(`<li>${message}</li>`);
  container.prepend(elem);
  setTimeout(function () {
    elem.remove();
  }, 1500);
}

function IconVisibility(html, menu, btnLeft, btnRight) {
  let scrollLeftValue = Math.ceil(menu.scrollLeft);
  let scrollableWidth = menu.scrollWidth - menu.clientWidth;

  btnLeft.style.display = scrollLeftValue > 0 ? 'flex' : 'none';
  btnRight.style.display = scrollableWidth > scrollLeftValue ? 'flex' : 'none';

  columnLayout(html);
}

export async function clickableAbility(target) {
  const categories = $(target).closest('.searchableAbility')[0].dataset.category.split(' ');
  let search = target.text.replace(/\d+$/, '').trim();

  for (let category of categories) {
    const items = await game.dsa5.itemLibrary.findCompendiumItem(search, category);
    const res = items.find((x) => x.name == search);
    if (res) {
      res.sheet.render(true);
      return;
    }
  }
  if (/\(/.test(search)) {
    search = search.split('(')[0].trim() + ' ()';

    for (let category of categories) {
      const items = await game.dsa5.itemLibrary.findCompendiumItem(search, category);
      const res = items.find((x) => x.name == search);
      if (res) {
        res.sheet.render(true);
        return;
      }
    }
  }
}

function columnLayout(html) {
  const width = html.width();
  const minWidth = Number(getComputedStyle(document.body).getPropertyValue('--minColumnWidth').replace('px', ''));
  const width60 = Number(getComputedStyle(document.body).getPropertyValue('--minColumnWidth60').replace('px', ''));
  const width40 = Number(getComputedStyle(document.body).getPropertyValue('--minColumnWidth40').replace('px', ''));
  const borderWidth = 32;
  const availableWidth = width - borderWidth;

  html.toggleClass('singleColumnLayout', width < minWidth * 2 + borderWidth);
  html.toggleClass('minimumColumnLayout', width <= width60);
  html.toggleClass('characteristicsSingleColumn', availableWidth < width60 + width40);
}

export function resizeListener(html) {
  //observer html for widtht ch
  const observer = new ResizeObserver((entries) => {
    for (let entry of entries) {
      if (entry.contentRect.width > 0) {
        columnLayout(html);
      }
    }
  });
  observer.observe(html[0]);
}

export function tabSlider(html) {
  const sliders = html.find('.navWrapper');

  for (let slider of sliders) {
    const btnLeft = slider.querySelector('.left-btn');
    const btnRight = slider.querySelector('.right-btn');
    const menu = slider.querySelector('.sheet-tabs');
    let activeDrag = false;

    btnRight.addEventListener('click', () => {
      menu.scrollLeft += 150;
      setTimeout(() => IconVisibility(html, menu, btnLeft, btnRight), 500);
    });
    btnLeft.addEventListener('click', () => {
      menu.scrollLeft -= 150;
      setTimeout(() => IconVisibility(html, menu, btnLeft, btnRight), 500);
    });

    new ResizeObserver(() => IconVisibility(html, menu, btnLeft, btnRight)).observe(slider);

    menu.addEventListener('mousemove', (drag) => {
      if (!activeDrag) return;

      menu.scrollLeft -= drag.movementX;
      setTimeout(() => IconVisibility(html, menu, btnLeft, btnRight), 500);
    });
    menu.addEventListener('mousedown', () => {
      activeDrag = true;
      menu.classList.add('dragging');
      document.addEventListener(
        'mouseup',
        () => {
          activeDrag = false;
          menu.classList.remove('dragging');
        },
        { once: true },
      );
    });
  }
}

const appHeight = () => {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
};
window.addEventListener('resize', appHeight);
appHeight();
