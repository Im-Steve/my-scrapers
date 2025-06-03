const { setTimeout } = require('node:timers/promises');
const { writeLog } = require('useful-toolbox-js');

const checkIfPageIsFound = require('./func/checkIfPageIsFound');
const { DEBUG_NAME_LESLIBRAIRES, MAXIMUM_ATTEMPTS } = require('../constants');
const { screenshotError, screenshotPage } = require('../func/takeScreenshot');

async function getBooksFromCatalog(browser, link, catalogName, options = {}) {
  const writeDebug = writeLog.setDebug(DEBUG_NAME_LESLIBRAIRES);
  const {
    approxMaxBooks = 5040,
    timeoutOff = false,
  } = options;

  let configuredLink = link;
  if (!link.includes('sort=')) {
    configuredLink = link.includes('?') ? link.concat('&sort=sales') : link.concat('?sort=sales');
  }
  writeDebug('original link:', link);
  writeDebug('configured link:', configuredLink);

  writeLog.step('catalog link:', configuredLink);
  writeLog.log('scraping...');
  writeDebug('approxMaxBooks:', approxMaxBooks);

  let bookLinks = [];
  let error = null;
  let pageIndex = 1;
  let morePages = true;

  try {
    // Scrape each page in the catalog
    while (morePages) {
      const page = await browser.newPage();
      page.setDefaultTimeout(timeoutOff ? 0 : MAXIMUM_ATTEMPTS * 1000);

      writeLog.rewrite(`\rpage ${pageIndex} `);
      if (writeLog.isDevOrDebugEnv()) {
        writeLog.log();
      }

      let booksFromThePage = [];
      let pageLoaded = false;
      let nbOfAttempts = 1;

      const pageLink = `${configuredLink}&page=${pageIndex}`;
      writeDebug(`page link: ${pageLink}`);
      await page.bringToFront();
      await page.goto(pageLink);
      writeDebug('waiting the new books...');
      await setTimeout(3000);

      // Check if the page is found
      if (pageIndex === 1) {
        const pageIsFound = await checkIfPageIsFound(page);
        if (!pageIsFound) {
          if (!writeLog.isDevOrDebugEnv()) {
            writeLog.log();
          }
          writeLog.alert('This page is not found according to Les Libraires:', pageLink);
          await page.close();
          return { bookLinks: [], error: null };
        }
      } else {
        writeDebug(`pageIndex: ${pageIndex}`);
        writeDebug('no need to check if the page is found');
      }

      writeDebug(`while (!pageLoaded): ${!pageLoaded}`);
      while (!pageLoaded) {
        writeDebug('check if the page is loaded');

        // Check if no result
        let html = await page.content();
        html = html.replace(/<li>Aucun résultat\.<\/li>/g, '');
        html = html.replace(/"Aucun résultat/g, '');
        if (html.includes('<span class="from-to">(<!-- --><!-- -->&nbsp;-&nbsp;<!-- --><!-- -->)<!-- --></span>')
        || html.includes('<span class="from-to">(<!-- --><!-- -->&nbsp;-&nbsp;<!-- --><!-- -->)</span>')
        || html.includes('<span class="from-to">(&nbsp;-&nbsp;)</span>')
        || html.includes('Aucun résultat')) {
          writeLog.dev('"No result" found');
          pageLoaded = true;
        } else {
          writeDebug('no "No result"');
        }

        // Check if any books were found
        booksFromThePage = await page.$$eval(
          'a.card__content__title',
          (elements) => elements.map((element) => element.href),
        );
        if (booksFromThePage.length !== 0) {
          writeDebug('books found');
          pageLoaded = true;
        } else {
          writeDebug('no books found');
        }

        // Check if the books are those on the 1st page
        if (booksFromThePage.length !== 0) {
          writeDebug('check if the books are those on the 1st page');
          writeDebug(`booksFromThePage[0 & 1]: ${JSON.stringify([booksFromThePage[0], booksFromThePage[1]], null, 2)}`);
          writeDebug(`bookLinks[0 & 1]: ${JSON.stringify([bookLinks[0], bookLinks[1]], null, 2)}`);

          const sameBooks = booksFromThePage.length > 1 && bookLinks.length > 1
          && booksFromThePage[0] === bookLinks[0]
          && booksFromThePage[1] === bookLinks[1];
          writeDebug(`sameBooks: ${sameBooks}`);

          if (sameBooks) {
            writeDebug('the books are those on the 1st page');
            booksFromThePage = [];
            pageLoaded = false;
          }
        }

        // Check if it's the same page as the previous one
        writeDebug('check if is the same page as the previous one');
        const url = await page.url();
        writeDebug(`url: ${url}`);
        const isTheSamePage = url.includes(`page=${pageIndex - 1}`);
        writeDebug(`isTheSamePage: ${isTheSamePage}`);

        if (isTheSamePage) {
          writeLog.log("it's the same page as the previous one");
          pageLoaded = true;
          booksFromThePage = [];
        }

        writeDebug(`pageLoaded: ${pageLoaded}`);
        writeDebug(`nbOfAttempts: ${nbOfAttempts}`);

        if (!pageLoaded) {
          writeDebug('if !pageLoaded');
          if (nbOfAttempts < MAXIMUM_ATTEMPTS) {
            writeDebug('waiting...');
            nbOfAttempts += 1;
            await setTimeout(1000);
          } else {
            error = `The load wait limit has been reached on ${catalogName || link}`;
            writeLog.error('!error!');
            writeLog.alert(error);
            await screenshotError(page, catalogName, `page-${pageIndex}`);
            await page.close();
            return { bookLinks: [], error };
          }
        }
        writeDebug('--------------------');
      }

      // The page is loaded
      writeLog.dev('books found for the page:', booksFromThePage.length);
      if (booksFromThePage.length !== 0) {
        bookLinks = bookLinks.concat(booksFromThePage);
        pageIndex += 1;
      } else {
        writeLog.log('limit reached');
        writeLog.log('no books found on a page');
        morePages = false;
        await screenshotPage(page, `end--${catalogName || 'null'}--page-${pageIndex}`);
      }

      writeDebug(`bookLinks.length: ${bookLinks.length}`);
      writeDebug(`approxMaxBooks: ${approxMaxBooks}`);
      writeDebug(`bookLinks.length >= approxMaxBooks: ${bookLinks.length >= approxMaxBooks}`);
      if (bookLinks.length >= approxMaxBooks) {
        writeLog.log('limit reached');
        writeLog.log('maximum number of books reached');
        pageIndex -= 1;
        morePages = false;
        await screenshotPage(page, `end--${catalogName || 'null'}--page-${pageIndex}`);
      }

      await page.close();
    }
  } catch (catchError) {
    error = `An error occurred while scraping the catalog: ${catalogName || link}`;
    writeLog.error('!error!');
    writeLog.alert(error);
    writeLog.error(catchError);
    return { bookLinks: [], error };
  }

  writeLog.info('books found for the catalog:', bookLinks.length);
  if (bookLinks.length === 0) {
    writeLog.alert('No books found with the catalog:', catalogName || link);
  }
  return { bookLinks, error };
}

module.exports = getBooksFromCatalog;
