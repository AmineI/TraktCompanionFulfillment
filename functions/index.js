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

//Todo : Change the Staging Client ID to the official client ID in firebase configuration.
const CLIENT_ID = functions.config().traktclient.id;


// Create a Dialogflow client instance.
const TraktAgent = dialogflow({
    // The Trakt API client ID for my Action.
    clientId: CLIENT_ID,
    //Debug mode enabled.
    //Todo : Figure out what this does.
    debug: true,
});


// Set the DialogflowApp object to handle the HTTPS POST request.
exports.dialogflowFirebaseFulfillmentBeta = functions
    .https.onRequest(TraktAgent);
