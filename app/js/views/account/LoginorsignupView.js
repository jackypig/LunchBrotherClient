define([
        'text!templates/account/loginorsignupTemplate.html',  
], function (loginorsignupTemplate) {

    var LoginorsignupView = Parse.View.extend({
        el: $("#page"),

        initialize: function () {
            _.bindAll(this, 'render');
        },

        template: _.template(loginorsignupTemplate),

        render: function () {
           
            this.$el.html(this.template());
            return this;
        }
    });
    return LoginorsignupView;
});
