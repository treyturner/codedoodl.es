AbstractViewPage = require '../AbstractViewPage'

class FourOhFourPageView extends AbstractViewPage

	template : 'page-four-oh-four'

	initialize : ->

		@templateVars =
			text : @CD().locale.get "four_oh_four_page_text"

		super(arguments...)
		return null

module.exports = FourOhFourPageView
