js
// This runs on Netlify's server, never in the visitor's browser.
// It keeps the Anthropic API key private and relays coach conversations to Claude.

const fs = require('fs');
const path = require('path');

// Reads author-notes.txt (sitting right next to this file) on every request.
// This lets Terry adjust the coach's emphasis or priorities just by editing
// a plain text file on GitHub — no HTML or JavaScript changes required.
function getAuthorNotes() {
  try {
    const notes = fs.readFileSync(path.join(__dirname, 'author-notes.txt'), 'utf8').trim();
    return notes;
  } catch (err) {
    // File missing or unreadable — proceed without it, don't break the coach.
    return '';
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY. Add it in Netlify > Project configuration > Environment variables.' })
    };
  }

  try {
    const { system, messages } = JSON.parse(event.body);

    const authorNotes = getAuthorNotes();
    const finalSystem = authorNotes
      ? system + '\n\nADDITIONAL GUIDANCE FROM THE AUTHOR (follow this closely — it reflects what the author considers most important):\n' + authorNotes
      : system;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system: finalSystem,
        messages: messages
      })
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};