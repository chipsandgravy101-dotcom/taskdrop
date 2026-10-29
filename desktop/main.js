const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const squirrelStartup = require('electron-squirrel-startup');
const { openDatabase } = require('./db');
const { startServer } = require('./server');
const { createOverlayManager } = require('./overlay');
const { createTray } = require('./tray');
const autostart = require('./autostart');

const hasSingleInstanceLock = !squirrelStartup && app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  let database;
  let mainWindow;
  let tray;
  let overlay;
  let httpServer;
  let isQuitting = false;
  let restartInProgress = false;

  function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.show();
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }

  function refreshViews() {
    const items = database.getItems();
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('checklist:items-updated', items);
    }
    if (overlay) {
      overlay.publishItems();
    }
  }

  async function restartHttpServer() {
    if (restartInProgress || isQuitting || !database) {
      return;
    }
    restartInProgress = true;
    try {
      if (httpServer) {
        await new Promise((resolve) => httpServer.close(() => resolve()));
        httpServer = null;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      httpServer = await startServer({ database, onItemAdded: refreshViews });
      httpServer.on('error', (error) => {
        console.error('TaskDrop HTTP server failed:', error);
        void restartHttpServer();
      });
      console.info('TaskDrop HTTP server restarted on 0.0.0.0:3000');
    } catch (error) {
      console.error('Unable to restart TaskDrop HTTP server:', error);
      setTimeout(() => {
        restartInProgress = false;
        void restartHttpServer();
      }, 2000);
      return;
    }
    restartInProgress = false;
  }

  function createMainWindow() {
    mainWindow = new BrowserWindow({
      width: 900,
      height: 720,
      minWidth: 560,
      minHeight: 460,
      title: 'TaskDrop',
      icon: app.isPackaged
        ? path.join(process.resourcesPath, 'taskdrop_icon.png')
        : path.join(__dirname, '..', 'taskdrop_icon.png'),
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    void mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch((error) => {
      console.error('Could not load the TaskDrop checklist window:', error);
      app.quit();
    });
    mainWindow.once('ready-to-show', () => {
      if (!process.argv.includes('--hidden')) {
        mainWindow.show();
      }
    });
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
      }
    });
  }

  function registerIpcHandlers() {
    ipcMain.handle('checklist:get-items', () => database.getItems());
    ipcMain.handle('checklist:set-completed', (_event, id, completed) => {
      const changed = database.setCompleted(Number(id), Boolean(completed));
      if (changed) {
        refreshViews();
      }
      return changed;
    });
    ipcMain.handle('checklist:clear-completed', () => {
      const removed = database.clearCompleted();
      if (removed > 0) {
        refreshViews();
      }
      return removed;
    });
    ipcMain.handle('autostart:get', () => autostart.isEnabled());
    ipcMain.handle('autostart:set', async (_event, enabled) => {
      await autostart.setEnabled(app, Boolean(enabled));
      return autostart.isEnabled();
    });
    ipcMain.handle('overlay:get-items', () => overlay.getItems());
    ipcMain.handle('overlay:complete', (_event, id) => {
      const changed = overlay.completeItem(Number(id));
      if (changed) {
        refreshViews();
      }
      return changed;
    });
  }

  app.on('second-instance', showMainWindow);

  app.whenReady().then(async () => {
    database = openDatabase(path.join(app.getPath('userData'), 'taskdrop.sqlite'));
    registerIpcHandlers();
    try {
      httpServer = await startServer({ database, onItemAdded: refreshViews });
      httpServer.on('error', (error) => {
        console.error('TaskDrop HTTP server failed:', error);
        void restartHttpServer();
      });
      console.info('TaskDrop HTTP server listening on 0.0.0.0:3000');
    } catch (error) {
      console.error('Unable to start TaskDrop HTTP server:', error);
      app.quit();
      return;
    }

    overlay = createOverlayManager({
      app,
      database,
      onItemsChanged: (items) => {
        if (tray) {
          tray.update(items.length);
        }
      }
    });
    tray = createTray({
      iconPath: app.isPackaged
        ? path.join(process.resourcesPath, 'taskdrop_icon.png')
        : path.join(__dirname, '..', 'taskdrop_icon.png'),
      onShow: showMainWindow,
      onQuit: () => {
        isQuitting = true;
        overlay.quit();
        app.quit();
      }
    });
    createMainWindow();
    overlay.publishItems();
  }).catch((error) => {
    console.error('TaskDrop startup failed:', error);
    app.quit();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (overlay) {
      overlay.quit();
    }
    if (tray) {
      tray.destroy();
    }
    if (httpServer) {
      httpServer.close();
      httpServer = null;
    }
    if (database) {
      database.close();
      database = null;
    }
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    void restartHttpServer();
  });
}
