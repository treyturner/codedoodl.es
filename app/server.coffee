express  = require "express"
compress = require "compression"
config   = require '../config/server'
staticAssets = require './utils/staticAssets'
app      = express()

app.set 'trust proxy', config.TRUST_PROXY
app.set "views", __dirname
app.engine 'html', require('ejs').renderFile
app.set 'view engine', 'html'
app.locals.scriptJSON = require './utils/scriptJSON'
app.use compress()
# Login/holding assets remain public when the site password gate is enabled.
app.use '/holding', staticAssets(__dirname + '/public/holding')

[
	"./health/routes",
	"./api/routes",
	"./site/routes",
	"./hooks/routes"
].forEach (routePath) ->
	require(routePath)(app)

app.use staticAssets(__dirname + '/public')
app.use require("./middleware").notFound
app.use (error, req, res, next) ->
    return next(error) if res.headersSent
    status = if error.status >= 400 and error.status < 500 then error.status else 500
    require('./utils/logger').error('HTTP request failed', { error: error.message }) if status is 500
    res.status(status).type('text').send(require('http').STATUS_CODES[status] or 'Request failed')

module.exports = app
