const {SignIn} = require('actions-on-google');

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

module.exports = {
    signInLauncher,
};
