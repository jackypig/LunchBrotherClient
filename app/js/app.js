var config = {
    "appUrl": "https://lunchbrother.com",
//    "appUrl": "http://localhost:63342/public/app/index.html",
    "baseUrl": "js",
    "paths": {
        jquery: 'libs/jquery/jquery-1.11.2.min',
        jquery_ui: 'libs/jquery-ui-1.11.4.custom/jquery-ui.min',
        underscore: 'libs/underscore/underscore-min',
        //backbone: 'libs/backbone/backbone-min',
        parse: 'libs/parse/parse-1.3.2.min',
        stripe: 'libs/stripe/stripe.v2',
        templates: '../templates',
        semantic: 'libs/semantic_2.0/semantic.min',
        facebook: '//connect.facebook.net/en_US/sdk',
        tablesort: 'libs/jquery-tablesort/jquery.tablesort'
    },
    shim: {
        underscore: {
            exports: '_'
        },
        jquery: {
            exports: '$'
        },
        parse: {
            deps: ['jquery', 'underscore'],
            exports: 'Parse'
        },
        'main': ['parse'],
        // 'parse':['jquery', 'underscore'],
        "semantic": ['jquery'],
        "libs/semantic_2.0/gdropdown.min": ["jquery", "semantic"],
        "libs/semantic_2.0/gcheckbox.min": ["jquery", "semantic"],
        "libs/semantic_2.0/gform.min": ["jquery", "semantic"],
		"libs/semantic_2.0/gsidebar.min": ["jquery", "semantic"],
	    "facebook": {
	    	exports: 'FB'
	    },
    }
};

//Permission code
var GENERAL_USER = 1, DRIVER = 2, DISTRIBUTOR = 3, LOCAL_MANAGER = 4, LB_ADMIN = 5;

//Default Grid Id and DP Id
var DEFAULT_DP = "DBR7M5Pw6q";
//var UMCP_GRID_ID = 'nmbyDzTp7m'; //dev
var UMCP_GRID_ID = 'GPOeekfiTI'; //prod

//var STRIPE_KEY = "pk_test_pb95pxk797ZxEFRk55wswMRk"; //dev
var STRIPE_KEY = "pk_live_YzLQL6HfUiVf8XAxGxWv5AkH"; //prod

//Start Order Time and Stop Order Time
var START_ORDER_TIME = function() {
    var current = new Date();
    var startOrderTime;
    if (current.getHours() > 14) {
        startOrderTime = new Date();
        startOrderTime.setHours(14, 0, 0, 0);

    } else {
        startOrderTime = new Date(current.getTime() - 24 * 60 * 60 * 1000);
        startOrderTime.setHours(14, 0, 0, 0);
    }
    return startOrderTime;
};

var STOP_ORDER_TIME = function() {
    var current = new Date();
    var stopOrderTime = new Date();
    if (current.getHours() > 14) {
        stopOrderTime.setHours(23, 59, 59, 59);
    } else {
        stopOrderTime.setHours(10, 30, 0, 0);
    }
    return stopOrderTime;
};

//Inventory Query Times
var INVENTORY_FROM_TIME = function() {
    var current = new Date();
    var fromTime;
    if (current.getHours() >= 14) {
        //After 14:00, display the inventory of the next day
        fromTime = new Date(current.getTime() + 24 * 60 * 60 * 1000);
        fromTime.setHours(10, 0, 0, 0);
    }
    else {
        //Before 14:00, display the inventory of the current day
        fromTime = new Date(current.getTime());
        fromTime.setHours(10, 0, 0, 0);
    }
    return fromTime;
};
var INVENTORY_UNTIL_TIME = function() {
    var current = new Date();
    var untilTime;
    if (current.getHours() >= 14) {
        //After 14:00, display the inventory of the next day
        untilTime = new Date(current.getTime() + 24 * 60 * 60 * 1000);
        untilTime.setHours(13, 0, 0, 0);
    } else {
        //Before 14:00, display the inventory of the current day
        untilTime = new Date();
        untilTime.setHours(13, 0, 0, 0);
    }
    return untilTime;
};

require.config(config);

// Load the main app module to start the app
require(["main"], function(main) {
    main.initialize();
});

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function showMessage(title, message, callback) {
    $("#alertTitle").text(title);
    $("#alertMessage").text(message);
    $('#alertDialog').modal({
        closable: false,
        onApprove: function () {
            if (callback != undefined && callback != null) {
                callback.call(this);
            }
        }
    }).modal('show');
}
