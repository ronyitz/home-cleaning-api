process.env.RATE_LIMIT_ENABLED = "false";
process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const Room = require("../src/models/Room");
const Task = require("../src/models/Task");

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

const HOUSEHOLD_ID = "64b000000000000000000001";
const OTHER_HOUSEHOLD_ID = "64b000000000000000000002";

function tokenFor(householdId) {
  return jwt.sign({ userId: "64a000000000000000000001", householdId }, process.env.JWT_SECRET);
}

// Signs up a new user who opens a new household, so they are its admin.
// Returns { token, household, inviteCode } from the signup response.
async function signupAdmin(email, groupName) {
  const response = await request(app)
    .post("/api/auth/signup")
    .send({ email, password: "password", firstName: "Test", lastName: "Admin", groupName });
  return response.body;
}

// Signs up a new user who joins an existing household, so they are a regular member.
// Returns { token, household } from the signup response.
async function signupMember(email, inviteCode) {
  const response = await request(app)
    .post("/api/auth/signup")
    .send({ email, password: "password", firstName: "Test", lastName: "Member", inviteCode });
  return response.body;
}

describe("GET /api/rooms/:household", () => {
  it("should return 401 without a token", async () => {
    const response = await request(app).get(`/api/rooms/${HOUSEHOLD_ID}`);
    expect(response.statusCode).toBe(401);
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

  it("should return 200 with only the household's rooms", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    await request(app).post("/api/rooms").send({ name: "Office", type: "office" }).set("Authorization", `Bearer ${admin2.token}`);

    const response = await request(app)
      .get(`/api/rooms/${admin.household}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].name).toBe("Kitchen");
    expect(response.body[0].household).toBe(admin.household);
  });

  it("should return the rooms sorted by order", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const bedroom = await request(app).post("/api/rooms").send({ name: "Bedroom", type: "bedroom" }).set("Authorization", `Bearer ${admin.token}`);
    const kitchen = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    const office = await request(app).post("/api/rooms").send({ name: "Office", type: "office" }).set("Authorization", `Bearer ${admin.token}`);
    // Created in alphabetical order, so the expected order below differs from both
    // the creation order and the name order (which the household+name index returns).
    await Room.updateOne({ _id: office.body._id }, { order: 1 });
    await Room.updateOne({ _id: bedroom.body._id }, { order: 2 });
    await Room.updateOne({ _id: kitchen.body._id }, { order: 3 });

    const response = await request(app).get(`/api/rooms/${admin.household}`).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.map((room) => room.name)).toEqual(["Office", "Bedroom", "Kitchen"]);
  });
});

describe("POST /api/rooms", () => {
  it("should return 201 and create the room and its tasks when an admin creates a room", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).post("/api/rooms").send({
      name: "Kitchen", type: "kitchen", tasks: [
        {
          "name": "ניקוי משטחים",
          "frequency": 1
        },
        {
          "name": "ריקון פח",
          "frequency": 2
        },
        {
          "name": "ניקוי תנור",
          "frequency": 30
        }
      ]
    }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(201);
    expect(response.body.name).toBe("Kitchen");
    const tasks = await Task.find({ room: response.body._id });
    expect(tasks.length).toBe(3);
  });

  it("should give each new room the next order number in its household", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const first = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(first.statusCode).toBe(201);
    const second = await request(app).post("/api/rooms").send({ name: "Bedroom", type: "bedroom" }).set("Authorization", `Bearer ${admin.token}`);
    expect(second.statusCode).toBe(201);
    const third = await request(app).post("/api/rooms").send({ name: "Office", type: "office" }).set("Authorization", `Bearer ${admin.token}`);
    expect(third.statusCode).toBe(201);
    // The first room of a different household, created after the three above.
    const other = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin2.token}`);
    expect(other.statusCode).toBe(201);

    expect(first.body.order).toBe(1);
    expect(second.body.order).toBe(2);
    expect(third.body.order).toBe(3);
    expect(other.body.order).toBe(1);
  });

  it("should return 403 when a regular member tries to create a room", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const user = await signupMember("user@example.com", admin.inviteCode);
    const response = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${user.token}`);
    expect(response.statusCode).toBe(403);
  });

  it("should return 422 when the name is missing or the type is invalid", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).post("/api/rooms").send({ type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(422);
    expect(response.body.error.message).toBe("name is required and must be a string");
    const response2 = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kssitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(422);
    expect(response2.body.error.message).toContain("type must be one of:");
  });

  it("should allow two different households to create rooms with the same name", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const response = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(201);
    const response2 = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin2.token}`);
    expect(response2.statusCode).toBe(201);
  });

  it("should return 409 when the same household creates two rooms with the same name", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(201);
    const response2 = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(409);
  });

  it("should not leave a room behind if creating its tasks fails", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    jest.spyOn(Task, "insertMany").mockRejectedValueOnce(new Error("DB failure"));
    const response = await request(app).post("/api/rooms").send({
      name: "Kitchen", type: "kitchen", tasks: [
        {
          "name": "ניקוי משטחים",
          "frequency": 1
        },
        {
          "name": "ריקון פח",
          "frequency": 2
        },
        {
          "name": "ניקוי תנור",
          "frequency": 30
        }
      ]
    }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(500);
    const count = await Room.countDocuments({ household: admin.household });
    expect(count).toBe(0);
  });
});



