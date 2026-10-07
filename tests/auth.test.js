process.env.RATE_LIMIT_ENABLED = "false";
process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const User = require("../src/models/User");
const Household = require("../src/models/Household");


const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
}, 60000);

afterEach(async () => {
  jest.restoreAllMocks();
  const collections = mongoose.connection.collections;
  for (const name in collections) {
    await collections[name].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const HOUSEHOLD_ID = "64a000000000000000000001";
const USER_ID = "64b000000000000000000001";

function tokenFor(userId, householdId, secret) {
  return jwt.sign({ userId, householdId }, secret);
}


//Check signup endpoint
describe("POST /api/auth/signup", () => {
  it("should return 422 if email is missing", async () => {
    const response = await request(app).post("/api/auth/signup").send({ password: "password" });
    expect(response.statusCode).toBe(422);
    expect(response.body.error.message).toBe("email is required and must be a string");
  });

  it("should return 422 if password is missing", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: "user@example.com" });
    expect(response.statusCode).toBe(422);
    expect(response.body.error.message).toBe("password is required and must be a string");
  });

  it("should return 409 if user already exists", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: "user3@example.com", password: "password", firstName: "John", lastName: "Doe", groupName: "My Household" });
    expect(response.statusCode).toBe(201);
    const response2 = await request(app).post("/api/auth/signup").send({ email: "user3@example.com", password: "password", firstName: "Jane", lastName: "Doe", groupName: "My Household2" });
    expect(response2.statusCode).toBe(409);
    expect(response2.body.error.message).toBe("User already exists");
  });

  it("should return 422 if email is invalid", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: { "$ne": null }, password: "password", firstName: "John", lastName: "Doe", groupName: "My Household" });
    expect(response.statusCode).toBe(422);
    expect(response.body.error.message).toBe("email is required and must be a string");
  });

  it("should return 404 if invite code is invalid", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: "user@example4.com", password: "password", firstName: "John", lastName: "Doe", inviteCode: "Not Exists" });
    expect(response.statusCode).toBe(404);
    const user = await User.findOne({ email: "user@example4.com" });
    expect(user).toBeNull();
    expect(response.body.error.message).toBe("Invalid invite code");
  });

  it("should return 201 and a token when signing up with a new household", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: "user@example.com", password: "password", firstName: "John", lastName: "Doe", groupName: "My Household" });
    expect(response.statusCode).toBe(201);
    expect(response.body.inviteCode).toBeDefined();
    expect(response.body.token).toBeDefined();

    const user = await User.findOne({ email: "user@example.com" });
    expect(user.password).not.toBe("password");
    expect(user.household.toString()).toBe(response.body.household);
    expect(user.role).toBe("admin");

    const household = await Household.findOne({ _id: response.body.household });
    expect(household.owner.toString()).toBe(user._id.toString());
    expect(household.members.map(m => m.toString())).toContain(user._id.toString());
  });

  it("should return 201 - joining an existing household with a valid invite code", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: "user1@example.com", password: "password", firstName: "John", lastName: "Doe", groupName: "My Household" });
    expect(response.statusCode).toBe(201);
    expect(response.body.inviteCode).toBeDefined();

    const user1 = await User.findOne({ email: "user1@example.com" });
    const inviteCode = response.body.inviteCode;
    const response2 = await request(app).post("/api/auth/signup").send({ email: "user2@example.com", password: "password", firstName: "Ron", lastName: "Doe", inviteCode: inviteCode });
    expect(response2.statusCode).toBe(201);

    const user2 = await User.findOne({ email: "user2@example.com" });
    expect(user2.role).toBe("user");
    expect(user2.household.toString()).toBe(response.body.household);

    const household = await Household.findOne({ _id: response.body.household });
    expect(household.members.length).toBe(2);
    expect(household.members.map(m => m.toString())).toContain(user2._id.toString());
    expect(household.owner.toString()).toBe(user1._id.toString());
  });

  // The next two tests ensure that if household creation or joining fails, the user is not left behind in the database.
  it("should not leave a user behind if household creation fails", async () => {
    jest.spyOn(Household, "create").mockRejectedValueOnce(new Error("DB failure"));
    const response = await request(app).post("/api/auth/signup").send({ email: "user10@example.com", password: "password", firstName: "John", lastName: "Doe", groupName: "My New Household" });
    const user = await User.findOne({ email: "user10@example.com" });
    expect(response.statusCode).toBe(500);
    expect(user).toBeNull();
  });

  it("should not leave a user behind if joining a household fails", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: "user10@example.com", password: "password", firstName: "John", lastName: "Doe", groupName: "My New Household" });
    expect(response.statusCode).toBe(201);
    jest.spyOn(Household.prototype, "save").mockRejectedValueOnce(new Error("DB failure"));
    const response2 = await request(app).post("/api/auth/signup").send({ email: "user11@example.com", password: "password", firstName: "John", lastName: "Doe", inviteCode: response.body.inviteCode });
    expect(response2.statusCode).toBe(500);
    const user = await User.findOne({ email: "user11@example.com" });
    expect(user).toBeNull();
  });
});

