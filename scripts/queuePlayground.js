// Playground for learning BullMQ: adds one job to a queue and processes it.
// Needs the local Redis from docker compose (localhost:6379).
// Run with: node scripts/queuePlayground.js   (stop with Ctrl+C)
const { Queue, Worker } = require("bullmq");

const connection = { host: "localhost", port: 6379 };

async function main() {

  // The producer side: put a job on the queue.
  const queue = new Queue("playground", { connection });

  for (const job of await queue.getFailed()) {
    console.log(job.id, job.name, job.data, "attempts:", job.attemptsMade, "reason:", job.failedReason);
  }
  const job = await queue.add("say-hello", { name: "Ron" }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  }
  );
  console.log("Added job:", job.id);

  // The consumer side: handle every job that arrives on the same queue.
  const worker = new Worker("playground", async (job) => {
    console.log(`Attempt ${job.attemptsMade + 1} for job ${job.id}`);
    if (job.attemptsMade < 2) {
      throw new Error("Push service is down");
    }
    console.log("Got job:", job.id, job.name, job.data);


  }, { connection });

  worker.on("completed", (job) => console.log(`Job ${job.id} completed`));
  worker.on("failed", (job, error) => console.log(`Job ${job.id} failed: ${error.message}`));
}

main();
