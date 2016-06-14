/**
 * Created by Jack on 2/27/15.
 */
define(function() {
    var InventoryModel = Parse.Object.extend("Inventory", {
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
    return InventoryModel;
});