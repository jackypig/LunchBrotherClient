/**
 * Created by Jack on 11/4/15.
 */
define([
    'stripe',
    'models/user/CardModel',
    'text!templates/manage/cardTemplate.html'
], function (Stripe, CardModel, cardTemplate) {

    var CardView = Parse.View.extend({
        el: $("#page"),

        events: {
            'submit #cardForm': 'saveCreditCard',
            'click .cancelCardBtn': 'onCancelClick'
        },

        initialize: function () {
            _.bindAll(this, 'render', 'saveCreditCard', 'stripeResponseHandler');
            Stripe.setPublishableKey(STRIPE_KEY);
        },

        template: _.template(cardTemplate),

        render: function () {
            this.$el.html(this.template());
            return this;
        },

        saveCreditCard: function(e) {
            e.preventDefault();
            var $form = this.$('form');
            Stripe.card.createToken($form, this.stripeResponseHandler);
        },


        stripeResponseHandler: function (status, response) {
            var $form = $('#cardForm');
            if (response.error) {
                // Show the errors on the form
                showMessage("Error", response.error.message);
                $form.find('.card-errors').text(response.error.message);
            }
            else {
                // No errors, submit the form.
                var self = this;
                var last4Digit = $form.find('input[name=number]').val().slice(-4);

                Parse.Cloud.run('saveCard', {
                    card: response.id,
                    last4Digit: last4Digit
                }, {
                    success: function (customer) {
                        showMessage("Success!", "Save Credit Card Successful", function() {
                            self.onCancelClick();
                        });
                    },
                    error: function(error) {
                        showMessage("Save Credit Card Failed", error.message);
                    }
                });
            }
        },

        onCancelClick: function() {
            window.location.href='#managerHome?week=&dp=';
        }
    });
    return CardView;
});

