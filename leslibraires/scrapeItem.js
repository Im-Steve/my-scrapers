const cheerio = require('cheerio');
const { setTimeout } = require('node:timers/promises');
const { frDateToJsDate, writeLog } = require('useful-toolbox-js');

const checkIfPageIsFound = require('./func/checkIfPageIsFound');
const { formatText } = require('../func/formatData');
const { DEBUG_NAME_LESLIBRAIRES, MAXIMUM_ATTEMPTS } = require('../constants');
const parseDimensions = require('./func/parseDimensions');
const { screenshotError } = require('../func/takeScreenshot');

const WEBSITE_URL = 'https://www.leslibraires.ca';

async function scrapeItem(page, link, initialData = {}, options = {}) {
  const writeDebug = writeLog.setDebug(DEBUG_NAME_LESLIBRAIRES);
  let error = null;

  page.setDefaultTimeout(options.timeoutOff ? 0 : MAXIMUM_ATTEMPTS * 1000);

  // Start
  writeLog.step('Scrape Les Libraires');

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
      await page.bringToFront();
      await page.goto(link);

      // Check if the page is found
      const pageIsFound = await checkIfPageIsFound(page, true);

      // Set content
      if (pageIsFound) {
        pageContent = await page.content();
      } else {
        writeLog.alert('This page is not found according to Les Libraires:', link);
        return {
          ...initialData,
          searched: true,
          found: false,
          error: null,
        };
      }
    } catch (catchError) {
      error = `An error occurred while accessing Les Libraires with: ${link}`;
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
    let nbOfAttempts = 1;

    let ISBN = initialData.ISBN || '';
    let ISBNs = initialData.ISBNs || [];
    let title = '';
    let authors = [];
    let authorsWithLink = [];
    let image = '';
    const images = [];
    let description = '';
    const mainCategories = [];
    const mainCategoriesWithLink = [];
    const subcategories = [];
    const subcategoriesWithLink = [];
    let releaseDate = '';
    let language = '';
    let publisher = '';
    let publisherWithLink = {};
    let collection = '';
    let collectionWithLink = {};
    let targetAudience = '';
    let nbOfPages = '';
    let composition = '';
    let support = '';
    let format = '';
    let mesure = '';
    let dimensions = '';
    let weight = '';
    let excerptLink = '';
    let downloadLink = '';
    let seriesPosition = '';
    let seriesName = '';
    let seriesCode = '';
    let seriesLink = '';

    // Check if there is an christmas modal
    if (isHardScraping) {
      const christmasModalSelector = 'div.modal-footer div button';
      const christmasModalButton = await page.$(christmasModalSelector);
      writeDebug(`christmasModalButton: ${christmasModalButton}`);

      if (christmasModalButton) {
        writeDebug('christmasModalButton.click()');
        page.$eval(christmasModalSelector, (button) => button.click());
        await setTimeout(1000);
      }
    }
    writeDebug('--------------------');

    // ISBNs
    const isbnCodeSelector = '.product__variation__code';
    const isbnTitleSelector = '.product__variation__button__title';
    let isbnCodeDivs = $(isbnCodeSelector);
    let isbnTitleDivs = $(isbnTitleSelector);
    writeDebug(`isbnCodeDivs: ${isbnCodeDivs}`);
    writeDebug(`isbnTitleDivs: ${isbnTitleDivs}`);
    writeDebug(`isbnCodeDivs.length: ${isbnCodeDivs.length}`);
    writeDebug(`isbnTitleDivs.length: ${isbnTitleDivs.length}`);

    // Check if ISBNs are loaded
    if (isHardScraping) {
      while ((isbnCodeDivs.length === 0 && isbnTitleDivs.length === 0)
      && nbOfAttempts <= MAXIMUM_ATTEMPTS) {
        nbOfAttempts += 1;
        writeDebug('wait for ISBN...');
        writeDebug(`nbOfAttempts: ${nbOfAttempts}`);
        await setTimeout(1000);
        pageContent = await page.content();
        $ = cheerio.load(pageContent);
        isbnCodeDivs = $(isbnCodeSelector);
        isbnTitleDivs = $(isbnTitleSelector);
        writeDebug(`isbnCodeDivs: ${isbnCodeDivs}`);
        writeDebug(`isbnTitleDivs: ${isbnTitleDivs}`);
        writeDebug(`isbnCodeDivs.length: ${isbnCodeDivs.length}`);
        writeDebug(`isbnTitleDivs.length: ${isbnTitleDivs.length}`);
      }
    }

    // Set ISBNs
    if (isbnCodeDivs.length === isbnTitleDivs.length) {
      ISBN = '';
      ISBNs = [];

      isbnCodeDivs.each((index, element) => {
        const isbnText = $(element).text().trim();
        const isbnMatch = isbnText.match(/ISBN : (\d+)/);

        if (isbnMatch && isbnMatch.length > 1) {
          const isbnTitle = isbnTitleDivs.eq(index).text().trim();
          ISBNs.push({ isbn: isbnMatch[1], format: isbnTitle });
        }
      });
    }
    if (ISBNs.length > 0) {
      ISBN = ISBNs[0].isbn;
    } else {
      ISBN = '';
    }
    writeDebug(`ISBN: ${JSON.stringify(ISBN, null, 2)}`);
    writeDebug(`ISBNs: ${JSON.stringify(ISBNs, null, 2)}`);
    writeDebug('--------------------');

    // title
    const titleElement = $('h2.product__title');
    if (titleElement.length > 0) {
      const titleFromPage = titleElement.text();
      writeDebug(`titleFromPage: ${JSON.stringify(titleFromPage, null, 2)}`);
      title = formatText(titleFromPage);
    } else {
      writeDebug('no titleElement');
    }
    writeDebug(`title: ${JSON.stringify(title, null, 2)}`);
    writeDebug('--------------------');

    // description
    // Check if there is a button
    if (isHardScraping) {
      const descButtonSelector = 'button.link.link--tomato.link--fs-15.d-inline';
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
    let descriptionDiv = $('.text-normalizer div');
    if (descriptionDiv.length === 0) {
      descriptionDiv = $('.text-normalizer');
    }

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

    // authors
    const authorsFromPage = [];
    $('.product__author a').each((index, element) => {
      const innerHTML = $(element).html();
      const href = $(element).attr('href');
      authorsFromPage.push({ innerHTML, href });
    });
    writeDebug(`authorsFromPage: ${JSON.stringify(authorsFromPage, null, 2)}`);

    authors = authorsFromPage.map((element) => formatText(element.innerHTML));
    authorsWithLink = authorsFromPage.map((element) => ({
      author: formatText(element.innerHTML),
      link: `${WEBSITE_URL}${element.href}`,
    }));
    writeDebug(`authors: ${JSON.stringify(authors, null, 2)}`);
    writeDebug(`authorsWithLink: ${JSON.stringify(authorsWithLink, null, 2)}`);
    writeDebug('--------------------');

    // cover
    // Check if there is an explicit button
    if (isHardScraping) {
      const explicitButtonSelector = 'button.card-explicit-content__action';
      const explicitButton = await page.$(explicitButtonSelector);
      writeDebug(`explicitButton: ${explicitButton}`);

      if (explicitButton) {
        writeDebug('explicitButton.click()');
        page.$eval(explicitButtonSelector, (button) => button.click());
        await setTimeout(1000);

        const explicitButtonSelector2 = 'div.modal-footer div button.btn.btn--raised.btn--raised--tomato';
        const explicitButton2 = await page.$(explicitButtonSelector2);
        writeDebug(`explicitButton2: ${explicitButton2}`);
        if (explicitButton2) {
          writeDebug('explicitButton2.click()');
          page.$eval(explicitButtonSelector2, (button) => button.click());
          await setTimeout(1000);
          pageContent = await page.content();
          $ = cheerio.load(pageContent);
        } else {
          writeLog.alert("Can't find explicit button on Les Libraires:", link);
        }
      }
    }

    // Get images
    // note: many bad next-img-wrapper in a page
    const imagesFromPage = [];
    $('.next-img-wrapper img').each((index, element) => {
      const src = $(element).attr('src');
      imagesFromPage.push({ src });
    });
    writeDebug(`imagesFromPage: ${JSON.stringify(imagesFromPage, null, 2)}`);

    imagesFromPage.forEach((img) => {
      if (img.src.includes('/books/')) {
        const realImageSrc = img.src.split('&')[0].replace('/_next/image?url=', '').replace(/%3A/g, ':').replace(/%2F/g, '/');
        images.push(realImageSrc);
      }
    });

    if (images.length > 0) {
      [image] = images;
    } else {
      image = '';
    }
    writeDebug(`image: ${JSON.stringify(image, null, 2)}`);
    writeDebug(`images: ${JSON.stringify(images, null, 2)}`);
    writeDebug('--------------------');

    // categories
    const categoryRow = $('tr.product__specification:has(td:contains("Catégories"))');

    if (categoryRow.length > 0) {
      const categoriesFromPage = categoryRow.find('td.product__specification__value a').map((index, element) => {
        const textContent = $(element).text();
        const href = $(element).attr('href');
        const isASubcategory = /\d/.test(href);
        return { textContent, href, isASubcategory };
      }).get();
      writeDebug(`categoriesFromPage: ${JSON.stringify(categoriesFromPage, null, 2)}`);

      for (const category of categoriesFromPage) {
        const categoryName = formatText(category.textContent);
        if (!category.isASubcategory) {
          mainCategories.push(categoryName);
          mainCategoriesWithLink.push({ category: categoryName, link: `${WEBSITE_URL}${category.href}` });
        } else {
          subcategories.push(categoryName);
          subcategoriesWithLink.push({ category: categoryName, link: `${WEBSITE_URL}${category.href}` });
        }
      }
    } else {
      writeDebug('no categoryRow');
    }
    writeDebug(`mainCategories: ${JSON.stringify(mainCategories, null, 2)}`);
    writeDebug(`mainCategoriesWithLink: ${JSON.stringify(mainCategoriesWithLink, null, 2)}`);
    writeDebug(`subcategories: ${JSON.stringify(subcategories, null, 2)}`);
    writeDebug(`subcategoriesWithLink: ${JSON.stringify(subcategoriesWithLink, null, 2)}`);
    writeDebug('--------------------');

    // release date
    const releaseDateHeader = $('td.product__specification__title:contains("Date de sortie")');
    if (releaseDateHeader.length > 0) {
      const releaseDateValue = releaseDateHeader.next('td');

      if (releaseDateValue.length > 0) {
        const dateFromPage = releaseDateValue.text();
        writeDebug(`dateFromPage: ${JSON.stringify(dateFromPage, null, 2)}`);

        const dateFormatted = formatText(dateFromPage);
        writeDebug(`dateFormatted: ${JSON.stringify(dateFormatted, null, 2)}`);

        const jsDate = frDateToJsDate(dateFormatted);
        writeDebug(`jsDate: ${jsDate}`);

        releaseDate = jsDate.toISOString();
      } else {
        writeDebug('no releaseDateValue');
      }
    } else {
      writeDebug('no releaseDateHeader');
    }
    writeDebug(`releaseDate: ${JSON.stringify(releaseDate, null, 2)}`);
    writeDebug('--------------------');

    // language
    const languageHeader = $('td.product__specification__title:contains("Langue")');
    if (languageHeader.length > 0) {
      const languageValue = languageHeader.next('td');

      if (languageValue.length > 0) {
        const languageFromPage = languageValue.text();
        writeDebug(`languageFromPage: ${JSON.stringify(languageFromPage, null, 2)}`);
        language = formatText(languageFromPage);
      } else {
        writeDebug('no languageValue');
      }
    } else {
      writeDebug('no languageHeader');
    }
    writeDebug(`language: ${JSON.stringify(language, null, 2)}`);
    writeDebug('--------------------');

    // publisher
    const publisherHeader = $('td.product__specification__title:contains("Éditeur")');

    if (publisherHeader.length > 0) {
      const publisherValue = publisherHeader.next('td');

      if (publisherValue.length > 0) {
        const publisherName = publisherValue.text();
        const publisherLink = publisherValue.find('a').attr('href');
        writeDebug(`publisherName: ${JSON.stringify(publisherName, null, 2)}`);
        writeDebug(`publisherLink: ${JSON.stringify(publisherLink, null, 2)}`);

        publisher = formatText(publisherName);
        publisherWithLink = { publisher, link: `${WEBSITE_URL}${publisherLink}` };
      } else {
        writeDebug('no publisherValue');
      }
    } else {
      writeDebug('no publisherHeader');
    }
    writeDebug(`publisher: ${JSON.stringify(publisher, null, 2)}`);
    writeDebug(`publisherWithLink: ${JSON.stringify(publisherWithLink, null, 2)}`);
    writeDebug('--------------------');

    // collection
    const collectionHeader = $('td.product__specification__title:contains("Collection")');

    if (collectionHeader.length > 0) {
      const collectionValue = collectionHeader.next('td');

      if (collectionValue.length > 0) {
        const collectionName = collectionValue.text();
        const collectionLink = collectionValue.find('a').attr('href');
        writeDebug(`collectionName: ${JSON.stringify(collectionName, null, 2)}`);
        writeDebug(`collectionLink: ${JSON.stringify(collectionLink, null, 2)}`);

        collection = formatText(collectionName);
        collectionWithLink = { collection, link: `${WEBSITE_URL}${collectionLink}` };
      } else {
        writeDebug('no collectionValue');
      }
    } else {
      writeDebug('no collectionHeader');
    }
    writeDebug(`collection: ${JSON.stringify(collection, null, 2)}`);
    writeDebug(`collectionWithLink: ${JSON.stringify(collectionWithLink, null, 2)}`);
    writeDebug('--------------------');

    // number of pages
    const nbPagesHeader = $('td.product__specification__title:contains("Nombre de pages")');

    if (nbPagesHeader.length > 0) {
      const nbPagesValue = nbPagesHeader.next('td');

      if (nbPagesValue.length > 0) {
        const nbPagesFromPage = nbPagesValue.text();
        writeDebug(`nbPagesFromPage: ${JSON.stringify(nbPagesFromPage, null, 2)}`);

        const nbPagesFormatted = formatText(nbPagesFromPage).replace(' pages', '');
        writeDebug(`nbPagesFormatted: ${JSON.stringify(nbPagesFormatted, null, 2)}`);

        const nbPagesInt = parseInt(nbPagesFormatted, 10);
        writeDebug(`nbPagesInt: ${JSON.stringify(nbPagesInt, null, 2)}`);

        nbOfPages = !Number.isNaN(nbPagesInt) ? nbPagesInt : null;
      } else {
        writeDebug('no nbPagesValue');
      }
    } else {
      writeDebug('no nbPagesHeader');
    }
    writeDebug(`nbOfPages: ${JSON.stringify(nbOfPages, null, 2)}`);
    writeDebug('--------------------');

    // target audience
    const audienceHeader = $('td.product__specification__title:contains("Public Cible")');

    if (audienceHeader.length > 0) {
      const audienceValue = audienceHeader.next('td');

      if (audienceValue.length > 0) {
        const audienceFromPage = audienceValue.text();
        writeDebug(`audienceFromPage: ${JSON.stringify(audienceFromPage, null, 2)}`);
        targetAudience = formatText(audienceFromPage);
      } else {
        writeDebug('no audienceValue');
      }
    } else {
      writeDebug('no audienceHeader');
    }
    writeDebug(`targetAudience: ${JSON.stringify(targetAudience, null, 2)}`);
    writeDebug('--------------------');

    // composition
    const compositionHeader = $('td.product__specification__title:contains("Composition")');

    if (compositionHeader.length > 0) {
      const compositionValue = compositionHeader.next('td');

      if (compositionValue.length > 0) {
        const compositionFromPage = compositionValue.text();
        writeDebug(`compositionFromPage: ${JSON.stringify(compositionFromPage, null, 2)}`);
        composition = formatText(compositionFromPage);
      } else {
        writeDebug('no compositionValue');
      }
    } else {
      writeDebug('no compositionHeader');
    }
    writeDebug(`composition: ${JSON.stringify(composition, null, 2)}`);
    writeDebug('--------------------');

    // support
    const supportHeader = $('td.product__specification__title:contains("Support")');

    if (supportHeader.length > 0) {
      const supportValue = supportHeader.next('td');

      if (supportValue.length > 0) {
        const supportFromPage = supportValue.text();
        writeDebug(`supportFromPage: ${JSON.stringify(supportFromPage, null, 2)}`);
        support = formatText(supportFromPage);
      } else {
        writeDebug('no supportValue');
      }
    } else {
      writeDebug('no supportHeader');
    }
    writeDebug(`support: ${JSON.stringify(support, null, 2)}`);
    writeDebug('--------------------');

    // format
    const formatHeader = $('td.product__specification__title:contains("Format")');

    if (formatHeader.length > 0) {
      const formatValue = formatHeader.next('td');

      if (formatValue.length > 0) {
        const formatFromPage = formatValue.text();
        writeDebug(`formatFromPage: ${JSON.stringify(formatFromPage, null, 2)}`);
        format = formatText(formatFromPage);
      } else {
        writeDebug('no formatValue');
      }
    } else {
      writeDebug('no formatHeader');
    }
    writeDebug(`format: ${JSON.stringify(format, null, 2)}`);
    writeDebug('--------------------');

    // mesure
    const mesureHeader = $('td.product__specification__title:contains("Mesure")');

    if (mesureHeader.length > 0) {
      const mesureValue = mesureHeader.next('td');

      if (mesureValue.length > 0) {
        const mesureFromPage = mesureValue.text();
        writeDebug(`mesureFromPage: ${JSON.stringify(mesureFromPage, null, 2)}`);
        mesure = formatText(mesureFromPage);
        writeDebug(`mesure: ${JSON.stringify(mesure, null, 2)}`);
        const mesureParsed = parseDimensions(mesure);
        writeDebug(`mesureParsed: ${JSON.stringify(mesureParsed, null, 2)}`);
        if (mesureParsed.error) {
          writeLog.alert(mesureParsed.error);
          writeLog.alert('on Les Libraires:', link);
        } else {
          dimensions = mesureParsed.dimensions;
          weight = mesureParsed.weight;
        }
      } else {
        writeDebug('no mesureValue');
      }
    } else {
      writeDebug('no mesureHeader');
    }
    writeDebug(`dimensions: ${JSON.stringify(dimensions, null, 2)}`);
    writeDebug(`weight: ${JSON.stringify(weight, null, 2)}`);
    writeDebug('--------------------');

    // Feuilleter ce livre
    const excerptElement = $('a:has(span:contains("Feuilleter ce livre"))');

    if (excerptElement.length > 0) {
      excerptLink = excerptElement.attr('href');
    } else {
      writeDebug('no excerptElement');
    }
    writeDebug(`excerptLink: ${JSON.stringify(excerptLink, null, 2)}`);
    writeDebug('--------------------');

    // Télécharger un extrait
    const downloadElement = $('a:has(span:contains("Télécharger un extrait"))');

    if (downloadElement.length > 0) {
      downloadLink = downloadElement.attr('href');
    } else {
      writeDebug('no downloadElement');
    }
    writeDebug(`downloadLink: ${JSON.stringify(downloadLink, null, 2)}`);
    writeDebug('--------------------');

    // series
    const seriesHeader = $('td.product__specification__title:contains("Séries")');

    if (seriesHeader.length > 0) {
      const seriesValue = seriesHeader.next('td');

      if (seriesValue.length > 0) {
        const seriesText = seriesValue.text() || '';
        writeDebug(`seriesText: ${JSON.stringify(seriesText, null, 2)}`);

        const positionMatch = seriesText.match(/Livre\s+(\d+)/);
        writeDebug(`positionMatch: ${JSON.stringify(positionMatch, null, 2)}`);
        seriesPosition = positionMatch ? parseInt(positionMatch[1], 10) : '';
        writeDebug(`seriesPosition: ${JSON.stringify(seriesPosition, null, 2)}`);

        seriesName = formatText(seriesValue.find('a').text()) || '';
        writeDebug(`seriesName: ${JSON.stringify(seriesName, null, 2)}`);

        const seriesHref = seriesValue.find('a').attr('href') || '';
        writeDebug(`seriesHref: ${JSON.stringify(seriesHref, null, 2)}`);
        seriesCode = seriesHref ? seriesHref.replace('/serie/', '') : '';
        writeDebug(`seriesCode: ${JSON.stringify(seriesCode, null, 2)}`);
        seriesLink = seriesHref ? `${WEBSITE_URL}${seriesHref}` : '';
        writeDebug(`seriesLink: ${JSON.stringify(seriesLink, null, 2)}`);

        if (!seriesCode) {
          writeLog.alert(`Series format is incorrect: ${seriesText}`);
          writeLog.alert('on Les Libraires:', link);

          seriesPosition = '';
          writeDebug(`seriesPosition: ${JSON.stringify(seriesPosition, null, 2)}`);
          seriesName = '';
          writeDebug(`seriesName: ${JSON.stringify(seriesName, null, 2)}`);
          seriesCode = '';
          writeDebug(`seriesCode: ${JSON.stringify(seriesCode, null, 2)}`);
          seriesLink = '';
          writeDebug(`seriesLink: ${JSON.stringify(seriesLink, null, 2)}`);
        }
      } else {
        writeDebug('no seriesValue');
      }
    } else {
      writeDebug('no seriesHeader');
    }
    writeDebug('--------------------');

    if (!ISBN) {
      error = `There is insufficient data on Les Libraires: ${link}`;
      writeLog.alert(error);
      if (isHardScraping) {
        await screenshotError(page, 'leslibraires', Date.now());
      }
    }

    return {
      link,
      searched,
      found,
      ISBN,
      ISBNs,
      title,
      authors,
      authorsWithLink,
      image,
      images,
      description,
      mainCategories,
      mainCategoriesWithLink,
      subcategories,
      subcategoriesWithLink,
      releaseDate,
      language,
      publisher,
      publisherWithLink,
      collection,
      collectionWithLink,
      targetAudience,
      nbOfPages,
      composition,
      support,
      format,
      mesure,
      dimensions,
      weight,
      excerptLink,
      downloadLink,
      seriesPosition,
      seriesName,
      seriesCode,
      seriesLink,
      error,
      pageContent,
    };
  } catch (catchError) {
    error = `An error occurred while scraping Les Libraires with: ${link}`;
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
