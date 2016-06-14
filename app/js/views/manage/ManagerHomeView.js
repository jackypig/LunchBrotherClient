define([
    'models/Grid',
    'models/Restaurant',
    'models/PickUpLocation',
    'models/InventoryModel',
    'models/Employee',
    'models/RegistrationCodeModel',
    'models/BankAccount',
    'models/Transfer',
    'models/user/CardModel',
    'text!templates/manage/managerHomeTemplate.html',
    'text!templates/manage/menuListTemplate.html',
    'text!templates/manage/salesTableBodyTemplate.html',
    'text!templates/manage/creditCardSectionTemplate.html',
    'text!templates/manage/billTableBodyTemplate.html'
], function(GridModel, RestaurantModel, PickUpLocationModel, InventoryModel, EmployeeModel,
            RegistrationCodeModel, BankAccountModel, TransferModel, CardModel,
            managerHomeTemplate, menuListTemplate, salesTableBodyTemplate,
            creditCardSectionTemplate, billTableBodyTemplate) {

    var ManagerHomeView = Parse.View.extend({
        el: $("#page"),
        template: _.template(managerHomeTemplate),
        menuListTemplate: _.template(menuListTemplate),
        salesTableBodyTemplate: _.template(salesTableBodyTemplate),
        creditCardSectionTemplate: _.template(creditCardSectionTemplate),
        billTableBodyTemplate: _.template(billTableBodyTemplate),
        events: {
            'click #DPAdd': 'onEditOrAddClick',
            'click #showDistributorStatus': 'onShowDistributorStatusClick',
            'click #showDriverStatus': 'onShowDriverStatusClick',
            'click #publishMenu': 'onPublishMenuClick',
            'click #concealMenu': 'onConcealMenuClick',
            'click #addPerson': 'onEditOrAddPersonClick',
            'click .toBankAccount': 'showBankInfo',
            'click .toCreditCard': 'showCardInfo',
            'click #toManageRestaurants': 'toManageRestaurants'
        },

        days: {0:'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'},
        weeklyMenu: {
            published: false,
            menus:[
                {
                    day:"MONDAY",
                    date: "",
                    dishes:[],
                    inventoryIds:[]
                },

                {
                    day:"TUESDAY",
                    date: "",
                    dishes:[],
                    inventoryIds:[]
                },

                {
                    day:"WEDNESDAY",
                    date: "",
                    dishes:[],
                    inventoryIds:[]
                },

                {
                    day:"THURSDAY",
                    date: "",
                    dishes:[],
                    inventoryIds:[]
                },

                {
                    day:"FRIDAY",
                    date: "",
                    dishes:[],
                    inventoryIds:[]
                }
            ]
        },

        nextPayment: {
            date: "",
            amount: 0.00
        },

        inventoryIds: [],

        pickUpLocations: [],

        selectedWeek: "",

        selectedDP: "",

        initialize: function() {
            _.bindAll(this, 'render');
            this.nextPaymentCalculation();
            var currentUser = Parse.User.current();
            var self = this;
            var pickUpLocationQuery = new Parse.Query(PickUpLocationModel);
            pickUpLocationQuery.equalTo("gridId", currentUser.get("gridId"));
            pickUpLocationQuery.find({
                success: function(pickUpLocations) {
                    _.each(pickUpLocations, function(pickUpLocation){
                        self.pickUpLocations.push(pickUpLocation.get("address"));
                    });
                },
                error: function(error) {
                    console.log("Error in querying pick up locations. Reason: " + error.message);
                }
            });
        },

        render: function() {
            var self = this;
            var chefGrid = Parse.User.current().get('gridId');
            var newEvent = {};
            //default chef's grid to University of Maryland College Park
            if (chefGrid == undefined){
                chefGrid = new GridModel();
                chefGrid.id = UMCP_GRID_ID;
            }

            var pickUpLocationQuery = new Parse.Query(PickUpLocationModel);
            pickUpLocationQuery.equalTo("gridId", chefGrid);
            pickUpLocationQuery.equalTo("manager", Parse.User.current());
            pickUpLocationQuery.include("distributor");
            pickUpLocationQuery.find({
                success:function(locations) {
                    _.each(locations, function(location) {
                        newEvent["click #dpEditButton-" + location.id] = 'onEditOrAddClick';
                        newEvent["click #dpDeleteButton-" + location.id] = 'onDeleteClick';
                    });
                    self.delegateEvents(_.extend(self.events, newEvent));

                    //Get three weeks
                    var threeWeeks = self.getNextThreeWeeks();
                    var lastThreeWeeks = self.getLastThreeWeeks();

                    //Query offline workers
                    self.queryWorkers(locations, threeWeeks, lastThreeWeeks);
                },
                error: function(error) {
                    console.log(error.message);
                }
            });
        },

        getNextThreeWeeks: function() {
            var d = new Date();
            var day = d.getDay();
            var diff = d.getDate() - day + 1;

            // For Saturday to see next week's menu
            if (day == 6) {
                diff += 1;
            }

            var monday = new Date(d.setDate(diff));
            var firstWeek = (monday.getMonth() + 1) + "/" + monday.getDate() + "-";

            var diff2 = monday.getDate() + 4;
            var friday = new Date(monday.setDate(diff2));
            firstWeek += (friday.getMonth() + 1) + "/" + friday.getDate();

            var diff3 = friday.getDate() + 3;
            var monday2 = new Date(friday.setDate(diff3));
            var secondWeek = (monday2.getMonth() + 1) + "/" + monday2.getDate() + "-";

            var diff4 = monday2.getDate() + 4;
            var friday2 = new Date(monday2.setDate(diff4));
            secondWeek += (friday2.getMonth() + 1) + "/" + friday2.getDate();

            var diff5 = friday2.getDate() + 3;
            var monday3 = new Date(friday2.setDate(diff5));
            var thirdWeek = (monday3.getMonth() + 1) + "/" + monday3.getDate() + "-";

            var diff6 = monday3.getDate() + 4;
            var friday3 = new Date(monday3.setDate(diff6));
            thirdWeek += (friday3.getMonth() + 1) + "/" + friday3.getDate();

            return [firstWeek, secondWeek, thirdWeek];
        },

        getLastThreeWeeks: function() {
            var d = new Date();
            var day = d.getDay();
            var diff = d.getDate() - day; // Sunday

            var monday = new Date(d);
            monday.setDate(diff+1);
            var friday = new Date(monday);
            var diff1 = monday.getDate() + 4;
            friday.setDate(diff1);
            var thisWeek = (monday.getMonth() + 1) + "/" + monday.getDate() + "-" + (friday.getMonth() + 1) + "/" + friday.getDate();

            var sunday = new Date(d);
            sunday.setDate(diff);
            var diff2 = sunday.getDate() - 2;
            var lastFriday = new Date(sunday);
            lastFriday.setDate(diff2);
            var diff3 = lastFriday.getDate() - 4;
            var lastMonday = new Date(lastFriday);
            lastMonday.setDate(diff3);
            var firstLastWeek = (lastMonday.getMonth() + 1) + "/" + lastMonday.getDate() + "-" + (lastFriday.getMonth() + 1) + "/" + lastFriday.getDate();

            var diff4 = lastMonday.getDate() - 3
            var secondLastFriday = new Date(lastMonday);
            secondLastFriday.setDate(diff4);
            var diff5 = secondLastFriday.getDate() - 4;
            var secondLastMonday = new Date(secondLastFriday);
            secondLastMonday.setDate(diff5);
            var secondLastWeek = (secondLastMonday.getMonth() + 1) + "/" + secondLastMonday.getDate() + "-" + (secondLastFriday.getMonth() + 1) + "/" + secondLastFriday.getDate();

            return [thisWeek, firstLastWeek, secondLastWeek];
        },

        queryWorkers: function(locations, threeWeeks, lastThreeWeeks) {
            var self = this;
            var employeeQuery = new Parse.Query(EmployeeModel);
            employeeQuery.equalTo("manager", Parse.User.current());
            employeeQuery.include("worker");
            employeeQuery.find({
                success: function(employees) {
                    var distributors = [];
                    var newEvent2 = {};

                    _.each(employees, function(employee) {
                        newEvent2["click #employeeEditButton-" + employee.id] = 'onEditOrAddPersonClick';
                        newEvent2["click #employeeDeleteButton-" + employee.id] = 'onDeletePersonClick';
                        if (employee.get("worker").get('permission') === DISTRIBUTOR) {
                            distributors.push(employee.get("worker"));
                        }
                    });
                    self.delegateEvents(_.extend(self.events, newEvent2));

                    var bankAccount = Parse.User.current().get('bankAccount');
                    if (bankAccount) {
                        bankAccount.fetch({
                            success: function(bankAccount) {
                                self.$el.html(self.template({distributors: distributors, distributingPoints: locations, weeks: threeWeeks, lastThreeWeeks:lastThreeWeeks, employees: employees, bankAccount: bankAccount}));
                                self.menuSelectionAndSalesData();
                                self.cardCreditSection();
                            }
                        });

                    } else {
                        bankAccount = new BankAccountModel();
                        self.$el.html(self.template({distributors: distributors, distributingPoints: locations, weeks: threeWeeks, lastThreeWeeks:lastThreeWeeks, employees: employees, bankAccount: bankAccount}));
                        self.menuSelectionAndSalesData();
                        self.cardCreditSection();
                    }
                },
                error: function(error) {
                    console.log(error.message);
                }
            });
        },

        menuSelectionAndSalesData: function() {
            var self = this;
            this.configureMenuSelection();
            this.$("#periodSelector").dropdown();
            this.$("#periodSelector").dropdown({
                onChange: function (week) {
                    console.log(week);
                    if (week) {
                        self.refreshBillTableBody(week)
                    };
                }
            });

            this.refreshBillTableBody(this.getLastThreeWeeks()[0]);

            //Sales data
            this.$("#salesTableBody").html(this.salesTableBodyTemplate({inventories: null, income: 0.00, nextPaymentDate: this.nextPayment.date, nextPaymentAmount: this.nextPayment.amount.toFixed(2)}));
            this.$( "#datepicker" ).datepicker({
                onSelect: function(dateText){
                    var month = parseInt(dateText.split("/")[0]) - 1;
                    var date = parseInt(dateText.split("/")[1]);
                    var year = parseInt(dateText.split("/")[2]);

                    var dayStart = new Date();
                    dayStart.setFullYear(year, month, date);
                    dayStart.setHours(0, 0, 0, 0);

                    var dayEnd = new Date();
                    dayEnd.setFullYear(year, month, date);
                    dayEnd.setHours(23, 59, 59, 0);

                    // Query Sales Data
                    self.querySalesData(dayStart, dayEnd);
                }
            });
        },

        refreshBillTableBody: function(week) {
            var self = this;
            var days = this.parseWeekIntoDates(week);
            var monday = days[0], friday = days[1];
            var inventoryQuery = new Parse.Query(InventoryModel);
            inventoryQuery.equalTo("orderBy", Parse.User.current());
            inventoryQuery.greaterThan("pickUpDate", monday);
            inventoryQuery.lessThan("pickUpDate", friday);
            inventoryQuery.include("dish");
            inventoryQuery.include("dish.restaurant");
            inventoryQuery.find({
                success: function(inventories) {
                    var restaurantPayments = null;
                    if (inventories.length !== 0) {
                        restaurantPayments = {};
                        _.each(inventories, function(inventory) {
                            var restaurantName = inventory.get("dish").get("restaurant").get("name");
                            var totalOrderQuantity = inventory.get("totalOrderQuantity");
                            var originalDishPrice = inventory.get("dish").get("originalPrice");

                            if (restaurantPayments[restaurantName]) {
                                restaurantPayments[restaurantName] += totalOrderQuantity * originalDishPrice;

                            } else {
                                restaurantPayments[restaurantName] = totalOrderQuantity * originalDishPrice;
                            }
                        });
                    }
                    self.$("#billTableBody").html(self.billTableBodyTemplate({payments: restaurantPayments}));
                },
                error: function(error) {
                    showMessage("Error", "Find inventory failed! Reason: " + error.message);
                }
            });
        },

        cardCreditSection: function() {
            var self = this;
            var cardQuery = new Parse.Query(CardModel);
            cardQuery.equalTo("createdBy", Parse.User.current());
            cardQuery.descending("createdAt");
            cardQuery.first({
                success: function(card) {
                    if (!card) {
                        card = new CardModel();
                    }
                    self.$("#creditCardSection").html(self.creditCardSectionTemplate({card: card}));
                },
                error: function(error) {
                    showMessage("Find Credit Card Failed", error.message);
                }
            });
        },

        nextPaymentCalculation: function() {
            var self = this;

            /**
             *  Find next payment date
             */
            var transferQueryForNextPayDate = new Parse.Query(TransferModel);
            transferQueryForNextPayDate.equalTo("manager", Parse.User.current());
            transferQueryForNextPayDate.equalTo("transferred", true);
            transferQueryForNextPayDate.descending("updatedAt");
            transferQueryForNextPayDate.first({
                success: function(transfer) {
                    if (transfer) {
                        var lastPayDate = transfer.updatedAt;
                        var date = new Date(lastPayDate.getTime() + 24 * 60 * 60 * 1000 * 14);
                        var dateString = date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear();
                        self.nextPayment.date = dateString;
                    }
                },
                error: function(error) {
                    console.log(error.message);
                }
            });

            /**
             *  Find next payment amount
             */
            var transferQuery = new Parse.Query(TransferModel);
            transferQuery.equalTo("manager", Parse.User.current());
            transferQuery.equalTo("transferred", false);
            transferQuery.ascending("updatedAt");
            transferQuery.find({
                success: function(transfers) {
                    var amount = 0.00;
                    var firstPayDateString = ""; //For the very first transfer pay date
                    _.each(transfers, function(transfer){
                        amount += transfer.get('amount');
                        if (!firstPayDateString) {
                            var firstTransferDate = transfer.updatedAt;
                            var firstPayDate = new Date(firstTransferDate.getTime() + 24 * 60 * 60 * 1000 * 14);
                            firstPayDateString = firstPayDate.getMonth() + 1 + "/" + firstPayDate.getDate() + "/" + firstPayDate.getFullYear();
                        }
                    });

                    self.nextPayment.amount = amount;

                    /**
                     * If no next payment date set, set it here
                     */
                    if (!self.nextPayment.date) {
                        if (!firstPayDateString) {
                            self.nextPayment.date = "TBD";
                        } else {
                            self.nextPayment.date = firstPayDateString;
                        }
                    }
                },
                error: function(error) {
                    console.log(error.message);
                }
            });
        },

        configureMenuSelection: function() {
            var self = this;
            if (this.options.week !== "" && this.options.dp !== "") {
                this.selectedDP = this.options.dp;
                this.selectedWeek = this.options.week;
                this.refreshWeekMenu();

                //We need to do this crazy stuff to both set the value and have it to be selectable
                $(".week-selection").dropdown('set selected', this.options.week);
                $(".week-selection").dropdown({
                    onChange: function (week) {
                        self.setWeek(week);
                    }
                });

                $(".dp-selection").dropdown('set selected', this.options.dp);
                $(".dp-selection").dropdown({
                    onChange: function (dp) {
                        self.setDP(dp);
                    }
                });

            } else {
                $(".week-selection").dropdown({
                    onChange: function (week) {
                        self.setWeek(week);
                    }
                });

                $(".dp-selection").dropdown({
                    onChange: function (dp) {
                        self.setDP(dp);
                    }
                });
            }

            self.$("#publishMenu").addClass('disabled');
        },

        querySalesData: function(dayStart, dayEnd) {
            var self = this;
            var inventoryQuery = new Parse.Query(InventoryModel);
            inventoryQuery.equalTo("orderBy", Parse.User.current());
            inventoryQuery.include("dish");
            inventoryQuery.lessThan("pickUpDate", dayEnd);
            inventoryQuery.greaterThan("pickUpDate", dayStart);
            inventoryQuery.find({
                success: function(inventories) {
                    if (inventories.length !== 0) {
                        _.each(inventories, function(inventory) {
                            var totalOrderQuantity = inventory.get("totalOrderQuantity");
                            var payByCardQuantity = inventory.get("payByCardCount");
                            var payByCardIncomeByInventory = payByCardQuantity * inventory.get("price");
                            var salesTotalByInventory = payByCardIncomeByInventory + (totalOrderQuantity - payByCardQuantity) * inventory.get("cashPrice");
                            inventory.income = salesTotalByInventory;
                        });
                    }

                    self.$("#salesTableBody").html(self.salesTableBodyTemplate({inventories: inventories, nextPaymentDate: self.nextPayment.date, nextPaymentAmount: self.nextPayment.amount.toFixed(2)}));
                },
                error: function(error) {
                    showMessage("Error", "Find inventory failed! Reason: " + error.message);
                }
            });
        },

        setWeek: function(week) {
            this.selectedWeek = week;
            this.refreshWeekMenu();
        },

        setDP: function(dpId) {
            this.selectedDP = dpId;
            this.refreshWeekMenu();
        },

        refreshWeekMenu: function() {
            if (this.selectedWeek && this.selectedDP) {
                var dp = new PickUpLocationModel();
                dp.id = this.selectedDP;

                /**
                 *
                 * Set start date and end date for querying inventory
                 */
                var days = this.parseWeekIntoDates(this.selectedWeek);
                var monday = days[0], friday = days[1];

                /**
                 * Reset the global variables
                 */
                this.inventoryIds = [];
                for (var pickUpDay = 0; pickUpDay < 5; pickUpDay++) {
                    this.weeklyMenu.menus[pickUpDay].date = this.getDateForEachDay(monday, pickUpDay, this.weeklyMenu.menus[pickUpDay].day);
                    this.weeklyMenu.menus[pickUpDay].dishes = [];
                    this.weeklyMenu.menus[pickUpDay].inventoryIds = [];
                }

                /**
                 *
                 * Main inventory query part
                 */
                var self = this;
                var currentUser = Parse.User.current();
                var inventoryQuery = new Parse.Query(InventoryModel);
                inventoryQuery.equalTo("orderBy", currentUser);
                inventoryQuery.equalTo("pickUpLocation", dp);
                inventoryQuery.greaterThan("pickUpDate", monday);
                inventoryQuery.lessThan("pickUpDate", friday);
                inventoryQuery.include("dish");
                inventoryQuery.include("dish.restaurant");
                inventoryQuery.find({
                    success: function (inventories) {
                        var published = false;
                        for (var i=0; i<inventories.length; i++) {
                            var pickUpDay = inventories[i].get('pickUpDate').getDay();
                            var dishInfo = {
                                dishName: inventories[i].get('dish').get('dishName'),
                                restaurantName: inventories[i].get('dish').get('restaurant').get('name'),
                                restaurantNumber: inventories[i].get('dish').get('restaurant').get('telnum'),
                                quantity: inventories[i].get('preorderQuantity'),
                                price: inventories[i].get('price'),
                                cashPrice: inventories[i].get('cashPrice'),
                                status: inventories[i].get('status')
                            };

                            self.weeklyMenu.menus[pickUpDay - 1].inventoryIds.push(inventories[i].id);
                            self.weeklyMenu.menus[pickUpDay - 1].dishes.push(dishInfo);
                            self.inventoryIds.push(inventories[i].id);
                            published = inventories[i].get('published');
                        }
                        
                        self.weeklyMenu.published = published;
                        self.$("#menuList").html(self.menuListTemplate(self.weeklyMenu));
                        if (published) {
                            self.$("#publishMenu").addClass('disabled');
                            self.$("div[id*='menuEditBtn']").addClass('disabled');
                        } else if (inventories.length === 0) {
                            self.$("#publishMenu").addClass('disabled');
                        }

                        var newEvent = {};
                        for (var i=0; i<5; i++) {
                            newEvent["click #menuEditBtn-" + self.weeklyMenu.menus[i].day] = 'onEditMenuClick';
                        }

                        self.delegateEvents(_.extend(self.events, newEvent));
                    },
                    error: function (error) {
                        console.log("Inventory Query Error: " + error.code + " " + error.message);
                    }
                });
            }
        },

        parseWeekIntoDates: function(week) {
            var days = week.split("-");
            var mondayMonth = parseInt(days[0].split("/")[0]) - 1, mondayDate = parseInt(days[0].split("/")[1]);
            var monday = new Date();
            monday.setFullYear(monday.getFullYear(), mondayMonth, mondayDate);
            monday.setHours(0, 0, 0, 0);

            var fridayMonth = parseInt(days[1].split("/")[0]) - 1, fridayDate = parseInt(days[1].split("/")[1]);
            var friday = new Date();
            friday.setFullYear(friday.getFullYear(), fridayMonth, fridayDate);
            friday.setHours(23, 59, 59, 0);

            return [monday, friday];
        },

        getDateForEachDay: function(monday, offset, day) {
            var date = new Date(monday.getTime() + 24 * 60 * 60 * 1000 * offset);
            var dateString = date.getMonth() + 1 + "/" + date.getDate() + " " + day;
            return dateString
        },

        onEditMenuClick: function(ev) {
            var inventoryIds = $(ev.currentTarget).data('inventoryIds');
            var date = $(ev.currentTarget).data('date');
            var dp = this.selectedDP ? this.selectedDP : this.options.dp;

            window.location.hash = "#menuEdit?inventoryIds=" + inventoryIds + "&date=" + date + "&dp=" + dp;

        },

        onEditOrAddPersonClick: function(ev) {
            this.$('.ui.form').form({
                firstName: {
                    identifier: 'firstName',
                    rules: [{
                        type: 'empty',
                        prompt: 'Please enter the first name'
                    }]
                },
                lastName: {
                    identifier: 'lastName',
                    rules: [{
                        type: 'empty',
                        prompt: 'Please enter the last name'
                    }]
                },
                email: {
                    identifier: 'email',
                    rules: [{
                        type: 'empty',
                        prompt: 'Please enter the email address'
                    }, {
                        type: 'email',
                        prompt: 'Please enter a valid e-mail'
                    }]
                },
                phonenumber: {
                    identifier: 'phonenumber',
                    rules: [{
                        type: 'empty',
                        prompt: 'Please enter cell phone number'
                    }, {
                        type: 'length[10]',
                        prompt:'Your phone number must be 10 digits'
                    }]
                },
                password: {
                    identifier: 'password',
                    rules: [{
                        type: 'empty',
                        prompt: 'Please enter your password'
                    }]
                },
                titleOptions: {
                    identifier: 'titleOptions',
                    rules: [{
                        type: 'empty',
                        prompt: 'Please select a title'
                    }]
                }
            }, {
                on: 'blur',
                inline: 'true'
            });
            var self = this;
            var pId = $(ev.currentTarget).data('id');
            var pFirstName = $(ev.currentTarget).data('firstName');
            var pLastName = $(ev.currentTarget).data('lastName');
            var pEmail = $(ev.currentTarget).data('email');
            var pPhoneNumber = $(ev.currentTarget).data('phoneNumber');
            var pPassword = $(ev.currentTarget).data('password');
            var pTitle = $(ev.currentTarget).data('title');
            
            $('#first_name').val(pFirstName);
            $('#last_name').val(pLastName);
            $('#email').val(pEmail);
            $('#phonenumber').val(pPhoneNumber);
            $('#password').val(pPassword);
            $('#titleOptions').val(pTitle);
            $('#editPersonDialog').modal({
                closable: false,
                onDeny: function () {
                    location.reload();
                },
                onApprove: function () {
                	self.savePerson(pId, $("#first_name").val(), $("#last_name").val(), $('#email').val(), $('#phonenumber').val(), $('#password').val(), $('#titleOptions').val());                	
                }
            }).modal('show');
        },

        onEditOrAddClick: function(ev) {
            this.$('.ui.form').form({
                dp_location: {
                    identifier: 'dp_location',
                    rules: [{
                        type: 'empty',
                        prompt: 'Please enter the name of your location'
                    }]
                }
            }, {
                on: 'blur',
                inline: 'true'
            });

            var self = this;
            var dpId = $(ev.currentTarget).data('id');
            var address = $(ev.currentTarget).data('address');
            var youtubeLink = $(ev.currentTarget).data('youtube');
            var distributorId = $(ev.currentTarget).data('distributor');

            var pickUpLocationsString = "";

            _.each(this.pickUpLocations, function(pickUpLocation){
                pickUpLocationsString += "\"" + pickUpLocation + "\"" + ", ";
            });

            if (pickUpLocationsString) {
                $('#dpWarningLine').text("Cannot use " + pickUpLocationsString.substring(0, pickUpLocationsString.length-2)).css({ 'font-size': 12 });
            }

            $("#distributorSelector").val(distributorId);
            $("#dp_location").val(address);
            $("#dp_youtubeLink").val(youtubeLink);
            $('#editDPDialog').modal({
                closable: false,
                onDeny: function () {
                    location.reload();
                },
                onApprove: function () {
                    self.saveDP(dpId, $("#dp_location").val(), $("#dp_youtubeLink").val(), $("#distributorSelector").val());
                }
            }).modal('show');
        },

        onDeleteClick: function(ev) {
            var self = this;
            var dpId = $(ev.currentTarget).data('id');
            $('#deleteDPDialog').modal({
                closable: false,
                onDeny: function () {
                    location.reload();
                },
                onApprove: function () {
                    self.deleteDP(dpId);
                }
            }).modal('show');
        },

        onDeletePersonClick: function(ev) {
            var self = this;
            var employeeId = $(ev.currentTarget).data('id');
            $('#deletePersonDialog').modal({
                closable: false,
                onDeny: function () {
                    location.reload();
                },
                onApprove: function () {
                    self.deleteEmployee(employeeId);
                }
            }).modal('show');
        },

        onShowDistributorStatusClick: function() {
            window.location.hash = '#distributor';
        },

        onShowDriverStatusClick: function() {
            window.location.hash = '#driver';
        },

        saveDP: function(id, address, youtubeLink, distributorId) {
            var currentManager = Parse.User.current();
            var chefGrid = currentManager.get('gridId');
            //default chef's grid to University of Maryland College Park
            if (chefGrid === undefined){
                chefGrid = new GridModel();
                chefGrid.id = UMCP_GRID_ID;
            }

            if (address.trim() !== "") {
                var dp = new PickUpLocationModel();
                dp.id = id;
                dp.set("manager", currentManager);
                dp.set("gridId", chefGrid);
                dp.set("address", address);
                if (distributorId !== "") {
                    var distributor = new Parse.User();
                    distributor.id = distributorId;
                    dp.set("distributor", distributor);
                } else {
                    dp.unset("distributor");
                }
                dp.set("youtubeLink", youtubeLink);
                dp.save(null, {
                    success: function(dp) {
                        if (id === undefined) {
                            showMessage("Success", "New distributing point created with Id: " + dp.id, function() {
                                location.reload();
                            });
                        } else {
                            showMessage("Success", "Distributing point info updated!", function() {
                                location.reload();
                            });
                        }
                    },
                    error: function(error) {
                        showMessage("Fail", "Update failed! Reason: " + error.message);
                    }
                });
            } else {
                showMessage("Fail", "Please enter the name for this distributing point.");
            }
        },
        
        savePerson: function(id, firstname, lastname, email, phonenumber, password, title){
            var gridId = Parse.User.current().get("gridId").id;
            if (id) {
                this.updatePerson(id, firstname, lastname, email, phonenumber, password, title, gridId);
            } else {
                var person = new Parse.User();
                person.set("username", email);
                person.set("password", password);
                person.set("firstName", firstname);
                person.set("lastName", lastname);
                person.set("email", email);
                person.set("telnum", Number(phonenumber));
                person.set("gridId", {
                    __type: "Pointer",
                    className: "Grid",
                    objectId: gridId
                });
                person.set("permission", Number(title));
                person.save(null, {
                    success: function(person) {
                        // Save Employee
                        var employee = new EmployeeModel();
                        employee.set("worker", person);
                        employee.set("manager", Parse.User.current());
                        employee.save(null, {
                            success: function(employee) {
                                showMessage("Success", "Save employee successfully!", function() {
                                    location.reload();
                                });
                            },
                            error: function(error) {
                                showMessage("Error", "Save employee failed! Reason: " + error.message);
                            }
                        });
                    },
                    error: function(error) {
                        showMessage("Error", "Save worker failed! Reason: " + error.message);
                    }
                });
            }
        },

        updatePerson: function(id, firstname, lastname, email, phonenumber, password, title, gridId) {
            Parse.Cloud.run('updateUser', {
                userId: id,
                firstName: firstname,
                lastName: lastname,
                email: email,
                telnum: phonenumber,
                password: password,
                permission: title,
                gridId: gridId
            }, {
                success: function (success) {
                    showMessage("Success", success, function() {
                        location.reload();
                    });
                },
                error: function (error) {
                    showMessage("Error", "Update user failed! Reason: " + error.message);
                }
            });
        },

        deleteEmployee: function(id) {
            var employee = new EmployeeModel();
            employee.id = id;
            employee.destroy({
                success: function(success) {
                    showMessage("Success", "Delete employee successfully!", function() {
                        location.reload();
                    });
                },
                error: function(error) {
                    showMessage("Error", "Delete employee failed! Reason: " + error.message);
                }
            });
        },

        deleteDP: function(id) {
            var dp = new PickUpLocationModel();
            dp.id = id;
            dp.destroy({
                success: function(dp) {
                    showMessage("Success", "Delete distributing point successfully!");
                },
                error: function(dp, error) {
                    showMessage("Error", "Delete distributing point failed! Reason: " + error.message);
                }
            });
        },

        onPublishMenuClick: function() {
            var hasDishEveryDay = true;
            _.each(this.weeklyMenu.menus, function(menu){
                hasDishEveryDay = hasDishEveryDay && menu.inventoryIds.length > 0;
            });

            //Pop out an alert window to make sure they want to publish menu which does not have dishes everyday
            if (!hasDishEveryDay) {
                $('#publishMenuWarningLine').text("Warning: You have empty dishes on some day(s) this week!").css({ 'font-size': 12 });
            } else {
                $('#publishMenuWarningLine').text("");
            }

            var self = this;
            $('#publishMenuDialog').modal({
                closable: false,
                onDeny: function () {
                    location.reload();
                },
                onApprove: function () {
                    $("#publishMenu").addClass('disabled');
                    $("#publishMenu").text('Published!');
                    $("div[id*='menuEditBtn']").addClass('disabled');

                    var inventories = [];
                    _.each(self.inventoryIds, function(inventoryId){
                        var inventory = new InventoryModel();
                        inventory.id = inventoryId;
                        inventory.set("published", true);
                        inventories.push(inventory);
                    });

                    Parse.Object.saveAll(inventories, {
                        success: function(inventories) {
                            showMessage("Success", "Save menu successfully!", function() {
                                location.reload();
                            });
                        },
                        error: function(error) {
                            showMessage("Error", "Save menu failed! Reason: " + error.message + "Menu: " + + inventories, function() {
                                location.reload();
                            });
                        }
                    });
                }
            }).modal('show');
        },

        onConcealMenuClick: function() {
            $("#publishMenu").removeClass('disabled');
            $("#publishMenu").text('Publish');
            $("div[id*='menuEditBtn']").removeClass('disabled');

            var inventories = [];
            _.each(this.inventoryIds, function(inventoryId){
                var inventory = new InventoryModel();
                inventory.id = inventoryId;
                inventory.set("published", false);
                inventories.push(inventory);
            });

            Parse.Object.saveAll(inventories, {
                success: function(inventories) {
                    showMessage("Success", "Week menu un-published successfully!");
                },
                error: function(error) {
                    showMessage("Error", "Save inventories failed! Reason: " + error.message);
                }
            });
        },

        showBankInfo: function(ev) {
            var bankId = $(ev.currentTarget).data('id');
            window.location.href='#bank?id=' + bankId;
        },

        showCardInfo: function() {
            //var cardId = $(ev.currentTarget).data('id');
            //window.location.href='#card?id=' + cardId;
            window.location.href='#card';
        },

        toManageRestaurants: function() {
            window.location.href='#manageRestaurants';  
        }
    });
    return ManagerHomeView;
});
