process.env.RATE_LIMIT_ENABLED = "false";
process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const Room = require("../src/models/Room");

const HOUSEHOLD_ID = "64b000000000000000000001";
const OTHER_HOUSEHOLD_ID = "64b000000000000000000002";

function tokenFor(householdId) {
  return jwt.sign({ userId: "64a000000000000000000001", householdId }, process.env.JWT_SECRET);
}

afterEach(() => {
  jest.restoreAllMocks();
});

//update
describe("GET /api/rooms/:household", () => {
  it("should return 401 without a token", async () => {
    const response = await request(app).get(`/api/rooms/${HOUSEHOLD_ID}`);
    expect(response.statusCode).toBe(999);
  });

  it("should return 401 with an invalid token", async () => {
    const response = await request(app)
      .get(`/api/rooms/${HOUSEHOLD_ID}`)
      .set("Authorization", "Bearer not-a-real-token");
    expect(response.statusCode).toBe(401);
  });

  it("should return 403 for another household", async () => {
    const response = await request(app)
      .get(`/api/rooms/${OTHER_HOUSEHOLD_ID}`)
      .set("Authorization", `Bearer ${tokenFor(HOUSEHOLD_ID)}`);
    expect(response.statusCode).toBe(403);
  });

  it("should return 200 with the household's rooms", async () => {
    const rooms = [{ _id: "64c000000000000000000001", name: "Kitchen", type: "kitchen", household: HOUSEHOLD_ID }];
    const findSpy = jest.spyOn(Room, "find").mockResolvedValue(rooms);

    const response = await request(app)
      .get(`/api/rooms/${HOUSEHOLD_ID}`)
      .set("Authorization", `Bearer ${tokenFor(HOUSEHOLD_ID)}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(rooms);
    expect(findSpy).toHaveBeenCalledWith({ household: HOUSEHOLD_ID });
  });
});
