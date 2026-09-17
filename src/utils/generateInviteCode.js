// Generates a random 6-digit invite code, e.g. "384021".
function generateInviteCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = generateInviteCode;
