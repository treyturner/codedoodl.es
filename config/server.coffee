config = module.exports

config.express =
	port : process.env.BIND_PORT or process.env.PORT or 3000
	ip   : process.env.BIND_ADDRESS or "0.0.0.0"

config.express_preview =
	port : process.env.BIND_PORT or process.env.PORT or 3001
	ip   : process.env.BIND_ADDRESS or "0.0.0.0"

config.PRODUCTION = process.env.NODE_ENV is "production"

config.buckets =
	ASSETS        : 'assets.codedoodl.es'
	SOURCE        : 'source.codedoodl.es'
	SOURCE_S3_URL : 's3-eu-west-1.amazonaws.com/source.codedoodl.es'
	PENDING       : 'pending.codedoodl.es'

config.cloudfront =
	SOURCE : 'E252Z8ZC5VB7QS'
	ASSETS : 'E278GI4I3S1464'

config.EXTERNAL_URLS =
	form      : 'https://docs.google.com/forms/d/1K66OvKMiKqGjgmYRFUtEA43KZzBzv4KzObM1JtD4cbk/viewform'
	extension : 'https://chrome.google.com/webstore/detail/codedoodles/hhfnbfhcojlgbojpphigjibpjkccfikh'

config.BASE_URL           = process.env.BASE_URL or (if config.PRODUCTION then "http://codedoodl.es" else "http://#{config.express.ip}:#{config.express.port}")
config.ASSETS_BUCKET_URL  = process.env.BASE_URL or (if config.PRODUCTION then "http://#{config.buckets.ASSETS}" else "http://#{config.express.ip}:#{config.express.port}")
config.DOODLES_BUCKET_URL = process.env.DOODLES_URL or "http://#{config.buckets.SOURCE}"

positiveInteger = (name, fallback, minimum = 1) ->
	value = if process.env[name]? then Number(process.env[name]) else fallback
	unless Number.isSafeInteger(value) and value >= minimum
		throw new Error "#{name} must be an integer >= #{minimum}"
	value

config.DOODLE_CACHE_TIMEOUT = positiveInteger('DOODLE_CACHE_TIMEOUT_MS', (if config.PRODUCTION then 300000 else 0), 0)
config.DOODLE_FETCH_TIMEOUT = positiveInteger('DOODLE_FETCH_TIMEOUT_MS', 10000)
config.DOODLE_FETCH_CONCURRENCY = positiveInteger('DOODLE_FETCH_CONCURRENCY', 8)
config.SESSION_SECRET = process.env.SESSION_SECRET or require('crypto').randomBytes(32).toString('hex')
config.TRUST_PROXY = if /^\d+$/.test(process.env.TRUST_PROXY or '') then Number(process.env.TRUST_PROXY) else (process.env.TRUST_PROXY or false)

config.routes =
	HOME       : ''
	ABOUT      : 'about'
	CONTRIBUTE : 'contribute'
	DOODLES    : '_'
	LOGIN      : 'login'
	FORM       : 'form'
	EXTENSION  : 'extension'
	HEALTH     : 'health'

config.shortlinks =
	SALT     : 'no need for this to be private I guess'
	ALPHABET : 'abcdefghijklmnopqrstuvwxyz'

config.GA_CODE            = process.env.GOOGLE_ANALYTICS_CODE or ''
config.PASSWORD           = process.env.DEV_PASSWORD or false
config.DOODLE_DATA_SOURCE = process.env.DOODLE_DATA_SOURCE
