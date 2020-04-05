//TODO : Move everything to axios

//Todo : Examine if request-promise-native would be better for Node.js v8.
const rp = require("request-promise");

class TraktApi {
    constructor(clientId, endpoint) {
        this.clientId = clientId;
        this.APIEndpoint = "https://api.trakt.tv";
        if (endpoint) {
            this.APIEndpoint = endpoint;
        }
    }

    getUserSettings(token) {
        let settingsOptions = {
            method: 'GET',
            uri: `${this.APIEndpoint}/users/settings`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'trakt-api-version': '2',
                'trakt-api-key': `${this.clientId}`
            }, json: true,
            resolveWithFullResponse: true
        };
        return rp(settingsOptions);
    };

//Todo test
    /**
     *
     * @param token auth Access token
     * @param textQuery : string Text query to search for
     * @param years : number 4 digit year, or range of years
     * @param page : number result page to get
     * @param types=["show","movie"] : (string[]|string) : ["show","movie","episode"] A list to filter the search - obtaining only the media types specified.
     * Todo POSSIBLE_MEDIA_TYPES = { SHOW: "show", MOVIE: "movie", EPISODE: "episode"}
     * @param extended : boolean whether to get extended results or not.
     * @param limit : number number of items per page.
     */
    getSearchResults(token, {textQuery, year = ""}, page = 1, types = ["show", "movie"], extended = false, limit = 10) {
        if (types === "") {//
            types = ["show", "movie"];
        }
        let searchOptions = {
            method: 'GET',
            uri: `${this.APIEndpoint}/search/${types}?page=${page}&limit=${limit}${extended === true ? `&extended=full` : ''}${year !== "" ? `&years=${year}` : ''}&query=${encodeURIComponent(textQuery)}`, //-> search/type1,type2,type3?..
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'trakt-api-version': '2',
                'trakt-api-key': `${this.clientId}`
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

    /**
     * @param token auth Access token
     * @param id : string Text query to search for
     * @param id_type="trakt" : string : "","",""  : string Text query to search for
     * @param media_types=["show","movie"] : (string[]|string) : ["show","movie","episode"] A list to filter the search - obtaining only the media types specified.
     * Todo POSSIBLE_MEDIA_TYPES = { SHOW: "show", MOVIE: "movie", EPISODE: "episode"}
     * @param extended=true : boolean whether to get extended results or not.
     */
    getResultById(token, id, id_type = "trakt", media_types = ["show", "movie"], extended = true) {
        if (media_types === "") {//
            media_types = ["show", "movie"];
        }
        let searchOptions = {
            method: 'GET',
            uri: `${this.APIEndpoint}/search/${id_type}/${encodeURIComponent(id)}?type=${media_types}${extended === true ? `&extended=full` : ''}`, //-> search/type1,type2,type3?..
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'trakt-api-version': '2',
                'trakt-api-key': `${this.clientId}`
            }, json: true,
            resolveWithFullResponse: true
        };
        return rp(searchOptions);

    };

    checkInItem(token, item) {
        let requestOptions = {
            method: 'POST',
            uri: `${this.APIEndpoint}/checkin`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'trakt-api-version': '2',
                'trakt-api-key': `${this.clientId}`
            }, json: item,
            resolveWithFullResponse: true
        };
        return rp(requestOptions);

//Todo : Manage checkin error when starting a new checkin
// "If a checkin is already in progress, a 409 HTTP status code will returned. The response will contain an expires_at timestamp which is when the user can check in again."

    };

//Todo : Note, As per https://trakt.tv/branding
// Checkin seems to be mobile-oriented while Scrobble is meant to be seamless to the user, being attached to play pause stop events etc, in a media player.

    deleteCheckins(token) {
        let requestOptions = {
            method: 'DELETE',
            uri: `${this.APIEndpoint}/checkin`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'trakt-api-version': '2',
                'trakt-api-key': `${this.clientId}`
            }, json: true,
            resolveWithFullResponse: true
        };
        return rp(requestOptions);
    };


}

/**
 * Launch the API request to obtain the user's settings.
 * https://trakt.docs.apiary.io/reference/users/settings
 * @param token auth Access token
 */


module.exports = (clientId, endpoint) => new TraktApi(clientId, endpoint);
