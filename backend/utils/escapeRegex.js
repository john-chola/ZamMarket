// Escape user input before using it inside a MongoDB $regex, so
// characters like ( * + ? are matched literally and a crafted
// pattern cannot slow the database down
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeRegex };
