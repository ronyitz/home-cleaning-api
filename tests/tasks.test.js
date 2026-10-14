process.env.RATE_LIMIT_ENABLED = "false";
process.env.JWT_SECRET = "test-secret";

// Replace the notification queue, so loading the app doesn't connect to Redis.
jest.mock("../src/queues/notificationQueue", () => ({
  notificationQueue: { add: jest.fn() },
}));

const request = require("supertest");
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

// Signs up a new user who opens a new household, so they are its admin.
// Returns { token, household, inviteCode } from the signup response.
async function signupAdmin(email, groupName) {
  const response = await request(app)
    .post("/api/auth/signup")
    .send({ email, password: "password", firstName: "Test", lastName: "Admin", groupName });
  return response.body;
}

// Creates a room with no tasks in the household of the given admin token.
// Returns the created room from the response.
async function createRoom(token, name = "Kitchen") {
  const response = await request(app)
    .post("/api/rooms")
    .send({ name, type: "kitchen" })
    .set("Authorization", `Bearer ${token}`);
  return response.body;
}

// Creates a task in the given room, due every 7 days and completed just now.
// Returns the created task from the response.
async function createTask(token, roomId, name = "Dishes") {
  const response = await request(app)
    .post("/api/tasks")
    .send({ name, room: roomId, frequency: 7, status: "good", lastCompletedAt: new Date() })
    .set("Authorization", `Bearer ${token}`);
  return response.body;
}

describe("GET /api/tasks/:household", () => {
  it("should return 403 for another household", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const response = await request(app).get(`/api/tasks/${admin.household}`).set("Authorization", `Bearer ${admin2.token}`);
    expect(response.statusCode).toBe(403);
  });

  it("should return 200 with only the household's tasks", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const room = await createRoom(admin.token);
    const room2 = await createRoom(admin2.token);
    await createTask(admin.token, room._id, "Dishes");
    await createTask(admin2.token, room2._id, "Laundry");
    const response = await request(app).get(`/api/tasks/${admin.household}`).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].name).toBe("Dishes");
    expect(await Task.countDocuments()).toBe(2);
  });

  it("should return only tasks due within maxNextDays", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    const lastCompletedAt = new Date();
    // Dishes is due in 2 days, Windows in 30 days.
    await request(app).post("/api/tasks").send({ name: "Dishes", room: room._id, frequency: 2, status: "good", lastCompletedAt }).set("Authorization", `Bearer ${admin.token}`);
    await request(app).post("/api/tasks").send({ name: "Windows", room: room._id, frequency: 30, status: "good", lastCompletedAt }).set("Authorization", `Bearer ${admin.token}`);
    const response = await request(app).get(`/api/tasks/${admin.household}?maxNextDays=7`).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].name).toBe("Dishes");
    expect(await Task.countDocuments()).toBe(2);
    const response2 = await request(app).get(`/api/tasks/${admin.household}?maxNextDays=40`).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(200);
    expect(response2.body.length).toBe(2);
  });
});

