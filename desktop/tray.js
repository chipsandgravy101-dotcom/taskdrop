const { Menu, Tray, nativeImage } = require('electron');

function makeBmp(hasPendingItems) {
  const width = 32;
  const height = 32;
  const rowSize = width * 3;
  const pixelSize = rowSize * height;
  const buffer = Buffer.alloc(54 + pixelSize);
  buffer.write('BM', 0);
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(pixelSize, 34);

  function setPixel(x, y, color) {
    const offset = 54 + ((height - 1 - y) * rowSize) + (x * 3);
    buffer[offset] = color[2];
    buffer[offset + 1] = color[1];
    buffer[offset + 2] = color[0];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(x, y, [44, 104, 190]);
    }
  }
  for (let y = 7; y < 25; y += 1) {
    for (let x = 8; x < 12; x += 1) {
      setPixel(x, y, [255, 255, 255]);
    }
    for (let x = 12; x < 21; x += 1) {
      if (y < 11 || y > 20 || x < 16) {
        setPixel(x, y, [255, 255, 255]);
      }
    }
  }
  if (hasPendingItems) {
    for (let y = 1; y < 12; y += 1) {
      for (let x = 20; x < 31; x += 1) {
        const dx = x - 25;
        const dy = y - 6;
        if (dx * dx + dy * dy <= 30) {
          setPixel(x, y, [230, 48, 48]);
        }
      }
    }
  }
  return buffer;
}

function createTray({ iconPath, onShow, onQuit }) {
  const appIcon = nativeImage.createFromPath(iconPath);
  if (appIcon.isEmpty()) {
    throw new Error(`Could not load TaskDrop icon from ${iconPath}`);
  }
  const tray = new Tray(appIcon);
  tray.setToolTip('TaskDrop');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Checklist', click: onShow },
    { type: 'separator' },
    { label: 'Quit', click: onQuit }
  ]));
  tray.on('click', onShow);
  return {
    update(pendingCount) {
      tray.setImage(pendingCount > 0
        ? nativeImage.createFromBuffer(makeBmp(true))
        : appIcon);
      tray.setToolTip(pendingCount > 0
        ? `TaskDrop — ${pendingCount} non-skippable item${pendingCount === 1 ? '' : 's'} pending`
        : 'TaskDrop');
    },
    destroy() {
      tray.destroy();
    }
  };
}

module.exports = { createTray };