describe("DELETE /api/rooms/:id", () => {
  it("should return 422 when the id is not a valid id", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(201);
    const response2 = await request(app).delete("/api/rooms/not-a-valid-id").set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(422);
  });

  it("should return 404 when the room does not exist", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).delete("/api/rooms/507f1f71c3a3a20000000000").set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(404);
  });

  it("should return 403 when a regular member tries to delete a room", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const member = await signupMember("member@example.com", admin.inviteCode);
    const room = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    const response2 = await request(app).delete(`/api/rooms/${room.body._id}`).set("Authorization", `Bearer ${member.token}`);
    expect(response2.statusCode).toBe(403);
  });

  it("should return 403 when an admin of another household tries to delete the room", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const room = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    const response2 = await request(app).delete(`/api/rooms/${room.body._id}`).set("Authorization", `Bearer ${admin2.token}`);
    expect(response2.statusCode).toBe(403);
  });

  it("should return 200 and delete the room and its tasks when an admin deletes a room", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).post("/api/rooms").send({
      name: "Kitchen", type: "kitchen", tasks: [
        {
          "name": "ניקוי משטחים",
          "frequency": 1
        },
        {
          "name": "ריקון פח",
          "frequency": 2
        },
        {
          "name": "ניקוי תנור",
          "frequency": 30
        }
      ]
    }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(201);
    const room = await Room.findById(response.body._id);
    expect(room).not.toBeNull();
    expect(await Task.countDocuments({ room: response.body._id })).toBe(3);
    const response2 = await request(app).delete(`/api/rooms/${response.body._id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(200);
    expect(await Room.findById(response.body._id)).toBeNull();
    expect(await Task.countDocuments({ room: response.body._id })).toBe(0);
  });

  it("should not delete the room if deleting its tasks fails", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).post("/api/rooms").send({
      name: "Kitchen", type: "kitchen", tasks: [
        {
          "name": "ניקוי משטחים",
          "frequency": 1
        },
        {
          "name": "ריקון פח",
          "frequency": 2
        },
        {
          "name": "ניקוי תנור",
          "frequency": 30
        }
      ]
    }).set("Authorization", `Bearer ${admin.token}`);
    expect(await Task.countDocuments({ room: response.body._id })).toBe(3);
    const deleteManySpy = jest.spyOn(Task, "deleteMany").mockRejectedValue(new Error("DB failure"));
    const response2 = await request(app).delete(`/api/rooms/${response.body._id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(500);
    expect(await Room.findById(response.body._id)).not.toBeNull();
    expect(await Task.countDocuments({ room: response.body._id })).toBe(3);
    expect(deleteManySpy).toHaveBeenCalled();
  });
});



describe("PUT /api/rooms/:id", () => {
  it("should return 422 when the name is missing or the type is invalid", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(201);
    const response2 = await request(app).put("/api/rooms/" + response.body._id).send({ name: null, type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(422);
    expect(response2.body.error.message).toBe("name is required and must be a string");
    const response3 = await request(app).put("/api/rooms/" + response.body._id).send({ name: "Living Room", type: "not-exists" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response3.statusCode).toBe(422);
    expect(response3.body.error.message).toContain("type must be one of:");
  });

  it("should return 403 when an admin of another household tries to update the room", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const response = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(201);
    const response3 = await request(app).put("/api/rooms/" + response.body._id).send({ name: "Living Room", type: "kitchen" }).set("Authorization", `Bearer ${admin2.token}`);
    expect(response3.statusCode).toBe(403);
    const room = await Room.findById(response.body._id);
    expect(room.name).toBe("Kitchen");
  });

  it("should return 200 and update the room's name and type", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(201);
    const response2 = await request(app).put("/api/rooms/" + response.body._id).send({ name: "Living Room", type: "living_room" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(200);
    const room = await Room.findById(response.body._id);
    expect(room.name).toBe("Living Room");
    expect(room.type).toBe("living_room");
  });

  it("should return 409 when renaming a room to a name that already exists in the household", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).post("/api/rooms").send({ name: "Kitchen", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(201);
    const response2 = await request(app).post("/api/rooms").send({ name: "Living Room", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(201);
    const response3 = await request(app).put("/api/rooms/" + response.body._id).send({ name: "Living Room", type: "kitchen" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response3.statusCode).toBe(409);
  });
});



describe("PUT /api/rooms/order", () => {

  it.todo("should return 422 when roomIds is missing, empty or contains an invalid id");

  it.todo("should return 403 when a regular member tries to reorder the rooms");

  it.todo("should return 422 when roomIds does not contain all the rooms of the household");

  it.todo("should reject a list that contains a room of another household");

  it.todo("should return 200 and save the new order");

  it.todo("should not change any room if saving the new order fails");
});


