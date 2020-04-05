async function checkInStopHandler(conv, params, confirmation, traktApiInstance) {
    if (!confirmation) {
        conv.ask(`Fine, won't do. How else may I be of assistance ?`);
        return false;
    } else {
        let success = await traktApiInstance.deleteCheckins(conv.user.access.token);
        if (success) {
            conv.ask(`The checkin was successfully stopped`);
            conv.ask(`Anything else I can do to assist ?`);
            return true;
        } else {
            util.requestErrorHandler(conv);
        }
    }
}

module.exports = {
    checkInStopHandler,

};
