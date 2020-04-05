'use strict';


// Imports the Dialogflow module from the Actions on Google client library.
// Also imports the chosen wrappers/helpers.
const {
    dialogflow,
    SignIn,
    SimpleResponse,
    Confirmation,
    Suggestions,
    BasicCard,
    Button,
    Image
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
        LIST_ADDITION: 'listadditiondata',
        CHECKIN_ADDITION: 'checkinadditiondata',
        DATA_ADDITION: 'additiondata',
        SEARCH_DETAILS: 'searchdetails'
    };
//Note : Contexts names are converted to lowercase by DialogFlow

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
const traktApi = {};

//Todo : move to traktApi.js
//Todo : Examine if request-promise-native would be better for Node.js v8.
const rp = require("request-promise");

/**
 * Launch the API request to obtain the user's settings.
 * https://trakt.docs.apiary.io/reference/users/settings
 * @param token auth Access token
 */

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
 * @param textQuery : string Text query to search for
 * @param types=["show","movie"] : string[] : ["show","movie","episode"] A list to filter the search - obtaining only the media types specified.
 * Todo POSSIBLE_MEDIA_TYPES = { SHOW: "show", MOVIE: "movie", EPISODE: "episode"}
 */
traktApi.getSearchResults = function (token, {textQuery, year = ""}, page = 1, types = ["show", "movie"], extended = false, limit = 10) {
    if (types === "") {//
        types = ["show", "movie"];
    }
    let searchOptions = {
        method: 'GET',
        uri: `${TraktAPIEndpoint}/search/${types}?page=${page}&limit=${limit}${extended === true ? `&extended=full` : ''}${year !== "" ? `&years=${year}` : ''}&query=${encodeURIComponent(textQuery)}`, //-> search/type1,type2,type3?..
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

traktApi.deleteCheckins = function (token) {
    let requestOptions = {
        method: 'DELETE',
        uri: `${TraktAPIEndpoint}/checkin`,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': `${CLIENT_ID}`
        }, json: true,
        resolveWithFullResponse: true
    };
    return rp(requestOptions);
};
traktApi.CheckinItem = function (token, item) {
    let requestOptions = {
        method: 'POST',
        uri: `${TraktAPIEndpoint}/checkin`,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': `${CLIENT_ID}`
        }, json: item,
        resolveWithFullResponse: true
    };
    return rp(requestOptions);
};


let tmdb = {};
tmdb.getImageUrl = (mediaType, TMDBId) => {
    //TODO Implement TMDB API, this is a placeholder.
    return 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/kBf3g9crrADGMc2AMAMlLBgSm2h.jpg';

    //TODO : attribute images from TMDB.
};

//Todo : Correctly handle errors.
function requestErrorHandler(conv, err) {
    console.log(err);
    conv.ask(`oh crap, I got a ${err.statusCode} network error trying to communicate with Trakt. Todo : Close the conversation or get it back on track`);
    //Todo : Remove this message ofc XD. Allows user to retry request, maybe ?
    return false;
    // API call failed...
}

//________________________________________________________\\

//Todo : DialogFlow : Handle the case when user explicitly ask to refresh his information.
//Todo : In this case, tell him how to unlink account maybe ?
/**
 * Launch the account linking request with the SignIn helper.
 * @param conv Conversation Object
 */
function signInLauncher(conv) {
    {
        conv.ask("You'll have to authorize this application from your Trakt account so that you can interact with your lists from here.");
        conv.ask(new SignIn('To let you manage your Trakt account'));
        //Prompt the user to sign in, and then fire the `actions_intent_SIGN_IN` event, which starts any matching intent with that event as input.
    }
}

/**
 * Handle the status of the user's sign in, after a response from the SignIn helper.
 * @param conv Conversation object
 * @param params
 * @param signin signin.status=='OK' when the sign in was successfully completed.
 * @returns {Promise<T | boolean> | boolean} Promise that returns when the user's Trakt data has been fetched. //Todo : What data to fetch at this moment ? List Sync ?
 */
function signInHandler(conv, params, signin) {
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
        return false;
    } else {
        //const accesstoken = conv.user.access.token;

        return traktApi.getUserSettings(conv.user.access.token)
            .then(response => {
                // Todo : This allows to avoid sending back the whole userStorage in turns where its content didn't change.
                // See https://developers.google.com/actions/assistant/save-data#clear_content_of_the_userstorage_field
                //conv.user.storage = {};

                //Todo : Obtaining consent prior to accessing userStorage. [Some countries have regulations that require developers to obtain consent from the user before they can access, or save certain information (e.g. personal information) in the userStorage. If you operate in one of these countries and you want to access, or save such information in userStorage, you must use the Confirmation helper to ask consent to the user and obtain the consent before you can start storing such information in userStorage.]
                //Todo : Tell user what we're saving and offer to change these
                conv.user.storage.TraktUserSettings = {
                    timezone: response.body.account.timezone,
                    date_format: response.body.account.date_format,
                    time_24hr: response.body.account.time_24hr,
                };//Todo : Use timezone and format.
                if (!conv.user.storage.name) {
                    conv.user.storage.name = response.body.user.name.split(" ")[0];// Todo : intent to change the user name. There are prebuilt ones on DialogFlow
                }
                //Should I refresh these settings sometimes ?
                conv.ask(`Now that I have your authorization, ${conv.user.storage.name}, I'll be able to check in for you, add something to your watchlist, and more regarding your Trakt lists and history.`);
                conv.ask(`Don't hesitate to ask me for help if you can't handle all these possibilities ! Anything I can do for you right now ?`);
                conv.ask(new Suggestions("What can you do ?", "Call me Master", "I'm watching Batman", "What's next to watch ?"));
                //Todo change these suggestions.
                return true;
            })
            .catch((conv, err) => requestErrorHandler(conv, err));
    }

}


