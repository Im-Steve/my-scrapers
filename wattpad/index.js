const path = require('path');

const getBooksFromCatalog = require('./getBooksFromCatalog');
const scrapeItem = require('./scrapeItem');

module.exports = {
  fileWithCatalogLinks: path.join('node_modules', 'my-scrapers', 'wattpad', 'linksToCatalogs.xlsx'),
  getBooksFromCatalog,
  scrapeItem,
};
