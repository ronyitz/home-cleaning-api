const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");


async function createHousehold(req, res) {
  const { name } = req.body;

  if (!name || typeof name !== "string") {
    throw new ApiError(422, "name is required and must be a string");
  }

  const household = await Household.create({ name });
  res.status(201).json(household);
} 

async function getHousholdByInviteCode(req, res) {
  const { inviteCode } = req.params;

  if (!inviteCode || typeof inviteCode !== "string") {
    throw new ApiError(422, "inviteCode is required and must be a string");
  }

  const household = await Household.findOne({ inviteCode });
  if (!household) {
    throw new ApiError(404, "Household not found");
  }

  res.json(household);
}

module.exports = { createHousehold, getHousholdByInviteCode };
