const http = require('node:http');

module.exports = async function start(app, cache, { port, ip }, logger) {
  const server = http.createServer(app);
  let stopping = false;
  function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    logger.info('Shutting down', { signal });
    cache.close();
    const deadline = setTimeout(() => server.closeAllConnections(), 5000);
    deadline.unref();
    server.close(() => {
      clearTimeout(deadline);
      logger.info('HTTP server stopped');
      logger.end();
    });
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  try {
    await cache.initialize();
    if (stopping) return;
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, ip, resolve);
    });
    logger.info('express is listening on ' + ip + ':' + server.address().port);
    return server;
  } catch (error) {
    cache.close();
    if (!stopping) {
      logger.error('Server startup failed', { error: error.message });
      logger.end();
      process.exitCode = 1;
    }
  }
};
