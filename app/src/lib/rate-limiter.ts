/**
 * In-memory Rate Limiter để chống Brute Force mật khẩu và DDoS cho các API nhạy cảm.
 */

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number;
}

const attempts = new Map<string, AttemptRecord>();

// Định kỳ dọn dẹp các bản ghi đã hết hạn
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attempts.entries()) {
      if (record.blockedUntil < now && now - record.firstAttemptAt > 5 * 60 * 1000) {
        attempts.delete(key);
      }
    }
  }, 60 * 1000);
}

/**
 * Kiểm tra xem một key (IP hoặc IP:identifier) có đang bị giới hạn truy cập không.
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 60 * 1000,
  blockDurationMs = 60 * 1000
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record) {
    return { allowed: true };
  }

  // Nếu đang trong thời gian phạt block
  if (record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // Nếu đã quá cửa sổ thời gian (windowMs), reset đếm
  if (now - record.firstAttemptAt > windowMs) {
    attempts.delete(key);
    return { allowed: true };
  }

  // Nếu số lần thử đã vượt ngưỡng
  if (record.count >= maxAttempts) {
    record.blockedUntil = now + blockDurationMs;
    const retryAfterSeconds = Math.ceil(blockDurationMs / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

/**
 * Ghi nhận một lần thử thất bại
 */
export function recordFailedAttempt(
  key: string,
  maxAttempts = 5,
  windowMs = 60 * 1000,
  blockDurationMs = 60 * 1000
) {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAttemptAt > windowMs) {
    attempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      blockedUntil: 0,
    });
    return;
  }

  record.count += 1;
  if (record.count >= maxAttempts) {
    record.blockedUntil = now + blockDurationMs;
  }
}

/**
 * Xóa đếm khi đăng nhập thành công
 */
export function resetRateLimit(key: string) {
  attempts.delete(key);
}

/**
 * Trích xuất địa chỉ IP của Client từ Request
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

