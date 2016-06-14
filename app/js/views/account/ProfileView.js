define( [
  'text!templates/account/profileTemplate.html'
], function ( profileTemplate )
{

    var ProfileView = Parse.View.extend( {
        el: $( "#page" ),
        events: {
            'click  #signUpBtn': 'saveProfile'
        },

        initialize: function ()
        {
            if ( !this.model )
            {
                this.model = Parse.User.current;
                if ( this.model == null )
                {
                    window.location.hash = 'login';
                    return;
                }
            }
            _.bindAll( this, 'render', 'saveProfile' );
        },

        template: _.template( profileTemplate ),

        render: function ()
        {
            this.$el.html( this.template( this.model.toJSON() ) );
            return this;
        },

        saveProfile: function ()
        {
            this.model.set( "firstName", this.$( "#first_name" ).val() );
            this.model.set( "lastName", this.$( "#last_name" ).val() );
            this.model.set( "password", this.$( "#password" ).val() );
            this.model.set( "email", this.$( "#email" ).val() );
            this.model.set( "telnum", Number( this.$( "#phonenumber" ).val() ) );
            this.model.save( null, {
                success: function ( user )
                {
                    window.location.href = '#home';
                },
                error: function ( user, error )
                {
                    showMessage("Error", "Save profile failed! Reason: " + error.message);
                }
            } );
        }

    } );
    return ProfileView;
} );