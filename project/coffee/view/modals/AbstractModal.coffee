AbstractView = require '../AbstractView'

class AbstractModal extends AbstractView

	$window : null

	### override in individual classes ###
	name     : null
	template : null

	initialize : ->

		@$window = $(window)

		super()

		@CD().appView.addChild @
		@setListeners 'on'
		@animateIn()

		return null

	hide : ->

		@animateOut => @CD().appView.remove @

		null

	dispose : ->

		@setListeners 'off'
		@CD().appView.modalManager.modals[@name].view = null

		null

	setListeners : (setting) ->

		@$window[setting] 'keyup', @onKeyUp
		@$('[data-close]')[setting] 'click', @closeClick

		null

	onKeyUp : (e) ->

		if e.keyCode is 27 then @hide()

		null

	animateIn : ->

		gsap.to @$el, { duration: 0.3, 'visibility': 'visible', 'opacity': 1, ease : 'power1.out' }
		gsap.to @$el.find('.inner'), { duration: 0.3, delay : 0.15, 'transform': 'scale(1)', 'visibility': 'visible', 'opacity': 1, ease : 'back.out' }

		null

	animateOut : (callback) ->

		gsap.to @$el, { duration: 0.3, delay : 0.15, 'opacity': 0, ease : 'power1.out', onComplete: callback }
		gsap.to @$el.find('.inner'), { duration: 0.3, 'transform': 'scale(0.8)', 'opacity': 0, ease : 'back.in' }

		null

	closeClick: ( e ) ->

		e.preventDefault()

		@hide()

		null

module.exports = AbstractModal
