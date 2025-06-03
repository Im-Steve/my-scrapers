const fs = require('fs');
const path = require('path');
const { formatFileName, logFolder, writeLog } = require('useful-toolbox-js');

async function screenshotPage(page, fileName = 'null') {
  try {
    if (!fs.existsSync(logFolder)) {
      await fs.promises.mkdir(logFolder);
    }

    const screenshotPath = path.join(logFolder, `${formatFileName(fileName)}.png`);
    await page.screenshot({ path: screenshotPath });
  } catch (error) {
    writeLog.alert("Can't take a screenshot");
    writeLog.error(error);
  }
}

async function screenshotError(page, source = 'null', code = 'null') {
  try {
    if (!fs.existsSync(logFolder)) {
      await fs.promises.mkdir(logFolder);
    }

    const screenshotPath = path.join(logFolder, `error--${formatFileName(source)}--${formatFileName(code)}.png`);
    await page.screenshot({ path: screenshotPath });
    writeLog.alert('See screenshot:', screenshotPath);
  } catch (error) {
    writeLog.alert("Can't take a screenshot");
    writeLog.error(error);
  }
}

module.exports = { screenshotPage, screenshotError };
