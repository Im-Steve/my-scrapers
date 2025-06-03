const { setTimeout } = require('node:timers/promises');
const { normalizeText, writeLog } = require('useful-toolbox-js');

const { DEBUG_NAME_WATTPAD, MAXIMUM_ATTEMPTS } = require('../constants');
const { screenshotError, screenshotPage } = require('../func/takeScreenshot');

async function getBooksFromCatalog(page, link, catalogName, language = '', options = {}) {
  const writeDebug = writeLog.setDebug(DEBUG_NAME_WATTPAD);

  const defaultTimeout = options.timeoutOff ? 0 : MAXIMUM_ATTEMPTS * 1000;
  page.setDefaultTimeout(defaultTimeout);

  let langUrlExt = '';
  if (normalizeText(language).includes('fr')) {
    langUrlExt = '?locale=fr_FR';
  } else if (normalizeText(language).includes('eng')) {
    langUrlExt = '?locale=en_US';
  }
  const configuredLink = `${link}${langUrlExt}`;
  writeDebug('original link:', link);
  writeDebug('configured link:', configuredLink);

  writeLog.step('catalog link:', configuredLink);

  let bookLinks = [];
  let error = null;

  try {
    // Go to the link
    writeLog.log('go to the link...');
    await page.bringToFront();
    await page.goto(configuredLink);

    // Get number of books
    const nbBooksOnPage = await page.$eval('#header-left', (el) => el.textContent.trim());
    writeDebug(`nbBooksOnPage: ${nbBooksOnPage}`);
    const cleanedNbBooks = nbBooksOnPage.replace('Histoires', '').replace('K', '');
    writeDebug(`cleanedNbBooks: ${cleanedNbBooks}`);
    let nbBooksPlanned = parseFloat(cleanedNbBooks);
    writeDebug(`parseFloat(cleanedNbBooks): ${nbBooksPlanned}`);
    if (nbBooksOnPage.includes('K')) {
      nbBooksPlanned *= 1000;
    }
    writeLog.info('number of books planned:', nbBooksPlanned);

    // Scroll to bottom of page
    writeLog.log('scrolling...');
    let stopScrolling = false;
    while (!stopScrolling) {
      writeDebug('scrolling...');
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await setTimeout(1000);

      const showMoreHidden = await page.$('div.show-more.center-text.hidden');
      writeDebug(`showMoreHidden: ${showMoreHidden}`);
      stopScrolling = !!showMoreHidden;
      writeDebug(`stopScrolling: ${stopScrolling}`);

      bookLinks = await page.$$eval(
        'a.title.meta.on-story-preview',
        (elements) => elements.map((element) => element.href),
      );

      writeLog.rewrite(`\rnumber of books found: ${bookLinks.length} `);
      if (writeLog.isDevOrDebugEnv()) {
        writeLog.log();
      }
    }
    writeLog.log('(finished)');

    // Get book links
    writeLog.log('get book links...');
    bookLinks = await page.$$eval(
      'a.title.meta.on-story-preview',
      (elements) => elements.map((element) => element.href),
    );

    if (!bookLinks || bookLinks.length < (nbBooksPlanned * 0.8)) {
      error = `Insufficient number of books for ${catalogName || link}`;
      writeLog.alert(error);
      await screenshotError(page, catalogName, 'insufficient');
      return { bookLinks: [], error };
    }
  } catch (catchError) {
    error = `An error occurred while scraping the catalog: ${catalogName || link}`;
    writeLog.error('!error!');
    writeLog.alert(error);
    writeLog.error(catchError);
    await screenshotError(page, catalogName, 'catch');
    return { bookLinks: [], error };
  }

  writeLog.info('books found for the catalog:', bookLinks.length);
  await screenshotPage(page, `end--${catalogName || 'null'}`);
  return { bookLinks, error };
}

module.exports = getBooksFromCatalog;
