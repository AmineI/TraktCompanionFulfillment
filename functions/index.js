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
    DATA_ADDITION: 'additiondata',
    SEARCH_DETAILS: 'searchdetails',
    SEARCH_CHOICE: 'searchchoice'
};
//Note : Contexts names are converted to lowercase by DialogFlow

/** Dialogflow Context Lifespans {@link https://dialogflow.com/docs/contexts#lifespan} */
const Lifespans = {
    DEFAULT: 5,
};



let tmdb = {};
tmdb.getImageUrl = (mediaType, TMDBId) => {
    //TODO Implement TMDB API, this is a placeholder.
    return 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/kBf3g9crrADGMc2AMAMlLBgSm2h.jpg';

    //TODO : attribute images from TMDB.
};

//Todo : Correctly handle errors.

//Todo : DialogFlow : Handle the case when user explicitly ask to refresh his information. or not since he can unlink through G.Assistant
//Todo : In this case, tell him how to unlink account maybe ?
/**
 * Launch the account linking request with the SignIn helper.
 * @param conv Conversation Object
 */
function signInLauncher(conv) {
    conv.ask("You'll have to authorize this application from your Trakt account so that you can interact with your lists from here.");
    conv.ask(new SignIn('To let you manage your Trakt account'));
    //Prompt the user to sign in, and then fire the `actions_intent_SIGN_IN` event, which starts any matching intent with that event as input.
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
                conv.ask(new Suggestions("What can you do ?", "I'm watching Batman", "What's next to watch ?", "Call me Master"));
                //Todo change these suggestions.
                return true;
            })
            .catch((conv, err) => util.requestErrorHandler(conv, err));
    }

}


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
        let responseMessage = util.getRandomResponse(["Oh hai ! What can I do for you :) ?",
            "Holà, how can I help you ?",
            "It's you ! What do you want me to do ?",
            "Hello! How can I help you?",
            "Good day! What can I do for you today?",
            "Greetings! How can I assist?"]);//Todo : Watch out, the "smiley face" is read aloud.
        conv.ask(responseMessage);
        conv.ask(new Suggestions("What can you do ?", "Check in to $popular", "Add to my watchlist", "I've seen $popular_movie", "What's next to watch ?"))
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
        return traktApi.deleteCheckins(conv.user.access.token)//Todo check response for errors
            .then(response => {
                conv.ask(`The checkin was successfully stopped`);
                conv.ask(`Anything else I can do to assist ?`);
                return true;
            })
            .catch((err) => util.requestErrorHandler(conv, err));
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
            takeBestResultAboveThreshold: true
        });//Watch out ! followup takes an *event* as input, and not an intent !
        //todo ?season_number:season_number,
        //Todo ? episode_number:episode_number

        //Todo SearchDetails intent must go back to Checkin confirmation when finished.
        //conv.ask(new Confirmation(`Confirm checkin of ${media_item_name} ?`));//Todo mention episodes when needed through a message constructor.
    }
});

TraktAgent.intent('Checkin Start - Confirmation', (conv, params) => {
    conv.ask(`Sure`);
    let confirmedItem = conv.contexts.get(AppContexts.SEARCH_CHOICE).parameters.chosenItem;
    let type = confirmedItem.type;
    let confirmedItemString = confirmedItem[type].title;
    //TODO FOR EPISODE TOO. This works for movie but returns a show if we searched for an episode. We must get the episode from trakt.
    if (type === "episode") {//TODO : the type will not be episode I think, but most likely a show, to which I'll add the episode number asked.
        confirmedItemString += ` season ${confirmedItem.season} episode ${confirmedItem.number}`
    }
    return traktApi.CheckinItem(conv.user.access.token, {[type]: confirmedItem[type]})
        .then(response => {
                console.log(response.statusCode);
                conv.ask(`Check in ${confirmedItemString} confirmed ! Have a nice watch ! `);
                //Todo : delete additional data (& other) contexts on DF or here on success to "go back" to the beginning, or even exit to let the user watch
                return true;
            }
        ).catch(err => {
            console.error(err);
            //Todo handle different types of failure
            conv.ask(`There was an issue checking in ${confirmedItemString}.`);
            return;
        });
});


