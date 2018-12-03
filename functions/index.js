'use strict';


// Imports the Dialogflow module from the Actions on Google client library.
// Also imports the chosen wrappers/helpers.
const {
    dialogflow,
    SignIn,
    SimpleResponse,
    Confirmation,
    Permission,
    Suggestions,
    BasicCard,
} = require('actions-on-google');
// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');

//Gets the client ID from firebase's environment config.
//Can be set through firebase CLI : >firebase functions:config:set traktclient.id="MyTraktAPIAppClientId"
//Todo : Change the Staging Client ID & endpoint to the official client ID in firebase configuration.
const CLIENT_ID = functions.config().traktclient.id;
//>firebase functions:config:set traktclient.endpoint="https://api-staging.trakt.tv"
const TraktAPIEndpoint = functions.config().traktclient.endpoint;

/** Dialogflow Contexts {@link https://dialogflow.com/docs/contexts/input-output-contexts} */
    //Todo : See if I'd better use only one context for an addition and store the type of addition in it with an entity.
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
    clientId: CLIENT_ID,
    //Debug mode logs the raw JSON payload from the user request or response
    debug: true,
});

//________________________________________________________\\
const util = {};//Todo : move to util.js
/**
 *Returns a random response from an array.
 * @param ResponsesArray {Response[]|string[]} Array of responses
 * @returns {Response|string}
 */
util.getRandomResponse = function (ResponsesArray) {
    //A random integer index between 0 and the array length (excluded, since arrays start at 0.)
    let randomIndex = Math.floor(Math.random() * ResponsesArray.length);//Math.random c [0,1[.
    return ResponsesArray[randomIndex];
};

//________________________________________________________\\
const traktApi = {};//Todo : move to traktApi.js
//Todo : Examine if request-promise-native would be better for Node.js v8.
const rp = require("request-promise");

traktApi.getUserSettings = function (token) {
    let settingsOptions = {
        method: 'GET',
        uri: `${TraktAPIEndpoint}/users/settings`,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': `${CLIENT_ID}`
        }, json: true,
        resolveWithFullResponse: true
    };
    return rp(settingsOptions);
};

/**
 *
 * @param token auth Access token
 * @param textQuery Request to search
 * @param types media_type : ["show","movie","episode"] A list to filter the search - obtaining only the media types specified.
 */
traktApi.search = function (token, textQuery, types = ["show,movie"]) {

    let searchOptions = {
        method: 'GET',
        uri: `${TraktAPIEndpoint}/search/${types}?query=${encodeURIComponent(textQuery)}`, //-> search/type1,type2,type3?..
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': `${CLIENT_ID}`
        }, json: true,
        resolveWithFullResponse: true
    };
    return rp(searchOptions);

    /*    return traktApi.search(conv.user.access.token, "Who")
        .then(response => {
            console.log(response.headers);
            console.log(response.body);
            return true;
        })
        .catch(err => {
            console.log(err);
            return false;
        });*/
};

//________________________________________________________\\

//Todo : DialogFlow : Handle the case when user explicitly ask to refresh his information.
//Todo : In this case, tell him how to unlink account maybe ?

/**
 * This launches the account linking request with the SignIn helper.
 * @param conv Conversation Object
 */
function SignInLauncher(conv) {
    {
        conv.ask("You'll have to authorize this application from your Trakt account so that you can interact with your lists from here.");
        conv.ask(new SignIn('To let you manage your Trakt account'));
        //Prompt the user to sign in, and then fire the `actions_intent_SIGN_IN` event, which starts any matching intent with that event as input.
    }
}

/**
 * Handle the status of the user sign in, after a response from the SignIn helper.
 * @param conv Conversation object
 * @param params
 * @param signin signin.status=='OK' when the sign in was successfully completed.
 * @returns {Promise<T | boolean>} Promise that returns when the user's Trakt data has been fetched. //Todo : What data to fetch at this moment ? List Sync ?
 */
