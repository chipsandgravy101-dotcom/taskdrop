const itemsContainer = document.getElementById('items');

function renderItems(items) {
  itemsContainer.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'All non-skippable tasks are complete.';
    itemsContainer.append(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'task-card';
    const text = document.createElement('p');
    text.className = 'task-text';
    text.textContent = item.text;
    const button = document.createElement('button');
    button.className = 'complete-button';
    button.type = 'button';
    button.textContent = 'Mark Complete';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await window.taskdrop.completeOverlayItem(item.id);
      } catch (error) {
        button.disabled = false;
        console.error('Could not complete task:', error);
      }
    });
    card.append(text, button);
    itemsContainer.append(card);
  }
}

window.taskdrop.onOverlayItemsUpdated(renderItems);
void window.taskdrop.getOverlayItems().then(renderItems).catch((error) => {
  console.error('Could not load non-skippable tasks:', error);
});
