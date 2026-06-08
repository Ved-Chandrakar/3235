const { Log } = require('./logging');

console.log('Sending sample logs...');

// User requested log
Log('backend', 'error', 'handler', 'received string, expected bool');

// Additional logs for variety
Log('backend', 'info', 'db', 'connected to database cluster');
Log('backend', 'warn', 'cache', 'cache miss rate high - 85%');
Log('backend', 'fatal', 'config', 'invalid environment variables: DB_URL missing');
Log('frontend', 'debug', 'component', 'rendering ProductList with 24 items');
Log('frontend', 'error', 'api', 'Network error: 404 Not Found at /api/user/profile');
Log('backend', 'info', 'middleware', 'Auth token validated for user 5092');

console.log('Logs sent. Use "node send_logs.js" to run again.');
