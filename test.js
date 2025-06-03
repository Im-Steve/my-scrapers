const path = require('path');
const {
  startRecordingLogs,
  stopRecordingLogs,
  importExcelFile,
  launchBrowser,
  waitForEnter,
  writeLog,
} = require('useful-toolbox-js');

const {
  aa,
  ar,
  ll,
  rc,
  wp,
} = require('./index');

const ISBN_TO_TEST = '9782070437436';

async function getOneLesLibraires(isbnToSearch = ISBN_TO_TEST) {
  writeLog.log('\nTEST: GET ONE LES LIBRAIRES');
  writeLog.log('with:', isbnToSearch);
  writeLog.log('--------------------\n');

  const browser = await launchBrowser();
  const bookLink = await ll.getBookLink(browser, isbnToSearch);

  if (browser) {
    await browser.close();
  }

  writeLog.info('\nBook link:', bookLink);
}

async function getLesLibraires(linkToSearch) {
  writeLog.log('\nTEST: GET LES LIBRAIRES');
  writeLog.log('with:', linkToSearch);
  writeLog.log('--------------------\n');

  let linkFile;
  if (!linkToSearch) {
    const folderWithCatalogLinks = ll.folderWithCatalogLinks.replace('node_modules\\my-scrapers', '.');
    const linkFilePath = path.join(folderWithCatalogLinks, 'fr_palmares.xlsx');
    linkFile = importExcelFile(linkFilePath);
  } else {
    linkFile = {
      data: [{
        link: linkToSearch,
        catalog: 'test',
      }],
    };
  }

  const browser = await launchBrowser();
  const data = await ll.getBooksFromCatalog(
    browser,
    linkFile.data[0].link,
    linkFile.data[0].catalog,
  );

  if (browser) {
    await browser.close();
  }

  writeLog.info('\nData:');
  writeLog.log(JSON.stringify(data, null, 2));
}

async function scrapeLesLibraires(linkToSearch = 'https://www.leslibraires.ca/livres/le-guide-du-voyageur-galactique-h2g2-douglas-adams-9782070437436.html') {
  writeLog.log('\nTEST: SCRAPE LES LIBRAIRES');
  writeLog.log('with:', linkToSearch);
  writeLog.log('--------------------\n');

  const browser = await launchBrowser();
  const page = await browser.newPage();
  const data = await ll.scrapeItem(
    page,
    linkToSearch,
  );
  delete data.pageContent;

  if (browser) {
    await browser.close();
  }

  writeLog.info('\nData:');
  writeLog.log(JSON.stringify(data, null, 2));
}

async function scrapeAmazon(isbnToSearch = ISBN_TO_TEST) {
  writeLog.log('\nTEST: SCRAPE AMAZON');
  writeLog.log('with:', isbnToSearch);
  writeLog.log('--------------------\n');

  const browser = await launchBrowser();
  const page = await browser.newPage();
  const page2 = await browser.newPage();
  const data = await aa.scrapeItem(page, page2, isbnToSearch);
  delete data.pageContent;

  if (browser) {
    await browser.close();
  }

  writeLog.info('\nData:');
  writeLog.log(JSON.stringify(data, null, 2));
}

async function scrapeArchambault(isbnToSearch = ISBN_TO_TEST) {
  writeLog.log('\nTEST: SCRAPE ARCHAMBAULT');
  writeLog.log('with:', isbnToSearch);
  writeLog.log('--------------------\n');

  const browser = await launchBrowser();
  const page = await browser.newPage();
  const data = await ar.scrapeItem(page, isbnToSearch);
  delete data.pageContent;

  if (browser) {
    await browser.close();
  }

  writeLog.info('\nData:');
  writeLog.log(JSON.stringify(data, null, 2));
}

async function scrapeQuialu(isbnToSearch = ISBN_TO_TEST) {
  writeLog.log('\nTEST: SCRAPE QUIALU');
  writeLog.log('with:', isbnToSearch);
  writeLog.log('--------------------\n');

  const browser = await launchBrowser();
  const page = await browser.newPage();
  const page2 = await browser.newPage();
  const data = await rc.scrapeOpinions(page, page2, isbnToSearch);
  delete data.pageContent;

  if (browser) {
    await browser.close();
  }

  writeLog.info('\nData:');
  writeLog.log(JSON.stringify(data, null, 2));
}

async function getWattpad(linkToSearch, language = 'fr') {
  writeLog.log('\nTEST: GET WATTPAD');
  writeLog.log('with:', linkToSearch);
  writeLog.log('language:', language);
  writeLog.log('--------------------\n');

  let fileWithCatalogLinks;
  if (!linkToSearch) {
    fileWithCatalogLinks = importExcelFile(wp.fileWithCatalogLinks.replace('node_modules\\my-scrapers', '.'));
  } else {
    fileWithCatalogLinks = {
      data: [{
        link: linkToSearch,
        catalog: 'test',
      }],
    };
  }

  const browser = await launchBrowser();
  const page = await browser.newPage();
  const data = await wp.getBooksFromCatalog(
    page,
    fileWithCatalogLinks.data[0].link,
    fileWithCatalogLinks.data[0].catalog,
    language,
  );

  if (browser) {
    await browser.close();
  }

  writeLog.info('\nData:');
  writeLog.log(JSON.stringify(data, null, 2));
}

