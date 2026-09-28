express  = require "express"
compress = require "compression"
fs       = require "fs"
app      = express()

# Files keep their original extensions after the build. Inspect the bytes only
# when express.static has found a file, so plain SVG fonts and 404s stay valid.
setAssetHeaders = (res, filename) ->
    descriptor = fs.openSync(filename, 'r')
    try
        signature = Buffer.alloc(2)
        fs.readSync(descriptor, signature, 0, 2, 0)
        if signature[0] is 0x1f and signature[1] is 0x8b
            res.setHeader('Content-Encoding', 'gzip')
    finally
        fs.closeSync(descriptor)

app.set "views", __dirname
app.engine 'html', require('ejs').renderFile
app.set 'view engine', 'html'
app.use compress()
# Password pages need public assets, including the precompressed stylesheet.
app.use '/holding', express.static(__dirname + '/public/holding', { setHeaders: setAssetHeaders })

[
	"./health/routes",
	"./api/routes",
	"./site/routes",
	"./hooks/routes"
].forEach (routePath) ->
	require(routePath)(app)

app.use express.static(__dirname + '/public', { setHeaders: setAssetHeaders })
app.use require("./middleware").notFound

module.exports = app
