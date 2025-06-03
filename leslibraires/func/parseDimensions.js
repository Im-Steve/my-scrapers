function parseDimensions(mesure = '') {
  const dimensionsRegex = /(\d+\.?\d*)\s*cm\s*\(Hauteur\),\s*(\d+\.?\d*)\s*cm\s*\(Largeur\)/;
  const weightRegex = /(\d+)\s*gr\s*\(Poids\)/;

  const dimensionsMatch = mesure.match(dimensionsRegex);
  const weightMatch = mesure.match(weightRegex);

  if (dimensionsMatch || weightMatch) {
    const height = dimensionsMatch ? dimensionsMatch[1] : null;
    const width = dimensionsMatch ? dimensionsMatch[2] : null;
    const weight = weightMatch ? weightMatch[1] : null;

    return {
      dimensions: height && width ? `${height} x ${width} cm` : '',
      weight: weight ? `${weight} g` : '',
      error: null,
    };
  }

  return { error: `Mesure format is incorrect: ${mesure}` };
}

module.exports = parseDimensions;
