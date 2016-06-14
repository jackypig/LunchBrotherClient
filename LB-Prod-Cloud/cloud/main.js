var express = require('express');
var app = express();
var STRIPE_KEY = "sk_live_NmS6fDdb0AKJ6ajHw3rXmxun";

// Global app configuration section
app.use(express.bodyParser());  // Populate req.body
app.post('/receiveSMS',
    function(req, res) {
        console.log("Received text: " + req.body.Body + " From: " + req.body.From);
        res.send('Success');

        var repliedText = req.body.Body.toUpperCase();
        if (repliedText === "YES" || repliedText === "Y") {
            Parse.Cloud.run('updateRecords', {
                fromNumber: req.body.From

            }, {
                success: function () {
                    console.log("Records updated!");
                },

                error: function (error) {
                    console.log("Fail to update records. Reason: " + error.message);
                }
            });
            twilioSMSService(req.body.From, "Thank you for your confirmation!");

        }  else {
            //TODO - Update Records too
            console.log("No key words matched!");
        }
    });

app.listen();

Parse.Cloud.define("updateRecords",
    function (request, response) {
        var incomingNumber = request.params.fromNumber;
        var confirmModel = Parse.Object.extend("SMSConfirmRecord");
        var confirmQuery = new Parse.Query(confirmModel);
        confirmQuery.equalTo("sentToNumber", incomingNumber.substring(2));
        confirmQuery.equalTo("confirmStatus", "PENDING");
        confirmQuery.descending("createdAt");
        confirmQuery.find({
            success: function(records) {
                for (var i=0; i<records.length; i++) {
                    if (i === 0) {
                        updateSMSandInventoryStatus(records[i], "CONFIRMED", "Confirmed");
                    } else {
                        updateSMSandInventoryStatus(records[i], "UNCONFIRMED", "Unconfirmed");
                    }
                }

                notifyLBMenuConfirmed(incomingNumber);
                slackLunchBrother("#sms", "SMS Confirmed by " + incomingNumber, "EOM", ":inbox_tray:");
                //response.success("SMS and Inventory updated!");
            },
            error: function(error) {
                response.error("Fail to query inventory! Reason: " + error.message);
            }
        })
    }
);

function slackLunchBrother(channel, username, text, icon) {
    Parse.Cloud.httpRequest({
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        url: 'https://hooks.slack.com/services/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',
        body: {
            channel: channel,
            username: username,
            text: text,
            icon_emoji: icon
        },
        success: function (success) {
            console.log("Slacked LunchBrother #sms channel!");
        },
        error: function (error) {
            console.log("Error in slacking LunchBrother #sms. Reason: " + error.message);
        }
    });
}

function updateSMSandInventoryStatus(record, recordStatus, inventoryStatus) {
    record.set('confirmStatus', recordStatus);
    record.save();

    if (recordStatus === "CONFIRMED") {
        var inventoryIds = record.get('inventoryIds');
        for (var j=0; j<inventoryIds.length; j++) {
            console.log(inventoryIds[j]);
            var inventoryModel = Parse.Object.extend("Inventory");
            var inventoryQuery = new Parse.Query(inventoryModel);
            inventoryQuery.get(inventoryIds[j], {
                success:function(inventory) {
                    console.log(inventory);
                    inventory.set('status', inventoryStatus);
                    inventory.save();
                },
                error: function(error) {
                    console.log(error.message);
                }
            });
        }
    }
}

Parse.Cloud.define("pay",
    function (request, response) {
        var Stripe = require("stripe");
        Stripe.initialize(STRIPE_KEY);
        var tempAmount = request.params.totalCharge * 100;
        var params = {
            amount: tempAmount.toFixed(0),
            currency: "usd"
        };
        if (request.params.paymentToken) {
            params.card = request.params.paymentToken;
        }
        else {
            params.customer = request.params.customerId;
        }
        Stripe.Charges.create(params, {
                success: function (httpResponse) {
                    response.success("Purchase made!");
                }
                ,
                error: function (httpResponse) {
                    response.error("Error: " + httpResponse.message + "\n" + "Params:\n" + request.params.stripeToken + "," + request.params.amount);
                }
            }
        );
    }
);
Parse.Cloud.define("saveCard", function (request, response) {
    var Stripe = require("stripe");
    Stripe.initialize(STRIPE_KEY);
    var last4Digit = request.params.last4Digit;
    Stripe.Customers.create({
        card: request.params.card,
        description: Parse.User.current().get('username') + ' - ' + last4Digit
    }).then(function (customer) {
        console.log('Stripe customer created with info', customer);
        var Card = Parse.Object.extend("Card");
        var card = new Card();
        card.set("customerId", customer.id);
        card.set("createdBy", Parse.User.current());
        card.set("last4Digit", last4Digit);
        card.save();
        response.success(customer.id);
    });
});

