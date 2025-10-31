export type ScheduledTask<T> = () => Promise<T>;

interface RateLimiterOptions {
  requestsPerMinute?: number;
  name?: string;
}

class QueuedRateLimiter {
  private readonly requestsPerMinute: number;
  private readonly intervalMs: number;
  private readonly name: string;
  private queue: Array<{ id: string; task: ScheduledTask<any>; resolve: (v: any) => void; reject: (e: any) => void }>; 
  private timer: any;
  private isRunning: boolean;
  private lastRunAt: number | null;

  constructor(options?: RateLimiterOptions) {
    this.requestsPerMinute = Math.max(1, options?.requestsPerMinute ?? (process.env.RPM ? Number(process.env.RPM) : 20));
    this.intervalMs = Math.floor(60000 / this.requestsPerMinute);
    this.name = options?.name ?? 'provider-rate-limiter';
    this.queue = [];
    this.timer = null;
    this.isRunning = false;
    this.lastRunAt = null;
    console.log(`🎛️  RateLimiter(${this.name}) initialized: ${this.requestsPerMinute} req/min (~${this.intervalMs}ms/req)`);
  }

  schedule<T>(task: ScheduledTask<T>, label?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = crypto.randomUUID();
      this.queue.push({ id, task, resolve, reject });
      console.log(`🧾 [${this.name}] queued task ${id}${label ? ` (${label})` : ''}. Queue length: ${this.queue.length}`);
      this.start();
    });
  }

  private start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const tick = async () => {
      if (this.queue.length === 0) {
        // Nothing to process, pause until new items arrive
        this.stop();
        return;
      }

      const now = Date.now();
      if (this.lastRunAt !== null) {
        const elapsed = now - this.lastRunAt;
        if (elapsed < this.intervalMs) {
          // Not yet time; wait remaining and try again
          return;
        }
      }

      const next = this.queue.shift()!;
      this.lastRunAt = Date.now();

      console.log(`➡️  [${this.name}] dispatching task ${next.id}. Remaining queue: ${this.queue.length}`);
      next.task()
        .then((result) => {
          console.log(`✅ [${this.name}] completed task ${next.id}`);
          next.resolve(result);
        })
        .catch((err) => {
          console.warn(`⚠️  [${this.name}] task ${next.id} failed: ${err?.message || err}`);
          next.reject(err);
        });
    };

    this.timer = setInterval(tick, Math.max(250, Math.floor(this.intervalMs / 3))); // check multiple times per interval
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }
}

// Singleton limiter shared across engine
let singleton: QueuedRateLimiter | null = null;

export function getRateLimiter(options?: RateLimiterOptions): QueuedRateLimiter {
  if (!singleton) {
    singleton = new QueuedRateLimiter(options);
  }
  return singleton;
}
