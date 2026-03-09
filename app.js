const $ = id => document.getElementById(id);

let profiles = [];

function showUser() {
  try {
    const u = JSON.parse(localStorage.getItem("pr_user"));
    if (u && $("navUser")) $("navUser").textContent = u.name || u.email;
  } catch {}
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  localStorage.removeItem("pr_user");
  window.location.href = "/login.html";
}

async function authFetch(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = "/login.html"; return null; }
  return res;
}

async function init() {
  showUser();
  await fetchProfiles();
  await populateFilters();
  renderStats();
  renderGrid(profiles);

  $("searchInput").addEventListener("input", applyFilters);
  ["fGender","fCity","fDistrict","fCommunity","fEducation","fAgeMin","fAgeMax"].forEach(id => {
    $(id).addEventListener("change", applyFilters);
  });

  $("modalOverlay").addEventListener("click", e => {
    if (e.target === $("modalOverlay")) closeModal();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
}

async function fetchProfiles() {
  try {
    const res = await authFetch("/api/profiles");
    if (!res) return;
    profiles = await res.json();
  } catch { profiles = []; }
}

async function populateFilters() {
  const fields = ["city","district","community","education"];
  const elMap = { city: "fCity", district: "fDistrict", community: "fCommunity", education: "fEducation" };
  for (const f of fields) {
    try {
      const res = await fetch(`/api/options/${f}`);
      const vals = await res.json();
      const sel = $(elMap[f]);
      vals.forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o); });
    } catch {}
  }
  for (let a = 18; a <= 50; a++) {
    const oMin = document.createElement("option"); oMin.value = a; oMin.textContent = a + " yrs";
    const oMax = document.createElement("option"); oMax.value = a; oMax.textContent = a + " yrs";
    $("fAgeMin").appendChild(oMin);
    $("fAgeMax").appendChild(oMax);
  }
}

function renderStats() {
  const total = profiles.length;
  const female = profiles.filter(p => p.gender === "female").length;
  const male = profiles.filter(p => p.gender === "male").length;
  const cities = new Set(profiles.map(p => p.city)).size;
  $("statsBar").innerHTML = `
    <div class="stat-pill"><span class="num" style="color:var(--accent2)">${total}</span><span class="lbl">Profiles</span></div>
    <div class="stat-pill"><span class="num" style="color:var(--pink)">${female}</span><span class="lbl">Female</span></div>
    <div class="stat-pill"><span class="num" style="color:var(--cyan)">${male}</span><span class="lbl">Male</span></div>
    <div class="stat-pill"><span class="num" style="color:var(--amber)">${cities}</span><span class="lbl">Cities</span></div>
  `;
}

function applyFilters() {
  const q = $("searchInput").value.toLowerCase().trim();
  const gender = $("fGender").value;
  const city = $("fCity").value;
  const district = $("fDistrict").value;
  const community = $("fCommunity").value;
  const education = $("fEducation").value;
  const ageMin = parseInt($("fAgeMin").value) || 0;
  const ageMax = parseInt($("fAgeMax").value) || 0;

  const filtered = profiles.filter(p => {
    if (q && !p.fullName.toLowerCase().includes(q) && !(p.city||"").toLowerCase().includes(q) && !(p.profession||"").toLowerCase().includes(q) && !(p.community||"").toLowerCase().includes(q)) return false;
    if (gender && p.gender !== gender) return false;
    if (city && p.city !== city) return false;
    if (district && p.district !== district) return false;
    if (community && p.community !== community) return false;
    if (education && p.education !== education) return false;
    if (ageMin && p.age < ageMin) return false;
    if (ageMax && p.age > ageMax) return false;
    return true;
  });
  renderGrid(filtered);
}

function renderGrid(list) {
  $("countBadge").textContent = `Showing ${list.length} profile${list.length !== 1 ? "s" : ""}`;
  if (!list.length) {
    $("profilesGrid").innerHTML = '<div class="no-results">No profiles match your filters.</div>';
    return;
  }
  $("profilesGrid").innerHTML = list.map(p => {
    const initials = p.fullName.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
    const heightStr = p.heightCm ? `${Math.floor(p.heightCm/30.48)}'${Math.round((p.heightCm%30.48)/2.54)}"` : "";
    return `
    <div class="profile-card" onclick="openProfile('${p.id}')">
      <div class="pc-top">
        <div class="pc-avatar">${initials}</div>
        <div class="pc-info">
          <div class="pc-name">${esc(p.fullName)}</div>
          <div class="pc-sub">${p.age ? p.age + " yrs" : ""}${heightStr ? " · " + heightStr : ""}${p.maritalStatus ? " · " + p.maritalStatus : ""}</div>
        </div>
      </div>
      <div class="pc-tags">
        ${p.city ? `<span class="pc-tag city">${esc(p.city)}</span>` : ""}
        ${p.community ? `<span class="pc-tag comm">${esc(p.community)}</span>` : ""}
        ${p.education ? `<span class="pc-tag edu">${esc(p.education)}</span>` : ""}
        ${p.profession ? `<span class="pc-tag prof">${esc(p.profession)}</span>` : ""}
      </div>
      ${p.about ? `<div class="pc-about">${esc(p.about)}</div>` : ""}
    </div>`;
  }).join("");
}

