const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "matrimonial.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id              TEXT PRIMARY KEY,
    full_name       TEXT NOT NULL,
    gender          TEXT NOT NULL DEFAULT 'female',
    dob             TEXT NOT NULL DEFAULT '',
    age             INTEGER DEFAULT 0,
    height_cm       INTEGER DEFAULT 0,
    city            TEXT NOT NULL DEFAULT '',
    district        TEXT NOT NULL DEFAULT '',
    state           TEXT NOT NULL DEFAULT 'Punjab',
    religion        TEXT DEFAULT '',
    community       TEXT DEFAULT '',
    subcaste        TEXT DEFAULT '',
    mother_tongue   TEXT DEFAULT 'Punjabi',
    education       TEXT DEFAULT '',
    profession      TEXT DEFAULT '',
    income_annual   TEXT DEFAULT '',
    marital_status  TEXT NOT NULL DEFAULT 'Never Married',
    complexion      TEXT DEFAULT '',
    about           TEXT DEFAULT '',
    hobbies         TEXT DEFAULT '',

    father_name     TEXT DEFAULT '',
    father_occupation TEXT DEFAULT '',
    mother_name     TEXT DEFAULT '',
    mother_occupation TEXT DEFAULT '',
    siblings        TEXT DEFAULT '',
    family_type     TEXT DEFAULT '',
    family_status   TEXT DEFAULT '',
    family_city     TEXT DEFAULT '',

    phone           TEXT NOT NULL DEFAULT '',
    email           TEXT DEFAULT '',
    whatsapp        TEXT DEFAULT '',

    photo_url       TEXT DEFAULT '',
    partner_pref    TEXT DEFAULT '',

    consent         INTEGER NOT NULL DEFAULT 0,
    privacy_level   TEXT NOT NULL DEFAULT 'registered',
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_prof_gender    ON profiles(gender);
  CREATE INDEX IF NOT EXISTS idx_prof_city      ON profiles(city);
  CREATE INDEX IF NOT EXISTS idx_prof_district  ON profiles(district);
  CREATE INDEX IF NOT EXISTS idx_prof_community ON profiles(community);
  CREATE INDEX IF NOT EXISTS idx_prof_education ON profiles(education);
  CREATE INDEX IF NOT EXISTS idx_prof_age       ON profiles(age);
  CREATE INDEX IF NOT EXISTS idx_prof_status    ON profiles(status);

  CREATE TABLE IF NOT EXISTS contact_requests (
    id              TEXT PRIMARY KEY,
    requester_id    TEXT NOT NULL,
    profile_id      TEXT NOT NULL,
    message         TEXT DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      INTEGER NOT NULL,
    FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_cr_profile ON contact_requests(profile_id);
`);

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function sanitize(val) {
  if (typeof val !== "string") return "";
  return val.replace(/<[^>]*>/g, "").trim().slice(0, 2000);
}

const stmts = {
  insert: db.prepare(`
    INSERT INTO profiles (id, full_name, gender, dob, age, height_cm, city, district, state,
      religion, community, subcaste, mother_tongue, education, profession, income_annual,
      marital_status, complexion, about, hobbies,
      father_name, father_occupation, mother_name, mother_occupation, siblings, family_type, family_status, family_city,
      phone, email, whatsapp, photo_url, partner_pref,
      consent, privacy_level, status, created_at, updated_at)
    VALUES (@id, @fullName, @gender, @dob, @age, @heightCm, @city, @district, @state,
      @religion, @community, @subcaste, @motherTongue, @education, @profession, @incomeAnnual,
      @maritalStatus, @complexion, @about, @hobbies,
      @fatherName, @fatherOccupation, @motherName, @motherOccupation, @siblings, @familyType, @familyStatus, @familyCity,
      @phone, @email, @whatsapp, @photoUrl, @partnerPref,
      @consent, @privacyLevel, @status, @createdAt, @updatedAt)
  `),
  update: db.prepare(`
    UPDATE profiles SET full_name=@fullName, gender=@gender, dob=@dob, age=@age,
      height_cm=@heightCm, city=@city, district=@district, state=@state,
      religion=@religion, community=@community, subcaste=@subcaste, mother_tongue=@motherTongue,
      education=@education, profession=@profession, income_annual=@incomeAnnual,
      marital_status=@maritalStatus, complexion=@complexion, about=@about, hobbies=@hobbies,
      father_name=@fatherName, father_occupation=@fatherOccupation,
      mother_name=@motherName, mother_occupation=@motherOccupation,
      siblings=@siblings, family_type=@familyType, family_status=@familyStatus, family_city=@familyCity,
      phone=@phone, email=@email, whatsapp=@whatsapp, photo_url=@photoUrl, partner_pref=@partnerPref,
      privacy_level=@privacyLevel, status=@status, updated_at=@updatedAt
    WHERE id=@id
  `),
  getAll: db.prepare("SELECT * FROM profiles WHERE status='active' ORDER BY created_at DESC"),
  getById: db.prepare("SELECT * FROM profiles WHERE id = ?"),
  deleteById: db.prepare("DELETE FROM profiles WHERE id = ?"),
  search: db.prepare(`SELECT * FROM profiles WHERE status='active'
    AND (@gender = '' OR gender = @gender)
    AND (@city = '' OR city = @city)
    AND (@district = '' OR district = @district)
    AND (@community = '' OR community = @community)
    AND (@education = '' OR education = @education)
    AND (@ageMin = 0 OR age >= @ageMin)
    AND (@ageMax = 0 OR age <= @ageMax)
    ORDER BY created_at DESC`),
};

function rowToProfile(r) {
  return {
    id: r.id, fullName: r.full_name, gender: r.gender, dob: r.dob, age: r.age,
    heightCm: r.height_cm, city: r.city, district: r.district, state: r.state,
    religion: r.religion, community: r.community, subcaste: r.subcaste, motherTongue: r.mother_tongue,
    education: r.education, profession: r.profession, incomeAnnual: r.income_annual,
    maritalStatus: r.marital_status, complexion: r.complexion, about: r.about, hobbies: r.hobbies,
    fatherName: r.father_name, fatherOccupation: r.father_occupation,
    motherName: r.mother_name, motherOccupation: r.mother_occupation,
    siblings: r.siblings, familyType: r.family_type, familyStatus: r.family_status, familyCity: r.family_city,
    phone: r.phone, email: r.email, whatsapp: r.whatsapp,
    photoUrl: r.photo_url, partnerPref: r.partner_pref,
    consent: r.consent, privacyLevel: r.privacy_level, status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function publicView(p) {
  const out = { ...p };
  if (p.privacyLevel === "hidden") {
    out.phone = ""; out.email = ""; out.whatsapp = "";
  }
  return out;
}

exports.createProfile = function (data) {
  const now = Date.now();
  const dobDate = data.dob ? new Date(data.dob) : null;
  const age = dobDate ? Math.floor((Date.now() - dobDate.getTime()) / 31557600000) : parseInt(data.age, 10) || 0;
  const profile = {
    id: genId(),
    fullName: sanitize(data.fullName),
    gender: sanitize(data.gender || "female"),
    dob: sanitize(data.dob || ""),
    age,
    heightCm: parseInt(data.heightCm, 10) || 0,
    city: sanitize(data.city || ""),
    district: sanitize(data.district || ""),
    state: sanitize(data.state || "Punjab"),
    religion: sanitize(data.religion || ""),
    community: sanitize(data.community || ""),
    subcaste: sanitize(data.subcaste || ""),
    motherTongue: sanitize(data.motherTongue || "Punjabi"),
    education: sanitize(data.education || ""),
    profession: sanitize(data.profession || ""),
    incomeAnnual: sanitize(data.incomeAnnual || ""),
    maritalStatus: sanitize(data.maritalStatus || "Never Married"),
    complexion: sanitize(data.complexion || ""),
    about: sanitize(data.about || ""),
    hobbies: sanitize(data.hobbies || ""),
    fatherName: sanitize(data.fatherName || ""),
    fatherOccupation: sanitize(data.fatherOccupation || ""),
    motherName: sanitize(data.motherName || ""),
    motherOccupation: sanitize(data.motherOccupation || ""),
    siblings: sanitize(data.siblings || ""),
    familyType: sanitize(data.familyType || ""),
    familyStatus: sanitize(data.familyStatus || ""),
    familyCity: sanitize(data.familyCity || ""),
    phone: sanitize(data.phone || ""),
    email: sanitize(data.email || ""),
    whatsapp: sanitize(data.whatsapp || ""),
    photoUrl: sanitize(data.photoUrl || ""),
    partnerPref: sanitize(data.partnerPref || ""),
    consent: data.consent ? 1 : 0,
    privacyLevel: sanitize(data.privacyLevel || "registered"),
    status: "active",
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
  stmts.insert.run(profile);
  return profile;
};

exports.updateProfile = function (id, data) {
  const existing = stmts.getById.get(id);
  if (!existing) return null;
  const dobDate = data.dob ? new Date(data.dob) : (existing.dob ? new Date(existing.dob) : null);
  const age = dobDate && !isNaN(dobDate) ? Math.floor((Date.now() - dobDate.getTime()) / 31557600000) : existing.age;
  const updated = {
    id,
    fullName: sanitize(data.fullName ?? existing.full_name),
    gender: sanitize(data.gender ?? existing.gender),
    dob: sanitize(data.dob ?? existing.dob),
    age,
    heightCm: parseInt(data.heightCm ?? existing.height_cm, 10) || 0,
    city: sanitize(data.city ?? existing.city),
    district: sanitize(data.district ?? existing.district),
    state: sanitize(data.state ?? existing.state),
    religion: sanitize(data.religion ?? existing.religion),
    community: sanitize(data.community ?? existing.community),
    subcaste: sanitize(data.subcaste ?? existing.subcaste),
    motherTongue: sanitize(data.motherTongue ?? existing.mother_tongue),
    education: sanitize(data.education ?? existing.education),
    profession: sanitize(data.profession ?? existing.profession),
    incomeAnnual: sanitize(data.incomeAnnual ?? existing.income_annual),
    maritalStatus: sanitize(data.maritalStatus ?? existing.marital_status),
    complexion: sanitize(data.complexion ?? existing.complexion),
    about: sanitize(data.about ?? existing.about),
    hobbies: sanitize(data.hobbies ?? existing.hobbies),
    fatherName: sanitize(data.fatherName ?? existing.father_name),
    fatherOccupation: sanitize(data.fatherOccupation ?? existing.father_occupation),
    motherName: sanitize(data.motherName ?? existing.mother_name),
    motherOccupation: sanitize(data.motherOccupation ?? existing.mother_occupation),
    siblings: sanitize(data.siblings ?? existing.siblings),
    familyType: sanitize(data.familyType ?? existing.family_type),
    familyStatus: sanitize(data.familyStatus ?? existing.family_status),
    familyCity: sanitize(data.familyCity ?? existing.family_city),
    phone: sanitize(data.phone ?? existing.phone),
    email: sanitize(data.email ?? existing.email),
    whatsapp: sanitize(data.whatsapp ?? existing.whatsapp),
    photoUrl: sanitize(data.photoUrl ?? existing.photo_url),
    partnerPref: sanitize(data.partnerPref ?? existing.partner_pref),
    privacyLevel: sanitize(data.privacyLevel ?? existing.privacy_level),
    status: sanitize(data.status ?? existing.status),
    updatedAt: Date.now(),
  };
  stmts.update.run(updated);
  return rowToProfile(stmts.getById.get(id));
};

exports.getAllProfiles = () => stmts.getAll.all().map(rowToProfile);
exports.getProfileById = (id) => { const r = stmts.getById.get(id); return r ? rowToProfile(r) : null; };
exports.deleteProfile = (id) => stmts.deleteById.run(id).changes > 0;
exports.publicView = publicView;

exports.searchProfiles = function (filters) {
  return stmts.search.all({
    gender: filters.gender || "",
    city: filters.city || "",
    district: filters.district || "",
    community: filters.community || "",
    education: filters.education || "",
    ageMin: parseInt(filters.ageMin, 10) || 0,
    ageMax: parseInt(filters.ageMax, 10) || 0,
  }).map(rowToProfile);
};

exports.getDistinctValues = function (column) {
  const allowed = ["city", "district", "community", "education", "profession", "religion"];
  if (!allowed.includes(column)) return [];
  return db.prepare(`SELECT DISTINCT ${column} FROM profiles WHERE status='active' AND ${column} != '' ORDER BY ${column}`).all().map(r => r[column]);
};

// Contact requests
exports.createContactRequest = function (requesterId, profileId, message) {
  const id = genId();
  db.prepare("INSERT INTO contact_requests (id, requester_id, profile_id, message, status, created_at) VALUES (?,?,?,?,?,?)")
    .run(id, requesterId, profileId, sanitize(message || ""), "pending", Date.now());
  return { id, requesterId, profileId, message, status: "pending" };
};

exports.getContactRequests = function (profileId) {
  return db.prepare("SELECT cr.*, p.full_name as requester_name FROM contact_requests cr JOIN profiles p ON cr.requester_id = p.id WHERE cr.profile_id = ? ORDER BY cr.created_at DESC")
    .all(profileId);
};
