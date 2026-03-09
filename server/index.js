require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3100;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use("/api/", limiter);

app.use(express.static(path.join(__dirname, "..")));

// ── Profiles CRUD ──
app.get("/api/profiles", (req, res) => {
  const filters = req.query;
  const hasFilter = filters.gender || filters.city || filters.district || filters.community || filters.education || filters.ageMin || filters.ageMax;
  const profiles = hasFilter ? db.searchProfiles(filters) : db.getAllProfiles();
  res.json(profiles.map(db.publicView));
});

app.get("/api/profiles/:id", (req, res) => {
  const p = db.getProfileById(req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json(db.publicView(p));
});

app.post("/api/profiles", (req, res) => {
  if (!req.body.consent) return res.status(400).json({ error: "Consent is required" });
  if (!req.body.fullName || !req.body.phone) return res.status(400).json({ error: "Name and phone are required" });
  const profile = db.createProfile(req.body);
  res.status(201).json(profile);
});

app.put("/api/profiles/:id", (req, res) => {
  const updated = db.updateProfile(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

app.delete("/api/profiles/:id", (req, res) => {
  const ok = db.deleteProfile(req.params.id);
  res.json({ success: ok });
});

// ── Filter options ──
app.get("/api/options/:field", (req, res) => {
  res.json(db.getDistinctValues(req.params.field));
});

// ── Stats ──
app.get("/api/stats", (req, res) => {
  const all = db.getAllProfiles();
  const cities = {};
  const districts = {};
  all.forEach(p => {
    cities[p.city] = (cities[p.city] || 0) + 1;
    districts[p.district] = (districts[p.district] || 0) + 1;
  });
  res.json({
    total: all.length,
    female: all.filter(p => p.gender === "female").length,
    male: all.filter(p => p.gender === "male").length,
    cities,
    districts,
  });
});

// ── CSV Export ──
app.get("/api/export/csv", (req, res) => {
  const gender = req.query.gender || "female";
  const all = db.getAllProfiles().filter(p => p.gender === gender);

  const cols = [
    "Full Name","Age","DOB","Height (cm)","City","District","State",
    "Religion","Community","Sub-caste","Mother Tongue",
    "Education","Profession","Annual Income","Marital Status","Complexion",
    "About","Hobbies",
    "Father Name","Father Occupation","Mother Name","Mother Occupation",
    "Siblings","Family Type","Family Status","Family City",
    "Phone","Email","WhatsApp","Partner Preferences"
  ];

  const esc = v => {
    if (!v && v !== 0) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };

  const rows = all.map(p => [
    p.fullName, p.age, p.dob, p.heightCm, p.city, p.district, p.state,
    p.religion, p.community, p.subcaste, p.motherTongue,
    p.education, p.profession, p.incomeAnnual, p.maritalStatus, p.complexion,
    p.about, p.hobbies,
    p.fatherName, p.fatherOccupation, p.motherName, p.motherOccupation,
    p.siblings, p.familyType, p.familyStatus, p.familyCity,
    p.phone, p.email, p.whatsapp, p.partnerPref
  ].map(esc).join(","));

  const csv = [cols.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${gender}_profiles_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(csv);
});

// ── Contact Requests ──
app.post("/api/contact-request", (req, res) => {
  const { requesterId, profileId, message } = req.body;
  if (!requesterId || !profileId) return res.status(400).json({ error: "Missing IDs" });
  const cr = db.createContactRequest(requesterId, profileId, message);
  res.status(201).json(cr);
});

app.listen(PORT, () => {
  console.log(`
  Punjab Matrimonial Platform
  ───────────────────────────
  Dashboard:     http://localhost:${PORT}
  Registration:  http://localhost:${PORT}/register.html
  API:           http://localhost:${PORT}/api/profiles
  `);
});
