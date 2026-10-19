process.env.RATE_LIMIT_ENABLED = "false";
process.env.JWT_SECRET = "test-secret";

// Replace the notification queue, so loading the app doesn't connect to Redis.
jest.mock("../src/queues/notificationQueue", () => ({
  notificationQueue: { add: jest.fn() },
}));

const request = require("supertest");
const app = require("../src/app");
const TaskCompletion = require("../src/models/TaskCompletion");

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

// Marks the task as done, which saves one TaskCompletion to the history.
async function completeTask(token, taskId) {
  return request(app).patch(`/api/tasks/${taskId}/complete`).set("Authorization", `Bearer ${token}`);
}

// Sends GET /api/history/:household with an optional query string, e.g. "?days=7".
async function getHistory(token, household, query = "") {
  return request(app).get(`/api/history/${household}${query}`).set("Authorization", `Bearer ${token}`);
}

describe("GET /api/history/:household", () => {
  it("should return 403 for another household", async () => {
    const admin = await signupAdmin("ron@user.com", "Ron's house");
    const admin2 = await signupAdmin("hadas@user.com", "Hadas's house");
    const res = await getHistory(admin2.token, admin.household);
    expect(res.statusCode).toBe(403);
  });

  it("should return 422 when taskId is not a valid id", async () => {
    const admin = await signupAdmin("ron@user.com", "Ron's house");
    const res = await getHistory(admin.token, admin.household, "?taskId=abc");
    expect(res.statusCode).toBe(422);
    expect(res.body.error.message).toBe("taskId must be a valid id");
  });

  it("should return 422 when days is not a whole number >= 1", async () => {
    const admin = await signupAdmin("ron@user.com", "Ron's house");
    // 1.5 is not a whole number; 0 is a whole number but below 1.
    const res = await getHistory(admin.token, admin.household, "?days=1.5");
    expect(res.statusCode).toBe(422);
    expect(res.body.error.message).toBe("days must be a whole number >= 1");
    const res2 = await getHistory(admin.token, admin.household, "?days=0");
    expect(res2.statusCode).toBe(422);
  });

  it("should return 200 with the household's completions, newest first, with the completing user's name", async () => {
    const admin = await signupAdmin("ron@user.com", "Ron's house");
    const room = await createRoom(admin.token);
    const dishes = await createTask(admin.token, room._id, "Dishes");
    const floor = await createTask(admin.token, room._id, "Floor");
    await completeTask(admin.token, dishes._id);
    await completeTask(admin.token, floor._id);

    const res = await getHistory(admin.token, admin.household);
    expect(res.statusCode).toBe(200);
    // Floor was completed last, so it comes first.
    expect(res.body.map((c) => c.taskName)).toEqual(["Floor", "Dishes"]);
    expect(res.body[0].roomName).toBe("Kitchen");
    expect(res.body[0].completedBy.firstName).toBe("Test");
    expect(res.body[0].completedBy.lastName).toBe("Admin");
    // populate must pick only the name fields, never the password hash.
    expect(res.body[0].completedBy.password).toBeUndefined();
  });

  it("should not return completions of another household", async () => {
    const admin = await signupAdmin("ron@user.com", "Ron's house");
    const admin2 = await signupAdmin("hadas@user.com", "Hadas's house");
    const room = await createRoom(admin.token);
    const room2 = await createRoom(admin2.token);
    const task = await createTask(admin.token, room._id, "Dishes");
    const task2 = await createTask(admin2.token, room2._id, "Laundry");
    await completeTask(admin.token, task._id);
    await completeTask(admin2.token, task2._id);

    const res = await getHistory(admin.token, admin.household);
    expect(res.statusCode).toBe(200);
    expect(res.body.map((c) => c.taskName)).toEqual(["Dishes"]);
  });

  it("should return only the completions of the given taskId", async () => {
    const admin = await signupAdmin("ron@user.com", "Ron's house");
    const room = await createRoom(admin.token);
    const dishes = await createTask(admin.token, room._id, "Dishes");
    const floor = await createTask(admin.token, room._id, "Floor");
    await completeTask(admin.token, dishes._id);
    await completeTask(admin.token, floor._id);

    const res = await getHistory(admin.token, admin.household, `?taskId=${dishes._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].task).toBe(dishes._id);
  });

  it("should return only completions from the last given number of days", async () => {
    const DAY_IN_MS = 24 * 60 * 60 * 1000;
    const admin = await signupAdmin("ron@user.com", "Ron's house");
    const room = await createRoom(admin.token);
    const task = await createTask(admin.token, room._id, "Dishes");
    // One completion now, and one saved directly with a date 10 days ago.
    await completeTask(admin.token, task._id);
    await TaskCompletion.create({
      task: task._id,
      household: admin.household,
      taskName: "Dishes",
      roomName: "Kitchen",
      completedAt: new Date(Date.now() - 10 * DAY_IN_MS),
    });

    // Without days both are returned, so the filter below is what removes the old one.
    const all = await getHistory(admin.token, admin.household);
    expect(all.body).toHaveLength(2);

    const res = await getHistory(admin.token, admin.household, "?days=7");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(new Date(res.body[0].completedAt).getTime()).toBeGreaterThan(Date.now() - 7 * DAY_IN_MS);
  });
});