Parse.Cloud.define("saveRecipient", function (request, response) {
    createRecipient({
        params: {
            name: request.params.name,
            type: request.params.type,
            bankAccount: request.params.bankAccount,
            email: request.params.email
        },
        success: function (httpResponse) {
            var BankAccount = Parse.Object.extend("BankAccount");
            var bankAccount = new BankAccount();
            bankAccount.set("recipientId", httpResponse.data.id);
            bankAccount.set("type", request.params.type);
            bankAccount.set("createdById", request.params.createdById);
            bankAccount.set("last4DigitAccount", request.params.last4DigitForAccountNumber);
            bankAccount.set("accountNumber", request.params.accountNumber);
            bankAccount.set("routingNumber", request.params.routingNumber);
            bankAccount.save({
                success: function(bankInfo) {
                    response.success(bankInfo);
                },
                error: function(error) {
                    response.error(error.message);
                }
            });
        },
        error: function (httpResponse) {
            response.error(httpResponse);
        }
    });
});

function createRecipient(options) {
    Parse.Cloud.httpRequest({
        method: 'POST',
        url: 'https://sk_live_NmS6fDdb0AKJ6ajHw3rXmxun:@api.stripe.com/v1/recipients?' +
        'name=' + encodeURI(options.params.name) +
        '&type=' + options.params.type +
        '&bank_account=' + options.params.bankAccount +
        '&email=' + options.params.email,
        success: options.success,
        error: options.error
    });
}

Parse.Cloud.define("email",
    function (request, response) {
        /*var Mandrill = require('mandrill');
         Mandrill.initialize('JRaXC3NG1BqZ_JWDnjX8gA');*/
        var paymentId = request.params.paymentId;
        var paymentModel = Parse.Object.extend("Payment");
        var payQuery = new Parse.Query(paymentModel);
        payQuery.include('pickUpLocation');
        payQuery.include('pickUpLocation.distributor');
        payQuery.include('pickUpLocation.manager');
        payQuery.get(paymentId, {
            success: function (paymentDetail) {
                var emailAddress = paymentDetail.get('email');
                var fname = paymentDetail.get('fname');
                var lname = paymentDetail.get('lname');
                var totalPrice = paymentDetail.get('totalPrice');
                var address = paymentDetail.get('pickUpLocation').get('address');

                var contactPerson;
                if (paymentDetail.get('pickUpLocation').get('distributor')) {
                    contactPerson = paymentDetail.get('pickUpLocation').get('distributor');

                } else {
                    contactPerson = paymentDetail.get('pickUpLocation').get('manager');
                }

                var contactInfo = contactPerson.get('firstName') + " " + contactPerson.get('lastName') + " - " + contactPerson.get('telnum');
                var OrderModel = Parse.Object.extend("Order");
                var orderQuery = new Parse.Query(OrderModel);
                orderQuery.equalTo("paymentId", paymentDetail);
                orderQuery.include("dishId");
                orderQuery.find({
                    success: function(orders) {
                        var dishSummary = "";

                        for (var i=0; i<orders.length; i++) {
                            if (i == 0) {
                                dishSummary = orders[i].get('dishId').get('dishName') + " - " + orders[i].get('quantity');
                            } else {
                                dishSummary += "; " + orders[i].get('dishId').get('dishName') + " - " + orders[i].get('quantity');
                            }
                        }

                        sendEmail({
                            message: {
                                html: '<p style="position: relative" align="middle"><b><big>' + fname + '</big></b></p><p style="position: relative" align="middle"><b><big>Thank you for placing your order at <a href="http://www.lunchbrother.com" style="color: blue">lunchbrother.com</a>!</big></b></p>' +
                                '<table border="0" cellpadding="10" align="center" style="position: relative">' +
                                '<tr><th align="right" width="30%">OrderNumber:</th>' +
                                '<td>' + paymentId + '</td>' + '</tr>' + '<tr>' +
                                '<th align="right">Dish:</th>' +
                                '<td>' + dishSummary + '</td>' +
                                '</tr>' +
                                '<tr>' +
                                '<th align="right">Total Price: </th>' +
                                '<td>' + totalPrice + '</td>' +
                                '</tr>' +
                                '<tr>' +
                                '<th align="right "> Pick-Up Address:</th>' +
                                '<td>' + address + '</td>' +
                                '</tr>' +
                                '<tr>' +
                                '<th align="right">Pick-Up Time:</th>' +
                                '<td> 12:00PM-12:30PM* Weekdays </td>' +
                                '</tr>' +
                                '<tr>' +
                                '<th align="right">Contact Info</th>' +
                                '<td>' + contactInfo + '</td>' +
                                '</tr>' +
                                '</table>' +
                                '<p align="middle" style="position:relative;  color: red">*Please <a href="www.lunchbrother.com/#status">check the delivery status on Lunchbrother</a> to find the specific pick-up start time.</p>' +
                                '<p align="middle" style="position:relative;  color: red">**No pick-up later than <a style="color: blue;">12:30PM</a>, please manage well your pick-up time.' +
                                '</p>',
                                subject: "Notification: your lunch is on your way",
                                from_email: "orders@lunchbrother.com",
                                from_name: "LunchBrother",
                                to: [{
                                    email: emailAddress,
                                    name: lname + "," + fname
                                }],
                                inline_css: true,
                            },
                            success: function (httpResponse) { response.success("Email sent!"); },
                            error: function (httpResponse) { response.error("Uh oh, something went wrong"); }
                        });
                    },
                    error: function(error) {
                        console.log("Error finding orders: Reason: " + error.message);
                    }
                });
            },
            error: function (object, error) {
                // The object was not retrieved successfully.
                // error is a Parse.Error with an error code and message.
                console.log(error.message);
            }
        });
    });