async function scrapeWattpad(linkToSearch = 'https://www.wattpad.com/story/366144336-le-caf%C3%A9-des-possibles') {
  writeLog.log('\nTEST: SCRAPE WATTPAD');
  writeLog.log('with:', linkToSearch);
  writeLog.log('--------------------\n');

  const browser = await launchBrowser();
  const page = await browser.newPage();
  const page2 = await browser.newPage();
  const data = await wp.scrapeItem(page, page2, linkToSearch);
  delete data.pageContent;

  if (browser) {
    await browser.close();
  }

  writeLog.info('\nData:');
  writeLog.log(JSON.stringify(data, null, 2));
}

async function testAll() {
  writeLog.log('\nTEST ALL');
  writeLog.log('--------------------');

  await getOneLesLibraires();
  writeLog.log('\n');
  await waitForEnter();
  writeLog.log('');

  await scrapeLesLibraires();
  writeLog.log('\n');
  await waitForEnter();
  writeLog.log('');

  await scrapeLesLibraires('https://www.leslibraires.ca/livres/error');
  writeLog.log('\n');
  await waitForEnter();
  writeLog.log('');

  await scrapeAmazon();
  writeLog.log('\n');
  await waitForEnter();
  writeLog.log('');

  await scrapeArchambault();
  writeLog.log('\n');
  await waitForEnter();
  writeLog.log('');

  await scrapeQuialu();
  writeLog.log('\n');
  await waitForEnter();
  writeLog.log('');

  await scrapeWattpad();
  writeLog.log('\n');
  await waitForEnter();
  writeLog.log('');

  await getLesLibraires();
  writeLog.log('\n');
  await waitForEnter();
  writeLog.log('');

  await getLesLibraires('https://www.leslibraires.ca/catalogue/error');
  writeLog.log('\n');
  await waitForEnter();
  writeLog.log('');

  await getLesLibraires('https://www.leslibraires.ca/serie/error');
  writeLog.log('\n');
  await waitForEnter();
  writeLog.log('');

  await getWattpad();
}

function showUsage() {
  writeLog.log(
    'Command lines:\n',
    '\tnode test.js usage\n',
    '\t> node test.js all (to test all)\n',
    '\tnode test.js get-one-ll (to test Les Libraires getting)\n',
    '\tnode test.js get-ll (to test Les Libraires getting)\n',
    '\tnode test.js get-ll-noresults (to test no results with a catalog)\n',
    '\tnode test.js get-ll-noseries (to test no results with a series)\n',
    '\tnode test.js scrape-ll (to test Les Libraires scraping)\n',
    '\tnode test.js scrape-ll-noresults (to test scraping with no results)\n',
    '\tnode test.js scrape-aa (to test Amazon scraping)\n',
    '\tnode test.js scrape-ar (to test Archambault scraping)\n',
    '\tnode test.js scrape-rc (to test Quialu scraping)\n',
    '\tnode test.js get-wp (to test Wattpad getting)\n',
    '\tnode test.js get-wp-fr (to test Wattpad getting in french)\n',
    '\tnode test.js get-wp-eng (to test Wattpad getting in english)\n',
    '\tnode test.js scrape-wp (to test Wattpad scraping)\n',
  );
}

async function runTest() {
  await startRecordingLogs();

  const actionArg = process.argv.length >= 3 && process.argv[2];

  switch (actionArg) {
    case 'usage':
      showUsage();
      break;
    case 'get-one-ll':
      await getOneLesLibraires();
      break;
    case 'get-ll':
      await getLesLibraires();
      break;
    case 'get-ll-noresults':
      await getLesLibraires('https://www.leslibraires.ca/catalogue/error');
      break;
    case 'get-ll-noseries':
      await getLesLibraires('https://www.leslibraires.ca/serie/error');
      break;
    case 'scrape-ll':
      await scrapeLesLibraires();
      break;
    case 'scrape-ll-noresults':
      await scrapeLesLibraires('https://www.leslibraires.ca/livres/error');
      break;
    case 'scrape-aa':
      await scrapeAmazon();
      break;
    case 'scrape-ar':
      await scrapeArchambault();
      break;
    case 'scrape-rc':
      await scrapeQuialu();
      break;
    case 'get-wp':
      await getWattpad();
      break;
    case 'get-wp-fr':
      await getWattpad(undefined, 'fr');
      break;
    case 'get-wp-eng':
      await getWattpad(undefined, 'eng');
      break;
    case 'scrape-wp':
      await scrapeWattpad();
      break;
    case 'all':
      await testAll();
      break;
    default:
      writeLog.error('Error: Invalid use of arguments');
      showUsage();
  }
  stopRecordingLogs();
}

runTest();
