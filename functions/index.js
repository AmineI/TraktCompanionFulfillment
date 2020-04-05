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
    Image,
    Carousel
} = require('actions-on-google');
// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');

//Gets the client configs from firebase's environment config.
//Can be set through firebase CLI : >firebase functions:config:set traktclient.id="MyTraktAPIAppClientId" , traktclient.endpoint="https://api-staging.trakt.tv"
//Todo : Change the Staging Client ID & endpoint to the official client ID in firebase configuration.
const {id: TraktClientId, endpoint: TraktAPIEndpoint} = functions.config().traktclient;
const {apikey: TMDBApiKey} = functions.config().tmdb;
const util = require("./util");
const traktApi = require("./trakt")(TraktClientId, TraktAPIEndpoint);
let tmdb = require("./tmdb")(TMDBApiKey);


// Create a Dialogflow client instance.
const TraktAgent = dialogflow({
    // The Trakt API client ID for my Action.
    clientId: TraktClientId,
    //Debug mode logs the raw JSON payload from the user request or response
    debug: false,
});


/** Dialogflow Contexts {@link https://dialogflow.com/docs/contexts/input-output-contexts} */
//Todo : See if I'd better use only one context for an addition and store the type of addition in it with an entity.
const AppContexts = {
    LIST_ADDITION: 'listadditiondata',
    CHECKIN_DATA: 'checkindata',
    CHECKIN_CONFIRMATION: 'confirmcheckin',//Event
    DATA_ADDITION: 'additiondata',
    SEARCH_DETAILS: 'searchdetails',//Both Event and context. TODO May cause issues, will have to separate Event/Context.
    SEARCH_CHOICE: 'searchchoice',//Event , and data
    PROMPT: {EPISODE: 'episodeprompt'}
};
//Note : Contexts names are converted to lowercase by DialogFlow

/** Dialogflow Context Lifespans {@link https://dialogflow.com/docs/contexts#lifespan} */
const Lifespans = {
    DEFAULT: 5,
};

//Todo : Correctly handle errors.

//Todo : DialogFlow : Handle the case when user explicitly ask to refresh his information. or not since he can unlink through G.Assistant
// In this case, tell him how to unlink account maybe ?

const convs = require("./convs");


TraktAgent.intent('Default Welcome Intent', (conv) => {
    if (!conv.user.access.token) {//The user isn't correctly signed in since we weren't provided with an access token for the user
        //so we'll briefly walk him through the app and ask him to sign in. Todo : Traktie is a temp name.
        let introduction = `Hi there ! I'm Traktie, pleased to meet you. I can do a lot to help you manage your Trakt lists.\n` +//Todo Emphasize "a lot" with SSML
            `If you just watched something, or if you're in a rush to check in a movie, I can do all that for you, and more !\n` +
            `But firstly, you'll have to authorize me to checkin for you, and update your list on your behalf. Is it ok ?`;

        //This sets the context to be a followup of DefaultWelcomeIntent before asking for User confirmation, as the intent handling the confirmation has to be matched only after this specific conversation.
        conv.contexts.set('DefaultWelcomeIntent-followup', 4);
        conv.ask(new Confirmation(introduction));//Todo : This is not even a prompt, huh. Change it.
    } else {//Google sent us an access token for the user, so his account his correctly linked.

        //Welcome him
        let responseMessage = util.getRandomResponse(["Oh hai ! What can I do for you?",
            "Holà, how can I help you ?",
            "It's you ! What do you want me to do ?",
            "Hello! How can I help you?",
            "Good day! What can I do for you today?",
            "Greetings! How can I assist?"]);//Todo : Watch out, the "smiley face" is read aloud.
        conv.ask(responseMessage);
        conv.ask(new Suggestions("What can you do ?", "I'm watching Batman", "Check in Game of Thrones")); //TODO "Check in to $popular", "Add to my watchlist", "I've seen $popular_movie", "What's next to watch ?"))
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
        convs.signIn.signInLauncher(conv);//TODO : Do not force login each time. Try to implement middleware like express
        return true;
    } else {
        return convs.signIn.signInHandler(conv, {}, 'NotRequested', traktApi);
    }
});