Parse.Cloud.define("emailNotification",
    function (request, response) {
        var pickUpLocationId = request.params.pickUpLocationId;
        var orders = request.params.ordersToSend;

        var PickUpLocation = Parse.Object.extend("PickUpLocation");
        var pickUpLocationQuery = new Parse.Query(PickUpLocation);
        pickUpLocationQuery.include("distributor");
        pickUpLocationQuery.get(pickUpLocationId).then(function(pickUpLocation) {
            var pickupAddress = pickUpLocation.get('address');
            var distributor = pickUpLocation.get('distributor');
            var contactInfo = distributor.get('firstName') + " " + distributor.get('lastName') + " (" + distributor.get('telnum') + ") ";

            //var addressDetails = "Regents Drive Parking Garage, College Park, MD 20740";
            //var addressNotes = "Meter space, Ground Floor, next to the elevator in the South-East corner.";

            var emailArray = []; //array of recipients
            emailArray[0] = {
                email: "jackypig0906@gmail.com",
                name: "Hung, Ling"
            };

            //emailArray[1] = {
            //    email: "ling@xappmedia.com",
            //    name: "Hung, Ling"
            //};
            //
            //emailArray[2] = {
            //    email: "ling2@xappmedia.com",
            //    name: "Wrong, Email"
            //};

            for (var i = 0; i < orders.length; i++) {
                var emailInfo = orders[i].split(",");
                var fname = emailInfo[0];
                var lname = emailInfo[1];
                var email = emailInfo[2];

                emailArray[i+1] = {
                    email: email,
                    name: lname + "," + fname
                }
            }

            return sendEmail({
                message: {
                    html: '<p style="position: relative" align="middle"><b><big>Dear Customer,</big></b></p>' +
                    '<p style="position: relative" align="middle"><b><big>Thank you for ordering at <a href="http://www.lunchbrother.com" style="color: blue">lunchbrother.com</a>!</big></b></p>' +
                    '<p style="position: relative" align="middle"><b><big>Your lunch is ready for picking up!</big></b></p>' +
                    '<table style="position: relative" cellpadding="10" align="center">' +
                    '<tr>' +
                    '<th align="right " width="30%">Pick-Up Address:</th>' +
                    '<td>' + pickupAddress + '</td>' +
                    '</tr>' +
                        //'<tr>' +
                        //'<td>&nbsp;</td>' +
                        //'<td>' + addressNotes + '</td>' +
                        //'</tr>' +
                    '<tr>' +
                    '<th align="right">Contact Info</th>' +
                    '<td>' + contactInfo + '</td>' +
                    '</tr>' +
                    '</table>' +
                    '<p style="color: red; position: relative" align="middle">***No pick-up later than <a style="color: blue">12:30PM</a>, please manage well your pick-up time***</p>',
                    subject: "Notification: your lunch is ready to pick up",
                    from_email: "orders@lunchbrother.com",
                    from_name: "LunchBrother",
                    to: emailArray,
                    inline_css: true,
                    preserve_recipients: false
                },
                success: function (httpResponse) {
                    return httpResponse;
                },
                error: function (httpResponse) {
                    return httpResponse;
                }
            });

        }).then(function(httpResponse){
            slackLunchBrother("@jackypig", "Pick-up notification sent successfully!", "EOM", ":email:");
            response.success("Pick-up notification sent successfully!");

        }, function(httpResponse) {
            response.error("Pick-up notification sent failed!");
        });
    });

Parse.Cloud.define("emailResetPasswordLink",
    function (request, response) {
        var fname = request.params.firstName;
        var email = request.params.emailAddress;
        var verificationLink = request.params.verificationLink;
        sendEmail({
            message: {
                html: '<p style="position: relative" align="middle"><b><big>' + fname + '</big></b> </p>' +
                '<p style="position: relative" align="middle"><b><big>You have requested to reset your password, please click the following link and proceed to reset your password.</big></b></p>' +
                '<p style="position: relative" align="middle"><b><big><a href="' + verificationLink + '" style="color: blue">' + verificationLink + '</a></big></b></p>',
                subject: "Reset your password for your LunchBrother account",
                from_email: "orders@lunchbrother.com",
                from_name: "LunchBrother",
                to: [{
                    email: email
                }],
                inline_css: true
            },
            success: function (httpResponse) { response.success("Verification link sent!"); },
            error: function (httpResponse) { response.error("Uh oh, something went wrong"); }
        });
    });

