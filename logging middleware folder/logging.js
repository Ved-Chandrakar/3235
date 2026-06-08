const http = require('http');

function Log(stack, level, packageName, message) {
  const validStacks = ['backend', 'frontend'];
  const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
  const backendPackages = ['cache', 'controller', 'db', 'domain', 'config', 'middleware', 'util', 'handler'];
  const frontendPackages = ['api', 'component', 'hook', 'state', 'style', 'config', 'middleware', 'util', 'view'];

  if (!validStacks.includes(stack) || !validLevels.includes(level)) return;
  if (stack === 'backend' && !backendPackages.includes(packageName)) return;
  if (stack === 'frontend' && !frontendPackages.includes(packageName)) return;

  const body = JSON.stringify({ stack, level, package: packageName, message });
  const options = {
    hostname: '4.224.186.213',
    port: 80,
    path: '/evaluation-service/logs',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const req = http.request(options, (res) => {
    res.on('end', () => {
      if (res.statusCode === 200) console.log('successfully logged...');
      else console.error(`Log failed: Status ${res.statusCode}`);
    });
  });

  req.on('error', (error) => console.error('Logging error:', error.message));
  req.write(body);
  req.end();
}

function loggingMiddleware(req, res, next) {
  const start = Date.now();
  Log('backend', 'info', 'controller', `${req.method} ${req.url}`);

  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const level = res.statusCode >= 400 ? 'error' : 'info';
    Log('backend', level, 'controller', `${req.method} ${req.url} - ${res.statusCode} - ${Date.now() - start}ms`);
    originalEnd.call(res, chunk, encoding);
  };
  next();
}

function errorLoggingMiddleware(err, req, res, next) {
  Log('backend', 'fatal', 'db', `Error: ${err.message}`);
  Log('backend', 'error', 'controller', err.stack);
  res.status(err.status || 500).json({ error: err.message, message: 'An error occurred' });
}

module.exports = {
  Log,
  loggingMiddleware,
  errorLoggingMiddleware
};
