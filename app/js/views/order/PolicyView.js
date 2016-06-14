define([
  'text!templates/policy/policyTemplate.html'
], function (policyTemplate) {

    var PolicyView = Parse.View.extend({
        el: $("#page"),

        initialize: function () {
            _.bindAll(this, 'render');
        },

        template: _.template(policyTemplate),

        render: function () {
            this.$el.html(this.template());
            return this;
        }
    });
    return PolicyView;
});