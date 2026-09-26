express  = require "express"
compress = require "compression"
fs       = require "fs"
app      = express()

# Called by static middleware only for an existing file, before its headers are
# sent. The archive convention keeps gzip bytes under ordinary filenames;
# ordinary SVG/fonts and HTML error pages must not inherit that encoding.
setStaticHeaders = (res, filename) ->
    descriptor = fs.openSync filename, 'r'
    try
        signature = Buffer.alloc 2
        fs.readSync descriptor, signature, 0, 2, 0
        if signature[0] is 0x1f and signature[1] is 0x8b
            res.setHeader 'Content-Encoding', 'gzip'
    finally
        fs.closeSync descriptor

app.set "views", __dirname
app.engine 'html', require('ejs').renderFile
app.set 'view engine', 'html'
app.use compress()
# Login/holding assets remain public when the site password gate is enabled.
app.use '/holding', express.static(__dirname + '/public/holding', setHeaders: setStaticHeaders)

[
	"./health/routes",
	"./api/routes",
	"./site/routes",
	"./hooks/routes"
].forEach (routePath) ->
	require(routePath)(app)

app.use express.static(__dirname + '/public', setHeaders: setStaticHeaders)
app.use require("./middleware").notFound

module.exports = app
