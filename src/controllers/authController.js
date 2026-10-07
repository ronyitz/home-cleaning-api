const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Household = require("../models/Household");
const ApiError = require("../utils/ApiError");
const { createUser } = require("./userController");
const generateInviteCode = require("../utils/generateInviteCode");
const mongoose = require("mongoose");

function signToken(userId, householdId) {
  return jwt.sign({ userId, householdId }, process.env.JWT_SECRET, { expiresIn: "180d" });
}

// POST /api/auth/signup
async function signup(req, res) {
  const { email, firstName, lastName, password, groupName, inviteCode } = req.body;

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
    let user;
    let household;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        user = await createUser({ firstName, lastName, email, password }, session);
        [household] = await Household.create([{
          name: groupName,
          inviteCode: generateInviteCode(),
          owner: user._id,
          members: [user._id],
        }], { session });

        user.household = household._id;
        user.role = "admin";
        await user.save({ session });

      });
    } finally {
      session.endSession();
    }
    return res.status(201).json({ token: signToken(user._id, household._id), inviteCode: household.inviteCode, household: household._id });

  } else if (inviteCode && typeof inviteCode === "string") {

    let user;
    let household = await Household.findOne({ inviteCode });
    if (!household) {
      throw new ApiError(404, "Invalid invite code");
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Joining an existing household
        user = await createUser({ firstName, lastName, email, password, household: household._id }, session);
        household.members.push(user._id);
        await household.save({ session });
      });
    } finally {
      session.endSession();
    }
    return res.status(201).json({ token: signToken(user._id, household._id), household: household._id });
  } else {
    throw new ApiError(422, "groupName or inviteCode is required");
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(422).json({ message: "email is required and must be a string" });
    }

    if (!password || typeof password !== "string") {
      return res.status(422).json({ message: "password is required and must be a string" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const household = user.household ? await Household.findById(user.household) : null;
    const token = jwt.sign({ userId: user._id, householdId: household._id }, process.env.JWT_SECRET, {
      expiresIn: "180d",
    });


    const isAdmin = user.role === "admin";

    res.json({
      token,
      household: user.household,
      householdName: household.name,
      isAdmin: isAdmin,
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
