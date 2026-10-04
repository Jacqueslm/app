// The one function Vercel runs. Everything the site needs from a server comes
// through here: the password door, the three private pages, and the two AI
// routes whose key must never reach a phone.
//
// The app itself is in server/vercel-app.js, next to the Railway server and
// sharing its prompt and request-body code, so the two hosts cannot answer
// differently.
module.exports = require('../server/vercel-app');
