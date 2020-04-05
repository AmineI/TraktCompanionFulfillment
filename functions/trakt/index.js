//Todo : Regarding API calls, it may be relevant to fetch the popular movies once in a while to "cache" them in some storage somewhere ?
const axiosModule = require("axios");

const TraktCallErrorMessage = "An issue occurred interacting with the TMDB API";

class TraktApi {
    constructor(clientId, endpoint) {
        this.clientId = clientId;
        this.APIEndpoint = "https://api.trakt.tv";
        if (endpoint) {
            this.APIEndpoint = endpoint;
        }
        this.axios = axiosModule.create({
            baseURL: this.APIEndpoint,
            headers: {
                'Content-Type': 'application/json',
                'trakt-api-version': '2',
                'trakt-api-key': `${this.clientId}`
            },
        });
    }

    /**
     * @param token : string auth access token
     */
    async getUserSettings(token) {
        try {
            const res = await this.axios({
                method: 'GET',
                url: `/users/settings`,
                headers: {'Authorization': `Bearer ${token}`}
            });
            return res.data;
        } catch (err) {
            console.error(err.response.status);
            console.error(err.config);
            throw TraktCallErrorMessage;
        }
    };

    /**
     * @param textQuery : string Text query to search for
     * @param years : number 4 digit year, or range of years
     * @param page : number result page to get
     * @param types=["show","movie"] : (string[]|string) : ["show","movie","episode"] A list to filter the search - obtaining only the media types specified.
     * Todo POSSIBLE_MEDIA_TYPES = { SHOW: "show", MOVIE: "movie", EPISODE: "episode"}
     * @param extended : boolean whether to get extended results or not.
     * @param limit : number number of items per page.
     */
    async getSearchResults({textQuery, year = ""}, page = 1, types = ["show", "movie"], extended = false, limit = 10) {
        (types === "") ? types = ["show", "movie"] : '';
        let params = {
            page: page,
            limit: limit,
            query: textQuery
        };
        (extended) ? params.extended = 'full' : '';
        (year !== "") ? params.years = year : '';

        try {
            const res = await this.axios({
                method: 'GET',
                url: `/search/${types}`, //-> search/type1,type2,type3?..
                params
            });
            return res.data;
        } catch (err) {
            console.error(err.response.status);
            console.error(err.config);
            throw TraktCallErrorMessage;
        }
    };

    /**
     * @param id : string id of the media we want more information about
     * @param id_type="trakt" : string Type of Id we have
     * Todo POSSIBLE_ID_TYPES = ["trakt", "TMDB", "tvdb",...]
     * @param media_types=["show","movie"] : (string[]|string) : ["show","movie","episode"] media type of the id we have.
     * Todo POSSIBLE_MEDIA_TYPES = { SHOW: "show", MOVIE: "movie", EPISODE: "episode"}
     * @param extended=true : boolean whether to get extended results or not.
     */
    async getResultById(id, id_type = "trakt", media_types = ["show", "movie"], extended = true) {
        (media_types === "") ? media_types = ["show", "movie"] : '';
        let params = {type: media_types};
        (extended) ? params.extended = 'full' : '';

        try {
            const res = await this.axios({
                method: 'GET',
                url: `/search/${id_type}/${id}`, //-> search/trakt/id
                params
            });
            return res.data;
        } catch (err) {
            console.error(err.response.status);
            console.error(err.config);
            throw TraktCallErrorMessage;
        }
    };

    async checkInItem(token, item) {
        try {
            const res = await this.axios({
                method: 'POST',
                url: `/checkin`,
                data: item,
                headers: {'Authorization': `Bearer ${token}`}
            });
            return (res.status === 201);
        } catch (err) {
            console.error(err.response.status);
            console.error(err.config);
            throw {status: err.response.status, message: TraktCallErrorMessage};
        }
        //Todo : Manage checkin error when starting a new checkin 401 when something is missing I think
        // "If a checkin is already in progress, a 409 HTTP status code will returned. The response will contain an expires_at timestamp which is when the user can check in again."

        //Todo : Note, As per https://trakt.tv/branding
        // Checkin seems to be mobile-oriented while Scrobble is meant to be seamless to the user, being attached to play pause stop events etc, in a media player.
    };

    async deleteCheckins(token) {
        try {
            const res = await this.axios({
                method: 'DELETE',
                url: `/checkin`,
                headers: {'Authorization': `Bearer ${token}`}
            });
            return (res.status === 204);
        } catch (err) {
            console.error(err.response.status);
            console.error(err.config);
            return false;
        }
    };


}

/**
 * Launch the API request to obtain the user's settings.
 * https://trakt.docs.apiary.io/reference/users/settings
 * @param token auth Access token
 */


module.exports = (clientId, endpoint) => new TraktApi(clientId, endpoint);
