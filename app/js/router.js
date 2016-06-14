define([
    'views/home/LandingView',
  'views/home/HomeView',
  'views/order/OrderView',
  'views/order/PolicyView',
  'views/confirm/ConfirmView',
  'views/status/StatusView',
  'views/manage/LoginView',
  'views/manage/DistributorView',
  'views/manage/ManagerHomeView',
  'views/manage/MenuEditView',
  'views/manage/DriverView',
  'views/account/LoginorsignupView',
  'views/account/SignupemailView',
  'views/account/ProfileView',
	'views/account/ForgotpasswordView',
  'views/account/ResetPasswordView',
  'views/manage/ManageRestaurantsView',
  'views/manage/NewdishView', 
  'views/manage/NewRestaurantView', 
  'views/manage/ManagerListView',
  'views/manage/NewManagerView',
  'views/manage/BankView',
    'views/manage/lbAdminView',
    'views/manage/CardView'
  ], function (LandingView,
        HomeView,
		OrderView, 
		PolicyView, 
		ConfirmView, 
		StatusView, 
		LoginView, 
		DistributorView,
        ManagerHomeView,
        MenuEditView,
		DriverView,
		LoginorsignupView, 
		SignupemailView,
		ProfileView,
		ForgotpasswordView,
        ResetPasswordView,
    ManageRestaurantsView,
        NewdishView,
        NewRestaurantView,
    ManagerListView,    
        NewManagerView,
        BankView,
        AdminView,
        CardView) {

    var AppRouter = Parse.Router.extend({
        routes: {
            // Define some URL routes
            'order': 'showOrder',
            'landing': 'showLanding',
            'home': 'showHome',
            'policy': 'showPolicy',
            'confirm': 'showConfirm',
            'status': 'showStatus',
            'login': 'showLogin',
            'loginorsignup' : 'showLoginorsignup',
            'profile': 'showProfile',
            'signupemail' : 'showSignupemail',
            'forgotpassword' : 'showForgotpassword',
            'resetPassword?*queryString' : 'showResetPassword',

            // Local Manager
            'managerHome?*queryString': 'showManagerHome',
            'menuEdit?*queryString': 'showMenuEdit',
            'distributor': 'showDistributor',
            'driver': 'showDriver',

            // Restaurant
            'manageRestaurants': 'showManageRestaurants',
            'newRestaurant' : 'showNewRestaurant',
            'editRestaurant?*queryString' : 'showEditRestaurant',

            // Dish
            'newdish?*queryString' : 'showNewdish',
            'editDish?*queryString' : 'showEditDish',

            // Manager
            'managerList' : 'showManagerList',
            'newManager' : 'showNewManager',
            'editManager?*queryString' : 'showEditManager',
            'bank?*queryString' : 'showBank',
            'card' : 'showCard',

            // Admin
            'admin' : 'showAdminPage',

            // Default
            '*actions': 'defaultAction'   
        }
    });

    var ParseQueryString = function(queryString){
        var params = {};
        if(queryString){
            _.each(
                _.map(decodeURI(queryString).split(/&/g),function(el,i){
                    var aux = el.split('='), o = {};
                    if(aux.length >= 1){
                        var val = undefined;
                        if(aux.length == 2)
                            val = aux[1];
                        o[aux[0]] = val;
                    }
                    return o;
                }),
                function(o){
                    _.extend(params,o);
                }
            );
        }
        return params;
    };

    var renderView = function(role, view) {
        var currentUser = Parse.User.current();
        if(currentUser != null) {
            showSideBar(currentUser);
            var permission = currentUser.get('permission');
            displayBottomBarItems(permission);
            if (permission >= role) {
                view.render();
            } else {
                window.location.hash = "#home";
            }
        } else {
            $("#accountLogin").show();
            window.location.hash = "#loginorsignup";
        }
    };

    var showSideBar = function(currentUser) {
        currentUser.fetch().then(function (user){
            $("#userEmail").text(user.get('email'));
            // Phone Number
            var phoneNumber = "Add your phone number";
            if (user.get('telnum')) {
                phoneNumber = user.get('telnum');
            }
            $("#userPhone").text(phoneNumber);

            $("#userFullName").text(user.get('firstName') + " " + user.get('lastName'));
            //$("#userCreditBalance").text("$" + currentUser.get('creditBalance').toFixed(2));
            $("#accountBarFirstName").text(user.get('firstName'));
            //$('#referlink input').val('https://www.lunchbrother.com/?refer=' + currentUser.id + '#signupemail');
            $("#accountLogin").hide();
            $('#account').show();

            var gridId = UMCP_GRID_ID;
            if (user.get('gridId') == undefined) {
                $("#userGrid").text("University of Maryland College Park");
            }else {
                user.get('gridId').fetch().then(function(grid) {
                    $("#userGrid").text(grid.get('name'));
                });
            }
        });
    };

    var displayBottomBarItems = function(permission) {
        if (permission === LB_ADMIN) {
            $("#bottom-bar-order").show();
            $("#bottom-bar-menu").show();
            $("#bottom-bar-tracking").show();
            //$("#bottom-bar-manager").show();
            $("#bottom-bar-admin").show();

        } else if (permission === LOCAL_MANAGER) {
            $("#bottom-bar-order").show();
            $("#bottom-bar-menu").show();
            $("#bottom-bar-tracking").show();
            $("#bottom-bar-manager").show();

        } else {
            $("#bottom-bar-order").show();
            $("#bottom-bar-menu").show();
            $("#bottom-bar-tracking").show();
        }
    };

    var initialize = function () {
        console.log('router initialize');

        var appRouter = new AppRouter();

        /**
         * General user related pages
         * Authorization: Permission >= GENERAL_USER
         */
        appRouter.on('route:showOrder', function () {
            var orderView = new OrderView();
            renderView(GENERAL_USER, orderView);
        });

        appRouter.on('route:showPolicy', function () {
            var policyView = new PolicyView();
            renderView(GENERAL_USER, policyView);
        });

        appRouter.on('route:showConfirm', function () {
            var confirmView = new ConfirmView();
            renderView(GENERAL_USER, confirmView);
        });

        appRouter.on('route:showStatus', function () {
            var statusView = new StatusView();
            renderView(GENERAL_USER, statusView);
        });

        appRouter.on('route:showHome', function () {
            var homeView = new HomeView();
            renderView(GENERAL_USER, homeView);
        });

        /**
         * Local manager related pages
         * Authorization: Permission >= LOCAL_MANAGER
         */
        appRouter.on('route:showManagerHome', function (queryString) {
            // Call render on the module we loaded in via the dependency array
            var params = new ParseQueryString(queryString);
            var managerHomeView = new ManagerHomeView({
                week: params.week,
                dp: params.dp
            });
            renderView(LOCAL_MANAGER, managerHomeView);
        });

        appRouter.on('route:showMenuEdit', function (queryString) {
            // Call render on the module we loaded in via the dependency array
            var params = new ParseQueryString(queryString);
            var menuEditView = new MenuEditView({
                inventoryIds: params.inventoryIds,
                date: params.date,
                dp: params.dp
            });
            renderView(LOCAL_MANAGER, menuEditView);
        });

        appRouter.on('route:showDistributor', function () {
            // Call render on the module we loaded in via the dependency array
            var distributorView = new DistributorView();
            renderView(DISTRIBUTOR, distributorView);
        });

        appRouter.on('route:showDriver', function () {
            // Call render on the module we loaded in via the dependency array
            var driverView = new DriverView();
            renderView(DRIVER, driverView);
        });

        /**
         * Login and signup related pages
         * Authorization: Public
         */
        appRouter.on('route:showLogin', function () {
            // Call render on the module we loaded in via the dependency array
            var loginView = new LoginView();
            loginView.render();
        });

        appRouter.on('route:showSignupemail', function () {
            // Call render on the module we loaded in via the dependency array
            var signupemailView = new SignupemailView({
                model: {
                    refer: getParameterByName('refer')
                }
            });

            signupemailView.render();
        });

        appRouter.on( 'route:showProfile', function () {
            var profileView = new ProfileView();
            profileView.render();
        });

        appRouter.on('route:showLoginorsignup', function () {
            // Call render on the module we loaded in via the dependency array
            var loginorsignupView = new LoginorsignupView();
            loginorsignupView.render();
        });

        appRouter.on('route:showSignup', function () {
            // Call render on the module we loaded in via the dependency array
            var signupView = new SignupView();
            signupView.render();
        });
			
        appRouter.on('route:showForgotpassword', function () {
            // Call render on the module we loaded in via the dependency array
            var forgotpasswordView = new ForgotpasswordView();
            forgotpasswordView.render();
        });

        appRouter.on('route:showResetPassword', function (queryString) {
            var params = new ParseQueryString(queryString);
            var resetPasswordView = new ResetPasswordView({
                userId: params.userId,
                resetKey: params.resetKey
            });
            resetPasswordView.render();
        });

        appRouter.on('route:showLanding', function () {
            var landingView = new LandingView();
            landingView.render();
        });

        /**
         * Restaurant and dish related pages
         * Authorization: Permission >= LB_ADMIN
         */
        appRouter.on('route:showManageRestaurants', function () {
            var manageRestaurantsView = new ManageRestaurantsView();
            renderView(LB_ADMIN, manageRestaurantsView);
        });

        appRouter.on('route:showNewRestaurant', function () {
            var newRestaurantView = new NewRestaurantView();
            renderView(LB_ADMIN, newRestaurantView);
        });

        appRouter.on('route:showEditRestaurant', function (queryString) {
            var params = new ParseQueryString(queryString);
            var newRestaurantView = new NewRestaurantView({
                id: params.id
            });
            renderView(LB_ADMIN, newRestaurantView);
        });

        appRouter.on('route:showBank', function (queryString) {
            // Call render on the module we loaded in via the dependency array
            var params = new ParseQueryString(queryString);
            var newBankView = new BankView({
                id: params.id
            });
            newBankView.render();
        });

        appRouter.on('route:showCard', function () {
            var newCardView = new CardView();
            newCardView.render();
        });

        appRouter.on('route:showNewdish', function (queryString) {
            // Call render on the module we loaded in via the dependency array
            var params = new ParseQueryString(queryString);
            var newdishView = new NewdishView({
                restaurantId: params.restaurantId
            });
            renderView(LB_ADMIN, newdishView);
        });

        appRouter.on('route:showEditDish', function (queryString) {
            var params = new ParseQueryString(queryString);
            var newdishView = new NewdishView({
                dishId: params.dishId
            });
            renderView(LB_ADMIN, newdishView);
        });

        /**
         * Manager related pages
         * Authorization: Permission >= LB_ADMIN
         */
        appRouter.on('route:showManagerList', function () {
            var managerListView = new ManagerListView();
            renderView(LB_ADMIN, managerListView);
        });
        
        appRouter.on('route:showNewManager', function () {
            var newManagerView = new NewManagerView();
            renderView(LB_ADMIN, newManagerView);
        });

        appRouter.on('route:showEditManager', function (queryString) {
            var params = new ParseQueryString(queryString);
            var newManagerView = new NewManagerView({
                managerId: params.managerId
            });
            renderView(LB_ADMIN, newManagerView);
        });

        /**
         * LunchBrother admin related page
         * Authorization: Permission >= LB_ADMIN
         */
        appRouter.on('route:showAdminPage', function () {
            var adminView = new AdminView();
            renderView(LB_ADMIN, adminView);
        });

        /**
         * Default page redirect
         */
        appRouter.on('route:defaultAction', function (actions) {
            if(Parse.User.current() != null) {
                window.location.hash = "#home";

            } else {
                window.location.hash = "#landing";
            }
        });

        Parse.history.start();
    };
    return {
        initialize: initialize
    };
});
