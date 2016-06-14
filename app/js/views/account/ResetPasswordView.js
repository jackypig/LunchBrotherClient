define([
	'views/account/ForgotpasswordView',
    'text!templates/account/resetpasswordTemplate.html'
], function (ForgotpasswordView,resetPasswordTemplate) {

    var resetPasswordView = Parse.View.extend({
        el: $("#page"),

        events: {
            'click #resetBtn': 'resetPassword'
        },

        initialize: function (options) {
            this.options = options;
            _.bindAll(this, 'render', 'resetPassword');
        },

        template: _.template(resetPasswordTemplate),

        render: function () {
        	var self = this;
        	var exception = "Your resetkey is invalid, please try again";
        	var subquery = new Parse.Query(Parse.User);
        	var currentURL = window.location.href;
        	var linkResetKey = currentURL.substring(currentURL.length-5,currentURL.length);
        	var userId = this.options.userId;
        	Parse.Cloud.run("matchResetKey", {
        		userId : userId,
        		resetKey:linkResetKey
        	    },{
        	    	success:function(user){
                        var current = new Date();
                        var updateTime = user.updatedAt;
                        var timeDifference = (current.getTime() - updateTime.getTime())/1000/60;

                        if (timeDifference > 5) {
                            showMessage("Reset Link Expired", "Your reset password link is expired, please submit the request again.", function() {
                                window.location.hash = "#forgotpassword";
                            });
                        } else {
                            self.$el.html(self.template());
                            self.$('.ui.form').form({
                                'newPassword': {
                                    identifier: 'newPassword',
                                    rules: [{
                                        type: 'empty',
                                        prompt: 'Please enter your new password'
                                    }]
                                },
                                'confirmPassword': {
                                    identifier: 'confirmPassword',
                                    rules: [{
                                        type: 'empty',
                                        prompt: 'Please confirm your password'
                                    }]
                                }
                            }, {
                                on: 'blur',
                                inline: 'true'
                            });
                        }
                    },
                    error:function(error){
                        showMessage("Invalid Reset Key", "Your reset key is invalid, please try again.", function() {
                            window.location.hash = "#forgotpassword";
                        });
                    }
        	    });
            return this;
        },

        resetPassword: function() {
            var query = new Parse.Query(Parse.User);
            var linkResetKey = this.options.resetKey;
            var confirmPassword = this.$("#confirmPassword").val();
            var newPassword = this.$("#newPassword").val();
            if( newPassword.trim() == "" || confirmPassword.trim() == "") {
                //do nothing
            } else {
                if( newPassword != confirmPassword) {
                    showMessage("Passwords Mismatch", "Your passwords do not match, please check them and try again.");
                } else {
                    query.get(this.options.userId, {
                        success: function(user) {
                            var userResetKey = user.get('resetKey');
                            if (linkResetKey == userResetKey){
                                Parse.Cloud.run("saveNewPassword", {
                                    userId: user.id,
                                    password: this.$("#newPassword").val()
                                },{
                                    success: function() {
                                        showMessage("Success", "Your password has been reset, now you can login with your new password!", function () {
                                            window.location.hash = "#";
                                        });
                                    },
                                    error: function(error) {
                                        showMessage("Error", "Save new password failed! Reason: " + error.message);
                                    }
                                });
                            } else {
                                showMessage("Error", "Reset key does not match!");
                            }
                        },
                        error: function() {
                            showMessage("Error", "Can't find user!");
                        }
                    });
                }

            }
        }
    });
    return resetPasswordView;
});