function SignInHandler(conv, params, signin) {
    if (signin.status !== 'OK') {
        conv.close(`Without the authorization to do so on your Trakt account, I won't be able to update your lists or do anything for you.`);

        // noinspection all //IDK Why my IDE says that SimpleResponse can't be instantiated, so BAM error suppression 😏.
        let NoSignInMessage2 = new SimpleResponse({
            speech: '<speak>If you believe I may be evil - <prosody volume="soft" pitch="-10%" rate="100%"> despite my beautiful voice </prosody>- ' +
                'you can check my source code on GitHub ! <break time="0.5s"/>' +
                'I only do what you ask, and have <emphasis level="moderate"> absolutely no secret need </emphasis>' +
                'to fill your account with my own favorite shows.</speak>',
            text: 'If you believe I may be evil, you can check my source code on GitHub:\n' + //Todo : make the Github public indeed, before the release.
                'I only do what you ask, and have no secret need to fill your account with my own favorite shows 😉.'
        });
        conv.close(NoSignInMessage2);
        //return; TODO : Examine ESLint rules about that
    } else {
        //const accesstoken = conv.user.access.token;

        return traktApi.getUserSettings(conv.user.access.token)
            .then(response => {
                //Todo : Get timezone and format from trakt api and SAVE it in conv. Same for user name etc ?

                // Todo : This allows to avoid sending back the whole userStorage in turns where its content didn't change.
                // See https://developers.google.com/actions/assistant/save-data#clear_content_of_the_userstorage_field
                //conv.user.storage = {};

                //Todo : Obtaining consent prior to accessing userStorage. [Some countries have regulations that require developers to obtain consent from the user before they can access, or save certain information (e.g. personal information) in the userStorage. If you operate in one of these countries and you want to access, or save such information in userStorage, you must use the Confirmation helper to ask consent to the user and obtain the consent before you can start storing such information in userStorage.]
                //Todo : Tell user what we're saving and offer to change these
                conv.user.storage.TraktUserSettings = {
                    timezone: response.body.account.timezone,
                    date_format: response.body.account.date_format,
                    time_24hr: response.body.account.time_24hr,
                    name: response.body.user.name.split(" ")[0],
                };
                //Should I refresh these settings sometimes?

                //What should I do with the name

                conv.ask(`Now that I have your authorization, ${conv.user.storage.TraktUserSettings.name}, I'll be able to check in for you, add something to your watchlist, and more regarding your Trakt lists and history.`);
                conv.ask(`Don't hesitate to ask me for help if you can't handle all these possibilities ! Anything I can do for you right now ?`);
                //Todo : Show suggestions : Call me <Master>, I'm watching the last Batman movie, What do I have next to watch ?, Get_Help

                return true;
            })
            .catch(err => {
                console.log('Its a Status error:', err.statusCode);
                conv.ask(`oh crap, I got a ${err.statusCode} network error trying to communicate with Trakt. Todo : Close the conversation or get it back on track`);
                //Todo : Remove this message ofc XD.
                return false;
                // API call failed...
            });
    }

}


//___________________________________________________\\


TraktAgent.intent('Default Welcome Intent', (conv) => {
    if (!conv.user.access.token) {
        //The user isn't correctly signed in since we weren't provided with an access token for the user, so we'll briefly walk him through the app and ask him to sign in. Todo : Traktie is a temp name.
        let Introduction = `Hi there ! I'm Traktie, pleased to meet you. I can do a lot to help you manage your Trakt lists.\n` +//Todo Emphasize a lot
            `If you just watched something, or if you're in a rush to check in a movie, I can do all that for you, and more !\n` +
            `But firstly, you'll have to authorize me to checkin for you, and update your list on your behalf. Is it ok ?`;


        //This sets the context to be a followup of DefaultWelcomeIntent before asking for User confirmation, as the intent handling the confirmation has to be matched only after this specific conversation.
        conv.contexts.set('DefaultWelcomeIntent-followup', 5);
        conv.ask(new Confirmation(Introduction));//Todo : This is not even a prompt, huh. Change it.
    } else {//Google sent us an access token for the user, so his account his correctly linked.

        let responseMessage = util.getRandomResponse(["Oh hai ! What can I do for you :) ?",
            "Holà, how can I help you ?",
            "It's you ! What do you want me to do ?",
            "Hello! How can I help you?",
            "Good day! What can I do for you today?",
            "Greetings! How can I assist?"]);//Todo : Watch out, the "smiley face" is read aloud.
        conv.ask(responseMessage);
        conv.ask(new Suggestions("What can you do ?", "Check in to $popular_movie", "Add $popular_movie to my watchlist", "I've seen the last $popular_movie", "What's next for me to watch ?"))
        //Todo : change these messages and add suggestions.
    }
})
;

/**
 * This intents matches the `actions_intent_CONFIRMATION` event and DefaultWelcomeIntent-followup that were set in the Default Welcome Intent,
 * after a confirmation prompt that was presented to the user if he wasn't signed in.
 */
TraktAgent.intent('Default Welcome Intent - SignIn_Confirmation', (conv, input, confirmation) => {
    //Delete the followup context since it isn't needed anymore to keep the user "on tracks".
    //We'll either redirect him to the "sign in failed -> close conversation" path, or sign him in and he'll be then free to do what he wants
    conv.contexts.delete('DefaultWelcomeIntent-followup');
    if (confirmation) {
        SignInLauncher(conv);
        return true;
    } else {
        return SignInHandler(conv, {}, 'NotRequested');
    }
});

// Intent that starts the account linking flow.
TraktAgent.intent('Signin Request', (conv) => SignInLauncher(conv));

// The intent is linked to the `actions_intent_SIGN_IN` event, and thus starts when a sign in request is made, and is either refused or accepted
TraktAgent.intent('Signin Action', (conv, params, signin) => SignInHandler(conv, params, signin));

//Todo : Get help intent - on DialogFlow since it wouldn't require API Calls ? Or IDK, since Google<->Google is free ?
//Todo : Check firebase's invocations quota.
//conv.ask(`You can manage your watchlist, history, or even checkin`);//Todo : add more detail and put this in a "get help" intent
//conv.ask(`Anything I might help you more about ?`);


//Todo : Add all text dialogs in separated strings
//Todo Set conversations as end when needed


//__________________________________________________________________\\
//Todo : Update Actions Console on Google directory info before deploying any Prod/Beta/Alpha to the public.
//It is filled with FAKE data.

/**
 * Set the DialogflowApp object to handle the HTTPS POST request.
 */
exports.dialogflowFirebaseFulfillmentBeta = functions
    .https.onRequest(TraktAgent);
