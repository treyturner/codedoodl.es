class AbstractModel extends Backbone.DeepModel

	set : (key, value, options) ->

		return @ unless key?
		# Backbone accepts both an attribute map and a key/value pair. Native
		# class methods are strict: a value such as true cannot act as options.
		if typeof key is 'object'
			attrs = key
			options = value or {}
		else
			attrs = {}
			attrs[key] = value
			options or (options = {})

		attrs = @_filterAttrs attrs

		options.data = JSON.stringify attrs

		return super(attrs, options)

	_filterAttrs : (attrs) ->

		attrs

	CD : =>

		return window.CD

module.exports = AbstractModel
