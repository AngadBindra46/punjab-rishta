const { OAuth2Client } = require("google-auth-library");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const COOKIE_SECRET = process.env.COOKIE_SECRET || "dev-secret-change-in-production-1234567890";
const COOKIE_NAME = "pr_session";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const client = new OAuth2Client(CLIENT_ID);

async function verifyGoogleToken(credential) {
  const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
  const payload = ticket.getPayload();
  return { email: payload.email, name: payload.name, picture: payload.picture };
}

function setSessionCookie(res, user) {
  const value = Buffer.from(JSON.stringify({ ...user, loginAt: Date.now() })).toString("base64");
  res.cookie(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    signed: true,
  });
}

function getSession(req) {
  const val = req.signedCookies && req.signedCookies[COOKIE_NAME];
  if (!val) return null;
  try {
    const user = JSON.parse(Buffer.from(val, "base64").toString());
    if (Date.now() - user.loginAt > MAX_AGE) return null;
    return user;
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const user = getSession(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  req.user = user;
  next();
}

function mountAuthRoutes(app) {
  app.get("/api/auth/me", (req, res) => {
    const user = getSession(req);
    if (!user) return res.status(401).json({ error: "Not logged in" });
    res.json(user);
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) return res.status(400).json({ error: "Missing credential" });
      const user = await verifyGoogleToken(credential);
      setSessionCookie(res, user);
      res.json(user);
    } catch (err) {
      res.status(401).json({ error: "Invalid Google token" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true });
  });
}

module.exports = { requireAuth, mountAuthRoutes, getSession, COOKIE_SECRET };
