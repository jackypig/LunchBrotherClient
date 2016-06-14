define([
    'views/status/StatusView',
    'models/order/PaymentModel',
    'models/order/OrderModel',
    'models/dish/DishModel',
    'models/Grid',
    'models/PickUpLocation',
    'models/Employee',
    'models/order/NotificationModel',
    'models/manage/DeliveryModel',
    'text!templates/manage/distributorTemplate.html',
    'text!templates/manage/orderListTemplate.html',
    'libs/semantic/dropdown.min'
], function (StatusView, PaymentModel, OrderModel, DishModel, GridModel, PickUpLocationModel, EmployeeModel, NotificationModel, DeliveryModel, distributorTemplate, orderListTemplate) {
    var DistributorView = Parse.View.extend({
        el: $("#page"),
        template: _.template(distributorTemplate),
        orderListTemplate: _.template(orderListTemplate),
        events: {
            //view listenTo model change
            'keyup  #searchInput': 'onSearchBarInput',
            'change #addressOption': 'onAddressSelect',
            'click  #arriveBtn': 'updateStatus'
        },

        initialize: function () {
            _.bindAll(this, 'render', 'updateStatus');
        },

        render: function () {
            var self = this;
            var currentUser = Parse.User.current();
            if (currentUser.get('permission') != LOCAL_MANAGER) {
                var employeeQuery = new Parse.Query(EmployeeModel);
                employeeQuery.equalTo("worker", currentUser);
                employeeQuery.first({
                    success: function(employee) {
                        self.findPickUpLocationFromManager(employee.get('manager'));

                    },
                    error: function(error) {
                        showMessage("Error", "Can't find manager. Reason: " + error.message);
                    }
                });

            } else {
                this.findPickUpLocationFromManager(currentUser);
            }

            return this;
        },

        findPickUpLocationFromManager: function(manager) {
            var self = this;
            var pickUpLocationQuery = new Parse.Query(PickUpLocationModel);
            pickUpLocationQuery.equalTo("manager", manager);
            pickUpLocationQuery.find({
                success: function(pickUpLocations) {
                    self.$el.html(self.template({pickUpLocations: pickUpLocations}));
                    $('.menu li').removeClass('active');
                    $('.menu li a[href="#"]').parent().addClass('active');
                    var paymentQuery = new Parse.Query(PaymentModel);
                    self.$("#addressOption").dropdown();
                    self.applyQuery(paymentQuery, self);
                    self.$("#arriveBtn").addClass("red");

                    var current = new Date();
                    if (current.getHours() < 11 || current.getHours() > 14) {
                        self.$("#arriveBtn").addClass("disabled");
                    }
                },
                error: function(error) {
                    showMessage("Error", "Pick Up Location Query Error: " + error.code + " " + error.message);
                }
            });
        },

        onSearchBarInput: function () {
            var paymentQuery = new Parse.Query(PaymentModel);
            var searchText = this.$("#searchInput").val().toLowerCase();
            if (searchText != "") {
                paymentQuery.contains("lowercaseLastName", searchText);
            }
            else {
                this.$("#searchResultLabel").text("");
            }
            var self = this;
            this.applyQuery(paymentQuery, self);
        },

        onAddressSelect: function () {
            var paymentQuery = new Parse.Query(PaymentModel);
            var self = this;
            this.applyQuery(paymentQuery, self);
        },

        applyQuery: function (query, self) {
            this.$("#buildingLabel").text(this.$("#addressOption option:selected").text());
            query.contains("lowercaseLastName", this.$("#searchInput").val().toLowerCase());
            query.ascending("lowercaseLastName");
            //query.equalTo("paymentCheck", true);
            query.notEqualTo("isPickedUp", true);
            query.include("pickUpLocation");
            query.greaterThan("createdAt", START_ORDER_TIME());
            query.lessThan("createdAt", STOP_ORDER_TIME());
            query.limit(300);
            query.find().then(function(payments){
                self.populateDistributorView(payments);

            }, function(error){
                showMessage("Error", "Payment Query Error: " + error.code + " " + error.message);

            });
        },

        populateDistributorView: function(payments) {
            var self = this;
            var currentUser = Parse.User.current();
            var newResults = [];
            var newEvent = {};
            _.each(payments, function(payment) {
                if (payment.get("pickUpLocation") !== undefined) {
                    var paymentGridId = UMCP_GRID_ID;  //For old user backward compatibility
                    if (payment.get("pickUpLocation") !== undefined) {
                        paymentGridId = payment.get("pickUpLocation").get("gridId").id;
                    }

                    var paymentDetailMap = {
                        firstName: payment.get('fname'),
                        lastName: payment.get('lname'),
                        telNum: payment.get('telnum'),
                        totalPrice: payment.get('totalPrice'),
                        orderNumber: payment.id,
                        paid: payment.get('paymentCheck'),
                        orderSummary: ""
                    };

                    if (payment.get('orderSummary')) {
                        var orderSummaryString = "";
                        _.each(payment.get('orderSummary'), function(orderSummary){
                            var orderSummaryDetail = orderSummary.split('-');
                            var dishCode = orderSummaryDetail[0];
                            var dishName = orderSummaryDetail[1];
                            var dishCount = orderSummaryDetail[2];
                            orderSummaryString += dishName + " (" + dishCode + ")" + " - " + dishCount + ", ";
                        });

                        paymentDetailMap.orderSummary = orderSummaryString;
                    }

                    if (paymentGridId === currentUser.get("gridId").id && payment.get("pickUpLocation").id === self.$("#addressOption").val()) {
                        paymentDetailMap.orderSummary = paymentDetailMap.orderSummary.substring(0, paymentDetailMap.orderSummary.length - 2);
                        newResults.push(paymentDetailMap);
                        newEvent["click #checkButton-" + paymentDetailMap.orderNumber] = 'onPickupClick';
                        self.delegateEvents(_.extend(self.events, newEvent));
                    }
                }
            });
            self.$("#orderNumberLabel").text(newResults.length);
            self.$("#orderList").html(self.orderListTemplate({
                payments: newResults
            }));
        },

        onPickupClick: function (ev) {
            var self = this;
            var orderId = $(ev.currentTarget).data('order');
            var name = $(ev.currentTarget).data('lname') + ", " + $(ev.currentTarget).data('fname');
            var totalPrice = $(ev.currentTarget).data('price');
            $("#confirmDialogPay").text(totalPrice);
            $("#confirmDialogOrderId").text(orderId);
            $("#confirmDialogName").text(name);
            $('#confirmDeliveryPayment').modal({
                closable: false,
                onDeny: function () {

                },
                onApprove: function () {
                    self.saveChange(orderId);
                    self.$("#div-" + orderId).fadeOut(500, function(){
                        // This is a jquery bug for fading out trs, need to do this removal for mobile device
                        //http://stackoverflow.com/questions/944110/jquery-fadeout-not-working-with-table-rows
                        $(this).parent().remove();
                    });
                    self.$("#orderNumberLabel").text(self.$("#orderNumberLabel").text() - 1);
                }
            }).modal('show');
        },

        saveChange: function (orderId) {
            var paymentDetail = new PaymentModel();
            paymentDetail.id = orderId;
            paymentDetail.set("isPickedUp", true);
            paymentDetail.set("paymentCheck", true);
            paymentDetail.save(null, {
                success: function (paymentDetail) {
                    //Do nothing
                },
                error: function (error) {
                    showMessage("Error", "Save payment failed! Reason: " + error.message);
                }
            });
        },

        updateStatus: function () {
            this.$("#arriveBtn").addClass("disabled");
            this.checkIfNotificationSent(this.$("#addressOption").val());
        },

        sendNotification: function() {
            var self = this;
            var query = new Parse.Query(PaymentModel);
            var pickUpLocationId = this.$("#addressOption").val();
            query.equalTo("pickUpLocation", {
                __type: "Pointer",
                className: "PickUpLocation",
                objectId: pickUpLocationId
            });

            query.notEqualTo("isPickedUp", true);

            var orders = [];
            query.greaterThan("createdAt", START_ORDER_TIME());
            query.lessThan("createdAt", STOP_ORDER_TIME());
            query.limit(300);
            query.find({
                success: function (results) {
                    for (var i=0; i<results.length; i++) {
                        orders[i] = results[i].get('fname') + ",";
                        orders[i] += results[i].get('lname') + ",";
                        orders[i] += results[i].get('email');
                    }

                    Parse.Cloud.run('emailNotification', {
                        pickUpLocationId: pickUpLocationId,
                        ordersToSend: orders
                    }, {
                        success: function () {
                            showMessage("Success", "Pick-up notification has been sent to customers successfully!", function(){
                                var notification = new NotificationModel();
                                notification.set("key", self.getNotificationKey(pickUpLocationId));
                                notification.save({
                                    success: function(notification) {
                                        console.log("Notification saved successfully!");
                                    },
                                    error: function(error) {
                                        console.log("Notification saved failed! Reason: " + error.message);
                                    }
                                });
                            });
                        },
                        error: function (error) {
                            showMessage("Failed", "Notification failed to send. Error: " + error.message);
                        }
                    });
                },
                error: function (error) {
                    console.log("Error: " + error.code + " " + error.message);
                }
            });
        },

        checkIfNotificationSent: function() {
            var self = this;
            var notificationQuery = new Parse.Query(NotificationModel);
            notificationQuery.equalTo("key", self.getNotificationKey());
            notificationQuery.find({
                success: function (results) {
                    if(results.length > 0){
                        showMessage("Oops!", "Notification has already been sent before!");
                    }else{
                        self.sendNotification();
                    }
                },
                error: function (error) {
                    console.log("Error: " + error.code + " " + error.message);
                }
            });
        },

        getNotificationKey: function() {
            var date = new Date().getDate();
            var month = new Date().getMonth() + 1;
            var year = new Date().getFullYear();
            var key = this.$("#addressOption").val() + "-" + year + month + date;
            return key;
        }
    });

    return DistributorView;

});
