define([
    'stripe',
    'models/BankAccount',
  'text!templates/manage/bankTemplate.html'
], function (Stripe, BankAccountModel, bankTemplate) {

    var BankView = Parse.View.extend({
        el: $("#page"),

        events: {
            'submit #bankForm': 'saveBankAccount',
            'click .cancelBankBtn': 'onCancelClick'
        },

        initialize: function () {
            _.bindAll(this, 'render', 'saveBankAccount', 'stripeResponseHandler');
            Stripe.setPublishableKey(STRIPE_KEY);
        },

        template: _.template(bankTemplate),

        render: function () {
            var self = this;
            if (this.options.id) {
                var bankQuery = new Parse.Query(BankAccountModel);
                bankQuery.get(this.options.id, {
                    success: function(bankAccount) {
                        self.$el.html(self.template({bankAccount: bankAccount}));
                    },
                    error: function(error) {
                        showMessage("Error", "Find bank failed! Reason: " + error.message);
                    }
                });
            } else {
                var bankAccount = new BankAccountModel();
                self.$el.html(self.template({bankAccount: bankAccount}));
            }

            return this;
        },

        saveBankAccount: function(e) {
            if (this.isOldBankAccount()) {
                window.location.href = '#managerHome?week=&dp=';

            } else {
                e.preventDefault();
                var $form = this.$('form');
                //Disable the button
                $('#bankBtn').removeClass('red').addClass('grey');
                $('#bankBtn').prop('disabled', true);

                Stripe.bankAccount.createToken($form, this.stripeResponseHandler);
            }
        },

        isOldBankAccount: function() {
            var accountNumber = $(".account-number").val().trim();
            var routingNumber = $(".routing-number").val().trim();
            var originalAccountNumber = $(".original-account-number").val().trim();
            var originalRoutingNumber = $(".original-routing-number").val().trim();
            return (accountNumber === originalAccountNumber) && (routingNumber === originalRoutingNumber);
        },

        stripeResponseHandler: function(status, response) {
            var $form = $('#bankForm');

            if (response.error) {
                // Show the errors on the form
                showMessage("Error", response.error.message);
                $form.find('.bank-errors').text(response.error.message);
                $form.find('button').prop('disabled', false);
            } else {
                // response contains id and bank_account, which contains additional bank account details
                var token = response.id;
                var accountNumber = $(".account-number").val();
                var routingNumber = $(".routing-number").val();
                var last4DigitForAccountNumber = $(".account-number").val().slice(-4);
                var currentUser = Parse.User.current();

                Parse.Cloud.run('saveRecipient', {
                    name: currentUser.get('firstName') + " " + currentUser.get('lastName'),
                    type: 'individual',
                    bankAccount: token,
                    accountNumber: accountNumber,
                    routingNumber: routingNumber,
                    last4DigitForAccountNumber: last4DigitForAccountNumber,
                    email: currentUser.get('email'),
                    createdById: currentUser.id
                }, {
                    success: function (response) {
                        currentUser.set('bankAccount', response);
                        currentUser.save();
                        showMessage("Success", "Bank account created successfully!", function() {
                            window.location.href = '#managerHome?week=&dp=';
                        });
                    },
                    error: function(error) {
                        showMessage("Error", "Oops, something went wrong! Please check your account number and routing number then try again. Details: " + error.message);
                    }
                });
            }
        },

        onCancelClick: function() {
            window.location.href='#managerHome?week=&dp=';
        }
    });
    return BankView;
});

