function formatText(text) {
  if (!text || text === 'null' || text === 'undefined') {
    return '';
  }
  if (typeof text !== 'string') {
    return text;
  }

  return text
    .trim()
    .replace(/<!-- -->/g, '')
    .replace(/<br>\s/g, '<br>')
    .replace(/\s<br>/g, '<br>');
}

module.exports = {
  formatText,
};
