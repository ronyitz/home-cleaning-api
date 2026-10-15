// Unit tests for subscriptionService.notifySubscription.
// Calls the function directly (no app, no HTTP) and replaces webpush.sendNotification,
// so nothing is sent to a real push service.
const webpush = require("web-push");
const { UnrecoverableError } = require("bullmq");
const { notifySubscription } = require("../src/services/subscriptionService");
const Subscription = require("../src/models/Subscription");

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
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

// Saves a subscription for a random user and household.
// Returns the saved document.
async function createSubscription() {
  return Subscription.create({
    user: new mongoose.Types.ObjectId(),
    household: new mongoose.Types.ObjectId(),
    endpoint: "https://fcm.googleapis.com/fcm/send/test-device",
    keys: { p256dh: "test-p256dh", auth: "test-auth" },
  });
}

// Builds an error shaped like the ones webpush.sendNotification rejects with.
function pushError(statusCode) {
  return Object.assign(new Error(`Push failed with ${statusCode}`), { statusCode });
}

describe("notifySubscription", () => {
  it("sends the title and body to the subscription's endpoint", async () => {
    const subcription = await createSubscription();
    const send = jest.spyOn(webpush, "sendNotification").mockResolvedValue({ statusCode: 201 });
    await notifySubscription(subcription._id, { title: "aaa", body: "bbb" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].endpoint).toBe(subcription.endpoint);
    const payload = JSON.parse(send.mock.calls[0][1]);
    expect(payload.title).toBe("aaa");
    expect(payload.body).toBe("bbb");
  });

  it("does not send when the subscription no longer exists", async () => {
    const missingId = new mongoose.Types.ObjectId();
    const send = jest.spyOn(webpush, "sendNotification").mockResolvedValue({ statusCode: 201 });
    await notifySubscription(missingId, { title: "title", body: "body" });
    expect(send).not.toHaveBeenCalled();
  });

  it("deletes the subscription when the push service answers 410", async () => {
    const subcription = await createSubscription();
    const subcriptionAfterSending1 = await Subscription.findById(subcription._id);
    expect(subcriptionAfterSending1).not.toBe(null);
    jest.spyOn(webpush, "sendNotification").mockRejectedValueOnce(pushError(410));
    await notifySubscription(subcription._id, { title: "title", body: "body" });
    const subcriptionAfterSending2 = await Subscription.findById(subcription._id);
    expect(subcriptionAfterSending2).toBe(null);
  });


  it("throws and keeps the subscription when the push service answers 503", async () => {
    const subcription = await createSubscription();
    jest.spyOn(webpush, "sendNotification").mockRejectedValueOnce(pushError(503));
    await expect(notifySubscription(subcription._id, { title: "title", body: "body" })).rejects.toMatchObject({ statusCode: 503 });
    const subcriptionAfterSending = await Subscription.findById(subcription._id);
    expect(subcriptionAfterSending).not.toBe(null);
  });

  it("throws when the request fails without a status code (network error)", async () => {
    const subcription = await createSubscription();
    const networkError = new Error("network down");
    jest.spyOn(webpush, "sendNotification").mockRejectedValueOnce(networkError);
    await expect(notifySubscription(subcription._id, { title: "title", body: "body" })).rejects.toBe(networkError);
    const subcriptionAfterSending = await Subscription.findById(subcription._id);
    expect(subcriptionAfterSending).not.toBe(null);
  });

  it("throws UnrecoverableError and keeps the subscription when the push service answers 403", async () => {
    const subscription = await createSubscription();
    jest.spyOn(webpush, "sendNotification").mockRejectedValueOnce(pushError(403));
    await expect(notifySubscription(subscription._id, { title: "title", body: "body" })).rejects.toBeInstanceOf(UnrecoverableError);
    const subscriptionAfterSending = await Subscription.findById(subscription._id);
    expect(subscriptionAfterSending).not.toBe(null);
  });
});
