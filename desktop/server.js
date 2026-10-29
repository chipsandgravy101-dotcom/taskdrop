const express = require('express');

function createApp({ database, onItemAdded = () => {} }) {
  const app = express();
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/items', (_req, res) => {
    res.json(database.getItems());
  });

  app.post('/items', (req, res, next) => {
    const { text, non_skippable, created_at } = req.body ?? {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text must not be empty' });
    }
    if (typeof non_skippable !== 'boolean') {
      return res.status(400).json({ error: 'non_skippable must be a boolean' });
    }
    const utcTimestamp = typeof created_at === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|\+00:00)$/.test(created_at);
    if (!utcTimestamp || !Number.isFinite(Date.parse(created_at))) {
      return res.status(400).json({ error: 'created_at must be a valid ISO 8601 timestamp' });
    }

    try {
      const result = database.addItem({
        text,
        non_skippable,
        created_at
      });
      if (result.created) {
        onItemAdded();
      }
      return res.status(result.created ? 201 : 200).json({
        id: result.id,
        status: 'received'
      });
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    console.error('HTTP request failed:', error);
    if (res.headersSent) {
      return;
    }
    if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body')) {
      return res.status(400).json({ error: 'Request body must be valid JSON' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

function startServer(options, port = 3000, host = '0.0.0.0') {
  const app = createApp(options);
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}

module.exports = { createApp, startServer };
