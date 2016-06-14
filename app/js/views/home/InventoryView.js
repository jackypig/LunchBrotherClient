/**
 * Created by Jack on 3/2/16.
 */
define([
    'models/InventoryModel',
    'text!templates/home/inventoryTemplate.html'
], function(InventoryModel, inventoryTemplate) {

    var InventoryView = Parse.View.extend({

        tagName: "div",
        attributes: {
            class: 'column'
        },
        template: _.template(inventoryTemplate),

        events: {
            'click .plusone': 'addOne',
            'click .minusone': 'minusOne'
        },

        initialize: function() {
            this.model.initialize();
            _.bindAll(this, 'render', 'addOne', 'minusOne');
            this.model.bind('change:count', this.render);
        },

        render: function() {
            $(this.el).html(this.template({inventory: this.model}));
            $('#' + this.model.id + ' .menu .item').tab({context: $('#' + this.model.id)});
            $('.ui.rating').rating({
                interactive: false
            });
            //this.delegateEvents();
            return this;
        },

        addOne: function() {
            this.model.addOne();
        },

        minusOne: function() {
            this.model.minusOne();
        }
    });
    return InventoryView;
});
