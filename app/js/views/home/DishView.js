define([
  'models/dish/DishModel',
  'models/Restaurant',
  'text!templates/home/dishTemplate.html'
], function(DishModel, RestaurantModel, dishTemplate) {

  var DishView = Parse.View.extend({
   
    tagName: "div",
    attributes: {
      class: 'column'
    },
    template: _.template(dishTemplate),
   
    events: {
      'click .plusone': 'addOne',
      'click .minusone': 'minusOne'
    },

    currentQuantity: 0,
    inventoryId: null,

    initialize: function() {
    	this.model.initialize();
      _.bindAll(this, 'render', 'addOne', 'minusOne');
      this.model.bind('change:count', this.render);
    },

    render: function() {
        var dish = this.model._toFullJSON([]);
        $(this.el).html(this.template({dish: dish, inventoryId: this.inventoryId}));
        $('#' + this.model.id + ' .menu .item').tab({context: $('#' + this.model.id)});
        $('#' + this.model.id + '-currentQuantity').text(this.currentQuantity);
        $('.ui.rating').rating({
            interactive: false
        });
      //this.delegateEvents();
      return this;
    },

    setCurrentQuantity: function(quantity) {
      this.currentQuantity = quantity;
    },

    setInventoryId: function(inventoryId) {
        this.inventoryId = inventoryId;
    },

    addOne: function() {
      this.model.addOne();
    },

    minusOne: function() {
      this.model.minusOne();
    }
  });
  return DishView;
});
