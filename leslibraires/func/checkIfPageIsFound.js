const { writeLog } = require('useful-toolbox-js');

const { DEBUG_NAME_LESLIBRAIRES } = require('../../constants');

async function checkIfPageIsFound(page, forABook = false) {
  const writeDebug = writeLog.setDebug(DEBUG_NAME_LESLIBRAIRES);
  writeDebug('check if the page is found');
  writeDebug(`forABook: ${forABook}`);

  const html = await page.content();

  if (html.includes('<h1 class="headline headline--main">Page non trouvée</h1>')) {
    writeDebug('text found: Page non trouvée');
    return false;
  }

  const cleanedHtml = html
    .replace(/<li>Aucun résultat\.<\/li>/g, '')
    .replace(/"Aucun résultat/g, '')
    .replace(/Aucun résultat\."/g, '')
    .replace(/<li\s+role="option"\s+aria-selected="false">Aucun résultat\.<\/li>/g, '');
  const hasNoResults = cleanedHtml.includes('Aucun résultat.');
  if (hasNoResults) {
    writeDebug('text found: Aucun résultat');
    return false;
  }

  if (forABook) {
    const url = await page.url();
    if (url.includes('/catalogue')) {
      writeDebug('The book link has become a catalog, so no book found');
      return false;
    }
  }

  writeDebug('The criteria have been reviewed. The page is declared found.');
  return true;
}

module.exports = checkIfPageIsFound;
