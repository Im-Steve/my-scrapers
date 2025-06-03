const { writeLog } = require('useful-toolbox-js');

const getBooksFromCatalog = require('./getBooksFromCatalog');

async function getBookLink(browser, codeToSearch, options) {
  writeLog.step('Get the book link on Les Libraires');

  const searchUrl = `https://www.leslibraires.ca/catalogue?s=${codeToSearch}&sort=pertinence`;
  const { bookLinks, error } = await getBooksFromCatalog(
    browser,
    searchUrl,
    codeToSearch,
    {
      ...options,
      approxMaxBooks: 1,
    },
  );

  if (!error && Array.isArray(bookLinks) && bookLinks.length > 0) {
    return bookLinks[0];
  }

  return null;
}

module.exports = getBookLink;
