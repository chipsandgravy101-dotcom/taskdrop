const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

function getCommand(app) {
  const executable = `"${process.execPath}"`;
  const appPath = app.isPackaged ? '' : ` "${app.getAppPath()}"`;
  return `${executable}${appPath} --hidden`;
}

async function isEnabled() {
  try {
    const { stdout } = await execFileAsync('reg.exe', ['query', RUN_KEY, '/v', 'TaskDrop']);
    return stdout.includes('TaskDrop');
  } catch (error) {
    if (error.code === 1) {
      return false;
    }
    throw error;
  }
}

async function setEnabled(app, enabled) {
  if (enabled) {
    await execFileAsync('reg.exe', [
      'add', RUN_KEY, '/v', 'TaskDrop', '/t', 'REG_SZ', '/d', getCommand(app), '/f'
    ]);
    return;
  }
  try {
    await execFileAsync('reg.exe', ['delete', RUN_KEY, '/v', 'TaskDrop', '/f']);
  } catch (error) {
    if (error.code !== 1) {
      throw error;
    }
  }
}

module.exports = { isEnabled, setEnabled };
