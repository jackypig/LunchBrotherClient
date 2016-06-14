define([
  'text!templates/account/forgotpasswordTemplate.html'
], function (forgotpasswordTemplate) {

    var ForgotpasswordView = Parse.View.extend({
        el: $("#page"),

        events: {
            'click #sendemailBtn': 'onSendResetPasswordEmailClick'
        },

        initialize: function () {
            _.bindAll(this, 'render');
        },

        template: _.template(forgotpasswordTemplate),

        render: function () {
            this.$el.html(this.template());
            this.$('.ui.form').form({
                resetEmail: {
                    identifier: 'resetEmail',
                    rules: [{
                        type: 'empty',
                        prompt: 'Please enter your email'
                    }]
                }
            }, {
                on: 'blur',
                inline: 'true'
            });
            return this;
        },

        onSendResetPasswordEmailClick: function() {
            var self = this;
            var email = this.$("#resetEmail").val();

            if(email.trim() == ""){
                return;
            }

            var resetKey = self.generateResetKey();

            Parse.Cloud.run('saveResetKeyForUser', {
                emailAddress: email,
                resetKey: resetKey
            }, {
                success: function (user) {
                    var verificationLink = config.appUrl + "#resetPassword?userId=" + user.id + "&resetKey=" + user.get('resetKey');
                    Parse.Cloud.run('emailResetPasswordLink', {
                        firstName: user.get("firstName"),
                        emailAddress: email,
                        verificationLink: verificationLink
                    }, {
                        success: function () {
                            console.log("Verification link sent to " + email + " successfully!");
                        },
                        error: function (error) {
                            console.log("Verification link failed to send. Error: " + error.message);
                        }
                    });

                    showMessage("Success", "An email has been sent to " + email + ", please follow the instructions to reset your password!", function() {
                        window.location.hash = "#";
                    });
                },
                error: function (error) {
                    showMessage("Error", error.message, function() {
                        window.location.hash = "#forgotpassword";
                    });
                }
            });
        },

        generateResetKey: function() {
            var text = "";
            var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

            for( var i=0; i < 5; i++ )
                text += possible.charAt(Math.floor(Math.random() * possible.length));

            return text;
        }
    });
    return ForgotpasswordView;
});