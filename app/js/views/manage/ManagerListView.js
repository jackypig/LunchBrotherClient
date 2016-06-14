define([
    'text!templates/manage/managerListTemplate.html'

    ], function (managerListTemplate) {

      var ManagerListView = Parse.View.extend({

          el: $("#page"),

          events: {
              'click .toNewManager': 'onNewManagerClick',
              'click .deleteManager': "onDeleteManagerClick",
              'click .clickToShow': 'onClickToShowClick'
          },

          initialize: function () {
            _.bindAll(this, 'render');

          },

          template: _.template(managerListTemplate),

          render: function () {
              var self = this;
              var managerQuery = new Parse.Query(Parse.User);
              managerQuery.equalTo("permission", LOCAL_MANAGER);
              managerQuery.include("gridId");
              managerQuery.find({
                  success: function(managers) {
                      self.$el.html(self.template({managers: managers}));
                      for(var i = 0; i < managers.length; i++) {
                    	  var temp='#'+managers[i].toJSON().objectId+'-content';  
                    	  console.log(temp);
                    	  $(temp).hide();
                      }
                  },
                  error: function(error) {
                      showMessage("Error", "Find managers failed! Reason: " + error.message);
                  }
              });
          },

          onNewManagerClick: function() {
              window.location.href = '#newManager';
          },

          onDeleteManagerClick: function(ev) {
              var managerId = $(ev.currentTarget).data('id');
              console.log(managerId);
              showMessage("Oops!", "Delete function is still under construction");
              //TODO - Need more discussion to implement the delete function
          },
          
          onClickToShowClick: function(ev){
        	  var managerId = $(ev.currentTarget).data('id');
        	 //divId="#"+divId;
        	 console.log(managerId);
        	 $('#'+managerId+'-content').transition('vertical flip', '500ms');
          }
      });
      return ManagerListView;

    });


