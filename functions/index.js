'use strict';


// Imports the Dialogflow module from the Actions on Google client library.
// Also imports the chosen wrappers/helpers.
const {
    dialogflow,
    Permission,
    Suggestions,
    BasicCard,
    SignIn
} = require('actions-on-google');
// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');

//Gets the client ID from firebase's environment config.
//Can be set through firebase CLI : >firebase functions:config:set traktclient.id="MyTraktAPIAppClientId"
//Todo : Change the Staging Client ID & endpoint to the official client ID in firebase configuration.
const CLIENT_ID = functions.config().traktclient.id;
//>firebase functions:config:set traktclient.endpoint="https://api.trakt.tv"
const TraktAPIEndpoint = functions.config().traktclient.endpoint;

//Todo : See if I'd better use only one context for an addition and store the type of addition in it with an entity.
/** Dialogflow Contexts {@link https://dialogflow.com/docs/contexts/input-output-contexts} */
const AppContexts = {
        LIST_ADDITION: 'ListAdditionData',
        CHECKIN_ADDITION: 'CheckinAdditionData',
    };

/** Dialogflow Context Lifespans {@link https://dialogflow.com/docs/contexts#lifespan} */
const Lifespans = {
    DEFAULT: 5,
};


// Create a Dialogflow client instance.
const TraktAgent = dialogflow({
    // The Trakt API client ID for my Action.
    clientId: CLIENT_ID
});


function SignInHandler(conv, params, signin) {
    if (signin.status !== 'OK') {
        conv.ask(`Ok, you won't be able to use the account update features, like 'Checkin' or 'Add to watchlist', then.`);
        return;
    } else {
        const accesstoken = conv.user.access.token;


        //TODO : Separate any API call function.
        const rp = require("request-promise");
        //TOdo : Examine if request-promise-native would be better.
        let options = {
            method: 'GET',
            uri: `${TraktAPIEndpoint}/users/settings`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accesstoken}`,
                'trakt-api-version': '2',
                'trakt-api-key': `${CLIENT_ID}`
            }, json: true,
            resolveWithFullResponse: true
        };

        return rp(options)
            .then(response => {
                //Todo : Get timezone and format from trakt api and save it. Same for username etc ?
                console.log('Its a me Status:', response.statusCode);
                console.log('Its a me Headers:', JSON.stringify(response.headers));
                console.log('Its a me Response:', response.body);

                conv.ask(`I got your Trakt account details !`);
                conv.ask(`So you're ${response.body.user.name}. Now that you're logged in, I'll be able to help you manage your Trakt lists. Do you want to know more about what I'm able to do ? Or just go ahead and tell me how can I help you !`);
                //Todo : Show suggestions.
                return;
            })
            .catch(err => {
                console.log('Its a me Status error:', err.statusCode);
                conv.ask(`oh crap, I got a ${err.statusCode} network error trying to communicate with Trakt. Todo : Close the conversation or get it back on track`);
                //Todo : Remove this message ofc XD.
                return;
                // API call failed...
            });
    }

}


//___________________________________________________\\

// Intent that starts the account linking flow.
TraktAgent.intent('Signin Start', conv => {
    conv.ask(new SignIn('To let you manage your Trakt account'));
    //Prompt the user to sign in, and then fire the `actions_intent_SIGN_IN` event, which starts any matching intent with that event as input.
});

// The intent is linked to the `actions_intent_SIGN_IN` event, and thus starts when a sign in request is made, and is either refused or accepted
TraktAgent.intent('Signin Get', (conv, params, signin) => SignInHandler(conv, params, signin));

//Todo : Get help intent - on DialogFlow since it wouldn't require API Calls ? Or IDK, since Google<->Google is free ?
//Todo : Check firebase's invocations quota.
//conv.ask(`You can manage your watchlist, history, or even checkin`);//Todo : add more detail and put this in a "get help" intent
//conv.ask(`Anything I might help you more about ?`);


//Todo : Add every text in separated strings
//Todo Set conversations as end when needed


//__________________________________________________________________\\
//Todo : Update Actions Console on Google directory info before deploying any Prod/Beta/Alpha to the public.
//It is filled with FAKE data.

/**
 * Set the DialogflowApp object to handle the HTTPS POST request.
 */
exports.dialogflowFirebaseFulfillment = functions
    .https.onRequest(TraktAgent);
