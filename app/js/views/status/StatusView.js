define([
  'models/manage/DeliveryModel',
  'models/PickUpLocation',
  'models/order/PaymentModel',
  'models/Grid',
    'models/order/NotificationModel',
  'text!templates/status/statusTemplate.html',
], function (DeliveryModel, PickUpLocationModel, PaymentModel, GridModel, NotificationModel, statusTemplate) {

    var StatusView = Parse.View.extend({
        el: $("#page"),

        template: _.template(statusTemplate),

        initialize: function () {
            _.bindAll(this, 'render');
        },

        render: function () {
            $('.menu li').removeClass('active');
            $('.menu li a[href="#"]').parent().addClass('active');

            var currentUser = Parse.User.current();

            var gridId = currentUser.get('gridId').id;
            if (!gridId) {
                gridId = UMCP_GRID_ID;
            }

            //Time Range for querying the order from the current user
            var self = this;
            var pickUpLocationQuery = new Parse.Query(PickUpLocationModel);
            pickUpLocationQuery.equalTo("gridId", {__type: "Pointer", className: "Grid", objectId: gridId});
            pickUpLocationQuery.include("gridId");
            pickUpLocationQuery.include("distributor");
            pickUpLocationQuery.find({
                success: function(locations) {
                    self.displayStatus(locations);

                },
                error: function(error) {
                    showMessage("Error", "Find pick-up location failed! Error: " + error.code + " " + error.message);
                }
            });

            return this;
        },

        displayStatus: function(pickUpLocations) {
            var self = this;
            var startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            // Get grid coordinate
            var grid;
            _.each(pickUpLocations, function(pickUpLocation) {
                pickUpLocation.status = "On the way";
                if (!grid) {
                    grid = pickUpLocation.get("gridId");
                }
            });

            // Get pick up location status from Notification class
            var notificationQuery = new Parse.Query(NotificationModel);
            notificationQuery.greaterThan("updatedAt", startOfToday);
            notificationQuery.find({
                success: function(notifications) {
                    if (notifications) {
                        _.each(notifications, function(notification){
                            _.each(pickUpLocations, function(pickUpLocation){
                                if (notification.get("key").indexOf(pickUpLocation.id) > -1) {
                                    pickUpLocation.status = "Arrived";
                                }
                            });
                        });
                        self.getDriverLocation(pickUpLocations, startOfToday, grid);

                    } else {
                        self.getDriverLocation(pickUpLocations, startOfToday, grid);

                    }
                },
                error: function(error) {
                    showMessage("Error", "Find notifications failed! Error: " + error.code + " " + error.message);
                }
            });
        },

        getDriverLocation: function(pickUpLocations, startOfToday, grid) {
            var self = this;
            var deliverQuery = new Parse.Query(DeliveryModel);
            deliverQuery.equalTo("grid", grid);
            deliverQuery.greaterThan("updatedAt", startOfToday);
            deliverQuery.descending("updatedAt");
            deliverQuery.first({
                success: function (delivery) {
                    if (delivery) {
                        self.$el.html(self.template({rest: false, pickUpLocations: pickUpLocations, ready: true}));
                        $("h1.ui.small.center.aligned.header").html("Where is the delivery man?");

                        var gridLocation = new google.maps.LatLng(grid.get('coordinate').latitude, grid.get('coordinate').longitude);
                        var myOptions = {
                            center: gridLocation,
                            zoom: 10,
                            mapTypeId: google.maps.MapTypeId.ROADMAP,
                            mapTypeControl: false,
                            streetViewControl:false,
                            navigationControlOptions: {style: google.maps.NavigationControlStyle.SMALL}
                        };
                        var icon = 'img/car.png';
                        var map = new google.maps.Map(document.getElementById("mapHolder"), myOptions);
                        var driverLocation = new google.maps.LatLng(delivery.get('latitude'), delivery.get('longitude'));
                        var driverMarker = new google.maps.Marker({position: driverLocation, map: map, icon: icon, title: "Your lunch is here"});
                        var pickUpLocationMarker = new google.maps.Marker({position: gridLocation, map: map, title: "Your are here"});
                    } else {
                        $("#mapHolder").hide();
                    }
                },
                error: function (error) {
                    showMessage("Error", "Find delivery record failed! Error: " + error.code + " " + error.message);
                }
            });

        }
    });

    return StatusView;

});
