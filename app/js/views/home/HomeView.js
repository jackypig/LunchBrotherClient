define(['views/home/InventoryView',
        'views/home/DishView',
    'views/order/OrderView',
    'models/dish/DishModel',
    'models/dish/DishCollection',
    'models/Grid',
    'models/Restaurant',
    'models/PickUpLocation',
    'models/InventoryModel',
    'models/InventoryCollection',
    'models/UserRequestModel',
    'text!templates/home/homeTemplate.html',
    'text!templates/home/statsTemplate.html',
    'text!templates/order/orderTemplate.html'],
    function(InventoryView, DishView, OrderView, DishModel, DishCollection, GridModel, RestaurantModel, PickUpLocationModel,
             InventoryModel, InventoryCollection, UserRequestModel, homeTemplate, statsTemplate, orderTemplate) {

	var HomeView = Parse.View.extend({
		// tagName: 'ul', // required, but defaults to 'div' if not set
		el : $("#page"),

		statsTemplate : _.template(statsTemplate),
		stats : {
			orders : [],
			coupon : 0,
			tax : 0,
			totalCharge : 0,
            totalCashCharge : 0,
            youtubeLink: "",
            dp:""
		},

		events : {
			'click #paymentBtn' : 'continuePay'
		},

        inventoryMap : {},

        pickUpLocationYouTubeLinkMap: {},

		initialize : function() {
			_.bindAll(this, 'render', 'loadAll', 'addOne', 'continuePay');
            this.$el.html(_.template(homeTemplate)());
            this.inventories = new InventoryCollection();

            // Find pick-up locations
            this.getPickUpLocations();

            // Enable or disable checkout button based on current time
            this.disableOrEnableCheckOutBtn();

		},

        getPickUpLocations: function() {
            var self = this;
            var grid = Parse.User.current().get('gridId');
            if (grid === undefined) {
                grid = new GridModel();
                grid.id = UMCP_GRID_ID;
            }

            var pickUpLocationQuery = new Parse.Query(PickUpLocationModel);
            pickUpLocationQuery.equalTo('gridId', grid);
            pickUpLocationQuery.addAscending('address');
            pickUpLocationQuery.find().then(function(pickUpLocations){
                $.each(pickUpLocations, function (i, pickUpLocation) {
                    self.pickUpLocationYouTubeLinkMap[pickUpLocation.id] = pickUpLocation.get("youtubeLink");
                    $('#address').append($('<option>', {
                        value: pickUpLocation.id,
                        text : pickUpLocation.get('address')
                    }));
                });

                // Default setting
                self.setPageInfo(DEFAULT_DP);
                $("#address").dropdown('set selected', DEFAULT_DP);

                // Drop-down change event
                $("#address").change(function() {
                    self.setPageInfo($("#address").val());
                });

            }, function(error){
                showMessage("Oops!", "Something is wrong! Reason: " + error.message);

            });
        },

        setPageInfo: function(selectedPickupLocation) {
            this.stats.youtubeLink = this.pickUpLocationYouTubeLinkMap[selectedPickupLocation];
            this.stats.dp = selectedPickupLocation;
            this.collectInventoryDishes(selectedPickupLocation);
        },

        collectInventoryDishes: function(pickUpLocationId) {
            this.inventories = new InventoryCollection();
            var self = this;

            var pickUpLocation = new PickUpLocationModel();
            pickUpLocation.id = pickUpLocationId;

            var inventoryQuery = new Parse.Query(InventoryModel);
            inventoryQuery.include("dish");
            inventoryQuery.include("dish.restaurant");
            inventoryQuery.greaterThan("pickUpDate", INVENTORY_FROM_TIME());
            inventoryQuery.lessThan("pickUpDate", INVENTORY_UNTIL_TIME());
            inventoryQuery.equalTo("pickUpLocation", pickUpLocation);
            inventoryQuery.find({
                success: function(inventories) {
                    _.each(inventories, function(inventory) {
                        inventory["orderNumber"] = 0;
                        self.inventories.add(inventory);
                        self.inventoryMap[inventory.id] = {
                            inventoryId: inventory.id,
                            price: inventory.get('price'),
                            cashPrice: inventory.get('cashPrice'),
                            currentQuantity: inventory.get('currentQuantity'),
                            restaurant: inventory.get('dish').get('restaurant'),
                            dpId: inventory.get('pickUpLocation').id
                        }
                    });

                    self.loadAll();
                    self.inventories.bind('all', self.render);
                },
                error: function(error) {
                    showMessage("Error", "Find inventory failed! Reason: " + error.message);
                }
            });
        },

        disableOrEnableCheckOutBtn: function() {
            var currentTime = new Date();
            var weekday = currentTime.getDay();

            // Disable check out button by default unless adding orders
            $('#paymentBtn').prop('disabled', true);
            $('#paymentBtn').addClass('grey');

            if (Parse.User.current().get('permission') != LB_ADMIN) {
                if (weekday == 6 && weekday == 5) {
                    $("#timeAlert").css("display", "block").text("Sorry, we don't provide service on weekends. Please come back on Sunday after 2:00PM :)");

                } else if(currentTime > START_ORDER_TIME() || currentTime < STOP_ORDER_TIME()) {
                    $("#timeAlert").css("display", "block").text("Sorry, the order time is from 2:00PM to 10:30AM tomorrow, please come back again later.");

                } else {
                    // Do nothing
                }
            }
        },

        loadAll : function() {
            this.$("#dishList").html("");
            this.inventories.each(this.addOne);
        },

		render : function() {
            var self = this;
            this.stats.orders = [];
            _.each(this.inventories.orders(), function(inventory){
                var order = {};
                order.dishId = inventory.get('dish').id;
                order.count = inventory.get('count');
                order.price = inventory.get('price');
                order.cashPrice = inventory.get('cashPrice');
                order.code = inventory.get('dish').get('dishCode');
                order.name = inventory.get('dish').get('dishName');
                order.inventoryId = inventory.id;
                order.restaurant = inventory.get('dish').get('restaurant');
                order.dpId = inventory.get('pickUpLocation').id;
                self.stats.orders.push(order);
            });

            if (this.inventories.orders().length > 0) {
                $('#paymentBtn').prop('disabled', false);
                $('#paymentBtn').removeClass('grey');

            } else {
                $('#paymentBtn').prop('disabled', true);
                $('#paymentBtn').addClass('grey');
            }

            var charge = 0;
            var cashCharge = 0;
            _.each(this.stats.orders, function(order) {
                charge += order.count * order.price;
                cashCharge += order.count * order.cashPrice;
            });

            this.stats.totalCharge = parseFloat((charge).toFixed(2));
            this.stats.totalCashCharge = parseFloat((cashCharge).toFixed(2));
            this.$('#orderStats').html(this.statsTemplate(this.stats));
            this.delegateEvents();
            return this;
		},

        addOne : function(inventory) {
            var view = new InventoryView({
                model : inventory
            });

            this.$("#dishList").append(view.render().el);
            $('#' + inventory.id + ' .menu .item').tab({context: $('#' + inventory.id)});
            $('.ui.rating').rating({
                interactive: false
            });

            var current = new Date();
            var operatingTime = current > START_ORDER_TIME() && current < STOP_ORDER_TIME();
            if (!operatingTime && Parse.User.current().get('permission') != LB_ADMIN) {
                $('#' + inventory.id + '-plusButton').prop('disabled', true);
                $('#' + inventory.id + '-minusButton').prop('disabled', true);
            }
        },

		continuePay : function() {
            var view = new OrderView({
                model : this.stats
            });

            $("#dishTitle,#dishList,#paymentBtn,#orderMessage,#payCashBtn,#pickUpLocationWrapper").remove();
            $("#page").append(view.render().el);
        }
	});
	return HomeView;
});