function sendEmail(options) {
    Parse.Cloud.httpRequest({
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        url: 'https://mandrillapp.com/api/1.0/messages/send.json',
        body: {
            key: "JRaXC3NG1BqZ_JWDnjX8gA",
            message: options.message
        },
        success: options.success,
        error: options.error
    });
}

Parse.Cloud.define("sms",
    function (request, response) {
        var targetNumber = request.params.targetNumber;
        var messageBody = request.params.messageBody;

        twilioSMSService('+1' + targetNumber, messageBody);
    }
);

Parse.Cloud.job("summarizeTodaySales", function(request, status) {
    var current = new Date();
    if (current.getDay() != 6 && current.getDay() != 0) {
        var TransferModel = Parse.Object.extend("Transfer");

        //Sum up Today's Sales
        var paymentModel = Parse.Object.extend("Payment");
        var paymentQuery = new Parse.Query(paymentModel);

        var startOrderTime = new Date(current.getTime() - 24 * 60 * 60 * 1000);
        startOrderTime.setHours(19, 0, 0, 0);

        var stopOrderTime = new Date();
        stopOrderTime.setHours(15, 30, 0, 0);

        paymentQuery.greaterThan("createdAt", startOrderTime);
        paymentQuery.lessThan("createdAt", stopOrderTime);
        paymentQuery.find({
            success: function(payments) {
                // Only count credit card payment
                var todayIncome = 0;
                var payByCardCount = 0;
                for (var i=0; i<payments.length; i++) {
                    if (payments[i].get('paymentMethod') === "Credit Card") {
                        payByCardCount++;
                        todayIncome += payments[i].get('totalPrice');
                    }
                }
                var stripeFee = todayIncome * 0.029 + payByCardCount * 0.3;
                summarizeSalesOfToday(TransferModel, todayIncome, stripeFee);
            },
            error: function(error) {
                console.log(error.message);
            }
        });
    }
});

function summarizeSalesOfToday (TransferModel, todayIncome, stripeFee) {
    //Inventory of today
    var beginOfToday = new Date();
    beginOfToday.setHours(0, 0, 0, 0);
    var endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 59);

    var inventoryModel = Parse.Object.extend("Inventory");
    var inventoryQuery = new Parse.Query(inventoryModel);
    inventoryQuery.greaterThan("pickUpDate", beginOfToday);
    inventoryQuery.lessThan("pickUpDate", endOfToday);
    inventoryQuery.include("orderBy");
    inventoryQuery.include("dish");
    inventoryQuery.include("dish.restaurant");
    inventoryQuery.find({
        success: function(inventories) {
            //Summarize today's sale by querying inventory and create transfer queue for restaurants and local managers
            var transfers = [];
            var managerTransferRecord = {};

            if (inventories) {
                for (var i=0; i<inventories.length; i++) {
                    var orderById = inventories[i].get('orderBy').id;
                    if (orderById in managerTransferRecord) {
                        managerTransferRecord[orderById].transferAmount += inventories[i].get('payByCardCount') * inventories[i].get('price')

                    } else {
                        managerTransferRecord[orderById] = {
                            manager: inventories[i].get('orderBy'),
                            transferAmount: inventories[i].get('payByCardCount') * inventories[i].get('price')
                        }
                    }
                }

                var transferSummaryMessage = "";

                //Managers' Cut
                for (var record in managerTransferRecord) {
                    var managerTransfer = new TransferModel();
                    var managerCut = managerTransferRecord[record].transferAmount * 0.92;
                    managerTransfer.set('amount', Number(managerCut.toFixed(2)));
                    managerTransfer.set('manager', managerTransferRecord[record].manager);
                    managerTransfer.set("transferred", false);
                    transfers.push(managerTransfer);

                    transferSummaryMessage += managerTransferRecord[record].manager.get('firstName') + " - $" + managerCut.toFixed(2) + ", "
                }

                //LunchBrother's Cut
                var lbTransfer = new TransferModel();
                var lbAmount = todayIncome * 0.08 - stripeFee;    //LunchBrother takes 8% of the total sales
                lbTransfer.set('amount', Number(lbAmount.toFixed(2)));
                lbTransfer.set("transferred", false);
                transfers.push(lbTransfer);

                transferSummaryMessage += "LunchBrother - $" + lbAmount.toFixed(2) + " (Total - $" + todayIncome.toFixed(2) + ", Stripe Fee - $" + stripeFee.toFixed(2) + ")";


                Parse.Object.saveAll(transfers, {
                    success: function(transfers) {
                        slackLunchBrother("@jackypig", "Save transfer records successfully!", transferSummaryMessage, ":moneybag:");
                    },
                    error: function(error) {
                        console.log('Save transfer records failed! Reason: ' + error.message);
                    }
                });
            }
        },
        error: function(error) {
            console.log(error.message);
        }
    });
}

