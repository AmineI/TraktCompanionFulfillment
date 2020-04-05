const {
    SimpleResponse,
    Carousel,
    BasicCard,
    Button,
    Image
} = require('actions-on-google');
const util = require("../util");

//Todo, specify between types, and rename
async function buildCarouselFromTraktEntries(traktResults, tmdbApiInstance) {
    console.log("Building carousel...");
    let type, item, itemTitle;
    let itemTitlesCountsArray = [];
    //TODO What if the trakt item has no tmdb id ?
    //Todo Use the methods to find a movie or show from TMDB instead of trakt and then go to Trakt to check in / etc ?
    const imageUrlPromises = traktResults.map((result) => {
        return tmdbApiInstance.getPosterUrl(result.type, result[result.type].ids.tmdb);
    });//Returns an array of both imageUrls and eventually null values.

    const carouselItems = await Promise.all(imageUrlPromises).then(imageUrlResults => {
        return imageUrlResults.reduce((carouselItemsAccumulator, resolvedImageUrlForIndex, index) => {
            type = traktResults[index].type;
            item = traktResults[index][type];
            itemTitle = `${item.title} ${item.year ? '(' + item.year + ')' : ''}`;

            //Handle cases where multiple items have the same title, since this is not allowed by Google Assistant. We count apparitions and append a number after the item if it appears multiple times.
            if (itemTitle in itemTitlesCountsArray) {
                itemTitlesCountsArray[itemTitle] += 1;
                itemTitle += ` (${itemTitlesCountsArray[itemTitle]})`
            } else {
                itemTitlesCountsArray[itemTitle] = 1
            }

            // carouselItems must be a dictionary, and the select item's key will be returned on selection.
            // We use the index of the element from the search results as a key, for ease of use when gathering the result after user selection.
            carouselItemsAccumulator[index] = {
                synonyms: [//TODO find synonyms from API ? Trakt does not give that, does it ?
                ],
                title: itemTitle,//Titles must be unique.
                description: item.overview,
                image: new Image({
                    url: resolvedImageUrlForIndex || util.getPlaceholderPosterUrl("250x100", "No Poster Available"),
                    alt: `Poster of ${item.title}`
                })
            };

            //If the image is found, we add the image to the carousel
            if (resolvedImageUrlForIndex !== null) {
                //TODO REMOVE
            }

            return carouselItemsAccumulator;
        }, {});
    });


    const simpleResponse = new SimpleResponse({
        speech: `Alright, here are the ${traktResults.length} most relevant results. ` +
            `The first one is ${carouselItems[0].title}. Which one were you looking for ?`,
        text: `Here are the ${traktResults.length} most relevant results. ` +
            ` Which one were you looking for ?`,
    });
    const resultsCarousel = new Carousel({
        title: 'Relevant results',
        items: carouselItems
    });

    console.log("Carousel ready...");
    return [simpleResponse, resultsCarousel];//TODO Add suggestions chips, for checking next results page for ex
}

async function buildCardFromTraktItem(traktItem, tmdbApiInstance) {
    //Todo extract funcs to return only basic cards by media type. buildShowChoice and BuildMovieChoice for ex

    let item = traktItem[traktItem.type];

    /*
    text2: `*emphasis* or _italics_, **strong** or __bold__,
    and ***bold itallic*** or ___strong emphasis___ as well as other things like line  \nbreaks`,
    Note the two spaces before '\n' required for a line break to be rendered in the card.
    TODO remove text2 which is here for info purpose.
    */
    let posterUrl = await tmdbApiInstance.getPosterUrl(traktItem.type, item.ids.tmdb);


    let cardOptions = {
        subtitle: `Runtime ${item.runtime}min - ` + (item.tagline || `${item.aired_episodes} aired episodes`),//todo : tagline exists only on movies, and aired episodes only on shows. I believe.
        title: `${item.title} ${item.year ? '(' + item.year + ')' : ''}`,
        text: item.overview,
        buttons: new Button({
            title: 'Trakt page',
            url: `https://trakt.tv/${traktItem.type}s/${item.ids.slug}`,//todo : this is only valid for show & movie, not for episodes ?
        }),
        display: 'WHITE',
    };
    if (posterUrl !== null) {
        cardOptions.image = new Image({
            url: posterUrl,//We get images from tmdb since Trakt doesn't give them anymore https://apiblog.trakt.tv/how-to-find-the-best-images-516045bcc3b6
            alt: `${item.title} poster`,
        });
    }

    const simpleResponse = new SimpleResponse({
        speech: `Sure, here are the details of the ${traktItem.type} ${item.title}, is it the good one ?`,
        text: `Here are the details of the ${traktItem.type} ${item.title}, is it the one you want ?`,
    });

    const basicCard = new BasicCard(cardOptions);
    return [simpleResponse, basicCard];//TODO Add suggestions chips, for checking in or adding to the watchlist for ex
}

/**
 *In order to limit surfaces for visual responses, this may be useful.
 if (!conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')) {
        conv.ask('Sorry, try this on a screen device.');
    }
 */


module.exports = {
    buildCarouselFromTraktEntries,
    buildCardFromTraktItem
};
