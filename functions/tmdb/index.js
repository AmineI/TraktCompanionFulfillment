const axiosModule = require('axios').default;

const tmdbEndpoint = "https://api.themoviedb.org/3/";

const axios = axiosModule.create({
    baseURL: tmdbEndpoint
});

ImageSize = {
    "Backdrop": {
        "SMALL": "w300",
        "MEDIUM": "w780",
        "BIG": "w1280",
        "ORIGINAL": "original"
    },
    "Logo": {
        "ULTRA_SMALL": "w45",
        "SUPER_SMALL": "w92",
        "SMALL": "w154",
        "MEDIUM": "w185",
        "BIG": "w300",
        "SUPER_BIG": "w500",
        "ORIGINAL": "original"
    },
    "Poster": {
        "SUPER_SMALL": "w92",
        "SMALL": "w154",
        "MEDIUM": "w185",
        "BIG": "w500",
        "SUPER_BIG": "w780",
        "ORIGINAL": "original"
    },
    "Profile": {
        "SMALL": "w45",
        "MEDIUM": "w185",
        "BIG": "h632",
        "ORIGINAL": "original"
    },
    "Still": {
        "SMALL": "w92",
        "MEDIUM": "w185",
        "BIG": "w300",
        "ORIGINAL": "original"
    }
};
const TMDBCallErrorMessage = "An issue occurred interacting with the TMDB API";

class TMDB {
    constructor(ApiKey) {
        this.APIKey = ApiKey;
    };

    async getPosterUrl(mediaType, mediaTMDBId) {
        if (mediaTMDBId == null) {
            return null;
        }
        const posterPath = await this.getPosterPath(mediaType, mediaTMDBId);
        return this.buildImageUrl(posterPath, ImageSize.Poster.ORIGINAL);
        //TODO : Indicate somewhere that the image source is TMDB.
    };


    async searchMovieData(movieName, releaseYear = null) {
        try {
            const res = await axios({
                method: 'GET',
                url: `movie/search/movie`,
                params: {
                    api_key: this.APIKey,
                    query: movieName,
                    year: releaseYear
                }
            });
            return res.data;
        } catch (err) {
            console.error(err);
            throw TMDBCallErrorMessage;
        }
    }


    async getMovieData(movieid, optionalPath, optionalParams = {}) {
        try {
            const res = await axios({
                method: 'GET',
                url: `movie/${movieid}${optionalPath}`,
                params: Object.assign({
                    api_key: this.APIKey
                }, optionalParams)
            });
            return res.data;
        } catch (err) {
            console.error(err);
            throw TMDBCallErrorMessage;
        }
    }


    async getShowData(showId, optionalPath, optionalParams = {}) {
        try {
            const res = await axios({
                method: 'GET',
                url: `tv/${showId}${optionalPath}`,
                params: Object.assign({
                    api_key: this.APIKey
                }, optionalParams)
            });
            return res.data;
        } catch (err) {
            console.error(err);
            throw TMDBCallErrorMessage;
        }
    }

    async getPosterPath(mediaType, mediaId) {
        const getMediaData = (mediaType == "show") ? this.getShowData : this.getMovieData;
        try {
            const resbody = await getMediaData.call(this, mediaId, "/images", {"include_image_language": "en,null"});//We must pass the "this" context on call, as it is lsot otherwise with a standard function call
            return resbody.posters[0].file_path;//TODO Handle errors, as some entries don't have posters sometimes.
        } catch (err) {
            console.error(err);
            throw TMDBCallErrorMessage;
        }
    }

    async getDirector(movieid) {/*
        return this.getMovieData(movieid, '/credits').then(responseBody => {
            for (let crewMember of responseBody.crew) {
                if (crewMember.job === "Director") {
                    return crewMember;
                }
            }
            return undefined;
        });*/

        try {
            const resbody = await this.getMovieData(movieid, '/credits');
            for (let crewMember of resbody.crew) {
                if (crewMember.job === "Director") {
                    return crewMember;
                }
            }
            return null;
        } catch (err) {
            console.error(err);
            throw TMDBCallErrorMessage;
        }
    }

    buildImageUrl(imagePath, size = ImageSize.Poster.ORIGINAL) {
        if (imagePath == null) {
            return null;
        }
        const baseUrl = "http://image.tmdb.org/t/p/";
        return baseUrl + size + imagePath;
        // +w185 + /xFofUu6o9iVnqh7fbnLLEcolxEw.jpg
        // w185 = width 185px.
        // doc info : https://developers.themoviedb.org/3/getting-started/images
    }


}

module.exports = (apiKey) => new TMDB(apiKey);
