define([
    'stripe',
    'models/Restaurant',
    'models/Grid',
    'models/BankAccount',
    'text!templates/manage/newRestaurantTemplate.html'

    ], function (Stripe, RestaurantModel, GridModel, BankAccountModel, newRestaurantTemplate) {

      var NewRestaurantView = Parse.View.extend({
          el: $("#page"),

          template: _.template(newRestaurantTemplate),

          events: {
              'click #saveRestaurantBtn': 'saveRestaurant',
              'click #cancelRestaurantBtn': 'cancelRestaurant'
          },

          initialize: function () {
            _.bindAll(this, 'render', 'saveRestaurant');
              Stripe.setPublishableKey(STRIPE_KEY);
          },

          render: function () {
              var self = this;
              var restaurantId = this.options.id;
              if(restaurantId) {
                  var restaurantQuery = new Parse.Query(RestaurantModel);
                  restaurantQuery.include('bankAccount');
                  restaurantQuery.get(restaurantId, {
                      success: function(restaurant) {
                          self.continueFindGridAndRender(restaurant);
                      },
                      error: function(error) {
                          showMessage("Error", "Find restaurants failed! Reason: " + error.message);
                      }
                  });
              } else {
                  var restaurant = new RestaurantModel();
                  self.continueFindGridAndRender(restaurant);
              }
          },

          continueFindGridAndRender: function(restaurant) {
              var self = this;
              var gridQuery = new Parse.Query(GridModel);
              gridQuery.find({
                  success: function(grids) {
                      var bankAccount = new BankAccountModel();

                      if (restaurant.get('bankAccount')) {
                          bankAccount = restaurant.get('bankAccount')
                      }

                      self.$el.html(self.template({grids: grids, restaurant: restaurant, bankAccount: bankAccount}));


                      if (self.options.id) {
                          $("#restaurantPageTitle").text("Edit this restaurant");
                      } else {
                          $("#restaurantPageTitle").text("Add new restaurant");
                      }

                      if (restaurant.id) {
                          $(".restaurant-type-selection").dropdown('set selected', restaurant.get('type'));
                          $(".restaurant-area-selection").dropdown('set selected', restaurant.get('gridId').id);
                          $(".yelp-rating-selection").dropdown('set selected', restaurant.get('rating'));
                          $(".pickup-time-selection").dropdown('set selected', restaurant.get('pickUpTime'));

                          $(".restaurant-type-selection").dropdown('set value', restaurant.get('type'));
                          $(".restaurant-area-selection").dropdown('set value', restaurant.get('gridId').id);
                          $(".yelp-rating-selection").dropdown('set value', restaurant.get('rating'));
                          $(".pickup-time-selection").dropdown('set value', restaurant.get('pickUpTime'));
                      } else {
                          $(".restaurant-type-selection").dropdown();
                          $(".restaurant-area-selection").dropdown();
                          $(".yelp-rating-selection").dropdown();
                          $(".pickup-time-selection").dropdown();
                      }
                  },
                  error: function(error) {
                      showMessage("Error", "Error in finding grids. Reason: " + error.message);
                  }
              });
          },

          saveRestaurant: function() {
              var self = this;
              var id = $("#restaurantId").val();
              var name = $("#restaurantName").val();
              var type = $(".restaurant-type-selection").dropdown('get value');
              var address = $("#restaurantAddress").val();
              var email = $("#restaurantEmail").val();
              var telnum = $("#restaurantTelnum").val();
              var confirmNumber = $("#orderConfirmNumber").val();
              var managerName = $("#restaurantManager").val();
              var gridId = $(".restaurant-area-selection").dropdown('get value');
              var url = $("#restaurantWebsite").val();
              var yelpLink = $("#yelpLink").val();
              var yelpRating = Number($(".yelp-rating-selection").dropdown('get value'));
              var description = $("#restaurantDescription").val();
              var pickUpTime = $(".pickup-time-selection").dropdown('get value');

              var savedRestaurant = new RestaurantModel();
              if (id) {
                  savedRestaurant.id = id;
              }
              savedRestaurant.save({
                name: name,
                type: type,
                address: address,
                  email: email,
                telnum: telnum,
                confirmNumber: confirmNumber,
                managerName: managerName,
                gridId: {
                  __type: "Pointer",
                  className: "Grid",
                  objectId: gridId
                },
                url: url,
                yelpLink: yelpLink,
                  rating: yelpRating,
                description: description,
                  pickUpTime: pickUpTime
              }, {
                success: function(savedRestaurant) {
                    showMessage("Success", "Save restaurant successfully!", function() {
                        $("#restaurantId").val(savedRestaurant.id);
                        self.createBankAccount();
                    });
                },
                error: function(savedRestaurant, error) {
                    showMessage("Error", "Failed to save restaurant, with error message: " + error.message);
                }
              });
          },

          createBankAccount: function() {
              if (this.validateBankFields()) {
                  var $form = this.$('form');
                  Stripe.bankAccount.createToken($form, this.stripeResponseHandler);
              } else {
                  location.reload();
                  window.location.href='#manageRestaurants';
              }
          },

          stripeResponseHandler: function(status, response) {
              var $form = $('#restaurantForm');

              if (response.error) {
                  // Show the errors on the form
                  showMessage("Error", response.error.message);
                  $form.find('.bank-errors').text(response.error.message);
                  $form.find('button').prop('disabled', false);
              } else {
                  var token = response.id;
                  var accountNumber = $(".restaurant-account-number").val();
                  var routingNumber = $(".restaurant-routing-number").val();
                  var last4DigitForAccountNumber = $(".restaurant-account-number").val().slice(-4);
                  var restaurantId = $("#restaurantId").val();

                  Parse.Cloud.run('saveRecipient', {
                      name: $("#restaurantName").val(),
                      type: 'corporation',
                      bankAccount: token,
                      accountNumber: accountNumber,
                      routingNumber: routingNumber,
                      last4DigitForAccountNumber: last4DigitForAccountNumber,
                      email: $("#restaurantEmail").val(),
                      createdById: restaurantId
                  }, {
                      success: function (response) {
                          var restaurant = new RestaurantModel();
                          restaurant.id = restaurantId;
                          restaurant.set('bankAccount', response);
                          restaurant.save();
                          showMessage("Success", "Bank account created successfully!", function() {
                              location.reload();
                              window.location.href='#manageRestaurants';
                          });
                      },
                      error: function(error) {
                          showMessage("Error", "Oops, something went wrong! Please check your account number and routing number then try again.");
                          console.log(error.message);
                      }
                  });
              }
          },

          validateBankFields: function() {
              var hasBankInfo = false;
              var accountNumber = $(".restaurant-account-number").val().trim();
              var routingNumber = $(".restaurant-routing-number").val().trim();
              if (accountNumber !== "" && routingNumber !== "" && !this.isOldBankAccount()) {
                  hasBankInfo = true;
              }
              return hasBankInfo;
          },

          isOldBankAccount: function() {
              var accountNumber = $(".restaurant-account-number").val().trim();
              var routingNumber = $(".restaurant-routing-number").val().trim();
              var originalAccountNumber = $(".original-restaurant-account-number").val().trim();
              var originalRoutingNumber = $(".original-restaurant-routing-number").val().trim();
              return (accountNumber === originalAccountNumber) && (routingNumber === originalRoutingNumber);
          },

          cancelRestaurant: function() {
              location.reload();
              window.location.href='#manageRestaurants'
          }
      });
      return NewRestaurantView;

    });



