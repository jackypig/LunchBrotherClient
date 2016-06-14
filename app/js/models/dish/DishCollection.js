define(['models/dish/DishModel'],
  function(DishModel) {
    var DishCollection = Parse.Collection.extend({
      
      model: DishModel,
      
      orders: function() {
        return this.filter(function(dish){ return dish.get('count') > 0; });
      },

      charge: function(){
        var total = 0;
        _.each(this.orders(), function(dish){
          total += dish.charge();
        });
        return total;
      },

      totalCount: function(){
        var count = 0;
        _.each(this.orders(), function(dish){
          count += dish.get('count');
        });
        return count;
      }

    });
    return DishCollection;
  });
