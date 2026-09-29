_               = require 'underscore'
express         = require 'express'
session         = require 'express-session'
Hashids         = require 'hashids'
getTemplateData = require '../utils/getTemplateData'
config          = require '../../config/server'
hashids         = new Hashids config.shortlinks.SALT, 3, config.shortlinks.ALPHABET

###
views
###
home = (req, res) ->
	if !config.PASSWORD or (req.session and req.session.logged_in)
		res.render "site/index", getTemplateData('HOME')
	else
		res.render "site/holding", getTemplateData('HOLDING')

about = (req, res) ->
	res.render "site/index", getTemplateData('ABOUT')

contribute = (req, res) ->
	res.render "site/index", getTemplateData('CONTRIBUTE')

doodles = (req, res) ->
	if !req.params.authorName or !req.params.doodleName
		return res.redirect 301, "/#{config.routes.HOME}"

	allDoodles = require('../utils/getDoodleData').getDoodles()
	doodle     = _.findWhere allDoodles, slug : "#{req.params.authorName}/#{req.params.doodleName}"

	if doodle
		res.render "site/index", getTemplateData('DOODLES', req)
	else
		res.redirect 302, "/404"

checkShortLink = (req, res, next) ->
	# Filenames and ordinary paths must reach static serving or the 404 handler.
	return next() unless hashids.isValidId(req.params.shortlink)
	allDoodles = require('../utils/getDoodleData').getDoodles()
	index      = hashids.decode(req.params.shortlink)[0]
	doodle     = _.findWhere allDoodles, index : index
	if doodle
		return res.redirect 301, "/#{config.routes.DOODLES}/#{doodle.slug}"

	next()

###
vanity URLS for redirection
###
extensionRedirect = (req, res) ->
	return res.redirect 301, config.EXTERNAL_URLS.extension

###
basic password-protect
###
checkAuth = (req, res, next) ->
	if !config.PASSWORD
		return next()

	if !req.session.logged_in
		res.redirect "/#{config.routes.HOME}"
	else
		return next()

login = (req, res) ->
	msg = if req.query.wrong_pw isnt undefined then 'Wrong. Try again' else false
	vars = _.extend msg : msg,
		getTemplateData('LOGIN')
	res.render "site/login", vars

loginPost = (req, res, next) ->
	if config.PASSWORD and req.body?.pw is config.PASSWORD
		req.session.regenerate (error) ->
			return next(error) if error
			req.session.logged_in = true
			req.session.save (error) ->
				if error then next(error) else res.redirect('/')
	else
		res.redirect '/login?wrong_pw'

setup = (app) ->
	if config.PASSWORD
		app.use session
			secret: config.SESSION_SECRET
			resave: false
			saveUninitialized: false
			cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto' }

	app.get "/#{config.routes.LOGIN}", login
	app.post "/#{config.routes.LOGIN}", express.urlencoded({ extended: false }), express.json(), loginPost

	app.get "/#{config.routes.HOME}", home
	app.get "/#{config.routes.ABOUT}", checkAuth, about
	app.get "/#{config.routes.CONTRIBUTE}", checkAuth, contribute
	app.get ["/#{config.routes.DOODLES}", "/#{config.routes.DOODLES}/:authorName", "/#{config.routes.DOODLES}/:authorName/:doodleName"], checkAuth, doodles

	app.get "/#{config.routes.EXTENSION}", extensionRedirect

	app.get '/:shortlink', checkShortLink
	app.use (req, res, next) ->
		if req.method in ['GET', 'HEAD'] then checkAuth(req, res, next) else next()

module.exports = setup
