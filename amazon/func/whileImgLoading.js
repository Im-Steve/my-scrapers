const { writeLog } = require('useful-toolbox-js');

const { DEBUG_NAME_AMAZON, MAXIMUM_ATTEMPTS } = require('../../constants');

async function whileImgLoading(pageItem, selector) {
  const writeDebug = writeLog.setDebug(DEBUG_NAME_AMAZON);
  let error = null;
  let nbOfAttempts = 1;

  let imageUrl = await pageItem.$eval(selector, (img) => img.src);

  while (imageUrl.includes('loadIndicators') && nbOfAttempts < MAXIMUM_ATTEMPTS) {
    writeDebug(`imageUrl: ${JSON.stringify(imageUrl, null, 2)}`);
    writeDebug('imageUrl is a load indicator');
    writeDebug('waiting...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    imageUrl = await pageItem.$eval(selector, (img) => img.src);
    nbOfAttempts += 1;
  }

  if (imageUrl.includes('loadIndicators')) {
    error = 'The load wait limit for the Amazon load indicator has been reached';
  }

  return { imageUrl, error };
}

module.exports = whileImgLoading;
