define(function() {
  var DishModel = Parse.Object.extend("Dish", {

    initialize: function() {
        this.set({count: 0});
    },

    addOne: function() {
       this.set({count: this.get('count') + 1});
    },

    minusOne: function() {
      if (this.get('count') > 0) {
        return this.set({ count: this.get('count') - 1 });
      }
    },
    
    charge: function(){
      return this.get('count') * this.get('Unit_Price');
    }
  });
  return DishModel;
});