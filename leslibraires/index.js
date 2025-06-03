const path = require('path');

const getBookLink = require('./getBookLink');
const getBooksFromCatalog = require('./getBooksFromCatalog');
const scrapeItem = require('./scrapeItem');

module.exports = {
  folderWithCatalogLinks: path.join('node_modules', 'my-scrapers', 'leslibraires', 'catalogLinks'),
  getBookLink,
  getBooksFromCatalog,
  scrapeItem,
};
