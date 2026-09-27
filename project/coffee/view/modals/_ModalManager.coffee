AbstractView     = require '../AbstractView'
OrientationModal = require './OrientationModal'

class ModalManager extends AbstractView

	# when new modal classes are created, add here, with reference to class name
	modals :
		orientationModal : classRef : OrientationModal, view : null

	initialize : ->

		super()

		return null

	init : ->

		null

	isOpen : ->

		for name, modal of @modals
			return true if modal.view

		false

	hideOpenModal : ->

		( if @modals[name].view then openModal = @modals[name].view ) for name, modal of @modals

		openModal?.hide()

		null

	showModal : (name, cb=null) ->

		return if @modals[name].view

		@modals[name].view = new @modals[name].classRef cb

		null

module.exports = ModalManager
