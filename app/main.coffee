#!/usr/bin/env node

config = require '../config/server'
app = require './server'
log = require('winston').loggers.get('app:server')

# One process owns the cache and sessions; the container runtime supervises it.
server = app.listen config.express.port, config.express.ip, ->
    log.info('express is listening on ' + config.BASE_URL)

server.on 'error', (error) ->
    log.error('Unable to listen for connections', error)
    process.exit(10)

stopping = false
stop = ->
    return if stopping
    stopping = true
    timeout = setTimeout (-> process.exit(1)), 5000
    timeout.unref()
    server.close -> process.exit(0)

process.on 'SIGTERM', stop
process.on 'SIGINT', stop