// Intent that starts the account linking flow.
TraktAgent.intent('Signin Request', (conv) => convs.signIn.signInLauncher(conv));

// The intent is linked to the `actions_intent_SIGN_IN` event, and thus starts when a sign in request is made, and is either refused or accepted
TraktAgent.intent('Signin Action', (conv, params, signin) => convs.signIn.signInHandler(conv, params, signin, traktApi));


TraktAgent.intent('Checkin Stop', (conv) => conv.ask(new Confirmation(`Okay. Are you sure to stop the current checkin right now ?`))
    // On DialogFlow, the followup intent managing the confirmation then has to have 'actions_intent_CONFIRMATION' as a trigger event, to handle the answer.
);

//Todo : warning, if the checkin had to be stopped in order to checkin something else
// We'll have to answer differently and provide the user with the checkin he initially asked for.
TraktAgent.intent('Checkin Stop - Confirmation', (conv, params, confirmation) => convs.checkIn.checkInStopHandler(conv, params, confirmation, traktApi));


//Todo : remove other actions contexts when starting an action. Ex : starting the add_watchlist should remove checkin_context
TraktAgent.intent('Checkin Start', (conv, params) => {

    //Todo : set contexts lifespan high on DF so that we don't forget the point if we take a lot of time in the search intent.
    const {media_item_name, media_type, year, episode_number, season_number} = conv.contexts.get(AppContexts.DATA_ADDITION).parameters;
    //Todo : Mark some parameters as not required in DF if we want to be able to access the data collection intents ourselves for slot filling

    //Todo What to do if the user asks for the last episode or the newest ? The entity currently detects a number or ordinal so it will have to be changed on Dialogflow's end.
    //"last" could be set as a synonym of -1 in DF, and then -1 could be handled properly by the fulfillment..

    //We followup in the SEARCH_DETAILS intent, which launches a search request and displaying the results to the user.
    conv.followup(AppContexts.SEARCH_DETAILS, {
        textQuery: media_item_name,
        media_type: media_type,
        year: year,
        search_page: 1, //todo handle page changes through an intent.
        takeBestResultAboveThreshold: true
    });//Watch out ! followup takes an *event* as input, and not an intent ! And these events' values  are obtained just like if it was a context...

    //SearchDetails goes back to Checkin confirmation when finished because the CheckinData context is still set.

});

//Is called after a choice was made from the search results, and the user confirmed he wanted to check in it.
TraktAgent.intent('Checkin Start - Confirmation', async (conv, params) => {
    conv.ask(`Sure`);
    let confirmedItem = conv.contexts.get(AppContexts.SEARCH_CHOICE).parameters.chosenItem;
    let mediaType = confirmedItem.type;
    let itemToSend = {
        [mediaType]: confirmedItem[mediaType]
    };

    let isItemReadyToSend = true;
    let confirmedMediaString = confirmedItem[mediaType].title;

    //For a movie item, we just have to send the movie item to the checkin endpoint.
    if (mediaType === "show") {//For a show however, we have to add a episode key along with the item to send to the API, to specify the episode to check into.
        isItemReadyToSend = populateCheckinItemEpisodeValues(conv, itemToSend);
        confirmedMediaString += itemToSend.season ? ` season ${itemToSend.episode.season} episode ${itemToSend.episode.number}` : ` episode ${itemToSend.episode.number_abs}`;
    }

    if (isItemReadyToSend) {
        try {
            let successfulCheckin = await traktApi.checkInItem(conv.user.access.token, itemToSend);
            conv.close(`Check in of ${confirmedMediaString} successful ! Have a nice watch ! `);
            //Todo : delete additional data (& other) contexts on DF or here on success to "go back" to the beginning, or even exit to let the user watch
            conv.contexts.delete(AppContexts.DATA_ADDITION);
            conv.resetContexts(true);

        } catch (err) {//Todo handle different types of failure?
            conv.ask(`There was an issue checking in ${confirmedMediaString}.`);
        }
    } else {//We are missing some data to be able to send the checkin request.
        conv.data.followupEventAfterPrompt = AppContexts.CHECKIN_CONFIRMATION;//We note this value in the conversation data, to know that we must directly follow up to come back here once the value was obtained.
        conv.contexts.set(AppContexts.PROMPT.EPISODE, 3);
        conv.ask(new SimpleResponse({
                speech: `Okay ! Which season and/or episode are you watching ?`,
                text: `Which season/episode are you watching ?`
            })
        );
    }
});

