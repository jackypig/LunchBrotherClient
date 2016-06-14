/**
 * Created by Jack on 7/13/15.
 */
define([
    'models/Grid',
    'models/Restaurant',
    'models/InventoryModel',
    'models/dish/DishModel',
    'models/PickUpLocation',
    'text!templates/manage/menuEditTemplate.html',
    'text!templates/manage/menuEditDishListTemplate.html'
], function(GridModel, RestaurantModel, InventoryModel, DishModel, PickUpLocationModel, menuEditTemplate, menuEditDishListTemplate) {

    var MenuEditView = Parse.View.extend({
        el: $("#page"),
        template: _.template(menuEditTemplate),
        menuEditDishListTemplate: _.template(menuEditDishListTemplate),

        events: {
            'click #menuEditCancelBtn': 'onCancelClick',
            'click #menuEditSaveBtn': 'onSaveClick'
        },

        initialInventories: [],
        addedInventories: [],
        restaurantPickUpTime: "",
        
        initialize: function() {
            _.bindAll(this, 'render');
        },

        render: function() {
            this.initialInventories = [];
            this.addedInventories = [];
            var inventoryIds = this.options.inventoryIds;
            var date = this.options.date;
            var inventoryArray = inventoryIds.split(",");

            var self = this;
            /**
             * Get Inventory
             */
            var inventoryQuery = new Parse.Query(InventoryModel);
            inventoryQuery.containedIn("objectId", inventoryArray);
            inventoryQuery.include("dish");
            inventoryQuery.find({
                success:function(inventories) {
                    var dishes = [];
                    _.each(inventories, function(inventory) {
                            var dish = inventory.get('dish');
                            dish.inventoryId = inventory.id;
                            dish.price = inventory.get('price');
                            dish.cashPrice = inventory.get('cashPrice');
                            dishes.push(dish);

                            var inventory = {
                                id: inventory.id,
                                dishId: dish.id,
                                price: dish.price,
                                cashPrice: dish.cashPrice
                            };
                            self.addedInventories.push(inventory);
                            self.initialInventories.push(inventory);
                        }
                    );

                    /**
                     * Set Restaurant Value
                     */
                    var restaurantId = null;
                    if (inventoryArray[0] !== "") {
                        restaurantId = dishes[0].get('restaurant').id;

                        // Set pick-up time
                        var restaurantQuery = new Parse.Query(RestaurantModel);
                        restaurantQuery.get(restaurantId, {
                            success: function(restaurant) {
                                self.restaurantPickUpTime = restaurant.get('pickUpTime');
                            },
                            error: function(error) {
                                showMessage("Error", "Error in fetching restaurant. Reason: " + error.message);
                            }
                        });
                    }

                    if (restaurantId) {
                        /**
                         * Get restaurant dishes and compare with inventory dishes then fill up the rest dishes
                         */
                        var dishQuery = new Parse.Query(DishModel);
                        dishQuery.equalTo("restaurant", {
                            __type:"Pointer",
                            className: "Restaurant",
                            objectId: restaurantId
                        });

                        dishQuery.find({
                            success: function(restaurantDishes){
                                //Remove inventory dishes from restaurant dishes
                                _.each(dishes, function(inventoryDish){
                                    restaurantDishes = _.reject(restaurantDishes, function(el) {
                                        return el.id === inventoryDish.id;
                                    });
                                });

                                //Add remainder restaurant dishes
                                _.each(restaurantDishes, function(restaurantDish){
                                    restaurantDish.price = restaurantDish.get('Unit_Price');
                                    dishes.push(restaurantDish);
                                });

                                var currentUser = Parse.User.current();
                                var restaurantQuery = new Parse.Query(RestaurantModel);
                                restaurantQuery.equalTo("gridId", currentUser.get('gridId'));
                                restaurantQuery.find({
                                    success:function(restaurants) {
                                        self.$el.html(self.template({restaurants: restaurants, date: date}));
                                        self.displayDPName();

                                        self.$("#menuEditDishList").html(self.menuEditDishListTemplate({dishes : dishes}));
                                        self.setButtonsAndAddInventories(dishes);
                                        $(".restaurant-selection").dropdown(
                                            'set selected', restaurantId
                                        );
                                        $(".restaurant-selection").dropdown({
                                            onChange: function (restaurantId) {
                                                self.refreshInventoryMenu(restaurantId);
                                            }
                                        }).addClass('disabled');
                                        $(".restaurant-selector-warning").css('visibility', 'visible');
                                    },
                                    error: function(err) {
                                        console.log(err.message);
                                    }
                                });
                            },
                            error: function(err){
                                console.log(err.message);
                            }
                        });
                    } else {
                        var currentUser = Parse.User.current();
                        var restaurantQuery = new Parse.Query(RestaurantModel);
                        restaurantQuery.equalTo("gridId", currentUser.get('gridId'));
                        restaurantQuery.find({
                            success:function(restaurants) {
                                self.$el.html(self.template({restaurants: restaurants, date: date}));
                                self.displayDPName();

                                //For days with empty dishes
                                $(".restaurant-selection").dropdown({
                                    onChange: function (restaurantId) {
                                        self.refreshInventoryMenu(restaurantId);
                                    }
                                });
                            },
                            error: function(err) {
                                console.log(err.message);
                            }
                        });
                    }
                },
                error: function(err) {
                    console.log(err.message);
                }
            });
        },

        displayDPName: function() {
            var dpQuery = new Parse.Query(PickUpLocationModel);
            dpQuery.get(this.options.dp, {
                success: function(dp) {
                    $("#menuEditViewDpName").text(dp.get("address"));
                },
                error: function(error) {
                    console.log("Error in getting DP. Reason: " + error);
                }
            });
        },

        refreshInventoryMenu: function(restaurantId) {
            var self = this;
            this.addedInventories = [];
//            this.initialInventories = [];

            var dishQuery = new Parse.Query(DishModel);
            dishQuery.equalTo("restaurant", {
                __type:"Pointer",
                className: "Restaurant",
                objectId: restaurantId
            });

            dishQuery.include("restaurant");
            dishQuery.find({
                success: function(restaurantDishes){
                    self.restaurantPickUpTime = restaurantDishes[0].get('restaurant').get('pickUpTime');
                    self.$("#menuEditDishList").html(self.menuEditDishListTemplate({dishes : restaurantDishes}));
                    self.setButtonsAndAddInventories(restaurantDishes);
                },
                error: function(err){
                    console.log(err.message);
                }
            });
        },

        setButtonsAndAddInventories: function(dishes) {
            var self = this;
            _.each(dishes, function(dish) {
                //Mark inventory dishes as added
                if (dish.inventoryId) {
                    self.markAsAdded(dish.id);
                }

                /**
                 * Set input value onChange events
                 */
                $("#dishPriceInput-" + dish.id).keyup(function(){
                    self.markAsNotAdded(dish.id);
                    self.addedInventories = _.reject(self.addedInventories, function (el) {
                        return el.dishId === $('#dishIdInput-' + dish.id).val();
                    });
                    self.checkAddedDishes();
                });

                $("#cashPriceInput-" + dish.id).keyup(function(){
                    self.markAsNotAdded(dish.id);
                    self.addedInventories = _.reject(self.addedInventories, function (el) {
                        return el.dishId === $('#dishIdInput-' + dish.id).val();
                    });
                    self.checkAddedDishes();
                });

                $('#addToMenuBtn-' + dish.id).click(function(){
                    if ($('#dimmer-' + dish.id).dimmer("is active")) {
                        self.markAsNotAdded(dish.id);
                        self.addedInventories = _.reject(self.addedInventories, function(el) {
                            return el.dishId === $('#dishIdInput-' + dish.id).val();
                        });
                        self.checkAddedDishes();

                    } else {
                        var price = $('#dishPriceInput-' + dish.id).val();
                        var cashPrice = $('#cashPriceInput-' + dish.id).val();

                        //Validate price inputs
                        if (!Number(price)) {
                            showMessage("Oops!", "Price has to be a number!");
                        }

                        if (!Number(cashPrice)) {
                            showMessage("Oops!", "Cash Price has to be a number!");
                        }

                        if (self.addedInventories === 0) {
                            $(".restaurant-selection").dropdown(
                                'set selected', dish.get('restaurant').id
                            ).addClass('disabled');
                            $(".restaurant-selector-warning").css('visibility', 'visible');
                        }

                        self.markAsAdded(dish.id);

                        var inventory = {
                            id: $('#inventoryId-' + dish.id).val(),
                            dishId: $('#dishIdInput-' + dish.id).val(),
                            price: price,
                            cashPrice: cashPrice
                        };
                        self.addedInventories.push(inventory);
                    };
                });
            });
        },

        checkAddedDishes: function() {
            if (this.addedInventories.length === 0) {
                $(".restaurant-selection").dropdown().removeClass('disabled');
                $(".restaurant-selector-warning").css('visibility', 'hidden');
            }
        },

        isInteger: function(n) {
            return Number(n) && Number(n) % 1 === 0;
        },

        markAsAdded: function(dishId) {
            $('#dimmer-' + dishId).addClass("active");
            $("#addMenuIcon-" + dishId).removeClass("add");
            $("#addMenuIcon-" + dishId).addClass("minus");
            $("#addMenuLabel-" + dishId).text("Remove from Menu");
            $("#addToMenuBtn-" + dishId).removeClass("orange");
        },

        markAsNotAdded: function(dishId) {
            $('#dimmer-' + dishId).removeClass("active");
            $("#addMenuIcon-" + dishId).removeClass("minus");
            $("#addMenuIcon-" + dishId).addClass("add");
            $("#addMenuLabel-" + dishId).text("Add to Menu");
            $("#addToMenuBtn-" + dishId).addClass("orange");
        },

        onSaveClick: function() {
            /**
             * Destroy removed inventories
             */
            var self = this;
            _.each(this.addedInventories, function(addedInventory) {
                self.initialInventories = _.reject(self.initialInventories, function(el) {
                    return el.id === addedInventory.id;
                });
            });

            var toDestroyInventories = [];
            _.each(this.initialInventories, function(inventory) {
                var toDestoryInventory = new InventoryModel();
                toDestoryInventory.id = inventory.id;
                toDestroyInventories.push(toDestoryInventory);
            });

            Parse.Object.destroyAll(toDestroyInventories, {
                success: function(success) {
                    //Do nothing
                },
                error: function(error) {
                    console.log('Destroy failed! Reason: ' + error.message + "To destroy inventories: " + toDestroyInventories);
                }
            });

            /**
             * Save added dishes to inventory
             */
            var currentUser = Parse.User.current();
            var toSaveInventories = [];
            var datePart = this.options.date.split(" ")[0];
            var month = datePart.split("/")[0], date = datePart.split("/")[1];
            var pickUpdate = new Date();
            pickUpdate.setMonth(month - 1);
            pickUpdate.setDate(date);

            var hour = this.restaurantPickUpTime.split(":")[0];
            var minute = this.restaurantPickUpTime.split(":")[1];
            pickUpdate.setHours(Number(hour), Number(minute), 0, 0);

            _.each(this.addedInventories, function(inventory) {
                var toSaveInventory = new InventoryModel();
                if (inventory.id !== undefined) {
                    toSaveInventory.id = inventory.id;
                }
                var dish = new DishModel();
                dish.id = inventory.dishId;
                toSaveInventory.set("dish", dish);

                var dp = new PickUpLocationModel();
                dp.id = self.options.dp;
                toSaveInventory.set("pickUpLocation", dp);

                toSaveInventory.set("gridId", currentUser.get('gridId'));
                toSaveInventory.set("published", false);
                toSaveInventory.set("orderBy", currentUser);
                toSaveInventory.set("price", Number(inventory.price));
                toSaveInventory.set("cashPrice", Number(inventory.cashPrice));
                toSaveInventory.set("payByCardCount", 0);
                toSaveInventory.set("totalOrderQuantity", 0);
                toSaveInventory.set("status", "Unconfirmed");
                toSaveInventory.set("pickUpDate", pickUpdate);
                toSaveInventories.push(toSaveInventory);
            });


            Parse.Object.saveAll(toSaveInventories, {
                success: function(inventories) {
                    // Do nothing for now
                },
                error: function(error) {
                    console.log('Save failed! Reason: ' + error.message);
                }
            });

            this.onCancelClick();
        },

        onCancelClick: function() {
            this.initialInventories = [];
            this.addedInventories = [];

            var month = this.options.date.split("/")[0] - 1;
            var date = this.options.date.split("/")[1].split(" ")[0];
            var d = new Date();
            d.setMonth(month);
            d.setDate(date);
            var day = d.getDay(),
                diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
            var monday = new Date(d.setDate(diff));
            var week = (monday.getMonth() + 1) + "/" + monday.getDate() + "-";

            var diff2 = monday.getDate() + 4;
            var friday = new Date(monday.setDate(diff2));
            week += (friday.getMonth() + 1) + "/" + friday.getDate();

            window.location.hash = "#managerHome?week=" + week + "&dp=" + this.options.dp;
        }
    });
    return MenuEditView;
});
