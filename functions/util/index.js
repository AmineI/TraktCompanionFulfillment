/**
 *Returns a random response from an results.
 * @param ResponsesArray {Response[]|string[]} Array of responses
 * @returns {Response|string}
 */
function getRandomResponse(ResponsesArray) {
    //A random integer index between 0 and the results length (excluded, since arrays start at 0.)
    let randomIndex = Math.floor(Math.random() * ResponsesArray.length);//Math.random c [0,1[.
    return ResponsesArray[randomIndex];
}

function getPlaceholderPosterUrl(size = "500x750", text = " ") {
    return `https://via.placeholder.com/${size}?text=${text}`
}

//TODO use this properly when needed ?
function requestErrorHandler(conv, err) {
    // API call failed...
    console.error(err);
    conv.ask(`Ouch, I got a ${err.statusCode} network error trying to communicate with Trakt. Todo : Close the conversation or get it back on track..t.`);
    //Todo : Remove this message ofc. Allows user to retry requests, maybe ?
}

module.exports = {
    getRandomResponse,
    getPlaceholderPosterUrl,
    requestErrorHandler
};
