/**
 * Created by Jack on 3/1/16.
 */
define(['models/InventoryModel'],
    function(InventoryModel) {
        var InventoryCollection = Parse.Collection.extend({

            model: InventoryModel,

            orders: function() {
                return this.filter(function(inventory){ return inventory.get('count') > 0; });
            },

            charge: function(){
                var total = 0;
                _.each(this.orders(), function(inventory){
                    total += inventory.charge();
                });
                return total;
            },

            totalCount: function(){
                var count = 0;
                _.each(this.orders(), function(inventory){
                    count += inventory.get('count');
                });
                return count;
            }
        });
        return InventoryCollection;
    });
