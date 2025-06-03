const cheerio = require('cheerio');
const { setTimeout } = require('node:timers/promises');
const { writeLog } = require('useful-toolbox-js');

const extractFromTable = require('./func/extractFromTable');
const { formatText } = require('../func/formatData');
const { DEBUG_NAME_AMAZON, MAXIMUM_ATTEMPTS } = require('../constants');
const { screenshotError } = require('../func/takeScreenshot');
const whileImgLoading = require('./func/whileImgLoading');

const WEBSITE_URL = 'https://www.amazon.ca';
const LANG_URL_PATH = '/-/fr';
const SEARCH_URL = `${WEBSITE_URL}${LANG_URL_PATH}/s?k=`;

async function scrapeItem(pageSearch, pageItem, codeToSearch, initialData = {}, options = {}) {
  const writeDebug = writeLog.setDebug(DEBUG_NAME_AMAZON);
  let error = null;

  const defaultTimeout = options.timeoutOff ? 0 : MAXIMUM_ATTEMPTS * 1000;
  pageSearch.setDefaultTimeout(defaultTimeout);
  pageItem.setDefaultTimeout(defaultTimeout);

  // Start
  writeLog.step('Scrape Amazon');
  let nbOfAttempts = 1;

  let { link, pageContent } = initialData;
  const { useSavedPage } = options;

  let searched = false;
  let found = false;

  let isHardScraping = true;
  if (useSavedPage && pageContent && !initialData.error) {
    isHardScraping = false;
  }

  writeDebug(`codeToSearch: ${codeToSearch}`);
  writeDebug(`link: ${link}`);
  writeDebug(`has pageContent: ${!!pageContent}`);
  writeDebug(`has useSavedPage: ${useSavedPage}`);
  writeDebug(`isHardScraping: ${isHardScraping}`);

  // Load page content
  if (isHardScraping) {
    // Go to the search page
    writeLog.dev('go to the search page...');
    const searchUrl = `${SEARCH_URL}${codeToSearch}`;
    writeDebug(`searchUrl: ${searchUrl}`);
    try {
      await pageSearch.bringToFront();
      await pageSearch.goto(searchUrl);
    } catch (catchError) {
      error = `An error occurred while accessing Amazon search with: ${codeToSearch}`;
      writeLog.alert(error);
      writeLog.error(catchError);
      return { ...initialData, error };
    }

    // Accept cookies
    try {
      writeDebug('accept cookies');
      const cookiesButton = await pageSearch.$('[data-action="banner-accept-all"]');

      if (cookiesButton) {
        writeDebug('cookies button found');
        await cookiesButton.click();
        await setTimeout(1000);
      } else {
        writeDebug('no cookies button found');
      }
    } catch (catchError) {
      error = `An error occurred while accepting cookies with: ${codeToSearch}`;
      writeLog.alert(error);
      writeLog.error(catchError);
      return { ...initialData, error };
    }

    // Check if something went wrong
    try {
      let pageSearchContent = await pageSearch.content();

      while (pageSearchContent.includes('Sorry! Something went wrong.')
      // || pageSearchContent.includes("Sorry! We couldn't fetch that page."))
      && nbOfAttempts < MAXIMUM_ATTEMPTS) {
        writeDebug('something went wrong on Amazon');
        writeDebug('waiting...');
        await setTimeout(1000);

        writeDebug('click to the home page');
        await pageSearch.$$eval('a[href="/"]', (homeLinks) => homeLinks.map((homeLink) => homeLink.click()));
        writeDebug('waiting...');
        await setTimeout(1000);

        writeDebug('go to the search page...');
        await pageSearch.goto(searchUrl);
        pageSearchContent = await pageSearch.content();
        nbOfAttempts += 1;
        writeDebug(`nbOfAttempts: ${nbOfAttempts}`);
      }
    } catch (catchError) {
      error = 'An error occurred on the Amazon page "Something went wrong"';
      writeLog.alert(error);
      writeLog.error(catchError);
      return { ...initialData, error };
    }

    // Get the first item link
    writeLog.dev('get the item link...');
    try {
      // Check results
      const pageSearchContent = await pageSearch.content();
      if (pageSearchContent.includes('Sorry! Something went wrong.')) {
        error = 'Sorry! Something went wrong on Amazon.';
        writeLog.alert(error);
        return { ...initialData, error };
      }
      if (pageSearchContent.includes('Aucun résultat pour') || pageSearchContent.includes('No results for')) {
        writeLog.alert('No results on Amazon for:', codeToSearch);
        return {
          ...initialData,
          searched: true,
          found: false,
          error: null,
        };
      }

      // Get results
      let results = await pageSearch.$$(
        'div.title-recipe a',
      );
      if (!results || results.length === 0 || !results[0]) {
        results = await pageSearch.$$(
          'a.a-link-normal.s-line-clamp-4.s-link-style.a-text-normal',
        );
      }
      // if (!results || results.length === 0 || !results[0]) {
      //   results = await pageSearch.$$(
      //     'a.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal',
      //   );
      // }

      if (results && results.length > 0 && results[0]) {
        const itemHref = await results[0].evaluate((element) => element.getAttribute('href'));
        link = `${WEBSITE_URL}${itemHref.includes(LANG_URL_PATH) ? '' : LANG_URL_PATH}${itemHref}`;
      } else {
        error = `Nothing was found on Amazon with: ${codeToSearch}`;
        writeLog.alert(error);
        await screenshotError(pageSearch, 'amazon', codeToSearch);
        return { ...initialData, error };
      }
    } catch (catchError) {
      error = `An error occurred while getting the Amazon link with: ${codeToSearch}`;
      writeLog.alert(error);
      writeLog.error(catchError);
      return { ...initialData, error };
    }
  }

  if (isHardScraping) {
    // Go to the item page
    writeLog.dev('go to the item page...');
    writeDebug(`link: ${link}`);
    try {
      await pageItem.bringToFront();
      await pageItem.goto(link);
      pageContent = await pageItem.content();
    } catch (catchError) {
      error = `An error occurred while accessing the Amazon page: ${link}`;
      writeLog.alert(error);
      writeLog.error(catchError);
      return { ...initialData, error };
    }

    // Check if something went wrong
    try {
      while (pageContent.includes('Sorry! Something went wrong.')
      // || pageContent.includes("Sorry! We couldn't fetch that page."))
      && nbOfAttempts < MAXIMUM_ATTEMPTS) {
        writeDebug('something went wrong on Amazon');
        writeDebug('waiting...');
        await setTimeout(1000);

        writeDebug('click to the home page');
        await pageItem.$$eval('a[href="/"]', (homeLinks) => homeLinks.map((homeLink) => homeLink.click()));
        writeDebug('waiting...');
        await setTimeout(1000);

        writeDebug('go to the item page...');
        await pageItem.goto(link);
        pageContent = await pageItem.content();
        nbOfAttempts += 1;
        writeDebug(`nbOfAttempts: ${nbOfAttempts}`);
      }
    } catch (catchError) {
      error = 'An error occurred on the Amazon page "Something went wrong"';
      writeLog.alert(error);
      writeLog.error(catchError);
      return { ...initialData, error };
    }
  }

  // Scrape data
  writeLog.dev('scrape data...');
  try {
    const $ = cheerio.load(pageContent);
    searched = true;
    found = true;

    let title = '';
    let authors = [];
    let authorsWithLink = [];
    let description = '';
    let image = initialData.image || '';
    let images = initialData.images || [];
    const productDetails = {};
    let details = {
      nbOfPages: null,
      language: '',
      publisher: '',
      releaseDate: '',
      targetAudience: '',
      dimensions: '',
      weight: '',
    };
    let authorBio = '';
    let authorImg = '';

    // title
    const titleFromPage = $('#productTitle').text();
    writeDebug(`titleFromPage: ${JSON.stringify(titleFromPage, null, 2)}`);
    title = formatText(titleFromPage);
    writeDebug(`title: ${JSON.stringify(title, null, 2)}`);
    writeDebug('--------------------');

    // author
    const authorsFromPage = [];
    $('.author.notFaded').each((index, element) => {
      const authorElement = $(element);
      const aElement = authorElement.find('a');

      const innerHTML = aElement.text();
      const href = aElement.attr('href');

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

    // description
    const descFromPage = $('#bookDescription_feature_div div div').html();
    writeDebug(`descFromPage: ${JSON.stringify(descFromPage, null, 2)}`);
    writeDebug('---');
    description = formatText(descFromPage);
    writeDebug(`description: ${JSON.stringify(description, null, 2)}`);
    writeDebug('--------------------');

    // images
    // note: only with isHardScraping
    if (isHardScraping) {
      writeDebug('scrape images');
      const imagesFromPage = [];
      let imgUnavailable = false;

      // Check if no image
      const imgUnavailableElem = await pageItem.$('.variationUnavailable.unavailableExp');
      if (imgUnavailableElem) {
        const imgUnavailableHtml = await pageItem.evaluate(
          (element) => element.outerHTML,
          imgUnavailableElem,
        );

        if (imgUnavailableHtml && imgUnavailableHtml.includes('display: block')) {
          imgUnavailable = true;
        }
      }
      writeDebug(`imgUnavailable: ${imgUnavailable}`);

      // Get images
      // cover attempt #1
      if (!imgUnavailable && imagesFromPage.length === 0) {
        const mainImageSelector = 'span[data-action="main-image-click"]';
        writeDebug(`search ${mainImageSelector}`);
        const mainImage = await pageItem.$(mainImageSelector);
        if (mainImage) {
          await pageItem.click(mainImageSelector);
          await setTimeout(1000);
          const thumbnailsToClick = await pageItem.$$('.ivThumb[id^="ivImage_"]');
          writeDebug(`thumbnailsToClick.length: ${thumbnailsToClick.length}`);

          if (thumbnailsToClick.length > 1) {
            for (const thumbnail of thumbnailsToClick) {
              await thumbnail.click();
              await setTimeout(1000);

              const largeImgSelector = '#ivLargeImage img';
              const largeImg = await pageItem.$(largeImgSelector);
              if (largeImg) {
                const {
                  imageUrl,
                  error: errorImgLoading,
                } = await whileImgLoading(pageItem, largeImgSelector);
                error = error || errorImgLoading;
                writeDebug(`imageUrl: ${JSON.stringify(imageUrl, null, 2)}`);
                writeDebug(`error: ${JSON.stringify(error, null, 2)}`);
                imagesFromPage.push(imageUrl);
              } else {
                writeDebug('no largeImg');
              }
            }
          }

          if (thumbnailsToClick.length <= 1) {
            const largeImgSelector = '#ivLargeImage img';
            const largeImg = await pageItem.$(largeImgSelector);
            if (largeImg) {
              const {
                imageUrl,
                error: errorImgLoading,
              } = await whileImgLoading(pageItem, largeImgSelector);
              error = error || errorImgLoading;
              writeDebug(`imageUrl: ${JSON.stringify(imageUrl, null, 2)}`);
              writeDebug(`error: ${JSON.stringify(error, null, 2)}`);
              imagesFromPage.push(imageUrl);
            } else {
              writeDebug('no largeImg');
            }
          }
        }
      }

      // cover attempt #2
      if (!imgUnavailable && imagesFromPage.length === 0) {
        const imgBlkFrontSelector = '#imgBlkFront';
        writeDebug(`search ${imgBlkFrontSelector}`);
        const imgBlkFront = await pageItem.$(imgBlkFrontSelector);
        if (imgBlkFront) {
          const imageUrl = await whileImgLoading(pageItem, imgBlkFrontSelector);
          writeDebug(`imageUrl: ${JSON.stringify(imageUrl, null, 2)}`);
          imagesFromPage.push(imageUrl);
        }
      }

      // cover attempt #3
      if (!imgUnavailable && imagesFromPage.length === 0) {
        const ebooksImgBlkFrontSelector = '#ebooksImgBlkFront';
        writeDebug(`search ${ebooksImgBlkFrontSelector}`);
        const ebooksImgBlkFront = await pageItem.$(ebooksImgBlkFrontSelector);
        if (ebooksImgBlkFront) {
          const imageUrl = await whileImgLoading(pageItem, ebooksImgBlkFrontSelector);
          writeDebug(`imageUrl: ${JSON.stringify(imageUrl, null, 2)}`);
          imagesFromPage.push(imageUrl);
        }
      }

      // Filter images
      if (imagesFromPage.length > 0) {
        image = '';
        images = [];

        writeDebug('filter images...');
        for (const img of imagesFromPage) {
          const includesTransparent = img.includes('transparent');

          if (!includesTransparent) {
            images.push(img);
          }
        }
      }
    } else if (!image) {
      writeLog.alert('The hard scraping must be enabled to get the images on Amazon');
      writeLog.alert('Item with no image because no hard scraping:', codeToSearch);
    } else {
      writeDebug('the isHardScraping option must be activated to update the images');
    }
    if (images.length > 0) {
      [image] = images;
    } else {
      image = '';
    }
    writeDebug(`image: ${JSON.stringify(image, null, 2)}`);
    writeDebug(`images: ${JSON.stringify(images, null, 2)}`);
    writeDebug('--------------------');

    // product details
    const detailsList = $('.a-unordered-list.a-nostyle.a-vertical.a-spacing-none.detail-bullet-list li');

    detailsList.each((index, element) => {
      const keyElement = $(element).find('.a-text-bold');
      const valueElement = $(element).find(':not(.a-text-bold)').first();

      if (keyElement.length && valueElement.length) {
        const key = keyElement.text()
          .trim()
          .replace(/\s{2,}/g, '')
          .replace(/:/g, '')
          .replace(/‎/g, '')
          .replace(/‏/g, '');

        const value = valueElement.text()
          .trim()
          .replace(/\s{2,}/g, '')
          .replace(/:/g, '')
          .replace(/‎/g, '')
          .replace(/‏/g, '')
          .replace(key, '');

        productDetails[key] = value;
      }
    });
    writeDebug(`productDetails: ${JSON.stringify(productDetails, null, 2)}`);
    writeDebug('--------------------');

    // Extract details from the product details
    const detailsFromProductDetails = extractFromTable(productDetails, details);
    details = { ...details, ...detailsFromProductDetails };
    writeDebug(`detailsFromProductDetails and details: ${JSON.stringify(detailsFromProductDetails, null, 2)}`);
    writeDebug('--------------------');

    writeDebug(`details: ${JSON.stringify(details, null, 2)}`);
    writeDebug('--------------------');

    // author biography
    const bioTitleFr = "Biographie de l'auteur";
    const bioTitleEng = 'About the Author';

    const bioHeader = $('h3')
      .filter(
        (index, element) => $(element).text().trim() === bioTitleFr
          || $(element).text().trim() === bioTitleEng,
      )
      .first();

    if (bioHeader.length > 0) {
      const bioDiv = bioHeader.next('div');

      if (bioDiv.length > 0) {
        const bioFromPage = bioDiv.html();
        writeDebug(`bioFromPage: ${JSON.stringify(bioFromPage, null, 2)}`);
        writeDebug('---');
        authorBio = formatText(bioFromPage);
      } else {
        writeDebug('no bioDiv');
      }
    } else {
      writeDebug('no bioHeader');
    }
    writeDebug(`authorBio: ${JSON.stringify(authorBio, null, 2)}`);
    writeDebug('--------------------');

    // author image
    const authorImgElement = $('img._about-the-author-card_carouselItemStyles_authorImage__3jKLX');
    if (authorImgElement.length > 0) {
      const authorImgFromPage = authorImgElement.attr('src');
      writeDebug(`authorImgFromPage: ${JSON.stringify(authorImgFromPage, null, 2)}`);

      if (authorImgFromPage
      && authorImgFromPage !== 'https://m.media-amazon.com/images/I/01Kv-W2ysOL._SY600_.png') {
        authorImg = authorImgFromPage;
      } else {
        writeDebug('default image');
      }
    } else {
      writeDebug('no authorImgElement');
    }
    writeDebug(`authorImg: ${JSON.stringify(authorImg, null, 2)}`);
    writeDebug('--------------------');

    if (!title) {
      error = `There is insufficient data on Amazon with ${codeToSearch}`;
      writeLog.alert(error);
      if (isHardScraping) {
        await screenshotError(pageItem, 'amazon', codeToSearch);
      }
    }

    return {
      link,
      searched,
      found,
      title,
      authors,
      authorsWithLink,
      image,
      images,
      description,
      productDetails,
      ...details,
      authorBio,
      authorImg,
      error,
      pageContent,
    };
  } catch (catchError) {
    error = `An error occurred while scraping Amazon with: ${codeToSearch}`;
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
