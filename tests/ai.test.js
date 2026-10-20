process.env.RATE_LIMIT_ENABLED = "false";
process.env.JWT_SECRET = "test-secret";

// Replace the notification queue, so loading the app doesn't connect to Redis.
jest.mock("../src/queues/notificationQueue", () => ({
  notificationQueue: { add: jest.fn() },
}));

// Replace the Anthropic SDK, so tests never call the real (paid) model.
// aiService does `new Anthropic().messages.parse(...)` - every client shares this one parse mock.
const mockParse = jest.fn();

function mockCreateFakeClient() {
  return { messages: { parse: mockParse } };
}

const mockFakeAnthropic = jest.fn(mockCreateFakeClient);

jest.mock("@anthropic-ai/sdk", () => mockFakeAnthropic);

const request = require("supertest");
const app = require("../src/app");

const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
}, 60000);

afterEach(async () => {
  jest.restoreAllMocks();
  mockParse.mockReset();
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

// Sends POST /api/ai/command with the given text.
async function aiCommand(token, text) {
  return request(app).post("/api/ai/command").send({ text }).set("Authorization", `Bearer ${token}`);
}

// Makes the next (mocked) model call answer with these task ids.
function mockModelAnswer(taskIds) {
  mockParse.mockResolvedValueOnce({ parsed_output: { taskIds } });
}

describe("POST /api/ai/command", () => {
  it("should return 401 without a token", async () => {
    const response = await request(app).post("/api/ai/command").send({ text: "סיימתי את המטבח" });
    expect(response.statusCode).toBe(401);
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("should return 422 when text is missing, empty or too long", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const response = await request(app).post("/api/ai/command").send({}).set("Authorization", `Bearer ${admin.token}`);
    expect(response.statusCode).toBe(422);
    const response2 = await request(app).post("/api/ai/command").send({ text: "" }).set("Authorization", `Bearer ${admin.token}`);
    expect(response2.statusCode).toBe(422);
    const response3 = await request(app).post("/api/ai/command").send({ text: "a".repeat(550) }).set("Authorization", `Bearer ${admin.token}`);
    expect(response3.statusCode).toBe(422);
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("should return 200 with the matching task, including its room name", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    const task = await createTask(admin.token, room._id);
    mockModelAnswer([task._id]);
    const response = await aiCommand(admin.token, "I washed the dishes");
    expect(response.statusCode).toBe(200);
    expect(response.body.matches).toHaveLength(1);
    expect(response.body.matches[0]._id).toBe(task._id);
    expect(response.body.matches[0].room.name).toBe("Kitchen");
    expect(mockParse).toHaveBeenCalledTimes(1);
  });

  // The model's ids are untrusted: an id of another household's task (or a made-up id) is dropped.
  it("should not return tasks of another household even if the model returns their ids", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "OtherHousehold");

    const room = await createRoom(admin.token);
    const room2 = await createRoom(admin2.token);

    const task = await createTask(admin.token, room._id);
    const task2 = await createTask(admin2.token, room2._id);

    mockModelAnswer([task2._id]);

    const response = await aiCommand(admin.token, "I washed the dishes");
    expect(response.statusCode).toBe(200);
    expect(response.body.matches).toHaveLength(0);

  });

  // parsed_output is null when the answer was cut off or refused.
  it("should return an empty list when the model gives no parsed answer", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const room = await createRoom(admin.token);
    await createTask(admin.token, room._id);
    // What the SDK returns when the answer was cut off (max_tokens) or refused.
    mockParse.mockResolvedValueOnce({ parsed_output: null });

    const response = await aiCommand(admin.token, "I washed the dishes");
    expect(response.statusCode).toBe(200);
    expect(response.body.matches).toEqual([]);
    expect(mockParse).toHaveBeenCalledTimes(1);
  });

  // The other tests answer with a fixed mock, so they would pass even if nothing useful reached the model.
  // Privacy: another household's tasks must never be sent to the model.
  it("should send the model only this household's tasks, together with the user's text", async () => {
    const admin = await signupAdmin("admin@example.com", "MyHousehold");
    const admin2 = await signupAdmin("admin2@example.com", "OtherHousehold");

    const room = await createRoom(admin.token);                     
    const task = await createTask(admin.token, room._id);            
    const task2 = await createTask(admin.token, room._id, "Oven");

    const room2 = await createRoom(admin2.token, "Garage");
    await createTask(admin2.token, room2._id, "Laundry");

    // The answer doesn't matter in this test - only what was sent.
    mockModelAnswer([]);

    await aiCommand(admin.token, "I washed the dishes");

    const sentText = mockParse.mock.calls[0][0].messages[0].content;
    expect(sentText).toContain("I washed the dishes");
    expect(sentText).toContain(task._id);
    expect(sentText).toContain("Dishes");
    expect(sentText).toContain("Kitchen");
    expect(sentText).toContain(task2._id);
    expect(sentText).toContain("Oven");
    expect(sentText).not.toContain("Garage");
    expect(sentText).not.toContain("Laundry");
  });
});