Parse.Cloud.job("transfer", function(request, status) {
    var current = new Date();
    if (current.getDate() === 1 || current.getDate() === 15) {
        createTransfer();
    } else {
        status.success("Nothing to transfer!")
    }
});

function createTransfer() {
    var TransferModel = Parse.Object.extend("Transfer");
    var transferQuery = new Parse.Query(TransferModel);
    transferQuery.include("manager");
    transferQuery.equalTo("transferred", false);
    transferQuery.find({
        success: function(transfers) {
            if (transfers.length > 0) {
                var lbKey = "LunchBrother";
                var transferRecordMap = {};

                for (var i=0; i<transfers.length; i++) {
                    addTransferRecord(transferRecordMap, transfers[i], lbKey);
                }

                for (var target in transferRecordMap) {
                    if (target === lbKey) {
                        startTransfer(transferRecordMap[target], "self", Object.keys(transferRecordMap).length);

                    } else {
                        //Query bankAccount for createdBy to get recipientId and initiate the transfer
                        var bankAccountModel = Parse.Object.extend("BankAccount");
                        var bankAccountQuery = new Parse.Query(bankAccountModel);
                        bankAccountQuery.equalTo("createdById", target);  // target === transfers[0].get('manager').id
                        bankAccountQuery.descending("createdAt");
                        bankAccountQuery.first({                          // Get the latest one
                            success: function(bankAccount){
                                startTransfer(transferRecordMap[target], bankAccount.get("recipientId"), Object.keys(transferRecordMap).length);

                            },
                            error: function(error){
                                console.log(error.message);
                            }
                        });
                    }
                }

            } else {
                console.log("Nothing to transfer!");
                //Do nothing
            }
        },
        error: function(error) {
            console.log('Find transfer records failed! Reason: ' + error.message);
        }
    });
}

function addTransferRecord(transferRecordMap, transfer, lbKey) {
    var target, name;

    if (transfer.get('manager')) {
        target = transfer.get('manager').id;
        name = transfer.get('manager').get('firstName');

    } else {
        target = lbKey;
        name = lbKey;

    }

    transfer.set('transferred', true);
    if (transferRecordMap[target]) {
        transferRecordMap[target].amount += transfer.get('amount');
        transferRecordMap[target].transfers.push(transfer);

    } else {
        transferRecordMap[target] = {
            name: name,
            amount: transfer.get('amount'),
            transfers: [transfer]
        };
    }
}

function startTransfer(transferObject, recipient, numberOfTransferObjects) {
    if (transferObject.amount > 0) {
        var transferAmount = transferObject.amount * 100;
        if (recipient === "self") {
            transferAmount -= 50 * (numberOfTransferObjects - 1);
        }

        transfer({
            params: {
                currency: "usd",
                amount: transferAmount.toFixed(0),
                recipient: recipient
            },
            success: function (httpResponse) {
                slackLunchBrother("#co-founders", "Transfer money successfully!", "Target - " + transferObject.name + ", Amount - $" + transferAmount.toFixed(0) / 100 + ", Number of transfer records: " + transferObject.transfers.length, ":money_with_wings:");

                Parse.Object.saveAll(transferObject.transfers, {
                    success: function(transfers) {
                        console.log("Update transfer records successfully!");
                    },
                    error: function(error) {
                        console.log('Save transfer records failed! Reason: ' + error.message);
                    }
                });
            },
            error: function (httpResponse) {
                console.log(httpResponse);
            }
        });
    }
}

Parse.Cloud.define("addFundsImmediatelyForTest",
    function (request, response) {
        var Stripe = require("stripe");
        Stripe.initialize('sk_test_aslYgXx9b5OXsHKWqw3JxDCC');
        var params = {
            amount: 10000,
            currency: "usd",
            card: 4000000000000077,
            customer: "cus_6M8Um7v2nAO17z"
        };
        Stripe.Charges.create(params, {
                success: function (httpResponse) {
                    response.success("Funds added!");
                },
                error: function (httpResponse) {
                    response.error("Error: " + httpResponse.message);
                }
            }
        );
    }
);

Parse.Cloud.define("testTransfer", function(request, response) {
    transfer({
        params: {
            currency: "usd",
            amount: "100",
            recipient: "self"
        },
        success: function (httpResponse) { response.success(httpResponse.message); },
        error: function (httpResponse) { response.error(httpResponse.message); }
    });
});

function transfer(options) {
    Parse.Cloud.httpRequest({
        method: 'POST',
        url: 'https://sk_live_NmS6fDdb0AKJ6ajHw3rXmxun:@api.stripe.com/v1/transfers?' +
        'currency=' + options.params.currency +
        '&amount=' + options.params.amount +
        '&recipient=' + options.params.recipient,
        success: options.success,
        error: options.error
    });
}