/**
 * Populates a dictionary with a episode key, in order for it to be accepted by Trakt Checkin endpoint. Also updates a media description string.
 * @param conv : object conversation object, containing the contexts and relevant informations.
 * @param itemToCheckin : object dictionary containing the show object to send to the Trakt API, but missing its episode key. {@link https://trakt.docs.apiary.io/#reference/checkin/checkin/check-into-an-item}
 */
function populateCheckinItemEpisodeValues(conv, itemToCheckin) {
    let success = false;
    //TODO Handle missing data
    let userInputs = conv.contexts.get(AppContexts.DATA_ADDITION).parameters;
    itemToCheckin.episode = {};
    if (userInputs.season_number && userInputs.episode_number) {
        itemToCheckin.episode.season = userInputs.season_number;
        itemToCheckin.episode.number = userInputs.episode_number;
        success = true;
    } else {
        if (userInputs.episode_number) {//We only have episode number : we set it as the absolute episode number, among all seasons.
            itemToCheckin.episode.number_abs = userInputs.episode_number;
            success = true;
        } else {
            //The episode number is not set, the season number may be unset too but it doesn't matter since we do need at least an episode number.
            //We are therefore still missing episode info.
            success = false;
        }
    }
    return success;
}

/** Follows up by returning to a specified intent, stored in conv.data.followupEventAfterPrompt.
 * Can be used to return back to the previous intent immediately after receiving the prompt answer.
 * @param conv : Object conversation object.
 */
function followupAfterPrompt(conv) {
    console.log(`Prompt over. following back with : ${conv.data.followupEventAfterPrompt}`);
    if (conv.data.followupEventAfterPrompt) {
        conv.followup(conv.data.followupEventAfterPrompt);
        delete conv.data.followupEventAfterPrompt;
    }
}

//Triggered when the user provided season / episode after being prompted to.
TraktAgent.intent('Prompt - Season & Episode', async (conv, params) => {
    conv.contexts.set(AppContexts.PROMPT.EPISODE, 0);//Removes the prompt context now that the value was submitted
    followupAfterPrompt(conv);
});


TraktAgent.intent('SearchDetails', (conv, params) => searchHandler(conv, params));

async function searchHandler(conv, params) {
    //If the result relevance score is >=900/1000, we assume it is a relevant match and skip displaying the searchResults list to the user.
    const assumeGoodMatchThreshold = 900;//Todo : this is a test value to adjust.

    //TODO HANDLE EPISODES/SHOWS. Working with movies rn.
    let {media_type, search_page, textQuery, year, takeBestResultAboveThreshold} = conv.contexts.get(AppContexts.SEARCH_DETAILS).parameters;
    //Google Assistant can send the object as an argument, but we can't do that by ourselves with conv.followup. So the data is in the event context

    //Todo search only if the query changed.
    let searchResults = await traktApi.getSearchResults({textQuery, year},
        parseInt(search_page), media_type, true, 5);

    //We store the search searchResults in the context so that we can "continue" from here if the user needs to check the next page or go back to the search after a wrong choice.
    //We also change the default behavior or selecting the (seemingly) most relevant item sometimes.
    conv.contexts.set(AppContexts.SEARCH_DETAILS, 5, {
        media_type,
        search_page, textQuery, year,
        takeBestResultAboveThreshold: false,
        results: searchResults
    });//
    switch (searchResults.length) {
        case 0:
            conv.ask(`There are no results for ${textQuery}. Please retry with another query.`);
            break;
        case 1://If there is a single result, no need to display a list - we follow up as if the user choes this result.
            conv.followup(AppContexts.SEARCH_CHOICE, {option: 0});
            break;
        default://2 or more searchResults
            if (takeBestResultAboveThreshold && searchResults[0].score > assumeGoodMatchThreshold
                && searchResults[1].score < assumeGoodMatchThreshold) {//Multiple searchResults with the same name can have a 1000/1000 score so we have to check if there are multiple searchResults above the threshold.
                //If there is only one relevant result, we follow up with it, skipping the display of all searchResults.
                conv.followup(AppContexts.SEARCH_CHOICE, {option: 0});
            } else {//If there are multiple searchResults, and we couldn't take a guess, we display all searchResults.
                //todo see if a list is better suited than a carousel here. Useful sample https://github.com/actions-on-google/dialogflow-conversation-components-nodejs/blob/master/functions/index.js
                //Send to the user a carousel of searchResults to choose from
                let responses = (await convs.richResponses.buildCarouselFromTraktEntries(searchResults, tmdb));
                let suggestions = new Suggestions("The first one", "More results");//TODO add it to my watchlist, etc

                conv.ask(...responses, suggestions);//The spread operator sends the responses array as if they were multiple parameters. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
                //TODO Del func displayResultsCarousel(conv, searchResults);
            }
            break;
    }
}


