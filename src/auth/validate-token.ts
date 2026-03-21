import { Request, Response, NextFunction } from "express";

/**
 * Express middleware that extracts the Bearer token from the Authorization header.
 * The token is forwarded to ZT APIs which handle their own validation.
 * Future enhancement: add jwks-rsa validation against Azure AD tenant.
 */
export function validateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  if (!token || token.trim() === "") {
    res.status(401).json({ error: "Empty token" });
    return;
  }

  // Attach token to request for downstream use
  (req as any).userToken = token;
  next();
}