Parse.Cloud.job("weeklySMS", function(request, status) {
    //Assemble SMS Message
    var message = "Monday again, start a new fresh week w/ www.lunchbrother.com! Order by 10:25 and enjoy lunch at noon-12:30! *Could disable this reminder in ur profile page.";

    // Query for all users
    var userQuery = new Parse.Query(Parse.User);
    userQuery.each(function(user) {
        //TODO - check if telnum is undefined
        if(user.get('username') === 'jackypig0906@gmail.com') {
            status.message("Send SMS to " + user.get("telnum") + " phone.");
            return twilioSMSService(user.get('telnum'), message);
        }
    }).then(function() {
        // Set the job's success status
        status.success("SMS message sent.");
    }, function(error) {
        // Set the job's error status
        status.error("Uh oh, something went wrong.");
    });
});

Parse.Cloud.job("dailyOrderConfirmationSMS", function(request, status) {
    findInventoriesThensendSMS(0, "PICK_UP_TIME");
});

// TODO - Schedule this job to 10:35AM EST (15:35) every day
Parse.Cloud.job("orderQuantityNotificationSMS", function(request, status) {
    findInventoriesThensendSMS(0, "PICK_UP_QUANTITY");
});

Parse.Cloud.define("manuallySendConfirmationSMS", function(request, response) {
    findInventoriesThensendSMS(request.params.targetDate, request.params.smsType);
});

function findInventoriesThensendSMS(targetDate, smsType) {
    //Target date to confirm
    var lowerBoundPickUpTime = new Date();
    var confirmDateOffset = 7;
    if (smsType === "PICK_UP_QUANTITY") {
        confirmDateOffset = 0;  // Because cloud code is in UTC
    }
    lowerBoundPickUpTime.setHours(14, 0, 0, 0);

    if (targetDate === 0) {
        lowerBoundPickUpTime.setDate(lowerBoundPickUpTime.getDate() + confirmDateOffset);

    } else {
        lowerBoundPickUpTime.setDate(targetDate);

    }

    var upperBoundPickUpTime = new Date();
    upperBoundPickUpTime.setHours(18, 0, 0, 0);
    upperBoundPickUpTime.setDate(lowerBoundPickUpTime.getDate());
    console.log("Inventory query period: " + lowerBoundPickUpTime + " - " + upperBoundPickUpTime);

    var inventoryModel = Parse.Object.extend("Inventory");
    var inventoryQuery = new Parse.Query(inventoryModel);
    inventoryQuery.greaterThan("pickUpDate", lowerBoundPickUpTime);
    inventoryQuery.lessThan("pickUpDate", upperBoundPickUpTime);
    inventoryQuery.include("dish");
    inventoryQuery.include("dish.restaurant");
    inventoryQuery.include("pickUpLocation");
    inventoryQuery.include("pickUpLocation.manager");
    inventoryQuery.find({
        success: function(inventories) {
            console.log("Inventory Number: " + inventories.length);
            var managerInventoryMap = {};
            if (inventories.length > 0) {
                for (var i=0; i<inventories.length; i++) {
                    var managerFirstName = inventories[i].get('pickUpLocation').get('manager').get('firstName');
                    if (managerInventoryMap[managerFirstName]) {
                        managerInventoryMap[managerFirstName].push(inventories[i]);

                    } else {
                        managerInventoryMap[managerFirstName] = [inventories[i]];
                    }
                }

                for (var name in managerInventoryMap) {
                    if (smsType === "PICK_UP_QUANTITY") {
                        var message = name + " will pickup ";

                    } else {
                        var message = name + " requires orders: ";

                    }

                    var messagePickUpTime;
                    var messageQuantity = "";
                    var confirmNumber;
                    var restaurantName = "";
                    var managerName = "";
                    var inventoryIds = [];
                    var dishMap = {};
                    for (var i=0; i<managerInventoryMap[name].length; i++) {
                        var inventory = managerInventoryMap[name][i];
                        inventoryIds.push(inventory.id);
                        var pickUpDateTime = new Date(inventory.get('pickUpDate'));
                        var year = pickUpDateTime.getFullYear();
                        var month = pickUpDateTime.getMonth() + 1;
                        var day = pickUpDateTime.getDay();
                        var date = pickUpDateTime.getDate();
                        var hour = pickUpDateTime.getHours() - 5; //TODO - Need to somehow include time zone
                        var minute = (pickUpDateTime.getMinutes()<10 ? '0':'') + pickUpDateTime.getMinutes();

                        if (confirmNumber === undefined) {
                            confirmNumber = inventory.get('dish').get('restaurant').get('confirmNumber');
                        }

                        if (messagePickUpTime === undefined) {
                            var dayLabel = getDayLabel(day);
                            if (smsType === "PICK_UP_QUANTITY") {
                                messagePickUpTime = " at " + hour + ":" + minute + "AM Today. Reply \"yes\" to confirm.";

                            } else {
                                messagePickUpTime = " on " + dayLabel + " " + month + "/" + date + "/" + year + ". Reply \"yes\" to acknowledge";
                            }
                        }

                        if (!restaurantName) {
                            restaurantName = inventory.get('dish').get('restaurant').get('name');
                        }

                        if (!managerName) {
                            managerName = inventory.get('dish').get('restaurant').get('managerName');
                        }

                        if (smsType === "PICK_UP_QUANTITY") {
                            if (!dishMap[inventory.get('dish').id]) {
                                dishMap[inventory.get('dish').id] = {
                                    dishLabel: inventory.get('dish').get('dishName') + " (" + inventory.get('dish').get('dishCode') + ")",
                                    orderCount: inventory.get('totalOrderQuantity')
                                }
                            } else {
                                dishMap[inventory.get('dish').id].orderCount += inventory.get('totalOrderQuantity');
                            }

                        } else {
                            messageQuantity += ' ,"' + inventory.get('dish').get('dishCode') + '"';
                        }
                    }

                    if (smsType === "PICK_UP_QUANTITY") {
                        for (var key in dishMap) {
                            if (!messageQuantity) {
                                messageQuantity = dishMap[key].dishLabel + " - " + dishMap[key].orderCount;
                            } else {
                                messageQuantity += ", " + dishMap[key].dishLabel + " - " + dishMap[key].orderCount;
                            }
                        }
                    }

                    message +=  messageQuantity + messagePickUpTime;

                    twilioSMSService(confirmNumber, message);
                    //twilioSMSService("2022039808", message);  // Yali's phone number
                    //twilioSMSService("7179822078", message);  // Jack's phone number

                    var ConfirmRecord = Parse.Object.extend("SMSConfirmRecord");
                    var confirmRecord = new ConfirmRecord();

                    confirmRecord.set("inventoryIds", inventoryIds);
                    confirmRecord.set("sentToNumber", confirmNumber);
                    confirmRecord.set("confirmStatus", "PENDING");
                    confirmRecord.set("smsType", smsType);

                    confirmRecord.save();
                    console.log("SMS sent to " + confirmNumber + "! Message: " + message);

                    // Slack sms message copy to LunchBrother sms channel
                    slackLunchBrother("#sms", "SMS Sent to " + confirmNumber + " (" + restaurantName + ") ", "Message Content: " + message, ":outbox_tray:");
                }

            } else {
                console.log("Nothing to send!");
            }
        },
        error: function(error) {
            console.log("Fail to query inventory! Reason: " + error.message);
        }
    })
}