describe("GET /api/tasks/room/:roomId", () => {
  it("should return 403 for a room of another household", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const room = await createRoom(admin.token);
    await createTask(admin.token, room._id);
    const response2 = await request(app).get(`/api/tasks/room/${room._id}`).set("Authorization", `Bearer ${admin2.token}`);
    expect(response2.statusCode).toBe(403);
    expect(response2.body.error.message).toBe("Unauthorized");
    expect(await Task.countDocuments()).toBe(1);
  });

  it("should return 200 with the room's tasks sorted by next due date", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    const lastCompletedAt = new Date("2026-01-01T00:00:00.000Z");
    // Created in the opposite order of their due dates: Floor is due in 10 days, Dishes in 2.
    await request(app).post("/api/tasks").send({ name: "Floor", room: room._id, frequency: 10, status: "good", lastCompletedAt }).set("Authorization", `Bearer ${admin.token}`);
    await request(app).post("/api/tasks").send({ name: "Dishes", room: room._id, frequency: 2, status: "good", lastCompletedAt }).set("Authorization", `Bearer ${admin.token}`);
    expect(await Task.countDocuments()).toBe(2);
    const response2 = await request(app).get(`/api/tasks/room/${room._id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(200);
    expect(response2.body.length).toBe(2);
    expect(new Date(response2.body[0].nextDueAt).getTime()).toBeLessThan(new Date(response2.body[1].nextDueAt).getTime());
  });
});

describe("POST /api/tasks", () => {
  it("should return 422 when the name is missing or the frequency is invalid", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    const response = await request(app).post("/api/tasks").send({ name: null, room: room._id, frequency: 7, status: "good", lastCompletedAt: new Date() }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(422);
    expect(response.body.error.message).toBe("name is required and must be a non-empty string");
    const response2 = await request(app).post("/api/tasks").send({ name: "ניקיון רצפה", room: room._id, frequency: "hi", status: "good", lastCompletedAt: new Date() }).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(422);
    expect(response2.body.error.message).toBe("frequency is required and must be a number >= 1");
    expect(await Task.countDocuments()).toBe(0);
  });

  it("should return 403 when creating a task in a room of another household", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const room = await createRoom(admin.token);
    const response = await request(app).post("/api/tasks").send({ name: "ניקיון רצפה", room: room._id, frequency: 7, status: "good", lastCompletedAt: new Date() }).set("Authorization", `Bearer ${admin2.token}`);
    expect(response.statusCode).toBe(403);
    expect(response.body.error.message).toBe("Unauthorized");
    expect(await Task.countDocuments()).toBe(0);
  });

  it("should return 201 and create the task with its next due date", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    const lastCompletedAt = new Date("2026-01-01T00:00:00.000Z");
    const response = await request(app).post("/api/tasks").send({ name: "ניקיון רצפה", room: room._id, frequency: 7, status: "good", lastCompletedAt: lastCompletedAt }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(201);
    expect(response.body.nextDueAt).toBe("2026-01-08T00:00:00.000Z");
    expect(await Task.countDocuments()).toBe(1);
  });

  it("should return 409 when the room already has a task with the same name", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    await createTask(admin.token, room._id);
    const response2 = await request(app).post("/api/tasks").send({ name: "Dishes", room: room._id, frequency: 7, status: "good", lastCompletedAt: new Date() }).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(409);
    expect(response2.body.error.message).toBe("duplicated, already exists");
    expect(await Task.countDocuments()).toBe(1);
  });
});

describe("PUT /api/tasks/:taskId", () => {
  it("should return 422 when the name is missing or the frequency is invalid", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    const task = await createTask(admin.token, room._id);

    const response = await request(app).put(`/api/tasks/${task._id}`).send({ name: null, frequency: 7 }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(422);
    expect(response.body.error.message).toBe("name is required and must be a non-empty string");

    const response2 = await request(app).put(`/api/tasks/${task._id}`).send({ name: "Floor", frequency: 0 }).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(422);
    expect(response2.body.error.message).toBe("frequency is required and must be a number >= 1");

    const unchanged = await Task.findById(task._id);
    expect(unchanged.name).toBe("Dishes");
    expect(unchanged.frequency).toBe(7);
  });

  it("should return 403 for a task of another household", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const room = await createRoom(admin.token);
    const task = await createTask(admin.token, room._id);

    const response = await request(app).put(`/api/tasks/${task._id}`).send({ name: "Floor", frequency: 3 }).set("Authorization", `Bearer ${admin2.token}`);
    expect(response.statusCode).toBe(403);

    const unchanged = await Task.findById(task._id);
    expect(unchanged.name).toBe("Dishes");
  });

  it("should return 200 and update the task and its next due date", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    const created = await request(app).post("/api/tasks").send({ name: "Dishes", room: room._id, frequency: 7, status: "good", lastCompletedAt: new Date("2026-01-01T00:00:00.000Z") }).set("Authorization", `Bearer ${admin.token}`);

    // Only name and frequency are sent, so lastCompletedAt must be kept and nextDueAt recalculated from it.
    const response = await request(app).put(`/api/tasks/${created.body._id}`).send({ name: "Floor", frequency: 10 }).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.name).toBe("Floor");
    expect(response.body.frequency).toBe(10);
    expect(response.body.lastCompletedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(response.body.nextDueAt).toBe("2026-01-11T00:00:00.000Z");

    const updated = await Task.findById(created.body._id);
    expect(updated.name).toBe("Floor");
  });
});

describe("PATCH /api/tasks/:taskId/complete", () => {
  it("should return 404 when the task does not exist", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const missingId = new mongoose.Types.ObjectId();
    const response = await request(app).patch(`/api/tasks/${missingId}/complete`).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(404);
  });

  it("should return 403 for a task of another household", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const room = await createRoom(admin.token);
    const task = await createTask(admin.token, room._id);
    const response = await request(app).patch(`/api/tasks/${task._id}/complete`).set("Authorization", `Bearer ${admin2.token}`);
    expect(response.statusCode).toBe(403);

  });

  it("should return 200 and update lastCompletedAt and nextDueAt", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    // Last completed long ago, so the change made by completing the task is visible.
    const task = await request(app).post("/api/tasks").send({ name: "Dishes", room: room._id, frequency: 7, status: "good", lastCompletedAt: new Date("2026-01-01T00:00:00.000Z") }).set("Authorization", `Bearer ${admin.token}`);
    expect(task.body.nextDueAt).toBe("2026-01-08T00:00:00.000Z");

    const before = Date.now();
    const response = await request(app).patch(`/api/tasks/${task.body._id}/complete`).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(200);

    const DAY_IN_MS = 24 * 60 * 60 * 1000;
    const completedAt = new Date(response.body.lastCompletedAt).getTime();
    const nextDueAt = new Date(response.body.nextDueAt).getTime();
    expect(completedAt).toBeGreaterThanOrEqual(before);
    expect(nextDueAt - completedAt).toBeGreaterThanOrEqual(7 * DAY_IN_MS);
    expect(nextDueAt - completedAt).toBeLessThan(7 * DAY_IN_MS + 1000);
  });
});

describe("DELETE /api/tasks/:taskId", () => {
  it("should return 403 for a task of another household", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "MyHousehold2");
    const room = await createRoom(admin.token);
    const task = await createTask(admin.token, room._id);
    const res = await request(app).delete(`/api/tasks/${task._id}`).set("Authorization", `Bearer ${admin2.token}`);
    expect(res.statusCode).toBe(403);
    expect(await Task.findById(task._id)).not.toBeNull();
  });

  it("should return 200 and delete the task", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    const task = await createTask(admin.token, room._id);
    const res = await request(app).delete(`/api/tasks/${task._id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.statusCode).toBe(200);
    const taskExists = await Task.findById(task._id);
    expect(taskExists).toBeNull();
    const roomExists = await Room.findById(room._id);
    expect(roomExists).not.toBeNull();
  });
});
