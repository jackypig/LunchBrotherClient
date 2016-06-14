define([
    'models/order/PaymentModel',
    'models/order/OrderModel',
    'models/dish/DishModel',
    'models/Grid',
    'models/Restaurant',
    'models/PickUpLocation',
    'models/InventoryModel',
    'models/Employee',
    'models/manage/DeliveryModel',
    'views/manage/LoginView',
    'text!templates/manage/driverTemplate.html'
], function(PaymentModel, OrderModel, DishModel, GridModel, RestaurantModel, PickUpLocationModel, InventoryModel, EmployeeModel, DeliveryModel, LoginView, driverTemplate) {

    var DriverView = Parse.View.extend({
        el: $("#page"),
        events: {
            'click #readyToGo': 'startSendingLocation',
            'click #done': 'stopSendingLocation'
        },

        driverLocation: null,
        deliveryId: null,

        initialize: function() {
            _.bindAll(this, 'render');
        },

        template: _.template(driverTemplate),

        render: function() {
            this.findTodayPickupInfo();
            return this;
        },

        findTodayPickupInfo: function() {
            var self = this;
            var currentUser = Parse.User.current();
            if (currentUser.get('permission') != LOCAL_MANAGER) {
                var employeeQuery = new Parse.Query(EmployeeModel);
                employeeQuery.equalTo("worker", currentUser);
                employeeQuery.first({
                    success: function(employee) {
                        self.findInventoryByManager(employee.get('manager'));

                    },
                    error: function(error) {
                        showMessage("Error", "Can't finding manager. Reason: " + error.message);
                    }
                });

            } else {
                this.findInventoryByManager(currentUser);
            }
        },

        findInventoryByManager: function(manager) {
            var self = this;
            var inventoryQuery = new Parse.Query(InventoryModel);
            inventoryQuery.equalTo("orderBy", manager);
            inventoryQuery.greaterThan("pickUpDate", INVENTORY_FROM_TIME());
            inventoryQuery.lessThan("pickUpDate", INVENTORY_UNTIL_TIME());
            inventoryQuery.include("dish");
            inventoryQuery.include("dish.restaurant");
            inventoryQuery.include("pickUpLocation");
            inventoryQuery.find({
                success: function(inventories) {
                    var restaurantName = "";
                    var restaurantNumber = "";
                    var restaurantAddress = "";
                    var dishQuantitySummary = "";
                    var orderByDps = {};
                    var dishMap = {};

                    _.each(inventories, function(inventory) {
                        if (!restaurantName) {
                            restaurantName = inventory.get('dish').get('restaurant').get('name');
                        }

                        if (!restaurantNumber) {
                            restaurantNumber = inventory.get('dish').get('restaurant').get('telnum');
                        }

                        if (!restaurantAddress) {
                            restaurantAddress = inventory.get('dish').get('restaurant').get('address');
                        }

                        if (!dishMap[inventory.get('dish').id]) {
                            dishMap[inventory.get('dish').id] = {
                                dishLabel: inventory.get('dish').get('dishName') + " (" + inventory.get('dish').get('dishCode') + ")",
                                orderCount: inventory.get('totalOrderQuantity')
                            }
                        } else {
                            dishMap[inventory.get('dish').id].orderCount += inventory.get('totalOrderQuantity');
                        }

                        if (!orderByDps[inventory.get("pickUpLocation").id]) {
                            orderByDps[inventory.get("pickUpLocation").id] = {
                                address: inventory.get("pickUpLocation").get('address'),
                                dishLabel: inventory.get('dish').get('dishName') + " (" + inventory.get('dish').get('dishCode') + ")" +
                                " - " + inventory.get('totalOrderQuantity')
                            }

                        } else {
                            orderByDps[inventory.get("pickUpLocation").id].dishLabel += ", " + inventory.get('dish').get('dishName') + " (" + inventory.get('dish').get('dishCode') + ")" +
                                " - " + inventory.get('totalOrderQuantity');
                        }
                    });

                    for (var key in dishMap) {
                        if (!dishQuantitySummary) {
                            dishQuantitySummary = dishMap[key].dishLabel + " - " + dishMap[key].orderCount;
                        } else {
                            dishQuantitySummary += ", " + dishMap[key].dishLabel + " - " + dishMap[key].orderCount;
                        }
                    }

                    self.$el.html(self.template({orderByDps: orderByDps, dishQuantitySummary: dishQuantitySummary}));

                    self.$("#resName").html(restaurantName);
                    self.$("#resNumber").html(restaurantNumber);
                    self.$("#resAddress").html(restaurantAddress);
                },
                error: function(error) {
                    console.log(error.message);
                }
            });
        },

        savePosition: function(position) {
            console.log("Sending location...");
            var deliveryModel = new DeliveryModel();
            var currentUser = Parse.User.current();
            if(this.deliveryId != null) {
                deliveryModel.id = this.deliveryId;
            }
            var self = this;
            deliveryModel.set('deliverBy', currentUser);
            deliveryModel.set('status', "On the way");
            deliveryModel.set('grid', {
                __type: "Pointer",
                className: "Grid",
                objectId: currentUser.get("gridId").id});
            deliveryModel.set('longitude', position.coords.longitude);
            deliveryModel.set('latitude', position.coords.latitude);
            deliveryModel.save({
                success: function(delivery) {
                    self.deliveryId = delivery.id;
                },
                error: function(error) {
                    alert("Error: " + error.code + " " + error.message);
                }
            });
        },

        errorHandler: function(err) {
            if(err.code == 1) {
                alert("Error: Access is denied!");
            }

            else if( err.code == 2) {
                alert("Error: Position is unavailable!");
            }
        },

        startSendingLocation: function(){
            $("#readyToGo").addClass('disabled');
            if(navigator.geolocation){
                var options = {timeout:60000};
                geoLoc = navigator.geolocation;
                watchID = geoLoc.watchPosition(this.savePosition, this.errorHandler, options);
            } else {
                alert("Sorry, your browser does not support geolocation!");
            }
        },

        stopSendingLocation: function() {
            console.log("Stop recording location!");
            $("#readyToGo").removeClass('disabled');
            geoLoc.clearWatch(watchID);
            if(navigator.geolocation){
                var options = {timeout:60000};
                navigator.geolocation.getCurrentPosition(this.saveLastPosition, this.errorHandler, options);
            }
            else {
                alert("Sorry, browser does not support geolocation!");
            }
        },

        saveLastPosition: function(position) {
            var self = this;
            var currentUser = Parse.User.current();
            var deliveryModel = new DeliveryModel();
            deliveryModel.id = this.deliveryId;
            deliveryModel.set('deliverBy', currentUser);
            deliveryModel.set('status', "On the way");
            deliveryModel.set('grid', {
                __type: "Pointer",
                className: "Grid",
                objectId: currentUser.get("gridId").id});
            deliveryModel.set('longitude', position.coords.longitude);
            deliveryModel.set('latitude', position.coords.latitude);
            deliveryModel.save({
                success: function(delivery) {
                    self.deliveryId = null;
                },
                error: function(error) {
                    alert("Error: " + error.code + " " + error.message);
                }
            });

        }
    });
    return DriverView;
});