function getDayLabel(day) {
    var label;
    switch (day) {
        case 1:
            label = "Mon";
            break;
        case 2:
            label = "Tue";
            break;
        case 3:
            label = "Wed";
            break;
        case 4:
            label = "Thu";
            break;
        case 5:
            label = "Fri";
            break;
        case 6:
            label = "Sat";
            break;
        default :
            label = "Sun";
            break;
    }

    return label;
}

function twilioSMSService(targetNumber, messageBody) {
    Parse.Config.get({
        success: function(config) {
            // Require and initialize the Twilio module with your credentials
            var client = require('twilio')(config.get('twilioAccountSid'), config.get('twilioAuthToken'));

            // Send an SMS message
            client.sendSms({
                    to: targetNumber,
                    from: '+18082022277',
                    body: messageBody
                }, {
                    success: function (httpResponse) {
                        console.log("SMS sent to " + targetNumber + "!");
                    },
                    error: function (httpResponse) {
                        console.log("Uh oh, something went wrong");
                    }
                }
            );
        },
        error: function(error) {
            console.log("Error in getting configs! Reason: " + error.message);
        }
    });
}

function sendSMSCopyToLBEmail(message, confirmNumber, managerName, restaurantName) {
    sendEmail({
        message: {
            html:
            '<p style="position: relative" align="middle"><b><big>The following is the info of this message:</big></b></p>' +
            '<table style="position: relative" cellpadding="10" align="center">' +
            '<tr>' +
            '<th align="right " width="30%">Message Content</th>' +
            '<td>' + message + '</td>' +
            '</tr>' +
            '<tr>' +
            '<th align="right">Sent To</th>' +
            '<td>' + managerName + '</td>' +
            '</tr>' +
            '</table>',
            subject: "Notification: SMS Message Has Been Sent to " + confirmNumber + " (" + restaurantName + ") ",
            from_email: "orders@lunchbrother.com",
            from_name: "LunchBrother",
            to: [{
                email: "yalipan@lunchbrother.com",
                name: "LunchBrother LLC"
            }],
            inline_css: true
        },
        success: function (httpResponse) {
            console.log("Email sent to Yali!");
        },
        error: function (httpResponse) {
            console.log("Uh oh, something went wrong! Reason: " + httpResponse.message);
        }
    });
}

function notifyLBMenuConfirmed(fromNumber) {
    sendEmail({
        message: {
            html: '<p style="position: relative" align="middle"><b><big>EOM</big></b></p>',
            subject: "Notification: SMS Message Has Been Confirmed by " + fromNumber,
            from_email: "orders@lunchbrother.com",
            from_name: "LunchBrother",
            to: [{
                email: "yalipan@lunchbrother.com",
                name: "LunchBrother LLC"
            }],
            inline_css: true
        },
        success: function (httpResponse) {
            console.log("Notified Yali!");
        },
        error: function (httpResponse) {
            console.log("Uh oh, something went wrong! Reason: " + httpResponse.message);
        }
    });

}

