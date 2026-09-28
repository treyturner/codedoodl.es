express  = require "express"
compress = require "compression"
path     = require "path"
app      = express()

gzipExtRegex = /\.(css|js|svg|gz|html|xml|json)(?:$|\?)/
gzipStaticAssets = (req, res, next) ->
    if gzipExtRegex.test req.url
        res.set 'Content-Encoding', 'gzip'
    next()

app.set "views", __dirname
app.engine 'html', require('ejs').renderFile
app.set 'view engine', 'html'
app.use compress()
# Password pages need public assets, including the precompressed stylesheet.
app.use '/holding', express.static(__dirname + '/public/holding', {
    setHeaders: (res, filename) ->
        res.setHeader('Content-Encoding', 'gzip') if /\.css$/.test(filename)
})

[
	"./health/routes",
	"./api/routes",
	"./site/routes",
	"./hooks/routes"
].forEach (routePath) ->
	require(routePath)(app)

app.use gzipStaticAssets
app.use express.static(__dirname + '/public')
app.use require("./middleware").notFound

module.exports = app