//Todo : Manage checkin error when starting a new checkin
// "If a checkin is already in progress, a 409 HTTP status code will returned. The response will contain an expires_at timestamp which is when the user can check in again."

//Todo : Note, As per https://trakt.tv/branding
// Checkin seems to be mobile-oriented while Scrobble is meant to be seamless to the user, being attached to play pause stop events etc, in a media player.

//___________________________________________________\\


TraktAgent.intent('Default Welcome Intent', (conv) => {
    if (!conv.user.access.token) {
        //The user isn't correctly signed in since we weren't provided with an access token for the user, so we'll briefly walk him through the app and ask him to sign in. Todo : Traktie is a temp name.
        let introduction = `Hi there ! I'm Traktie, pleased to meet you. I can do a lot to help you manage your Trakt lists.\n` +//Todo Emphasize "a lot"
            `If you just watched something, or if you're in a rush to check in a movie, I can do all that for you, and more !\n` +
            `But firstly, you'll have to authorize me to checkin for you, and update your list on your behalf. Is it ok ?`;


        //This sets the context to be a followup of DefaultWelcomeIntent before asking for User confirmation, as the intent handling the confirmation has to be matched only after this specific conversation.
        conv.contexts.set('DefaultWelcomeIntent-followup', 4);
        conv.ask(new Confirmation(introduction));//Todo : This is not even a prompt, huh. Change it.
    } else {//Google sent us an access token for the user, so his account his correctly linked.

        let responseMessage = util.getRandomResponse(["Oh hai ! What can I do for you :) ?",
            "Holà, how can I help you ?",
            "It's you ! What do you want me to do ?",
            "Hello! How can I help you?",
            "Good day! What can I do for you today?",
            "Greetings! How can I assist?"]);//Todo : Watch out, the "smiley face" is read aloud.
        conv.ask(responseMessage);
        conv.ask(new Suggestions("What can you do ?", "Check in to $popular", "Add $pop to my watchlist", "I've seen $popular_movie", "What's next to watch ?"))
        //Todo : change these messages and add suggestions.
    }
});

/**
 * This intents matches the `actions_intent_CONFIRMATION` event and DefaultWelcomeIntent-followup that were set in the Default Welcome Intent,
 * after a confirmation prompt that was presented to the user if he wasn't signed in.
 */
TraktAgent.intent('Default Welcome Intent - SignIn_Confirmation', (conv, params, confirmation) => {
    //Delete the followup context since it isn't needed anymore to keep the user "on tracks".
    //We'll either redirect him to the "sign in failed -> close conversation" path, or sign him in and he'll be then free to do what he wants
    conv.contexts.delete('DefaultWelcomeIntent-followup');
    if (confirmation) {
        signInLauncher(conv);
        return true;
    } else {
        return signInHandler(conv, {}, 'NotRequested');
    }
});

// Intent that starts the account linking flow.
TraktAgent.intent('Signin Request', (conv) => signInLauncher(conv));

// The intent is linked to the `actions_intent_SIGN_IN` event, and thus starts when a sign in request is made, and is either refused or accepted
TraktAgent.intent('Signin Action', (conv, params, signin) => signInHandler(conv, params, signin));

//Todo : Handle the "start" case in another intent and function ?
//Todo : Add checkin launch with media data
//If the intent "Checkin_Edit is matched, we send the conversation data
TraktAgent.intent('Checkin Stop', (conv) => {
    conv.ask(new Confirmation(`Okay. Are you sure to stop the checkin right now ?`));
    // On DialogFlow, the followup intent managing the confirmation then has to have 'actions_intent_CONFIRMATION' as a trigger event, to handle the answer.
});

//Todo : warning, if the checkin was stopped because it was needed to check in something else
// We'll have to answer differently and provide the user with the checkin he initially asked for.
TraktAgent.intent('Checkin Stop - Confirmation', (conv, params, confirmation) => {
    if (!confirmation) {
        conv.ask(`Fine, won't do. How else may I be of assistance ?`);
        return false;
    } else {
        return traktApi.deleteCheckins(conv.user.access.token)
            .then(response => {
                conv.ask(`The checkin was successfully stopped`);
                conv.ask(`Anything else I can do to assist ?`);
                return true;
            })
            .catch((err) => requestErrorHandler(conv, err));
    }
});

