const { frDateToJsDate, engDateToJsDate } = require('useful-toolbox-js');

function extractFromTable(table, initialData) {
  let {
    ASIN = '',
    nbOfPages = null,
    language = '',
    publisher = '',
    releaseDate = '',
    targetAudience = '',
    dimensions = '',
    weight = '',
  } = initialData;

  Object.keys(table).forEach((key) => {
    if (key.toLowerCase().includes('asin')) {
      ASIN = table[key];
    }

    if (table[key].includes('pages')) {
      const nbOfPagesMatch = table[key].match(/\d+/g);
      if (nbOfPagesMatch) {
        const nbOfPagesInt = parseInt(nbOfPagesMatch[0], 10);
        nbOfPages = !Number.isNaN(nbOfPagesInt) ? nbOfPagesInt : null;
      }
    }

    if (key.toLowerCase().includes('langue')
    || key.toLowerCase().includes('language')) {
      language = table[key];
    }

    if (key.toLowerCase().includes('éditeur')
    || key.toLowerCase().includes('publisher')) {
      publisher = table[key];
    }

    if (key.toLowerCase().includes('date de publication')) {
      releaseDate = frDateToJsDate(table[key]);
    }

    if (key.toLowerCase().includes('publication date')) {
      releaseDate = engDateToJsDate(table[key]);
    }

    if (key.toLowerCase().includes('âge de lecture')
    || key.toLowerCase().includes('reading age')) {
      targetAudience = table[key];
    }

    if (key.toLowerCase().includes('dimension')) {
      dimensions = table[key];
    }

    if (key.toLowerCase().includes('poids')
    || key.toLowerCase().includes('weight')) {
      weight = table[key];
    }
  });

  return {
    ...initialData,
    ASIN,
    nbOfPages,
    language,
    publisher,
    releaseDate,
    targetAudience,
    dimensions,
    weight,
  };
}

module.exports = extractFromTable;
