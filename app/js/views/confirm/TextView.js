//OrderId&Email
define([
  'models/order/PaymentModel',
  'text!templates/confirm/textTemplate.html',
], function(PaymentModel,textTemplate) {

  var TextView = Parse.View.extend({

    tagName: "div",
    attributes: {
      class: 'column'
    },

    initialize: function(options) {
      _.bindAll(this, 'render');
    },

    template: _.template(textTemplate),
    render: function() {
      this.$el.html(this.template(this.model.toJSON()));
      return this;
    }
  });
  return TextView;
});