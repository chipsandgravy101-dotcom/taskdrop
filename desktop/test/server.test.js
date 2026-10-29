const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { openDatabase } = require('../db');
const { startServer } = require('../server');

test('HTTP API accepts items idempotently and updates the checklist', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'taskdrop-test-'));
  const database = openDatabase(path.join(directory, 'test.sqlite'));
  let notifications = 0;
  const server = await startServer({
    database,
    onItemAdded: () => {
      notifications += 1;
    }
  }, 0, '127.0.0.1');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const payload = {
    text: 'Buy groceries',
    non_skippable: true,
    created_at: '2026-10-29T01:32:00.000Z'
  };
  const first = await fetch(`${baseUrl}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(first.status, 201);
  const firstResult = await first.json();

  const duplicate = await fetch(`${baseUrl}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), firstResult);
  assert.equal(notifications, 1);

  const items = await fetch(`${baseUrl}/items`).then((response) => response.json());
  assert.equal(items.length, 1);
  assert.equal(items[0].text, payload.text);
  assert.equal(items[0].non_skippable, 1);
  assert.equal(items[0].completed, 0);
  assert.equal(database.getPendingNonSkippable().length, 1);

  assert.equal(database.setCompleted(firstResult.id, true), true);
  assert.equal(database.getPendingNonSkippable().length, 0);
  const completedItems = await fetch(`${baseUrl}/items`).then((response) => response.json());
  assert.equal(completedItems[0].completed, 1);
  assert.ok(completedItems[0].completed_at);
  assert.equal(database.clearCompleted(), 1);
  assert.deepEqual(await fetch(`${baseUrl}/items`).then((response) => response.json()), []);

  const invalid = await fetch(`${baseUrl}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '', created_at: payload.created_at })
  });
  assert.equal(invalid.status, 400);
});
