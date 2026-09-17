const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Household = require("../models/Household");
const ApiError = require("../utils/ApiError");
const { createUser } = require("./userController");
const generateInviteCode = require("../utils/generateInviteCode");

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "180d" });
}

// POST /api/auth/signup
async function signup(req, res) {
  const { email, password, groupName, inviteCode } = req.body;

  if (!email || typeof email !== "string") {
    throw new ApiError(422, "email is required and must be a string");
  }

  if (!password || typeof password !== "string") {
    throw new ApiError(422, "password is required and must be a string");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  if (groupName && typeof groupName === "string") {
    // Creating a new household
    const user = await createUser({ email, password });
    const household = await Household.create({
      name: groupName,
      inviteCode: generateInviteCode(),
      owner: user._id,
      members: [user._id],
    });

    user.household = household._id;
    user.role = "admin";
    await user.save();

    return res.status(201).json({ token: signToken(user._id), inviteCode: household.inviteCode, household: household._id });
  }else if(inviteCode && typeof inviteCode === "string") {
    // Joining an existing household
    const household = await Household.findOne({ inviteCode });
    if (!household) {
      throw new ApiError(404, "Invalid invite code");
    }

    const user = await createUser({ email, password });
    household.members.push(user._id);
    await household.save();

    user.household = household._id;
    await user.save();

    return res.status(201).json({ token: signToken(user._id), household: household._id });
  }else{
  throw new ApiError(422, "groupName or inviteCode is required");

  }

  // if (inviteCode && typeof inviteCode === "string") {
  //   // Joining an existing household
  //   const household = await Household.findOne({ inviteCode });
  //   if (!household) {
  //     throw new ApiError(404, "Invalid invite code");
  //   }

  //   const userId = await createUser({ email, password });
  //   household.members.push(userId);
  //   await household.save();

  //   return res.status(201).json({ token: signToken(userId) });
  // }

}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "180d",
    });

    const household = user.household ? await Household.findById(user.household) : null;
    const isAdmin = user.role === "admin";

    res.json({
      token,
      household: user.household,
      householdName: household.name,
      inviteCode: isAdmin && household ? household.inviteCode : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// GET /api/auth/verify
async function verify(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.json({ valid: false });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, userId: decoded.userId });
  } catch (error) {
    res.json({ valid: false });
  }
}

module.exports = { signup, login, verify };