function openProfile(id) {
  const p = profiles.find(x => x.id === id);
  if (!p) return;
  const initials = p.fullName.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  const heightStr = p.heightCm ? `${Math.floor(p.heightCm/30.48)}'${Math.round((p.heightCm%30.48)/2.54)}"` : "—";

  const field = (label, val) => val ? `<div class="md-field"><span class="label">${label}:</span> <span class="value">${esc(val)}</span></div>` : "";

  let contactHTML = "";
  if (p.phone || p.email || p.whatsapp) {
    contactHTML = `<div class="md-contact-box">
      ${p.phone ? `<div class="md-contact-item">📞 <a href="tel:${p.phone}">${p.phone}</a></div>` : ""}
      ${p.email ? `<div class="md-contact-item">✉️ <a href="mailto:${p.email}">${p.email}</a></div>` : ""}
      ${p.whatsapp ? `<div class="md-contact-item">💬 <a href="https://wa.me/91${p.whatsapp}" target="_blank">${p.whatsapp}</a></div>` : ""}
    </div>`;
  } else {
    contactHTML = `<div class="md-contact-hidden">Contact details are hidden. Send a contact request to connect.</div>`;
  }

  $("modalDetail").innerHTML = `
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <div class="md-header">
      <div class="md-avatar">${initials}</div>
      <div>
        <div class="md-name">${esc(p.fullName)}</div>
        <div class="md-subtitle">${p.age ? p.age + " yrs" : ""} · ${p.city}, ${p.district} · ${p.gender === "female" ? "Female" : "Male"}</div>
      </div>
    </div>

    ${p.about ? `<div class="md-section"><div class="md-section-title">About</div><div class="md-about">${esc(p.about)}</div></div>` : ""}

    <div class="md-section">
      <div class="md-section-title">Personal Details</div>
      <div class="md-grid">
        ${field("Date of Birth", p.dob)}
        ${field("Height", heightStr)}
        ${field("Complexion", p.complexion)}
        ${field("Marital Status", p.maritalStatus)}
        ${field("Religion", p.religion)}
        ${field("Community", p.community)}
        ${field("Sub-caste / Gotra", p.subcaste)}
        ${field("Mother Tongue", p.motherTongue)}
        ${field("Hobbies", p.hobbies)}
      </div>
    </div>

    <div class="md-section">
      <div class="md-section-title">Education &amp; Career</div>
      <div class="md-grid">
        ${field("Education", p.education)}
        ${field("Profession", p.profession)}
        ${field("Annual Income", p.incomeAnnual)}
      </div>
    </div>

    <div class="md-section">
      <div class="md-section-title">Family Background</div>
      <div class="md-grid">
        ${field("Father", p.fatherName + (p.fatherOccupation ? " (" + p.fatherOccupation + ")" : ""))}
        ${field("Mother", p.motherName + (p.motherOccupation ? " (" + p.motherOccupation + ")" : ""))}
        ${field("Siblings", p.siblings)}
        ${field("Family Type", p.familyType)}
        ${field("Family Status", p.familyStatus)}
        ${field("Family Based In", p.familyCity)}
      </div>
    </div>

    <div class="md-section">
      <div class="md-section-title">Contact Information</div>
      ${contactHTML}
    </div>

    ${p.partnerPref ? `<div class="md-section"><div class="md-section-title">Partner Preferences</div><div class="md-about">${esc(p.partnerPref)}</div></div>` : ""}
  `;
  $("modalOverlay").classList.add("open");
}

function closeModal() { $("modalOverlay").classList.remove("open"); }

function esc(s) {
  if (!s) return "";
  const d = document.createElement("div"); d.textContent = s; return d.innerHTML;
}

document.addEventListener("DOMContentLoaded", init);