//Check login endpoint
describe("POST /api/auth/login", () => {
  it("should return 200 - login successful", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: "user5@example.com", password: "password", firstName: "John", lastName: "Doe", groupName: "My Household" });
    expect(response.statusCode).toBe(201);
    expect(response.body.inviteCode).toBeDefined();
    expect(response.body.token).toBeDefined();

    const response2 = await request(app).post("/api/auth/login").send({ email: "user5@example.com", password: "password" });
    expect(response2.statusCode).toBe(200);
    expect(response2.body.token).toBeDefined();
  });


  it("should return 401 with a wrong password", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: "user6@example.com", password: "password", firstName: "John", lastName: "Doe", groupName: "My Household" });
    expect(response.statusCode).toBe(201);
    expect(response.body.inviteCode).toBeDefined();
    expect(response.body.token).toBeDefined();

    const response2 = await request(app).post("/api/auth/login").send({ email: "user6@example.com", password: "password1" });
    expect(response2.statusCode).toBe(401);
    expect(response2.body.message).toBe("Invalid email or password");
  });

  it("should return 401 with an invalid email", async () => {
    const response2 = await request(app).post("/api/auth/login").send({ email: "user7@example.com", password: "password1" });
    expect(response2.statusCode).toBe(401);
    expect(response2.body.message).toBe("Invalid email or password");
  });

  it("should return 422 with a missing password", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: "user8@example.com", password: "password", firstName: "John", lastName: "Doe", groupName: "My Household" });
    expect(response.statusCode).toBe(201);

    const response2 = await request(app).post("/api/auth/login").send({ email: "user8@example.com" });
    expect(response2.statusCode).toBe(422);
    expect(response2.body.message).toBe("password is required and must be a string");
  });

  it("should return 422 with a missing email", async () => {
    const response = await request(app).post("/api/auth/signup").send({ email: "user9@example.com", password: "password", firstName: "John", lastName: "Doe", groupName: "My Household" });
    expect(response.statusCode).toBe(201);

    const response2 = await request(app).post("/api/auth/login").send({ password: "password" });
    expect(response2.statusCode).toBe(422);
    expect(response2.body.message).toBe("email is required and must be a string");
  });

});




//Check verify endpoint
describe("GET /api/auth/verify", () => {
  it("should return valid false without Authorization header", async () => {
    const response = await request(app).get(`/api/auth/verify`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ valid: false });
  });

  it("should return valid false with a malformed token", async () => {
    const response = await request(app).get(`/api/auth/verify`).set("Authorization", "Bearer not-a-real-token");
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ valid: false });
  });

  it("should return valid false without the Bearer prefix", async () => {
    const response = await request(app).get(`/api/auth/verify`).set("Authorization", "Basic " + tokenFor(USER_ID, HOUSEHOLD_ID, process.env.JWT_SECRET));
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ valid: false });
  });

  it("should return valid false with a token signed by another secret", async () => {
    const response = await request(app).get(`/api/auth/verify`).set("Authorization", "Bearer " + tokenFor(USER_ID, HOUSEHOLD_ID, "not-the-right-secret"));
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ valid: false });
  });

  it("should return valid false with an expired token", async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 60;
    const expiredToken = jwt.sign({ userId: USER_ID, householdId: HOUSEHOLD_ID, exp: expiredAt }, process.env.JWT_SECRET);
    const response = await request(app).get(`/api/auth/verify`).set("Authorization", "Bearer " + expiredToken);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ valid: false });
  });

  it("should return 200 with valid true object with the userId", async () => {
    const response = await request(app).get(`/api/auth/verify`).set("Authorization", "Bearer " + tokenFor(USER_ID, HOUSEHOLD_ID, process.env.JWT_SECRET));
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ valid: true, userId: USER_ID });
  });
});
