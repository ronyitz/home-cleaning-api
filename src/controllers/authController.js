const authService = require("../services/authService");

// POST /api/auth/signup
async function signup(req, res) {
  const result = await authService.signup(req.body);
  res.status(201).json(result);
}

// POST /api/auth/login
async function login(req, res) {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}

// GET /api/auth/verify
async function verify(req, res) {
  const result = await authService.verify(req.headers.authorization);
  res.status(200).json(result);
}

module.exports = { signup, login, verify };
