/**
 * Created by Jack on 7/13/15.
 */
define([
    'models/University',
    'models/Grid',
    'models/InventoryModel',
    'models/UserRequestModel',
    'models/PickUpLocation',
    'text!templates/home/landingTemplate.html',
    'text!templates/home/weeklyMenuTemplate.html'
], function(UniversityModel, GridModel, InventoryModel, UserRequestModel, PickUpLocationModel, landingTemplate, weeklyMenuTemplate) {
    var GRID_QUERY = "Grid";
    var DP_QUERY = "PickUpLoaction";
    var UNIVERSITY_POPULATION_THRESHOLD = 25000;
    var LandingView = Parse.View.extend({
        el: $("#page"),
        template: _.template(landingTemplate),
        weeklyMenuTemplate: _.template(weeklyMenuTemplate),

        initialize: function() {
            _.bindAll(this, 'render');
        },

        universityDPMap:[],

        render: function() {
            var self = this;            
            var universityQuery = new Parse.Query(UniversityModel);
            universityQuery.equalTo("e_country", "USA");
            universityQuery.containedIn("e_state", ["MD", "DC", "VA"]);
            universityQuery.ascending("biz_name");
            universityQuery.limit(800);
            universityQuery.find().then(
                function(universities) {
                    var dpQuery = new Parse.Query(PickUpLocationModel);
                    dpQuery.include("gridId");

                    // TODO - Combine Grid class to University class
                    var filteredUniversities = _.reject(universities, function(university){
                        if (university.get("c_pop")) {
                            if (Number(university.get("c_pop")) < UNIVERSITY_POPULATION_THRESHOLD) {
                                return university;
                            }
                        } else {
                            return university;
                        }
                    });

                    return Parse.Promise.when(dpQuery.find(), filteredUniversities);
                },
                function(err) {
                    console.log(err.message);
                }
            ).then(
                function(dps, filteredUniversities){
                    var gridDpMap = {};
                    _.each(dps, function(dp){
                        if (!gridDpMap[dp.get("gridId").get("name")]) {
                            var dpArray = [];
                            dpArray.push(dp);
                            gridDpMap[dp.get("gridId").get("name")] = dpArray;

                        } else {
                            gridDpMap[dp.get("gridId").get("name")].push(dp);
                        }
                    });

                    // Render page
                    self.$el.html(self.template({universities: filteredUniversities}));

                    // Default university and dp selections and their onChange settings
                    $(".college-selector").dropdown('set selected', "University of Maryland College Park");
                    self.refreshWeeklyMenu(GRID_QUERY, "University of Maryland College Park");
                    $(".college-selector").dropdown({
                        onChange: function (collegeName) {
                            var dpOptions = "";
                            _.each(gridDpMap[collegeName], function(dp) {
                                dpOptions += '<div class="item" data-value="' + dp.id +'">' + dp.get("address") + '</div>'

                            });
                            $('.dp-selection .menu').html(dpOptions);
                            $('.dp-selection').dropdown({
                                onChange: function(dp) {
                                    self.refreshWeeklyMenu(DP_QUERY, dp)
                                }
                            });
                            self.refreshWeeklyMenu(GRID_QUERY, collegeName);
                        }
                    });

                    // Default dp onChange setting
                    var defaultDpOptions = "";
                    _.each(gridDpMap["University of Maryland College Park"], function(dp) {
                        defaultDpOptions += '<div class="item" data-value="' + dp.id +'">' + dp.get("address") + '</div>'
                    });
                    $('.dp-selection .menu').html(defaultDpOptions);
                    $('.dp-selection').dropdown({
                        onChange: function(dp) {
                            self.refreshWeeklyMenu(DP_QUERY, dp)
                        }
                    });

                    if (Parse.User.current()) {
                        self.showSideBar(Parse.User.current());
                        self.$("#signUpBtn").hide();
                        self.$("#loginBtn").hide();
                    } else {
                        self.$("#signUpBtn").show();
                        self.$("#loginBtn").show();
                        $("#accountLogin").show();
                        $("#accountSignup").show();
                    }
                }
            );
        },

        showSideBar: function(currentUser) {
            $("#userEmail").text(currentUser.get('email'));
            var gridId = UMCP_GRID_ID;
            if (currentUser.get('gridId') == undefined) {
                $("#userGrid").text("University of Maryland College Park");
            }else {
                var GridModel = Parse.Object.extend("Grid");
                var gridQuery = new Parse.Query(GridModel);
                gridId = currentUser.get('gridId').id;
                gridQuery.get(currentUser.get('gridId').id, {
                    success: function(grid) {
                        $("#userGrid").text(grid.get('name'));
                    },
                    error: function(object, error) {
                        console.log(error.message);
                    }
                });
            }

            // Phone Number
            var phoneNumber = "Add your phone number";
            if (currentUser.get('telnum')) {
                phoneNumber = currentUser.get('telnum');
            }
            $("#userPhone").text(phoneNumber);

            $("#userFullName").text(currentUser.get('firstName') + " " + currentUser.get('lastName'));
            //$("#userCreditBalance").text("$" + currentUser.get('creditBalance').toFixed(2));
            $("#accountBarFirstName").text(currentUser.get('firstName'));
            //$('#referlink input').val('https://www.lunchbrother.com/?refer=' + currentUser.id + '#signupemail');
            $("#accountLogin").hide();
            $('#account').show();

            // Display Bottom Bar
            if (currentUser.get("permission") === LB_ADMIN) {
                $("#bottom-bar-order").show();
                $("#bottom-bar-menu").show();
                $("#bottom-bar-tracking").show();
                //$("#bottom-bar-manager").show();
                $("#bottom-bar-admin").show();

            } else if (currentUser.get("permission") === LOCAL_MANAGER) {
                $("#bottom-bar-order").show();
                $("#bottom-bar-menu").show();
                $("#bottom-bar-tracking").show();
                $("#bottom-bar-manager").show();

            } else {
                $("#bottom-bar-order").show();
                $("#bottom-bar-menu").show();
                $("#bottom-bar-tracking").show();
            }
        },

        refreshWeeklyMenu: function(queryType, target) {
            var self = this;
            if (queryType === GRID_QUERY) {
                var gridQuery = new Parse.Query(GridModel);
                gridQuery.equalTo('name', target);
                gridQuery.first({
                    success: function(grid) {
                        if(grid) {
                            self.getInventory(queryType, grid);
                        } else {
                            self.showVoteDialog(target);
                        }
                    },
                    error: function(error) {
                        showMessage("Oops!", "Find grid failed! Reason: " + error.message);
                    }
                });

            } else {
                this.getInventory(queryType, target)
            }
        },

        getInventory: function(queryType, target) {
            var d = new Date();
            var day = d.getDay();
            var diff = d.getDate() - day + 1;

            // For Saturday to see next week's menu
            if (day == 6) {
                diff += 1;
            }

            var monday = new Date(d.setDate(diff));
            var firstWeek = (monday.getMonth() + 1) + "/" + monday.getDate() + "-";

            var firstMonday = new Date(monday);

            var diff2 = monday.getDate() + 4;
            var friday = new Date(monday.setDate(diff2));
            firstWeek += (friday.getMonth() + 1) + "/" + friday.getDate();

            var diff3 = friday.getDate() + 3;
            var monday2 = new Date(friday.setDate(diff3));
            var secondWeek = (monday2.getMonth() + 1) + "/" + monday2.getDate() + "-";

            var secondMonday = new Date(monday2);

            var diff4 = monday2.getDate() + 4;
            var friday2 = new Date(monday2.setDate(diff4));
            secondWeek += (friday2.getMonth() + 1) + "/" + friday2.getDate();

            var diff5 = friday2.getDate() + 3;
            var monday3 = new Date(friday2.setDate(diff5));
            var thirdWeek = (monday3.getMonth() + 1) + "/" + monday3.getDate() + "-";

            var thirdMonday = new Date(monday3);

            var diff6 = monday3.getDate() + 4;
            var friday3 = new Date(monday3.setDate(diff6));
            thirdWeek += (friday3.getMonth() + 1) + "/" + friday3.getDate();

            firstMonday.setFullYear(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate());
            firstMonday.setHours(0, 0, 0, 0);
            secondMonday.setFullYear(secondMonday.getFullYear(), secondMonday.getMonth(), secondMonday.getDate());
            secondMonday.setHours(0, 0, 0, 0);
            thirdMonday.setFullYear(thirdMonday.getFullYear(), thirdMonday.getMonth(), thirdMonday.getDate());
            thirdMonday.setHours(0, 0, 0, 0);
            friday3.setFullYear(friday.getFullYear(), friday3.getMonth(), friday3.getDate());
            friday3.setHours(23, 59, 59, 0);

            var self = this;
            var inventoryQuery = new Parse.Query(InventoryModel);

            if (queryType === GRID_QUERY) {
                var grid = new GridModel();
                grid.id = target.id;
                inventoryQuery.equalTo("gridId", grid);

            } else {
                var dp = new PickUpLocationModel();
                dp.id = target;
                inventoryQuery.equalTo("pickUpLocation", dp);
            }

            inventoryQuery.greaterThan("pickUpDate", firstMonday);
            inventoryQuery.lessThan("pickUpDate", friday3);
            inventoryQuery.include("dish");
            inventoryQuery.include("dish.restaurant");
            inventoryQuery.find({
                success: function (inventories) {
                    console.log(inventories.length);
                    var firstWeekMenu = {Mon:[], Tue:[], Wed:[], Thu:[], Fri:[], published:false};
                    var secondWeekMenu = {Mon:[], Tue:[], Wed:[], Thu:[], Fri:[], published:false};
                    var thirdWeekMenu = {Mon:[], Tue:[], Wed:[], Thu:[], Fri:[], published:false};

                    _.each(inventories, function(inventory){
                        if (inventory.get('pickUpDate') > firstMonday && inventory.get('pickUpDate') < secondMonday) {
                            if (inventory.get('published')) {
                                firstWeekMenu.published = true;
                            }
                            self.populateDayMenu(inventory.get('pickUpDate').getDay(), firstWeekMenu, inventory);

                        } else if (inventory.get('pickUpDate') > secondMonday && inventory.get('pickUpDate') < thirdMonday) {
                            if (inventory.get('published')) {
                                secondWeekMenu.published = true;
                            }
                            self.populateDayMenu(inventory.get('pickUpDate').getDay(), secondWeekMenu, inventory);

                        } else {
                            if (inventory.get('published')) {
                                thirdWeekMenu.published = true;
                            }
                            self.populateDayMenu(inventory.get('pickUpDate').getDay(), thirdWeekMenu, inventory);
                        }
                    });
                    self.$("#weeklyMenu").html(self.weeklyMenuTemplate({menu:[firstWeekMenu, secondWeekMenu, thirdWeekMenu], weeks: [firstWeek, secondWeek, thirdWeek]}));
                },
                error: function (error) {
                    showMessage("Oops!", "Inventory Query Error: " + error.code + " " + error.message);
                }
            });
        },

        populateDayMenu: function(day, menu, inventory) {
            switch(day) {
                case 1:
                    menu.Mon.push(inventory);
                    break;
                case 2:
                    menu.Tue.push(inventory);
                    break;
                case 3:
                    menu.Wed.push(inventory);
                    break;
                case 4:
                    menu.Thu.push(inventory);
                    break;
                default:
                    menu.Fri.push(inventory);
                    break;
            }
        },

        showVoteDialog: function(collegeName) {
            $('#targetCollege').text(collegeName);
            $('#voterEmail').val("");
            var requestQuery = new Parse.Query(UserRequestModel);
            requestQuery.equalTo("requestType", "SERVICE");
            requestQuery.equalTo("requestTargetId", collegeName);
            requestQuery.count({
                success: function(count) {
                    $('#numberOfVote').text(count);
                    $('#voteDialog').modal({
                        closable: true,
                        onDeny: function () {
                            // This is not an option
                        },
                        onApprove: function () {
                            var voterEmail = $('#voterEmail').val();
                            var emailRegEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i;
                            var collegeRegex = /\.edu/;

                            if (voterEmail.trim() === "") {
                                showMessage("Oops!", "Please enter your email address.");

                            } else if (!emailRegEx.test(voterEmail)) {
                                showMessage("Oops!", "Please enter valid email address.");

                            } else if (!collegeRegex.test(voterEmail)) {
                                showMessage("Oops!", "Sorry, we currently only accept school email address.");

                            } else {
                                var requestQuery = new Parse.Query(UserRequestModel);
                                requestQuery.equalTo("requestByEmail", voterEmail);
                                requestQuery.equalTo("requestTargetId", collegeName);
                                requestQuery.find({
                                    success: function(users) {
                                        if (users.length > 0){
                                            showMessage("Success", "We already have your request record, thank you very much!");

                                        } else {
                                            var newRequest = new UserRequestModel();
                                            newRequest.set("requestType", "SERVICE");
                                            newRequest.set("requestByEmail", voterEmail);
                                            newRequest.set("requestTargetId", collegeName);
                                            newRequest.save({
                                                success: function(request) {
                                                    showMessage("Success", "Request saved, thank you for your response!");
                                                },
                                                error: function(error) {
                                                    showMessage("Error", "Save request failed! Error: " + error.code + " " + error.message);
                                                }
                                            });
                                        }
                                    },
                                    error: function(error) {
                                        showMessage("Error", "Save request record failed! Error: " + error.code + " " + error.message);
                                    }
                                });
                            }
                        }
                    }).modal('show');
                },
                error: function(error) {
                    showMessage("Error", "Find request record failed! Error: " + error.code + " " + error.message);
                }
            });
        }
    });
    return LandingView;
});
