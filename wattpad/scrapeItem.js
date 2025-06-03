const cheerio = require('cheerio');
const { writeLog } = require('useful-toolbox-js');

const { formatText } = require('../func/formatData');
const { DEBUG_NAME_WATTPAD, MAXIMUM_ATTEMPTS } = require('../constants');
const { screenshotError } = require('../func/takeScreenshot');
const {
  wpAuthorClass,
  wpAuthorDescClass,
  wpAuthorPicClass,
  wpAuthorPreHref,
  wpCoverClass,
  wpDescClass,
  wpMatureClass,
  wpTitleClass,
} = require('../config.json');

const WEBSITE_URL = 'https://www.wattpad.com';

function replaceUserHref(text) {
  if (typeof text !== 'string') {
    return text;
  }

  return text
    .replace(/\/user\//g, `${WEBSITE_URL}/user/`)
    .replace(/<a/g, '<a rel="nofollow" target="_blank"');
}

async function scrapeItem(pageBook, pageAuthor, link, initialData = {}, options = {}) {
  const writeDebug = writeLog.setDebug(DEBUG_NAME_WATTPAD);
  let error = null;

  const defaultTimeout = options.timeoutOff ? 0 : MAXIMUM_ATTEMPTS * 1000;
  pageBook.setDefaultTimeout(defaultTimeout);
  pageAuthor.setDefaultTimeout(defaultTimeout);

  // Start
  writeLog.step('Scrape Wattpad');

  let { pageContent } = initialData;
  const { useSavedPage } = options;

  let searched = false;
  let found = false;

  let isHardScraping = true;
  if (useSavedPage && pageContent && !initialData.error) {
    isHardScraping = false;
  }

  writeDebug(`link: ${link}`);
  writeDebug(`has pageContent: ${!!pageContent}`);
  writeDebug(`has useSavedPage: ${useSavedPage}`);
  writeDebug(`isHardScraping: ${isHardScraping}`);

  // Load page content
  if (isHardScraping) {
    // Go to the link
    writeLog.dev('go to the link...');
    try {
      await pageBook.bringToFront();
      await pageBook.goto(link);

      // Check if the page is found
      const pageIsFound = await pageBook.evaluate(() => {
        const h3Elements = document.querySelectorAll('h3');
        for (const h3 of h3Elements) {
          if (h3.textContent.includes("Cette page s'est perdue dans une bonne histoire et n'est jamais revenue.")) {
            return false;
          }
        }
        return true;
      });

      // Set content
      if (pageIsFound) {
        pageContent = await pageBook.content();
      } else {
        writeLog.alert('This page is not found according to Wattpad:', link);
        return {
          ...initialData,
          searched: true,
          found: false,
          error: null,
        };
      }
    } catch (catchError) {
      error = `An error occurred while accessing Wattpad with: ${link}`;
      writeLog.alert(error);
      writeLog.error(catchError);
      return { ...initialData, error };
    }
  }

  // Scrape data
  writeLog.dev('scrape data...');
  try {
    let $ = cheerio.load(pageContent);
    searched = true;
    found = true;

    let title = '';
    let image = '';
    let author = '';
    let authorWithLink = {};
    let targetAudience = '';
    let description = '';
    let authorImg = '';
    let authorBio = '';

    // title
    const titleElement = $(wpTitleClass);
    if (titleElement.length > 0) {
      const titleFromPage = titleElement.text();
      writeDebug(`titleFromPage: ${JSON.stringify(titleFromPage, null, 2)}`);
      title = formatText(titleFromPage);
    } else {
      writeDebug('no titleElement');
    }
    writeDebug(`title: ${JSON.stringify(title, null, 2)}`);
    writeDebug('--------------------');

    // image
    const coverDiv = $(wpCoverClass);
    if (coverDiv.length > 0) {
      const cover = coverDiv.find('img').first();
      image = cover.attr('src');
    } else {
      writeDebug('no coverDiv');
    }
    writeDebug(`image: ${JSON.stringify(image, null, 2)}`);
    writeDebug('--------------------');

    // author
    let authorFromPage = { innerHTML: null, href: null };
    $(wpAuthorClass).each((index, element) => {
      const innerHTML = $(element).html();
      const href = $(element).attr('href');
      authorFromPage = { innerHTML, href };
    });
    writeDebug(`authorFromPage: ${JSON.stringify(authorFromPage, null, 2)}`);

    if (authorFromPage.innerHTML && authorFromPage.href) {
      author = formatText(authorFromPage.innerHTML);
      authorWithLink = {
        author,
        link: `${wpAuthorPreHref}${authorFromPage.href}`,
      };
    }
    writeDebug(`author: ${JSON.stringify(author, null, 2)}`);
    writeDebug(`authorWithLink: ${JSON.stringify(authorWithLink, null, 2)}`);
    writeDebug('--------------------');

    // mature
    const matureElement = $(wpMatureClass);
    if (matureElement.length > 0) {
      writeDebug('with matureElement');
      targetAudience = 'Mature';
    } else {
      writeDebug('no matureElement');
    }
    writeDebug(`targetAudience: ${JSON.stringify(targetAudience, null, 2)}`);
    writeDebug('--------------------');

    // description
    const descElement = $(wpDescClass);
    if (descElement.length > 0) {
      const descFromPage = descElement.html();
      writeDebug(`descFromPage: ${JSON.stringify(descFromPage, null, 2)}`);
      writeDebug('---');
      description = `<pre>${formatText(replaceUserHref(descFromPage))}</pre>`;
    } else {
      writeDebug('no descElement');
    }
    writeDebug(`description: ${JSON.stringify(description, null, 2)}`);
    writeDebug('--------------------');

    // author
    if (authorWithLink && authorWithLink.link) {
      if (isHardScraping) {
        writeLog.dev('go to the author page...');
        await pageAuthor.bringToFront();
        await pageAuthor.goto(authorWithLink.link);
        const authorPageContent = await pageAuthor.content();
        pageContent += authorPageContent;
        $ = cheerio.load(pageContent);
      }

      // author image
      const avatarProfileDiv = $(wpAuthorPicClass);
      if (avatarProfileDiv.length > 0) {
        const avatarProfile = avatarProfileDiv.find('img').first();
        authorImg = avatarProfile.attr('src');
      } else {
        writeDebug('no avatarProfileDiv');
      }
      writeDebug(`authorImg: ${JSON.stringify(authorImg, null, 2)}`);
      writeDebug('--------------------');

      // author description
      const descriptionDiv = $(wpAuthorDescClass);
      if (descriptionDiv.length > 0) {
        const authorDescFromPage = descriptionDiv.html();
        writeDebug(`authorDescFromPage: ${JSON.stringify(authorDescFromPage, null, 2)}`);
        writeDebug('---');
        authorBio = formatText(replaceUserHref(authorDescFromPage));
      } else {
        writeDebug('no descriptionDiv');
      }
      writeDebug(`authorBio: ${JSON.stringify(authorBio, null, 2)}`);
      writeDebug('--------------------');
    } else {
      writeDebug('no authorWithLink.link');
    }

    if (!title || !authorImg) {
      error = `There is insufficient data on Wattpad: ${link}`;
      writeLog.alert(error);
      if (isHardScraping) {
        const screenshotCode = Date.now();
        await screenshotError(pageBook, 'wattpad', `${screenshotCode}-book`);
        await screenshotError(pageAuthor, 'wattpad', `${screenshotCode}-profile`);
      }
      return {
        ...initialData,
        searched: true,
        found: false,
        id: '',
        error,
      };
    }

    return {
      link,
      searched,
      found,
      id: link.replace('https://www.wattpad.com/story/', ''),
      title,
      image,
      author,
      authorWithLink,
      targetAudience,
      description,
      authorImg,
      authorBio,
      error,
      pageContent,
    };
  } catch (catchError) {
    error = `An error occurred while scraping Wattpad with: ${link}`;
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

module.exports = scrapeItem;
