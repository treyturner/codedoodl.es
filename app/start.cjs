// CoffeeScript 1's CLI rewrites process.mainModule, which is unavailable in
// modern Node entrypoints. Keep a small CommonJS bootstrap until stage 4.
// Server-side compilation moves to build time in the CoffeeScript 2 stage.
require('coffeescript/register');
require('./main.coffee');
