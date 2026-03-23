import { Request, Response, NextFunction } from "express";

/**
 * Express middleware that extracts auth credentials.
 * Supports both:
 * - Bearer token (Authorization header) — for token-based apps
 * - Session cookies — for cookie-based apps like AISOAR
 *
 * The extracted credential is attached as req.userToken for downstream use.
 */
export function validateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  // Option 1: Bearer token
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    if (token && token.trim() !== "") {
      (req as any).userToken = token;
      next();
      return;
    }
  }

  // Option 2: Forward cookies (for session-based apps like AISOAR)
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    (req as any).userToken = cookieHeader;
    next();
    return;
  }

  // Option 3: Custom header for copilot auth bypass in dev
  const copilotAuth = req.headers["x-copilot-auth"];
  if (copilotAuth) {
    (req as any).userToken = copilotAuth as string;
    next();
    return;
  }

  res.status(401).json({ error: "Missing or invalid Authorization header" });
}
