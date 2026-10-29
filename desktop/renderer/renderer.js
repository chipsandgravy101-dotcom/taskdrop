const itemsList = document.getElementById('items');
const emptyState = document.getElementById('empty-state');
const itemCount = document.getElementById('item-count');
const clearButton = document.getElementById('clear-completed');
const autoStartToggle = document.getElementById('autostart');
const message = document.getElementById('message');

function showMessage(text) {
  message.textContent = text;
  if (text) {
    window.setTimeout(() => {
      if (message.textContent === text) {
        message.textContent = '';
      }
    }, 4000);
  }
}

function renderItems(items) {
  itemsList.replaceChildren();
  const completedCount = items.filter((item) => item.completed).length;
  emptyState.hidden = items.length > 0;
  itemCount.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  clearButton.disabled = completedCount === 0;

  for (const item of items) {
    const row = document.createElement('li');
    row.className = `item-row${item.completed ? ' completed' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.className = 'item-checkbox';
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(item.completed);
    checkbox.setAttribute('aria-label', `Mark "${item.text}" ${item.completed ? 'incomplete' : 'complete'}`);
    checkbox.addEventListener('change', async () => {
      try {
        await window.taskdrop.setCompleted(item.id, checkbox.checked);
      } catch (error) {
        showMessage(`Could not update task: ${error.message}`);
        await reloadItems();
      }
    });

    const content = document.createElement('div');
    content.className = 'item-content';
    const text = document.createElement('p');
    text.className = 'item-text';
    text.textContent = item.text;

    const meta = document.createElement('div');
    meta.className = 'item-meta';
    const timestamp = document.createElement('time');
    timestamp.dateTime = item.received_at;
    timestamp.textContent = new Date(item.received_at).toLocaleString();
    meta.append(timestamp);
    if (item.non_skippable) {
      const badge = document.createElement('span');
      badge.className = 'lock-badge';
      badge.textContent = '🔒 Non-skippable';
      meta.append(badge);
    }
    content.append(text, meta);
    row.append(checkbox, content);
    itemsList.append(row);
  }
}

async function reloadItems() {
  try {
    renderItems(await window.taskdrop.getItems());
  } catch (error) {
    showMessage(`Could not load tasks: ${error.message}`);
  }
}

clearButton.addEventListener('click', async () => {
  try {
    const removed = await window.taskdrop.clearCompleted();
    showMessage(`Cleared ${removed} completed ${removed === 1 ? 'task' : 'tasks'}.`);
    await reloadItems();
  } catch (error) {
    showMessage(`Could not clear completed tasks: ${error.message}`);
  }
});

autoStartToggle.addEventListener('change', async () => {
  autoStartToggle.disabled = true;
  try {
    autoStartToggle.checked = await window.taskdrop.setAutoStart(autoStartToggle.checked);
    showMessage(autoStartToggle.checked ? 'Auto-start enabled.' : 'Auto-start disabled.');
  } catch (error) {
    autoStartToggle.checked = false;
    showMessage(`Could not change auto-start: ${error.message}`);
  } finally {
    autoStartToggle.disabled = false;
  }
});

window.taskdrop.onItemsUpdated(renderItems);
void reloadItems();
void window.taskdrop.getAutoStart()
  .then((enabled) => {
    autoStartToggle.checked = enabled;
  })
  .catch((error) => showMessage(`Could not read auto-start setting: ${error.message}`));