Parse.Cloud.define("updateUser", function (request, response) {
    var user = new Parse.User();
    Parse.Cloud.useMasterKey();
    user.id = request.params.userId;
    user.set("username", request.params.email);
    user.set("password", request.params.password);
    user.set("firstName", request.params.firstName);
    user.set("lastName", request.params.lastName);
    user.set("email", request.params.email);
    user.set("telnum", Number(request.params.telnum));
    user.set("permission", Number(request.params.permission));
    user.set("gridId", {
        __type: "Pointer",
        className: "Grid",
        objectId: request.params.gridId
    });

    if (request.params.imageFile) {
        user.set("imageFile", request.params.imageFile);
    }

    user.save(null, {
        success: function(user) {
            response.success("Update user successfully!");
        },
        error: function(error) {
            response.error(error.message);
        }
    });
});

Parse.Cloud.define("deleteUser", function (request, response) {
    var userId = request.params.userId;
    Parse.Cloud.useMasterKey();
    var user = new Parse.User();
    user.id = userId;
    user.destroy({
        success: function() {
            response.success("Delete user successfully!");
        },
        error: function(error) {
            response.error(error.message);
        }
    });
});

Parse.Cloud.define("saveResetKeyForUser", function (request, response) {
    var email = request.params.emailAddress;
    var resetKey = request.params.resetKey;
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(Parse.User);
    query.equalTo("username", email);
    query.first({
        success: function (user) {
            if (user == null || user == undefined) {
                response.error("This email address is not in our system, please verify the email address and try again.");
            } else {
                user.set("resetKey", resetKey);
                user.save();
                response.success(user);
            }
        },
        error: function (error) {
            response.error(error.message);
        }
    });
});

Parse.Cloud.define("matchResetKey", function (request, response) {
    var resetLinkKey = request.params.resetKey;
    var userId = request.params.userId;
    getUser(userId).then(
        function (user) {
            var resetKey = user.get('resetKey');
            if (resetLinkKey == resetKey) {
                response.success(user);
            }
        },
        function (error) {
            response.error(error);
        }
    );
});

function getUser(userId){
    Parse.Cloud.useMasterKey();
    var userQuery = new Parse.Query(Parse.User);
    userQuery.equalTo("objectId",userId);
    return userQuery.first({
        success:function(userRetrieved){
            return userRetrieved;
        },
        error: function(error){
            return error;
        }
    });
};


Parse.Cloud.define("saveNewPassword", function (request, response) {
    var userId = request.params.userId;
    var password = request.params.password;
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(Parse.User);
    query.get(userId, {
        success: function (user) {
            user.set("password", password);
            user.set("resetKey", null);
            user.save();
            response.success();
        },
        error: function (error) {
            response.error(error.message);
        }
    });
});

function getSequence(callback) {
    var Test = Parse.Object.extend("Sequence");
    var query = new Parse.Query(Test);
    query.get("xIZdCZIeff", {
            success: function (object) {
                object.increment('sequence');
                object.save(null, {
                        success: function (object) {
                            callback(object.get('sequence'));
                        }
                        ,
                        error: function (object,
                                         error) {
                            callback(undefined);
                        }
                    }
                );
            }
            ,
            error: function (error) {
                console.log(error);
                callback(undefined);
            }
        }
    );
}
function getCurrentSequence(callback) {
    var Test = Parse.Object.extend("Sequence");
    var query = new Parse.Query(Test);
    query.get("lQyJu5P86j", {
            success: function (object) {
                callback(object.get('sequence'));
            }
            ,
            error: function (error) {
                callback(undefined);
            }
        }
    );
}
Parse.Cloud.beforeSave("Payment",
    function (request, response) {
        if (request.object.isNew()) {
            getSequence(function (sequence) {
                    if (sequence) {
                        request.object.set("orderId", sequence);
                        response.success();
                    }
                    else {
                        response.error('Could not get a sequence.');
                    }
                }
            );
        }
        else {
            response.success();
        }
    }
);

Parse.Cloud.beforeSave(Parse.User, function (request, response) {

    // If a new user is about to be created and it has a referredBy user, 
    // then increase the referredBy user's credit by 10
    if (request.object.isNew() && request.object.get('referredBy')) {
        Parse.Cloud.useMasterKey();
        var query = new Parse.Query(Parse.User);
        query.get(request.object.get('referredBy').id, {
            success: function (referredBy) {
                referredBy.set('creditBalance', referredBy.get('creditBalance') + 10);
                referredBy.save();
                response.success();
            },
            error: function (error) {
                response.error('Invitation link is not correct.');
            }
        });
    } else {
        response.success();
    }
});