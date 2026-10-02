const VALID_CAPACITY = 10;
const VALID_REFILL_PER_SECOND = 1;
const UNKNOWN_CAPACITY = 20;
const UNKNOWN_REFILL_PER_SECOND = 2;
const MAX_VALID_BUCKETS = 10000;
const TTL_MS = 2 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 30 * 1000;

const validBuckets = new Map();
const unknownBucket = { tokens: UNKNOWN_CAPACITY, updatedAt: Date.now() };

function refill(bucket, now, capacity, refillPerSecond) {
  const elapsed = Math.max(0, now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
  bucket.updatedAt = now;
}

function consume(bucket, now, capacity, refillPerSecond) {
  refill(bucket, now, capacity, refillPerSecond);
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

function cleanup(now = Date.now()) {
  for (const [key, bucket] of validBuckets) if (now - bucket.updatedAt > TTL_MS) validBuckets.delete(key);
}

function allowValid(hash, now = Date.now()) {
  cleanup(now);
  let bucket = validBuckets.get(hash);
  if (!bucket) {
    if (validBuckets.size >= MAX_VALID_BUCKETS) return false;
    bucket = { tokens: VALID_CAPACITY, updatedAt: now };
    validBuckets.set(hash, bucket);
  }
  return consume(bucket, now, VALID_CAPACITY, VALID_REFILL_PER_SECOND);
}

function allowUnknown(now = Date.now()) {
  cleanup(now);
  return consume(unknownBucket, now, UNKNOWN_CAPACITY, UNKNOWN_REFILL_PER_SECOND);
}

function refundUnknown(now = Date.now()) {
  refill(unknownBucket, now, UNKNOWN_CAPACITY, UNKNOWN_REFILL_PER_SECOND);
  unknownBucket.tokens = Math.min(UNKNOWN_CAPACITY, unknownBucket.tokens + 1);
}

function resetForTests() {
  validBuckets.clear();
  unknownBucket.tokens = UNKNOWN_CAPACITY;
  unknownBucket.updatedAt = Date.now();
}

const cleanupTimer = setInterval(() => cleanup(), CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

module.exports = { allowValid, allowUnknown, cleanup, refundUnknown, resetForTests, MAX_VALID_BUCKETS, TTL_MS };
