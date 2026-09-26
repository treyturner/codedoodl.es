// Keep a CommonJS entrypoint for Node's cluster forks. CoffeeScript 1's CLI
// rewrites process.mainModule, which is unavailable in modern Node entrypoints.
// Server-side compilation moves to build time in the CoffeeScript 2 stage.
require('coffeescript/register');
require('./main.coffee');
