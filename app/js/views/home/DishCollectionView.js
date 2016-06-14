//CollectionView: display collectionmodeldat in homeView
define([
  'models/dish/DishModel',
  'models/dish/DishCollection',
  'views/home/DishView'
], function(DishModel, DishCollection, DishView) {
  var DishCollectionView = Parse.View.extend({

    tagName: 'div',
    attributes: {
      id: 'dishList',
      class: "doubling two column row dishes"
    },

    events: {

    },

    initialize: function() {
      this._views = [];
      var self = this;
      _.each(this.collection, function(dish) {
        self._views.push(new DishView({
          model: dish
        }));
      });
      Parse.Events.on("collection:update", this.calculate, this);
    },
    
    render: function() {
      var self = this;
      this.$el.empty();
      var container = document.createDocumentFragment();
      _.each(this._views, function(subview) {
        var child = subview.render().el;
        container.appendChild(child);
      });
      this.$el.append(container);
      return this;
    },
    
    calculate: function() {
      var totalPrice = [];
      _.forEach(this.collection,function(model){
         var count = model.get("Count");
         var price = model.get("Unit_Price");
         var total = count*price;
         totalPrice.push(total);
      
      });
      
      var final = totalPrice[1]+totalPrice[0];
      //Parse.Events.trigger("homeview:update", { final: final});
      this.homeCallback({final:final});
    }
    
  });
  
  return DishCollectionView;
});
