const cheerio = require('cheerio');
const { setTimeout } = require('node:timers/promises');
const { writeLog } = require('useful-toolbox-js');

const { DEBUG_NAME_QUIALU, MAXIMUM_ATTEMPTS } = require('../constants');

const WEBSITE_URL = 'https://www.quialu.ca';

async function scrapeOpinions(pageRating, pageComments, ISBN, initialData = {}, options = {}) {
  const writeDebug = writeLog.setDebug(DEBUG_NAME_QUIALU);
  let error = null;

  const defaultTimeout = options.timeoutOff ? 0 : MAXIMUM_ATTEMPTS * 1000;
  pageRating.setDefaultTimeout(defaultTimeout);
  pageComments.setDefaultTimeout(defaultTimeout);

  // Start
  writeLog.step('Scrape Quialu');

  let { pageContent } = initialData;
  const { useSavedPage } = options;

  const link = `${WEBSITE_URL}/produit/${ISBN}`;

  let searched = false;
  let found = false;

  let isHardScraping = true;
  if (useSavedPage && pageContent && !initialData.error) {
    isHardScraping = false;
  }

  writeDebug(`ISBN: ${ISBN}`);
  writeDebug(`link: ${link}`);
  writeDebug(`has pageContent: ${!!pageContent}`);
  writeDebug(`has useSavedPage: ${useSavedPage}`);
  writeDebug(`isHardScraping: ${isHardScraping}`);

  // Load page content
  if (isHardScraping) {
    // Go to the page
    writeLog.dev('go to the page...');
    try {
      await pageRating.bringToFront();
      await pageRating.goto(link);
      pageContent = await pageRating.content();
    } catch (catchError) {
      error = `An error occurred while accessing Quialu with: ${ISBN}`;
      writeLog.alert(error);
      writeLog.error(catchError);
      return { ...initialData, error };
    }
  }

  // Scrape data
  writeLog.dev('scrape data...');
  try {
    const $r = cheerio.load(pageContent);
    searched = true;
    found = true;

    let rating = null;
    let nbOfVotes = 0;
    let nbOfLikes = initialData.nbOfLikes || 0;
    let nbOfComments = initialData.nbOfComments || 0;
    const commentIframeSrc = `https://www.quialu.ca/embed?isbn=${ISBN}&referrer=https://www.quialu.ca/produit/${ISBN}&embed_mode=classic`;

    // rating
    const ratingDiv = $r('.rating__precise');

    if (ratingDiv.length > 0) {
      const ratingFromPage = ratingDiv.text();
      writeDebug(`ratingFromPage: ${JSON.stringify(ratingFromPage, null, 2)}`);
      const ratingMatch = ratingFromPage.match(/([\d,.]+)/);
      writeDebug(`ratingMatch: ${JSON.stringify(ratingMatch, null, 2)}`);

      if (ratingMatch) {
        rating = parseFloat(ratingMatch[0].replace(',', '.'));
        rating = !Number.isNaN(rating) ? rating : null;
      } else {
        writeDebug('no ratingMatch');
      }
    } else {
      writeDebug('no ratingDiv');
    }
    writeDebug(`rating: ${JSON.stringify(rating, null, 2)}`);
    writeDebug('--------------------');

    // number of votes
    const voteDiv = $r('.rating__votes');

    if (voteDiv.length > 0) {
      const votesFromPage = voteDiv.text();
      writeDebug(`votesFromPage: ${JSON.stringify(votesFromPage, null, 2)}`);
      const voteMatch = votesFromPage.match(/\d+/);
      writeDebug(`voteMatch: ${JSON.stringify(voteMatch, null, 2)}`);

      if (voteMatch) {
        nbOfVotes = parseInt(voteMatch[0], 10);
        nbOfVotes = !Number.isNaN(nbOfVotes) ? nbOfVotes : 0;
      } else {
        writeDebug('no voteMatch');
      }
    } else {
      writeDebug('no voteDiv');
    }
    writeDebug(`nbOfVotes: ${JSON.stringify(nbOfVotes, null, 2)}`);
    writeDebug('--------------------');

    if (!rating && rating !== 0) {
      writeLog.alert('ISBN not found on Quialu:', ISBN);
      return {
        ...initialData,
        searched: true,
        found: false,
        error: null,
      };
    }

    // comment section
    if (isHardScraping) {
      writeLog.dev('go to the comment page...');
      writeDebug(`commentIframeSrc: ${commentIframeSrc}`);
      try {
        await pageComments.bringToFront();
        await pageComments.goto(commentIframeSrc);
        await setTimeout(1000);

        writeLog.dev('scrape comments...');

        nbOfLikes = 0;
        nbOfComments = 0;

        const commentDiv = await pageComments.$$('span strong');

        for (const element of commentDiv) {
          if (!nbOfLikes || !nbOfComments) {
            const textContent = await element.evaluate((el) => el.textContent);
            writeDebug(`textContent: ${JSON.stringify(textContent, null, 2)}`);
            const likeMatch = textContent.match(/(\d+)\spersonne[s]?/);
            writeDebug(`likeMatch: ${JSON.stringify(likeMatch, null, 2)}`);
            const commentMatch = textContent.match(/(\d+)\scommentaire[s]?/);
            writeDebug(`commentMatch: ${JSON.stringify(commentMatch, null, 2)}`);

            if (likeMatch && likeMatch.length > 1) {
              nbOfLikes = parseInt(likeMatch[1], 10);
              nbOfLikes = !Number.isNaN(nbOfLikes) ? nbOfLikes : 0;
            }
            if (commentMatch && commentMatch.length > 1) {
              nbOfComments = parseInt(commentMatch[1], 10);
              nbOfComments = !Number.isNaN(nbOfComments) ? nbOfComments : 0;
            }
            writeDebug('---');
          }
        }
      } catch (catchError) {
        error = `An error occurred on the Quialu comments: ${commentIframeSrc}`;
        writeLog.alert(error);
        writeLog.error(catchError);
      }
    } else {
      writeLog.alert('The hard scraping must be enabled to get the comments on Quialu');
    }
    writeDebug(`nbOfLikes: ${JSON.stringify(nbOfLikes, null, 2)}`);
    writeDebug(`nbOfComments: ${JSON.stringify(nbOfComments, null, 2)}`);
    writeDebug('--------------------');

    return {
      link,
      searched,
      found,
      rating,
      nbOfVotes,
      nbOfLikes,
      nbOfComments,
      commentIframeSrc,
      error,
      pageContent,
    };
  } catch (catchError) {
    error = `An error occurred while scraping Quialu with: ${ISBN}`;
    writeLog.alert(error);
    writeLog.error(catchError);
    return {
      ...initialData,
      searched: true,
      found: true,
      error,
    };
  }
}

module.exports = scrapeOpinions;
