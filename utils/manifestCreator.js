const { createInterface } = require('node:readline');
const { styleText } = require('node:util');

const questions = [
  { id: 'name', text: 'Doodle name', answerType: 'str', required: true },
  { id: 'author.name', text: 'Author name', answerType: 'str', required: true },
  { id: 'author.github', text: 'Author github username', answerType: 'github', required: true },
  { id: 'author.website', text: 'Author website', answerType: 'url', required: true },
  { id: 'author.twitter', text: 'Author twitter handle, without the "@" (leave blank if don\'t have one)', answerType: 'str', required: false },
  { id: 'description', text: 'Doodle description', answerType: 'str', required: true },
  { id: 'tags', text: 'Doodle tags (comma separated list)', answerType: 'tags', required: true },
  { id: 'interaction.mouse', text: 'Mouse interaction enabled? (y/n)', answerType: 'bool', required: true },
  { id: 'interaction.keyboard', text: 'Keyboard interaction enabled? (y/n)', answerType: 'bool', required: true },
  { id: 'interaction.touch', text: 'Touch interaction enabled? (y/n)', answerType: 'bool', required: true },
  { id: 'instructions', text: 'Instructions', answerType: 'strInstructions', required: true },
  { id: 'colour_scheme', text: 'Doodle colour scheme? (light/dark)', answerType: 'colour_scheme', required: true },
  { id: 'mobile_friendly', text: 'Doodle mobile friendly? (y/n)', answerType: 'bool', required: true }
];

function validateAnswer(question, answer) {
  if (question.required && !answer) return 'Please provide a value.';
  if (!answer && !question.required) return;
  switch (question.answerType) {
    case 'url': {
      try {
        const url = new URL(answer);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || /\s/.test(answer)) throw new Error();
      } catch { return 'Please provide an absolute HTTP or HTTPS URL.'; }
      break;
    }
    case 'bool':
      if (!/^[yn]$/i.test(answer)) return 'Please answer y or n.';
      break;
    case 'github':
      if (!/^(?!-)[a-z0-9-]{1,38}$/i.test(answer)) return 'Use a GitHub username: 1–38 letters, numbers or dashes, without a leading dash.';
      break;
    case 'strInstructions':
      if (answer.length > 35) return 'Instructions must be at most 35 characters.';
      break;
    case 'colour_scheme':
      if (!['light', 'dark'].includes(answer)) return 'Please answer light or dark.';
      break;
  }
}

async function create({ input = process.stdin, output = process.stdout } = {}) {
  const reader = createInterface({ input, crlfDelay: Infinity });
  const lines = reader[Symbol.asyncIterator]();
  const answers = {};
  try {
    for (const question of questions) {
      let value;
      while (true) {
        output.write(styleText('gray', `${question.text}: `, { stream: output }));
        const line = await lines.next();
        if (line.done) throw new Error('Input ended before the manifest was complete; no doodle was created.');
        value = line.value.trim();
        const error = validateAnswer(question, value);
        if (!error) break;
        output.write(`${error}\n`);
      }
      if (question.answerType === 'tags') value = value.toLowerCase().split(',').map(tag => tag.trim().replace(/\s+/g, '-')).filter(Boolean);
      if (question.answerType === 'bool') value = value.toLowerCase() === 'y';
      const [parent, child] = question.id.split('.');
      if (child) (answers[parent] ||= {})[child] = value;
      else answers[parent] = value;
    }
    return answers;
  } finally { reader.close(); }
}

module.exports = { create };
