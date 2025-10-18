import type { FastifyRequest, FastifyReply } from 'fastify';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verify Cloudflare Turnstile CAPTCHA
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export const verifyCaptcha = async function verifyCaptcha(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Skip CAPTCHA verification for development/testing
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.SKIP_CAPTCHA === 'true'
  ) {
    request.log.debug('CAPTCHA verification skipped (development mode)');
    return;
  }

  const captchaToken = request.headers['x-captcha-response'] as string;
  const userIp =
    (request.headers['x-captcha-user-remote-ip'] as string) || request.ip;

  if (!captchaToken) {
    return reply.code(400).send({
      error: 'CAPTCHA_REQUIRED',
      message: 'CAPTCHA token required in x-captcha-response header',
    });
  }

  const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  try {
    const formData = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: captchaToken,
      remoteip: userIp,
    });

    const response = await fetch(verifyUrl, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
      throw new Error(`Turnstile API error: ${response.status}`);
    }

    const result: TurnstileVerifyResponse = await response.json();

    if (!result.success) {
      request.log.warn(
        {
          errors: result['error-codes'],
          ip: userIp,
        },
        'CAPTCHA verification failed',
      );

      return reply.code(403).send({
        error: 'CAPTCHA_INVALID',
        message: 'CAPTCHA verification failed',
        errorCodes: result['error-codes'],
      });
    }

    // Success - continue to route handler
    request.log.debug({ ip: userIp }, 'CAPTCHA verified');
  } catch (error) {
    request.log.error({ error }, 'CAPTCHA verification exception');
    return reply.code(500).send({
      error: 'CAPTCHA_SERVICE_ERROR',
      message: 'Failed to verify CAPTCHA',
    });
  }
};
