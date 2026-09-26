// HTML escaping is not JavaScript-string escaping. Keep inline JSON executable
// while preventing metadata/configuration from closing the surrounding script.
module.exports = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,
  char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
