define( [
    'text!templates/account/fbLoginTemplate.html',
    'facebook',
    'models/Grid'
], function ( fbLoginTemplate, GridModel )
{

    var FbLoginView = Parse.View.extend( {
        el: $( "#page" ),
        template: _.template( fbLoginTemplate ),
        events: {
        },
        initialize: function ()
        {
            _.bindAll( this, 'render' );
        },

        render: function ()
        {
            var fbAppId = '410310702464792';
            Parse.FacebookUtils.init( {
                appId: fbAppId,
                status: true,
                cookie: true,
                xfbml: true,
                version: 'v2.2'
            } );

            Parse.FacebookUtils.logIn( 'public_profile, email', {
                success: function ( user )
                {
                    if ( !user.existed() )
                    {
                        console.log( "User signed up and logged in through Facebook!" );
                        FB.api( '/me', function ( response )
                        {
                            if ( response && !response.error )
                            {
                                var grid = new GridModel();
                                grid.id = this.$("#gridOptions").val();

                                console.log( user.id );
                                user = Parse.User.current();
                                user.set( "gridName", "UMCP" );
                                user.set("gridId", grid);
                                user.set( "firstName", response.first_name );
                                user.set( "lastName", response.last_name );
                                user.set( "username", response.name );
                                user.set( "permission", 1 );
                                user.set( "email", response.email );
                                user.set( "creditBalance", 30 );
                                user.save( null, {
                                    success: function ( u )
                                    {
                                        window.location.hash = '#home';
                                    },
                                    error: function ( u, error )
                                    {
                                        require( ["views/account/ProfileView"], function ( ProfileView )
                                        {
                                            var profileView = new ProfileView( {
                                                model: u
                                            } );
                                            profileView.render();
                                        } );
                                    }
                                } );
                            }
                        } );
                    } else
                    {
                        console.log( "User logged in through Facebook!" );
                        window.location.hash = '#home';
                    }
                },
                error: function ( user, error )
                {
                    console.log( "User cancelled the Facebook login or did not fully authorize." );
                }
            } );
            this.$el.html( this.template() );
            return this;
        }
    } );
    return FbLoginView;
} );