//Answers to a choice event from google assistant, after displaying a carousel/list for example..
//also answers a search_choice_event from ourselves, if we think the result is most likely what the user wants,
TraktAgent.intent('SearchDetails - Choice', async (conv, params, option) => convs.search.searchChoiceHandler(conv, params, option));

async function searchChoiceHandler(conv, params, option) {

    let chosenOptionIndex;
    //Google Assistant can send the object as an argument to the option parameter, but we can't do that by ourselves with conv.followup.
    //So the choosed option is either in the event context, or in the option parameter.

    let eventContext = conv.contexts.get(AppContexts.SEARCH_CHOICE);
    chosenOptionIndex = (eventContext !== undefined) ? eventContext.parameters.option : option;

    let chosenItem = conv.contexts.get(AppContexts.SEARCH_DETAILS).parameters.results[chosenOptionIndex];

    conv.contexts.set(AppContexts.SEARCH_CHOICE, 1, {chosenItem});
    let responses = await convs.richResponses.buildCardFromTraktItem(chosenItem, tmdb);//todo generate depending on choice.type (movie,show, episode..)
    let suggestions = new Suggestions("Yes", "Not this one", "go back to the results");//TODO add it to my watchlist, etc
    conv.ask(...responses, suggestions);//The spread operator sends the responses array as if they were multiple parameters. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
}

TraktAgent.intent('SearchDetails - Choice refused', async (conv, params) => {
    conv.followup(AppContexts.SEARCH_DETAILS, conv.contexts.get(AppContexts.SEARCH_DETAILS).parameters);//TODO Replace most followups by simple functions calls
    //We have to pass the orginal context parameters because it deletes all the context's parameters otherwise. Should separate events and contexts better.
});

TraktAgent.intent('SearchDetails - More results', async (conv, params) => {
    let searchDetailsParams = conv.contexts.get(AppContexts.SEARCH_DETAILS).parameters;
    searchDetailsParams.search_page += 1;
    conv.followup(AppContexts.SEARCH_DETAILS, searchDetailsParams);//TODO Replace most followups by simple functions calls
    //We have to pass the orginal context parameters because it deletes all the context's parameters otherwise. Should separate events and contexts better.
});

// Todo : Fill help intent text on dialogflow

//Todo : Review ALL text dialogs and suggestions, and add them to separated strings
//Todo : Set conversations as end when needed

//Todo : Firebase free invocation quota is around 1 million. It may prove useful to optimize the the number of calls to the webhook.

//Todo : Update Actions Console on Google directory info before deploying any Prod/Beta/Alpha to the public.
// as welll as the account linking instructions. It is filled with fake data from the staging environment right now.

/**
 * Set the DialogflowApp object to handle the HTTPS POST request.
 */
exports.dialogflowFirebaseFulfillmentBeta = functions
    .https.onRequest(TraktAgent);
