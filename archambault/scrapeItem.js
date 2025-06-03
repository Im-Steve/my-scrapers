const cheerio = require('cheerio');
const { setTimeout } = require('node:timers/promises');
const { writeLog } = require('useful-toolbox-js');

const { formatText } = require('../func/formatData');
const { DEBUG_NAME_ARCHAMBAULT, MAXIMUM_ATTEMPTS } = require('../constants');
const { screenshotError } = require('../func/takeScreenshot');

const WEBSITE_URL = 'https://www.archambault.ca';

async function scrapeItem(page, codeToSearch, initialData = {}, options = {}) {
  const writeDebug = writeLog.setDebug(DEBUG_NAME_ARCHAMBAULT);
  let error = null;

  page.setDefaultTimeout(options.timeoutOff ? 0 : MAXIMUM_ATTEMPTS * 1000);

  // Start
  writeLog.step('Scrape Archambault');

  let { link, pageContent } = initialData;
  const { useSavedPage } = options;

  let searched = false;
  let found = false;

  let isHardScraping = true;
  if (useSavedPage && pageContent && !initialData.error) {
    isHardScraping = false;
  }

  writeDebug(`codeToSearch: ${codeToSearch}`);
  writeDebug(`has pageContent: ${!!pageContent}`);
  writeDebug(`has useSavedPage: ${useSavedPage}`);
  writeDebug(`isHardScraping: ${isHardScraping}`);

  // Load page content
  if (isHardScraping) {
    // Go to the page
    writeLog.dev('go to the page...');
    const searchUrl = `${WEBSITE_URL}/Pages/Recherche?q=${codeToSearch}&rh=search&secq=${codeToSearch}&sortType=1`;
    writeDebug(`searchUrl: ${searchUrl}`);
    try {
      await page.bringToFront();
      await page.goto(searchUrl);
      link = page.url();
      pageContent = await page.content();
    } catch (catchError) {
      error = `An error occurred while accessing Archambault with: ${codeToSearch}`;
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
    let authors = [];
    // let authorsWithLink = [];
    let image = '';
    let description = '';
    let publisher = '';
    // let publisherWithLink = {};
    let collection = '';
    // let collectionWithLink = {};
    let subject = '';
    // let subjectWithLink = {};
    let language = '';
    let nbOfPages = null;
    let releaseDate = '';
    let dimensions = '';
    const detailTable = {};

    // Check if the item was found
    const productDiv = $('.product-details');
    if (productDiv.length === 0) {
      writeLog.alert('Item not found on Archambault:', codeToSearch);
      return {
        ...initialData,
        searched: true,
        found: false,
        error: null,
      };
    }

    // image
    const imgSlimmage = $('img.slimmage');
    if (imgSlimmage.length > 0) {
      const imageFromPage = imgSlimmage.attr('src');
      writeDebug(`imageFromPage: ${JSON.stringify(imageFromPage, null, 2)}`);
      image = imageFromPage ? imageFromPage.split('?')[0] : '';
    } else {
      writeDebug('no imgSlimmage');
    }
    writeDebug(`image: ${JSON.stringify(image, null, 2)}`);
    writeDebug('--------------------');

    // description
    // Check if there is a button
    if (isHardScraping) {
      const descButtonSelector = 'span.show-more-text';
      const descButton = await page.$(descButtonSelector);
      writeDebug(`descButton: ${descButton}`);
      if (descButton) {
        writeDebug('descButton.click()');
        page.$eval(descButtonSelector, (button) => button.click());
        await setTimeout(1000);
        pageContent = await page.content();
        $ = cheerio.load(pageContent);
      }
    }

    // Set description
    const descriptionDiv = $('div.block-description span');
    if (descriptionDiv.length > 0) {
      const descFromPage = descriptionDiv.html();
      writeDebug(`descFromPage: ${JSON.stringify(descFromPage, null, 2)}`);
      writeDebug('---');
      description = formatText(descFromPage);
    } else {
      writeDebug('no descriptionDiv');
    }
    writeDebug(`description: ${JSON.stringify(description, null, 2)}`);
    writeDebug('--------------------');

    // detail table
    const detailRows = $('.block-description__row');

    detailRows.each((index, element) => {
      const key = $(element).find('.block-description__row-category').text().trim();
      const value = $(element).find('.block-description__row-value');

      const aElement = value.find('a');
      if (aElement.length > 0) {
        const text = aElement.text().trim();
        const href = aElement.attr('href');
        detailTable[key] = { text, href };
      } else {
        detailTable[key] = value.text().trim();
      }
    });
    writeDebug(`detailTable: ${JSON.stringify(detailTable, null, 2)}`);
    writeDebug('--------------------');

    title = detailTable.Titre || '';
    authors = detailTable.Auteur ? [detailTable.Auteur.text] : [];
    // authorsWithLink = detailTable.Auteur ? [{
    //   author: detailTable.Auteur.text,
    //   link: `${WEBSITE_URL}${detailTable.Auteur.href}`,
    // }] : '';
    publisher = detailTable.Éditeur ? detailTable.Éditeur.text : '';
    // publisherWithLink = detailTable.Éditeur ? [{
    //   publisher: detailTable.Éditeur.text,
    //   link: `${WEBSITE_URL}${detailTable.Éditeur.href}`,
    // }] : '';
    collection = detailTable.Collection ? detailTable.Collection.text : '';
    // collectionWithLink = detailTable.Collection ? [{
    //   collection: detailTable.Collection.text,
    //   link: `${WEBSITE_URL}${detailTable.Collection.href}`,
    // }] : '';
    subject = detailTable.Sujet ? detailTable.Sujet.text : '';
    // subjectWithLink = detailTable.Sujet ? [{
    //   subject: detailTable.Sujet.text,
    //   link: `${WEBSITE_URL}${detailTable.Sujet.href}`,
    // }] : '';
    language = detailTable.Langue ? detailTable.Langue.split('/')[0] : '';
    nbOfPages = detailTable['Nombre de pages'] ? parseInt(detailTable['Nombre de pages'], 10) : null;
    releaseDate = detailTable['Date de publication'] ? new Date(detailTable['Date de publication']).toISOString() : '';
    dimensions = detailTable.Dimensions || '';

    writeDebug(`title: ${JSON.stringify(title, null, 2)}`);
    writeDebug(`authors: ${JSON.stringify(authors, null, 2)}`);
    // writeDebug(`authorsWithLink: ${JSON.stringify(authorsWithLink, null, 2)}`);
    writeDebug(`publisher: ${JSON.stringify(publisher, null, 2)}`);
    // writeDebug(`publisherWithLink: ${JSON.stringify(publisherWithLink, null, 2)}`);
    writeDebug(`collection: ${JSON.stringify(collection, null, 2)}`);
    // writeDebug(`collectionWithLink: ${JSON.stringify(collectionWithLink, null, 2)}`);
    writeDebug(`subject: ${JSON.stringify(subject, null, 2)}`);
    // writeDebug(`subjectWithLink: ${JSON.stringify(subjectWithLink, null, 2)}`);
    writeDebug(`language: ${JSON.stringify(language, null, 2)}`);
    writeDebug(`nbOfPages: ${JSON.stringify(nbOfPages, null, 2)}`);
    writeDebug(`releaseDate: ${JSON.stringify(releaseDate, null, 2)}`);
    writeDebug(`dimensions: ${JSON.stringify(dimensions, null, 2)}`);
    writeDebug('--------------------');

    if (!title) {
      error = `There is insufficient data on Archambault with ${codeToSearch}`;
      writeLog.alert(error);
      if (isHardScraping) {
        await screenshotError(page, 'archambault', codeToSearch);
      }
    }

    return {
      link,
      searched,
      found,
      title,
      authors,
      // authorsWithLink,
      image,
      description,
      publisher,
      // publisherWithLink,
      collection,
      // collectionWithLink,
      subject,
      // subjectWithLink,
      language,
      nbOfPages,
      releaseDate,
      dimensions,
      detailTable,
      error,
      pageContent,
    };
  } catch (catchError) {
    error = `An error occurred while scraping Archambault with: ${codeToSearch}`;
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
