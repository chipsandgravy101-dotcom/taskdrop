const path = require('node:path');
const { BrowserWindow } = require('electron');

function createOverlayManager({ app, database, onItemsChanged }) {
  let window = null;
  let isQuitting = false;
  let allowClose = false;

  function show() {
    if (!window || window.isDestroyed()) {
      allowClose = false;
      window = new BrowserWindow({
        width: 900,
        height: 600,
        minWidth: 560,
        minHeight: 460,
        center: true,
        frame: false,
        resizable: true,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        backgroundColor: '#101318',
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      });
      window.setAlwaysOnTop(true, 'screen-saver');
      window.on('close', (event) => {
        if (!isQuitting && !allowClose) {
          event.preventDefault();
        }
      });
      window.on('blur', () => {
        if (!isQuitting && window && !window.isDestroyed()) {
          window.show();
          window.focus();
        }
      });
      void window.loadFile(path.join(__dirname, 'overlay', 'index.html')).catch((error) => {
        console.error('Could not load the non-skippable overlay:', error);
      });
    }
    window.show();
    window.focus();
    publishItems();
  }

  function hide() {
    if (window && !window.isDestroyed()) {
      allowClose = true;
      window.close();
    }
    window = null;
  }

  function getItems() {
    return database.getPendingNonSkippable();
  }

  function publishItems() {
    const items = getItems();
    onItemsChanged(items);
    if (items.length > 0) {
      if (!window || window.isDestroyed()) {
        show();
      } else if (window.webContents && !window.webContents.isDestroyed()) {
        window.webContents.send('overlay:items-updated', items);
      }
    } else {
      hide();
    }
  }

  function completeItem(id) {
    const changed = database.setCompleted(id, true);
    if (changed) {
      publishItems();
    }
    return changed;
  }

  function quit() {
    isQuitting = true;
    hide();
  }

  return {
    show,
    publishItems,
    getItems,
    completeItem,
    quit
  };
}

module.exports = { createOverlayManager };
