class LocalesModel extends Backbone.Model

    defaults :
        code     : null
        language : null
        strings  : null
            
    get_language : =>
        return @get('language')

    getString : (id) =>
        for k, v of @get('strings')
            for a, e of v.strings
                return e if a is id
        console.warn "Locales -> not found string: #{id}"
        null

module.exports = LocalesModel
