config = require '../../config/server'
createCache = require './doodleCache'

module.exports = createCache
    production: config.PRODUCTION
    baseUrl: config.DOODLES_BUCKET_URL
    dataSource: config.DOODLE_DATA_SOURCE
    directory: require('path').resolve(__dirname, '../../doodles')
    ttl: config.DOODLE_CACHE_TIMEOUT
    timeout: config.DOODLE_FETCH_TIMEOUT
    concurrency: config.DOODLE_FETCH_CONCURRENCY
    logger: require './logger'
