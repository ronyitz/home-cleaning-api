const bcrypt = require("bcrypt");
const User = require("../models/User");

async function createUser(data, session) {
  const { firstName, lastName, email, password, household } = data;
  const hashedPassword = await bcrypt.hash(password, 10);
  const [user] = await User.create([{ firstName, lastName, email, password: hashedPassword, household }], { session });
  return user;
}

module.exports = { createUser };
