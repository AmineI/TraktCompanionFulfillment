const {
    SignIn,
    Suggestions,
    SimpleResponse
} = require('actions-on-google');

//TODO Always check the user's verification status before storing data with userStorage or starting an Account Linking flow to prevent guest users from interacting with a feature that will fail for them.
// https://developers.google.com/assistant/conversational/save-data
/**
 * Launch the account linking request with the SignIn helper.
 * @param conv Conversation Object
 */
function signInLauncher(conv) {
    //TODO : On Google assistant, these messages are not displayed. Find a way to manage this gracefully.
    conv.ask("You'll have to authorize this application from your Trakt account so that you can interact with your lists from here.");
    conv.ask(new SignIn('To let you manage your Trakt account'));
    //Prompt the user to sign in, and then fire the `actions_intent_SIGN_IN` event, which starts any matching intent with that event as input.
}

//TODO Refactor
/**
 * Handle the status of the user's sign in, after a response from the SignIn helper.
 * @param conv Conversation object
 * @param params
 * @param signin signin.status=='OK' when the sign in was successfully completed.
 * @returns {Promise<T | boolean> | boolean} Promise that returns when the user's Trakt data has been fetched. //Todo : What data to fetch at this moment ? List Sync ?
 */
async function signInHandler(conv, params, signin, traktApiInstance) {
    if (signin.status !== 'OK') {
        conv.close(`Without the authorization to do so on your Trakt account, I won't be able to update your lists for you.`);

        let NoSignInMessage2 = new SimpleResponse({
            speech: '<speak>If you believe I may be evil - <prosody volume="soft" pitch="-10%" rate="100%"> despite my beautiful voice </prosody>- ' +
                'you can check my source code on GitHub ! <break time="0.5s"/>' +
                'I only do what you ask, and have <emphasis level="moderate"> absolutely no secret need </emphasis>' +
                'to fill your account with my own favorite shows.</speak>',
            text: 'If you believe I may be evil, you can check my source code on GitHub:\n' + //Todo : make the Github public indeed, before the eventual release.
                'I only do what you ask, and have no secret need to fill your account with my own favorite shows 😉.'
        });
        conv.close(NoSignInMessage2);
    } else {
        try {
            let userSettings = await traktApiInstance.getUserSettings(conv.user.access.token);

            // Todo : This allows to avoid sending back the whole userStorage in turns where its content didn't change.
            // See https://developers.google.com/actions/assistant/save-data#clear_content_of_the_userstorage_field
            //conv.user.storage = {};

            //Todo : Obtaining consent prior to accessing userStorage. [Some countries have regulations that require developers to obtain consent from the user before they can access, or save certain information (e.g. personal information) in the userStorage. If you operate in one of these countries and you want to access, or save such information in userStorage, you must use the Confirmation helper to ask consent to the user and obtain the consent before you can start storing such information in userStorage.]
            //Todo : Tell user what we're saving and offer to change these
            conv.user.storage.TraktUserSettings = {
                timezone: userSettings.account.timezone,
                date_format: userSettings.account.date_format,
                time_24hr: userSettings.account.time_24hr,
            };//Todo : Use timezone and format.
            conv.user.storage.name = userSettings.user.name.split(" ")[0];// Todo : intent to change the user name. There are prebuilt ones on DialogFlow

            //TODO Should I refresh these settings once in a while ?
            conv.ask(`Now that I have your authorization, ${conv.user.storage.name}, I'll be able to do a lot for you - starting with checking in to a movie or show.`)// TODO Add later : for you, add something to your watchlist, and more regarding your Trakt lists and history.`);
            conv.ask(`If you want to know more, just ask ! Anything I can do for you right now ?`);
            conv.ask(new Suggestions("What can you do ?", "I'm watching Batman", "Check in The Office"));//TODO : , "What's next to watch ?", "Call me Master"));
            //Todo change these suggestions and shorten this dialog.

        } catch (err) {
            util.requestErrorHandler(conv, err)
        }
    }

}


module.exports = {
    signInLauncher,
    signInHandler
};