//Todo : remove other actions contexts when starting an action. Ex : starting the add_watchlist should remove checkin_context
TraktAgent.intent('Checkin Start', (conv, params) => {

    //Todo : add the DATA_ADDITION to dialogflow intent
    //Todo : set contexts lifespan to super high on DF so that we don't forget the point if we take a lot of time in the search intent.
    const {media_item_name, media_type, year, episode_number, season_number} = conv.contexts.get(AppContexts.DATA_ADDITION).parameters;
    //Todo : Mark some parameters as not required in DF if we want to be able to access the data collection intents ourselves for slot filling

    //Todo : If episode/season not given we assume it"s a movie
    //Todo handle if the asks for the last episode or the newest
    if (!media_item_name) {
        //Maybe set contexts for the data collec intent ? / Or no context to keep it with the usual "change item" intent
        conv.ask("Please provide the show/movie name");
        //Todo create a followup intent to handle this case
    } else {
        conv.followup(AppContexts.SEARCH_DETAILS, {
            textQuery: media_item_name,
            media_type: media_type,
            year: year,
            search_page: 1, //todo handle this
            take_best_result_above_threshold: true
        });//Watch out ! followup takes an *event* as input, and not an intent !
        //todo ?season_number:season_number,
        //Todo ? episode_number:episode_number

        //Todo SearchDetails intent must go back to Checkin confirmation when finished.
        //conv.ask(new Confirmation(`Confirm checkin of ${media_item_name} ?`));//Todo mention episodes when needed through a message constructor.
    }
});

TraktAgent.intent('Checkin Start - Confirmation', (conv, params, confirmation) => {
//Todo : redo this so it can followup after the search choice confirmation
    if (!confirmation) {
        conv.ask(`Fine, won't do. How else may I be of assistance ?`);
        return false;
    } else {
//todo start checkin


        conv.ask(`The checkin was successfully started`);
        //Todo : delete addition data (& other) contexts on DF or here on success
        conv.ask(`Anything else I can do to assist ?`);
        return true;
    }
});


TraktAgent.intent('SearchDetails', (conv, params) => {

    const search_data = conv.contexts.input[AppContexts.SEARCH_DETAILS].parameters;
    //Todo store the search results somewhere in the context

    return traktApi.getSearchResults(conv.user.access.token, search_data.query, search_data.media_type)
        .then(response => {
            console.log(response.body);
            //Todo process body

                //todo say or display media info, or build carousel/list if multiple results https://github.com/actions-on-google/dialogflow-conversation-components-nodejs/blob/master/functions/index.js useful sample
            conv.ask("debug breakpt");
                //todo : If only one pertinent choice, followup directly with it
            //conv.followup('SearchDetails - Choice', {choice});
                return true;
            }
        );


});

//Todo, specify between types, and rename
function displayItemChoice(conv, choice) {
    //Todo extract func to return only basic cards by media type

    //todo Display depending on choice.type (movie,show, episode..)
    let item = choice[choice.type];

    if (!conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')) {
        conv.ask('Sorry, try this on a screen device or select the ' +
            'phone surface in the simulator.');
        //todo say the first result or something
    }
// Create a basic card
    //Todo include dynamic info from search (should be in the choice var)
    conv.ask("Sure, here are the details of *title*, is it ok ?");//Todo replace title, add action type
    conv.ask(new BasicCard({
        text: `📱.  *emphasis* or _italics_, **strong** or
  __bold__, and ***bold itallic*** or ___strong emphasis___ as well as other
  things like line  \nbreaks`, // Note the two spaces before '\n' required for
                               // a line break to be rendered in the card.
        subtitle: 'This is a subtitle',
        title: 'Title: this is a title',
        buttons: new Button({
            title: 'Trakt page',
            url: 'https://trakt.tv/',
        }),
        image: new Image({
            url: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/kBf3g9crrADGMc2AMAMlLBgSm2h.jpg',//todo get from tvdb/tmdb since trakt doesn't give them anymore I think. CHeck their blog post https://apiblog.trakt.tv/how-to-find-the-best-images-516045bcc3b6
            alt: 'Batman logo from tmdb',
        }),
        display: 'WHITE',
    }));
    return;

}

TraktAgent.intent('SearchDetails - Choice', (conv, {choice}) => {
    displaychoice(conv, choice)
});

// Todo : Fill help intent text on dialogflow


//Todo : Review ALL text dialogs and suggestions, and add them to separated strings
//Todo : Set conversations as end when needed

//Todo : Firebase free invocation quota is around 1 million, huh. Optimize this someday to reduce the number of calls to the webhook, I guess ?
//Todo : Get the popular movies once in a while to "cache" them in some.. storage somewhere ?

//__________________________________________________________________\\
//Todo : Update Actions Console on Google directory info before deploying any Prod/Beta/Alpha to the public.
//It is filled with FAKE data right now.

/**
 * Set the DialogflowApp object to handle the HTTPS POST request.
 */
exports.dialogflowFirebaseFulfillmentBeta = functions
    .https.onRequest(TraktAgent);
