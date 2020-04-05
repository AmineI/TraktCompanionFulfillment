
####Prerequisites
0. Create a Firebase project in the [Firebase console](https://firebase.google.com/console). 

    Then, in the project directory, execute the following with a command prompt.

0. Install Firebase CLI with `npm install -g firebase-tools`. It might be needed to run this one with administrator privileges.

0. Install the package dependencies with `npm install`

0. Create a Firebase project in the [Firebase console](https://firebase.google.com/console)
0. Authenticate to the Firebase CLI through `firebase login`
0. Run `firebase init functions` to initialise //TODO : CHECK THAT STEP
0. Create an account and client app on [staging.Trakt.tv](http://staging.trakt.tv), and take note of your client Id.

    [staging.Trakt.tv](http://staging.trakt.tv) is an endpoint used for testing, to avoid filling the main site with test data.
    If you are ready to use this on production, you can create the app on [Trakt.tv](http://trakt.tv) instead. 

0. To gather poster images for shows and movies, we have to use another service like TMDB, since the Trakt API doesn't provide images.
    Create a TMDB account and obtain an [API key](https://www.themoviedb.org/settings/api) 

0. Set the required environment variables, like so :

    `firebase functions:config:set TMDB.apiKey="TMDBApiKey" traktclient.id="ClientId" traktclient.endpoint="https://api-staging.trakt.tv"`
    (or `"api.trakt.tv"` if using the main trakt website.)


####Deploy and use 

- With `npm run serve` the project can be locally deployed. 

    In that case, have a tool ready for proxying the connexion through an HTTPS proxy, as per Dialogflow's guidelines requiring a HTTPS webhook.
    I recommend [ngrok](http://ngrok.com) . Take note of the https endpoint given to you.

- With `npm deploy` the project can be deployed to firebase functions hosting.

    In order to use this, it requires a billable firebase account, on a paid plan. 
    As mentioned in the [Firebase Pricing page](https://firebase.google.com/pricing), the free _Spark plan_ denies any requests to outbound services, such as Trakt.tv . 

    The "pay as you go" _Blaze plan_ includes a reasonable 5GB outbound data transfer for free, but still requires bank information to sign up for, as any use after the free quota will be billed. 
