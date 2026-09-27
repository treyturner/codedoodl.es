AbstractViewPage     = require '../AbstractViewPage'
HomeGridItem         = require './HomeGridItem'
CodeWordTransitioner = require '../../utils/CodeWordTransitioner'

class HomeView extends AbstractViewPage

	template      : 'page-home'
	addToSelector : '[data-home-grid]'

	# manage state for homeView on per-session basis, allow number of
	# grid items, and scroll position of home grid to be persisted
	@visitedThisSession : false
	@gridItems : []
	@dims :
		item      : h: 288, w: 200, margin: 20, a: 0
		container : h: 0, w: 0, a: 0, pt: 25
	@colCount : 0

	@scrollDelta    : 0
	@scrollDistance : 0

	# rAF
	@ticking : false

	@SHOW_ROW_THRESHOLD : 0.3 # how much of a grid row (scale 0 -> 1) must be visible before it is "shown"
	@SCROLL_SHOW_CREDITS_THRESHOLD : 100 # pixels to bottom of home grid before showing credits

	EVENT_TICK : 'EVENT_TICK'

	isScrolling : false

	allDoodles : null

	creditsVisible   : false
	$credits         : null
	$creditCodeWords : null

	initialize : ->

		@templateVars = 
			credits : @CD().locale.get "home_credits"

		@allDoodles = @CD().appData.doodles

		super()

		@setupCredits()
		@addGridItems()

		return null

	checkScrollerCompat : ->

		if !@usesGridEffects()

			@$el.addClass 'grid-effects-disabled'

		null

	usesGridEffects : ->

		return Features.hover and !@CD().IS_FIREFOX

	setupCredits : ->

		@$credits         = @$el.find('[data-credits]')
		@$creditCodeWords = @$credits.find('[data-codeword]')

		@$creditCodeWords.each (i, el) =>

			$el          = $(el)
			originalText = $el.text()
			$el.attr 'data-original-text', originalText

		if @usesGridEffects()
			@hideCredits(true)
		else
			@showCredits()

		null

	addGridItems : ->

		for doodle in @allDoodles.models

			item = new HomeGridItem { model: doodle, parentGrid: @ }
			HomeView.gridItems.push item
			@addChild item

		null

	# positionGridItems : =>

	# 	for item, idx in HomeView.gridItems

	# 		top = (Math.floor(idx / HomeView.colCount) * HomeView.dims.item.h) + HomeView.dims.container.pt
	# 		left = ((idx % HomeView.colCount) * HomeView.dims.item.w) + (idx % HomeView.colCount) * HomeView.dims.item.margin

	# 		item.$el.css
	# 			'top': top
	# 			'left': left

	# 	@$grid.css 'height': Math.ceil(HomeView.gridItems.length / HomeView.colCount) * HomeView.dims.item.h

	# 	null

	init : ->

		@$grid = @$el.find('[data-home-grid]')

		@checkScrollerCompat()

		null

	setListeners : (setting) ->

		@CD().appView[setting] @CD().appView.EVENT_UPDATE_DIMENSIONS, @onResize
		# @CD().appView[setting] @CD().appView.EVENT_ON_SCROLL, @onScroll

		@CD().appView.header[setting] @CD().appView.header.EVENT_HOME_SCROLL_TO_TOP, @scrollToTop

		@$credits[setting] 'mouseenter', 'a', @onCreditWordEnter
		@$credits[setting] 'mouseleave', 'a', @onCreditWordLeave

		if setting is 'off'
			HomeView.scrollDistance = @el.scrollTop
			@el.removeEventListener 'scroll', @onNativeScroll
			for event in ['wheel', 'touchstart', 'pointerdown', 'keydown']
				@el.removeEventListener event, @onScrollInput
			clearTimeout @scrollEndTimer
			@onScrollInput()
			@scrollActive = false
			@isScrolling = false

		null

	setupDims : ->

		gridWidth = @$grid.outerWidth()

		HomeView.colCount = Math.round gridWidth / HomeView.dims.item.w
		
		HomeView.dims.container =
			h: @CD().appView.dims.h, w: gridWidth, a: (@CD().appView.dims.h * gridWidth), pt: 25

		HomeView.dims.item.a = HomeView.dims.item.h * (HomeView.dims.item.w + ((HomeView.dims.item.margin * (HomeView.colCount - 1)) / HomeView.colCount))

		null

	setupNativeScroll : ->

		@el.addEventListener 'scroll', @onNativeScroll, { passive: true }
		for event in ['wheel', 'touchstart', 'pointerdown', 'keydown']
			@el.addEventListener event, @onScrollInput, { passive: true }
		@scrollActive = true
		null

	onScrollInput : ->

		# Direct user input takes over an animated return to the top.
		@scrollTween?.kill()
		@scrollTween = null
		null

	onNativeScroll : ->

		return unless @scrollActive
		@onScrollStart() unless @isScrolling
		@onScroll()
		clearTimeout @scrollEndTimer
		@scrollEndTimer = setTimeout @onScrollEnd, 150
		null

	setItemsOffsetAndEase : ->

		(item.setOffsetAndEase i, HomeView.colCount) for item, i in HomeView.gridItems

		null

	onResize : ->

		@setupDims()
		@setItemsOffsetAndEase()

		if @scrollActive
			@onScroll()
			@onScrollEnd()

		null

	onScrollStart : ->

		@$grid.removeClass 'enable-grid-item-hover'

		if !@ticking
			@ticking = true
			requestAnimationFrame @onTick

		@isScrolling = true

		null

	onScrollEnd : ->

		@$grid.addClass 'enable-grid-item-hover'
		HomeView.scrollDelta = 0

		@setVisibleItemsAsShown() if @usesGridEffects()

		@isScrolling = false

		null

	onScroll : ->

		HomeView.scrollDelta = @el.scrollTop - HomeView.scrollDistance
		HomeView.scrollDistance = @el.scrollTop
		if @usesGridEffects()
			@checkItemsForVisibility()
			if @el.scrollHeight - @el.clientHeight - @el.scrollTop < HomeView.SCROLL_SHOW_CREDITS_THRESHOLD
				@showCredits()
			else
				@hideCredits()
		null

	onTick : ->

		# console.log "tick..."
		# @trigger @EVENT_TICK, HomeView.scrollDelta

		shouldTick = false
		for item, i in HomeView.gridItems
			if item.offset isnt 0
				shouldTick = true 
				break

		if shouldTick
			requestAnimationFrame @onTick
		else
			@ticking = false

		null

	scrollToTop : ->

		return unless @scrollActive
		@onScrollInput()
		@scrollTween = gsap.to @el, { scrollTop: 0, duration: 0.7, ease: 'power1.out' }

		null

	show : ->

		super(arguments...)
		null

	startScroller : ->

		@setupDims()

		@setupNativeScroll()
		@el.scrollTop = HomeView.scrollDistance
		@setItemsOffsetAndEase()

		@onScroll()
		@onScrollEnd()

		null

	animateIn : ->

		@setupDims()
		# @positionGridItems()

		if !HomeView.visitedThisSession
			# @addDoodles @getRequiredDoodleCountByArea(), true
			HomeView.visitedThisSession = true
			@animateInInitialItems @startScroller
		else
			@startScroller()

		null

	setVisibleItemsAsShown : ->

		itemsToShow = []
		for item, i in HomeView.gridItems

			position = @_getItemPositionDataByIndex i

			if position.visibility > 0
				itemsToShow.push item
			else
				item.hide()

		for item, i in itemsToShow

			do (item, i) =>
				setTimeout item.show, (500 * 0.1) * i

		null

	checkItemsForVisibility : ->

		for item, i in HomeView.gridItems

			position = @_getItemPositionDataByIndex i
			offset = item.maxOffset - (position.visibility * item.maxOffset)

			item.$el.css
				'visibility' : if position.visibility > 0 then 'visible' else 'hidden'
				'opacity' : if position.visibility > 0 then 1 else 0
				# 'opacity' : if position.visibility > 0 then position.visibility + 0.3 else 0
				# 'transform' : "translate3d(0, #{position.transform}#{offset}px, 0)"

			# item.$el.find('.grid-item-thumb-holder').css
			# 	'opacity' : if position.visibility > 0 then position.visibility else 0
			# 	'transform' : "scale(#{position.visibility}) translate(-50%, -50%)"

		null

	_getItemPositionDataByIndex : (idx) ->

		verticalOffset = (Math.floor(idx / HomeView.colCount) * HomeView.dims.item.h) + HomeView.dims.container.pt
		position = visibility: 1, transform: '+'

		if verticalOffset + HomeView.dims.item.h < HomeView.scrollDistance or verticalOffset > HomeView.scrollDistance + HomeView.dims.container.h
			position = visibility: 0, transform: '+'
		else if verticalOffset > HomeView.scrollDistance and verticalOffset + HomeView.dims.item.h < HomeView.scrollDistance + HomeView.dims.container.h
			position = visibility: 1, transform: '+'
		else if verticalOffset < HomeView.scrollDistance and verticalOffset + HomeView.dims.item.h > HomeView.scrollDistance
			perc = 1 - ((HomeView.scrollDistance - verticalOffset) / HomeView.dims.item.h)
			position = visibility: perc, transform: '-'
		else if verticalOffset < HomeView.scrollDistance + HomeView.dims.container.h and verticalOffset + HomeView.dims.item.h > HomeView.scrollDistance + HomeView.dims.container.h
			perc = ((HomeView.scrollDistance + HomeView.dims.container.h) - verticalOffset) / HomeView.dims.item.h
			position = visibility: perc, transform: '+'

		position

	getRequiredDoodleCountByArea : ->

		totalArea  = HomeView.dims.container.a + (HomeView.scrollDistance * HomeView.dims.container.w)
		targetRows = (totalArea / HomeView.dims.item.a) / HomeView.colCount

		targetItems = Math.floor(targetRows) * HomeView.colCount
		targetItems = if (targetRows % 1) > HomeView.SHOW_ROW_THRESHOLD then targetItems + HomeView.colCount else targetItems

		# return targetItems - HomeView.gridItems.length
		return targetItems

	# addDoodles : (count, fullPageTransition=false) =>

	# 	console.log "adding doodles... x#{count}"

	# 	newItems = []

	# 	for idx in [HomeView.gridItems.length...HomeView.gridItems.length+count]

	# 		doodle = @allDoodles.at idx
	# 		break if !doodle

	# 		newItems.push new HomeGridItem doodle

	# 	HomeView.gridItems = HomeView.gridItems.concat newItems

	# 	for item, idx in newItems

	# 		@addChild item
	# 		@animateItemIn item, idx, fullPageTransition

	# 	null

	animateInInitialItems : (cb) ->

		itemCount = @getRequiredDoodleCountByArea()
		itemCount = Math.min itemCount, @allDoodles.length

		console.log "itemCount = @getRequiredDoodleCountByArea()", itemCount

		for i in [0...itemCount]
			params = [HomeView.gridItems[i], i, true]
			if i is itemCount-1 then params.push cb
			@animateItemIn.apply @, params

		null

	animateItemIn : (item, index, fullPageTransition=false, cb=null) ->

		duration   = 0.4
		fromParams = y : (if fullPageTransition then window.innerHeight else 0), opacity : 0, scale : 0.6
		toParams   = delay : (duration * 0.2) * index, y : 0, opacity : 1, scale : 1 , ease : 'expo.out'

		if cb then toParams.onComplete = =>
			@$grid.removeClass 'before-intro-animation'
			setTimeout =>
				@$grid.addClass 'after-intro-animation'
			, 400
			cb()

		gsap.fromTo item.$el, fromParams, Object.assign({ duration }, toParams)

		null

	showCredits : ->

		return unless !@creditsVisible
		@creditsVisible = true

		@$creditCodeWords
			.removeClass('disable-pointer')
			.each (i, el) =>

				$el = $(el)
				CodeWordTransitioner.to $el.attr('data-original-text'), $el, 'red', false, =>
					$el.addClass 'enable-underline'

		null

	hideCredits : (force=false) ->

		return unless @creditsVisible or force
		@creditsVisible = false

		@$creditCodeWords
			.addClass('disable-pointer')
			.each (i, el) =>

				$el = $(el)
				$el.removeClass 'enable-underline'
				CodeWordTransitioner.to $el.attr('data-original-text').split('').map(-> return ' ').join(''), $el, 'red'

		null

	onCreditWordEnter : (e) ->

		$el = $(e.currentTarget)

		CodeWordTransitioner.scramble $el, 'red'

		null

	onCreditWordLeave : (e) ->

		$el = $(e.currentTarget)

		CodeWordTransitioner.unscramble $el, 'red'

		null

module.exports = HomeView