//Todo, specify between types, and rename
function displayResultsCarousel(conv, results) {

    if (!conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')) {
        conv.ask('Sorry, try this on a screen device or select the ' +
            'phone surface in the simulator.');
        //todo say the first result or something
    }
    let type, item, itemTitle;
    let carouselItems = {};
    let itemIndex = 0;
    let itemTitlesCountsArray = [];
    results.forEach(result => {
            type = result.type;
            item = result[type];
            itemTitle = `${item.title} (${item.year})`;

            //Handle cases where multiple items have the same title, since this is not allowed by Google Assistant. We thus  append a number after the item.
            if (itemTitle in itemTitlesCountsArray) {
                itemTitlesCountsArray[itemTitle] += 1;
                itemTitle += ` (${itemTitlesCountsArray[itemTitle]})`
            } else {
                itemTitlesCountsArray[itemTitle] = 1
            }
            // carouselItems must be a dictionary which key will be returned on selection.
            // We use the index of the element in the search results as a key for ease of use when gathering the result after select.
            carouselItems[itemIndex] = {
                synonyms: [//TODO find synonyms ?
                ],
                title: itemTitle,//Titles must be unique.
                description: item.overview,
                image: new Image({
                    url: tmdb.getImageUrl(type, item.ids.tmdb),//TODO What if tmdb id not set ?
                    alt: `Poster of ${item.title}`
                })
            };
            itemIndex++;
        }
    );

    conv.ask(new Carousel({
        title: 'Matching Results',
        items: carouselItems
    }));
    return;
}

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
    conv.ask(`Sure, here are the details of the ${choice.type} ${item.title}, is it ok ?`);

    conv.ask(new BasicCard({
        subtitle: `Runtime ${item.runtime}min - ` + (item.tagline || `${item.aired_episodes} aired episodes`),//todo : tagline exists only on movies, and aired episodes only on shows. I believe.
        title: `${item.title} (${item.year})`,
        text: item.overview,
        buttons: new Button({
            title: 'Trakt page',
            url: `https://trakt.tv/${choice.type}s/${item.ids.slug}`,//todo : this is only valid for show & movie
        }),
        image: new Image({
            url: tmdb.getImageUrl(choice),//todo get from tvdb/tmdb since trakt doesn't give them anymore I think. CHeck their blog post https://apiblog.trakt.tv/how-to-find-the-best-images-516045bcc3b6
            alt: 'Batman logo from tmdb',
        }),
        display: 'WHITE',
    }));
    /*text2: `*emphasis* or _italics_, **strong** or __bold__,
     and ***bold itallic*** or ___strong emphasis___ as well as other things like line  \nbreaks`,
     // Note the two spaces before '\n' required for a line break to be rendered in the card.
     //TODO remove text2 which is here for info purpose.
 */
    return;

}

//Answers to a choice event from google assistant and a search_choice_event from ourselvesan
TraktAgent.intent('SearchDetails - Choice', (conv, params, option) => {
    let chosenOptionIndex;
    //Google Assistant can send the object as an argument to the option parameter, but we can't do that by ourselves with conv.followup.
    //So the choosed option is either in the event context, or in the option parameter.

    let eventContext = conv.contexts.get(AppContexts.SEARCH_CHOICE);
    chosenOptionIndex = (eventContext !== undefined) ? eventContext.parameters.option : option;

    let chosenItem = conv.contexts.get(AppContexts.SEARCH_DETAILS).parameters.results[chosenOptionIndex];

    conv.contexts.set(AppContexts.SEARCH_CHOICE, 1, {chosenItem});
    displayItemChoice(conv, chosenItem);//todo Display depending on choice.type (movie,show, episode..)

    /* If the initial search was done without the "extended" parameter we have to do this to get more details
    return traktApi.getResultById(conv.user.access.token, chosen_option[chosen_option.type].ids.trakt, "trakt", chosen_option.type)
        .then(response => {
                let result = response.body[0];
                displayItemChoice(conv, result);
                return;
            });
     */
});

TraktAgent.intent('SearchDetails', (conv, params) => {
    //If the result relevance score is >=900/1000, we assume it is a relevant match and skip displaying the results list to the user.
    const assumeGoodMatchThreshold = 900;//Todo : this is a test value to adjust.

    //TODO HANDLE EPISODES/SHOWS. Working with movies rn.
    let {media_type, search_page, textQuery, year, takeBestResultAboveThreshold} = conv.contexts.get(AppContexts.SEARCH_DETAILS).parameters;
    //Google Assistant can send the object as an argument, but we can't do that by ourselves with conv.followup. So the data is in the event context

    //Todo search only if the query changed.
    return traktApi.getSearchResults(conv.user.access.token,
        {textQuery, year},
        parseInt(search_page), media_type, true, 5)
        .then(response => {
                let results = response.body;
                //We store the search results in the context so that we can "continue" from here if the user needs to check the next page or go back to the search after a wrong choice.
                conv.contexts.set(AppContexts.SEARCH_DETAILS, 5, {
                    media_type,
                    search_page, textQuery, year,
                    results
                });
                switch (results.length) {
                    case 0:
                        conv.ask("There are no results. Please retry with another query.");
                        break;
                    case 1://If there is a single result, no need to display a list - we follow up as if the user choes this result.
                        conv.followup(AppContexts.SEARCH_CHOICE, {option: 0});
                        break;
                    default://2 or more results
                        if (takeBestResultAboveThreshold && results[0].score > assumeGoodMatchThreshold
                            && results[1].score < assumeGoodMatchThreshold) {//Multiple results with the same name can have a 1000/1000 score so we have to check if there are multiple results above the threshold.
                            //If there is only one relevant result, we follow up with it, skipping the display of all results.
                            conv.followup(AppContexts.SEARCH_CHOICE, {option: 0});
                        } else {//If there are multiple results, and we couldn't take a guess, we display all results.
                            conv.ask("Here are the results");
                            //todo see if a list is better suited than a carousel here. Useful sample https://github.com/actions-on-google/dialogflow-conversation-components-nodejs/blob/master/functions/index.js
                            //Send to the user a carousel of results to choose from
                            displayResultsCarousel(conv, results);
                        }
                        break;
                }
                return;
            }
        );
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
