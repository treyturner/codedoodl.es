config = require '../config/server'
start = require './utils/serverLifecycle'

# One process owns the cache and sessions; the container runtime supervises it.
start(require('./server'), require('./utils/getDoodleData'), config.express, require('./utils/logger'))
