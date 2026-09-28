config = require '../../config/server'

healthCheck = (req, res) ->
	return res.status(200).type('text').send 'OK'

setup = (app) ->
	app.get "/#{config.routes.HEALTH}", healthCheck

module.exports = setup
