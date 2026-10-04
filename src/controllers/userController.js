const bcrypt = require("bcrypt");
const User = require("../models/User");

async function createUser({ firstName, lastName, email, password }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({ firstName, lastName, email, password: hashedPassword });
  return user;
}

module.exports = { createUser };
