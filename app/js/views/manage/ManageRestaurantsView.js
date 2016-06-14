define([
    'models/Restaurant',
    'models/dish/DishModel',
    'models/order/OrderModel',
    'models/InventoryModel',
    'text!templates/manage/manageRestaurantsTemplate.html',
    'text!templates/manage/manageRestaurantDishListTemplate.html'
], function (RestaurantModel, DishModel, OrderModel, InventoryModel, manageRestaurantsTemplate, manageRestaurantDishListTemplate) {

    var ManageRestaurantsView = Parse.View.extend({
        el: $("#page"),

        events: {
            "click .toNewRestaurant": "toNewRestaurantPageClick",
            "click .deleteDish": "onDeleteDishClick",
            "click #editRestaurant": "onEditRestaurantClick",
            "click #deleteRestaurant": "onDeleteRestaurantClick"
        },

        initialize: function () {
            _.bindAll(this, 'render');
        },

        template: _.template(manageRestaurantsTemplate),
        dishListTemplate: _.template(manageRestaurantDishListTemplate),

        render: function () {
            var self = this;
            var restaurantQuery = new Parse.Query(RestaurantModel);
            restaurantQuery.find({
                success: function(restaurants) {
                    self.$el.html(self.template({restaurants: restaurants}));
                    $("#editRestaurant").addClass('disabled');
                    $("#deleteRestaurant").addClass('disabled');
                    $(".manage-restaurant-selection").dropdown({
                        onChange: function (restaurantId) {
                            self.refreshDishList(restaurantId);
                        }
                    });
                },
                error: function(error) {
                    showMessage("Error", "Find restaurants failed! Reason: " + error.message);
                }
            });
        },

        refreshDishList: function(restaurantId) {
            var newEvent = {"click #addNewDishBtn": 'toNewDishPage'};
            this.delegateEvents(_.extend(this.events, newEvent));

            if (restaurantId) {
                $("#editRestaurant").removeClass('disabled');
                $("#deleteRestaurant").removeClass('disabled');
            } else {
                $("#editRestaurant").addClass('disabled');
                $("#deleteRestaurant").addClass('disabled');
            }

            var self = this;
            var dishQuery = new Parse.Query(DishModel);
            dishQuery.equalTo("restaurant", {
                __type: "Pointer",
                className: "Restaurant",
                objectId: restaurantId
            });
            dishQuery.notEqualTo("active", false);
            dishQuery.find({
                success: function(dishes) {
                    self.$("#dishList").html(self.dishListTemplate({dishes: dishes}));
                },
                error: function(error) {
                    showMessage("Error", "Find dishes failed! Reason: " + error.message);
                }
            });
        },

        toNewDishPage: function() {
            window.location.href='#newdish?restaurantId=' + $(".manage-restaurant-selection").dropdown('get value');
        },

        toNewRestaurantPageClick: function() {
            window.location.href = '#newRestaurant';
        },

        onEditRestaurantClick: function() {
            window.location.href = '#editRestaurant?id=' + $(".manage-restaurant-selection").dropdown('get value');
        },

        onDeleteRestaurantClick: function() {
            $("#deleteContent").html("Do you really want to delete this restaurant?");
            $('#deleteDishOrRestaurantDialog').modal({
                closable: false,
                onDeny: function () {
                    //Do nothing
                },
                onApprove: function () {
                    var restaurant = new RestaurantModel();
                    restaurant.id = $(".manage-restaurant-selection").dropdown('get value');
                    restaurant.destroy({
                        success: function(restaurant) {
                            showMessage("Success", "Delete restaurant successfully!", function() {
                                location.reload();
                            });
                        },
                        error: function(restaurant, error) {
                            showMessage("Error", "Delete restaurant failed! Reason: " + error.message);
                        }
                    });
                }
            }).modal('show');
        },

        onDeleteDishClick: function(ev) {
            var self = this;
            var dishId = $(ev.currentTarget).data('id');
            var dish = new DishModel();
            dish.id = dishId;

            var inventoryQuery = new Parse.Query(InventoryModel);
            inventoryQuery.equalTo('dish', dish);
            inventoryQuery.count({
                success: function(number) {
                    console.log("Inventory count for this dish: " + number);
                    if (number > 0) {
                        showMessage("Error", "This dish has been published in the weekly menu so it can't be deleted!");
                    } else {
                        self.checkOrderHistory(dish);
                    }
                },
                error: function(error) {
                    console.log(error.message);
                }
            });
        },

        checkOrderHistory: function(dish) {
            var self = this;
            var orderQuery = new Parse.Query(OrderModel);
            orderQuery.equalTo('dishId', dish);
            orderQuery.count({
                success: function(number) {
                    console.log("Order count for this dish: " + number);
                    if (number > 0) {
                        self.softDeleteDish(dish);
                    } else {
                        self.hardDeleteDish(dish);
                    }
                },
                error: function(error) {
                    console.log(error.message);
                }
            });
        },

        softDeleteDish: function(dish) {
            dish.set('active', false);
            dish.save({
                success: function(dish) {
                    showMessage("Success", "Delete dish successfully!", function() {
                        $("#dishRow-" + dish.id).remove();
                    });
                },
                error: function(restaurant, error) {
                    showMessage("Error", "Delete dish failed! Reason: " + error.message);
                }
            });
        },

        hardDeleteDish: function(dish) {
            dish.destroy({
                success: function(dish) {
                    showMessage("Success", "Delete dish successfully!", function() {
                        $("#dishRow-" + dish.id).remove();
                    });
                },
                error: function(restaurant, error) {
                    showMessage("Error", "Delete dish failed! Reason: " + error.message);
                }
            });
        }
    });
    return ManageRestaurantsView;
});
