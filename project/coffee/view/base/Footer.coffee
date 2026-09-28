AbstractView = require '../AbstractView'

class Footer extends AbstractView

    template : 'site-footer'

    initialize : ->

        @templateVars = {}

        super()

        return null

module.exports = Footer
