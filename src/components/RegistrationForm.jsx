import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import logo from "../assets/anunathan-logo.png";
import agentPhoto from "../assets/me.png";

const BUSINESS_OPPORTUNITIES = [
  { id: "financial_freedom", label: "Financial and Time Freedom" },
  { id: "own_business", label: "Owning Your Own Business (No Business Experience Required)" },
  { id: "successful_entrepreneur", label: "Becoming a Successful Entrepreneur" },
  { id: "million_income", label: "Million Dollar Income (Dreamer)" },
];

const WEALTH_SOLUTIONS = [
  { id: "protection_planning", label: "Protection Planning" },
  { id: "investment_planning", label: "Investment Planning" },
  { id: "college_tuition", label: "College Tuition Planning" },
  { id: "lifetime_income", label: "Lifetime Income, Guaranteed Income Stream" },
  { id: "will_trust", label: "Will & Trust (W&T), Estate Planning" },
  { id: "tax_optimization", label: "Tax Optimization" },
  { id: "retirement", label: "Retirement" },
  { id: "legacy", label: "Legacy" },
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TIME  = ["AM","PM"];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function formatDisplayTime(hour) {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:00 ${period}`;
}

// Format date as local ISO without timezone suffix: "2025-05-05T18:00:00"
function formatLocalISO(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00:00`;
}

function generateAvailableSlots() {
  const slots = [];
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 42); // 6 weeks

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1); // start from tomorrow

  while (cursor <= end) {
    const dow = cursor.getDay(); // 0=Sun, 6=Sat
    let hours = [];
    if (dow >= 1 && dow <= 5) hours = [18, 19];       // Mon-Fri: 6 PM, 7 PM
    else if (dow === 6) hours = [10, 11, 16, 17];      // Sat: 10 AM, 11 AM, 4 PM, 5 PM
    else if (dow === 0) hours = [15, 16, 17];           // Sun: 3 PM, 4 PM, 5 PM

    for (const h of hours) {
      const slotStart = new Date(cursor);
      slotStart.setHours(h, 0, 0, 0);
      if (slotStart > now) {
        const dateLabel = slotStart.toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
        });
        const shortDate = slotStart.toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        });
        slots.push({
          value: formatLocalISO(slotStart),
          timeLabel: `${formatDisplayTime(h)} – ${formatDisplayTime(h + 1)}`,
          dateLabel,
          shortDate,
          dateKey: slotStart.toDateString(),
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}


export default function RegistrationForm() {
  const [formData, setFormData] = useState({
    interest_type: "",
    business_opportunities: [],
    wealth_solutions: [],
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    profession: "",
    preferred_days: [],
    preferred_time: [],
    referred_by: "",
  });

  const [connectionType, setConnectionType] = useState(""); // "zoom_meeting" | "meeting_preference"
  const [selectedSlot, setSelectedSlot] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailSent, setEmailSent] = useState(true);
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");

  const showEntrepreneurship = formData.interest_type === "entrepreneurship" || formData.interest_type === "both";
  const showClient = formData.interest_type === "client" || formData.interest_type === "both";

  const availableSlots = useMemo(() => generateAvailableSlots(), []);
  const selectedSlotInfo = useMemo(
    () => availableSlots.find((s) => s.value === selectedSlot) || null,
    [availableSlots, selectedSlot]
  );

  const canSubmit = useMemo(() => {
    const baseOk =
      formData.interest_type &&
      formData.first_name.trim() &&
      formData.last_name.trim() &&
      formData.phone.trim() &&
      isValidEmail(formData.email) &&
      formData.referred_by.trim() &&
      connectionType;

    const meetingOk =
      connectionType === "zoom_meeting"
        ? Boolean(selectedSlot)
        : connectionType === "meeting_preference"
        ? formData.preferred_days.length > 0 && formData.preferred_time.length > 0
        : false;

    const interestOk =
      (showEntrepreneurship ? formData.business_opportunities.length > 0 : true) &&
      (showClient ? formData.wealth_solutions.length > 0 : true);

    return Boolean(baseOk && meetingOk && interestOk);
  }, [formData, connectionType, selectedSlot, showEntrepreneurship, showClient]);

  function toggleArray(field, id) {
    setFormData((prev) => {
      const set = new Set(prev[field]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, [field]: Array.from(set) };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Please complete all required fields before submitting.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        ...formData,
        connection_type: connectionType,
        selected_slot: selectedSlot || null,
        selected_slot_label: selectedSlotInfo ? selectedSlotInfo.timeLabel : null,
        selected_slot_date: selectedSlotInfo ? selectedSlotInfo.dateLabel : null,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        profession: formData.profession.trim(),
        referred_by: formData.referred_by.trim(),
      };

      const { data, error: fnError } = await supabase.functions.invoke("register", {
        body: payload,
      });

      if (fnError) throw fnError;
      if (!data?.ok) throw new Error(data?.error || "Submission failed.");

      setSubmitted(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="cardHeader text-center">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    marginTop: "32px",
                    marginBottom: "0px",
                    minHeight: "140px",
                  }}
                >
                  <div />
                  <img
                    src={logo}
                    alt="AnNa Financial Group"
                    style={{
                      height: "clamp(100px, 13vw, 150px)",
                      width: "auto",
                      objectFit: "contain",
                      display: "block",
                      background: "transparent",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <img
                      src={agentPhoto}
                      alt="Financial Agent"
                      style={{
                        height: "clamp(100px, 13vw, 150px)",
                        width: "auto",
                        objectFit: "contain",
                        objectPosition: "top center",
                        background: "transparent",
                        display: "block",
                      }}
                    />
                  </div>
                </div>

                <h1 style={{
                  fontSize: "23px",
                  fontWeight: "bold",
                  color: "#0f172a",
                  margin: "0 0 10px 0",
                  lineHeight: 1.2,
                  textAlign: "center",
                }}>
                  Get Started - Registration
                </h1>
                <p className="sub2 text-base md:text-lg text-slate-700 mb-4">
                  We're excited to connect with you and introduce an opportunity that combines purpose with prosperity.
                </p>
                <p className="sub2 text-base md:text-lg text-slate-700 mb-6">
                  At <b>AnNa Financial Group</b>, you'll help families secure their tomorrow and advance your career with unlimited potential.
                </p>
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 mb-6 mx-auto max-w-4xl">
                  <p className="sub2 text-sm md:text-base text-slate-800 text-center">
                    ✅ <b>Be your own boss</b> ✅ <b>Flexible schedule</b>
                  </p>
                  <p className="sub2 text-sm md:text-base text-slate-800 text-center">
                    ✅ <b>Unlimited income potential</b> ✅ <b>Make an impact</b>
                  </p>
                </div>
              </div>

              <form className="cardBody" onSubmit={handleSubmit}>
                {/* Interest Type */}
                <div className="section">
                  <div className="sectionTitle">
                    Interested In Business/Client?<span className="req">*</span>
                  </div>
                  <div className="row">
                    {[
                      { id: "entrepreneurship", label: "Entrepreneurship" },
                      { id: "client", label: "Client" },
                      { id: "both", label: "Both" },
                    ].map((opt) => (
                      <label className="pill" key={opt.id}>
                        <input
                          type="radio"
                          name="interest_type"
                          value={opt.id}
                          checked={formData.interest_type === opt.id}
                          onChange={(e) => setFormData((p) => ({ ...p, interest_type: e.target.value }))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <div className="help">Choose one. Selecting "Both" shows both sections.</div>
                </div>

                {/* Entrepreneurship & Client – side by side */}
                <div className="grid2">
                  <div className="section">
                    <div className="sectionTitle">Entrepreneurship – Business Opportunity</div>
                    {showEntrepreneurship ? (
                      <div className="choices">
                        {BUSINESS_OPPORTUNITIES.map((o) => (
                          <label className="pill" key={o.id}>
                            <input
                              type="checkbox"
                              checked={formData.business_opportunities.includes(o.id)}
                              onChange={() => toggleArray("business_opportunities", o.id)}
                            />
                            {o.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="help">Select "Entrepreneurship" or "Both" above to enable this section.</div>
                    )}
                  </div>

                  <div className="section">
                    <div className="sectionTitle">Client – Wealth Building Solutions</div>
                    {showClient ? (
                      <div className="choices">
                        {WEALTH_SOLUTIONS.map((o) => (
                          <label className="pill" key={o.id}>
                            <input
                              type="checkbox"
                              checked={formData.wealth_solutions.includes(o.id)}
                              onChange={() => toggleArray("wealth_solutions", o.id)}
                            />
                            {o.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="help">Select "Client" or "Both" above to enable this section.</div>
                    )}
                  </div>
                </div>

                {/* Personal Info */}
                <div className="section">
                  <div className="sectionTitle">Personal Information</div>

                  <div className="grid2">
                    <div className="field">
                      <label>First Name<span className="req">*</span></label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData((p) => ({ ...p, first_name: e.target.value }))}
                        placeholder="First name"
                      />
                    </div>
                    <div className="field">
                      <label>Last Name<span className="req">*</span></label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData((p) => ({ ...p, last_name: e.target.value }))}
                        placeholder="Last name"
                      />
                    </div>
                  </div>

                  <div className="field" style={{ marginTop: 12 }}>
                    <label>Phone Number<span className="req">*</span></label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div className="field" style={{ marginTop: 12 }}>
                    <label>Email<span className="req">*</span></label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      placeholder="name@email.com"
                    />
                    {formData.email && !isValidEmail(formData.email) ? (
                      <div className="help" style={{ color: "var(--danger)" }}>
                        Please enter a valid email.
                      </div>
                    ) : null}
                  </div>

                  <div className="field" style={{ marginTop: 12 }}>
                    <label>Profession</label>
                    <input
                      type="text"
                      value={formData.profession}
                      onChange={(e) => setFormData((p) => ({ ...p, profession: e.target.value }))}
                      placeholder="Profession"
                    />
                  </div>
                </div>

                {/* ── HOW WOULD YOU LIKE TO CONNECT? ── */}
                <div className="section">
                  <div className="sectionTitle">
                    Ready to Take the Next Step?<span className="req">*</span>
                  </div>
                  <div className="help" style={{ marginBottom: 12 }}>
                    Choose how you'd like to move forward with us — schedule a live Zoom meeting or let us know your general availability.
                  </div>
                  <div className="row">
                    <label className={`connectionPill${connectionType === "zoom_meeting" ? " connectionPillActive" : ""}`}>
                      <input
                        type="radio"
                        name="connection_type"
                        value="zoom_meeting"
                        checked={connectionType === "zoom_meeting"}
                        onChange={() => { setConnectionType("zoom_meeting"); setSelectedSlot(""); }}
                      />
                      📅 Book a Live Zoom Meeting
                    </label>
                    <label className={`connectionPill${connectionType === "meeting_preference" ? " connectionPillActive" : ""}`}>
                      <input
                        type="radio"
                        name="connection_type"
                        value="meeting_preference"
                        checked={connectionType === "meeting_preference"}
                        onChange={() => setConnectionType("meeting_preference")}
                      />
                      🗓 Set My Meeting Preference
                    </label>
                  </div>
                </div>

                {/* ── ZOOM MEETING SLOT PICKER ── */}
                {connectionType === "zoom_meeting" && (
                  <div className="section">
                    <div className="sectionTitle">
                      When Can We Connect With You?<span className="req">*</span>
                    </div>
                    <div className="help" style={{ marginBottom: 10 }}>
                      Select one time slot below. All times are in <b>Central Time (CT)</b>.
                      Available: Mon–Fri 6–8 PM · Sat 10 AM–12 PM &amp; 4–6 PM · Sun 3–6 PM
                    </div>
                    <div className="field">
                      <select
                        value={selectedSlot}
                        onChange={(e) => setSelectedSlot(e.target.value)}
                      >
                        <option value="">— Select a date &amp; time slot —</option>
                        {availableSlots.map((slot) => (
                          <option value={slot.value} key={slot.value}>
                            {slot.shortDate} | {slot.timeLabel} CT
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedSlotInfo && (
                      <div style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        background: "#f0fdfa",
                        border: "1px solid var(--brand)",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "var(--brand-dark)",
                        fontWeight: 600,
                      }}>
                        ✅ Selected: {selectedSlotInfo.dateLabel} · {selectedSlotInfo.timeLabel} CT
                      </div>
                    )}
                  </div>
                )}

                {/* ── MEETING PREFERENCE (only when selected) ── */}
                {connectionType === "meeting_preference" && (
                  <div className="section">
                    <div className="sectionTitle">Meeting Preferences</div>

                    <div className="field">
                      <label>
                        Preferred Meeting Day (Select all that apply)<span className="req">*</span>
                      </label>
                      <div className="row">
                        {DAYS.map((d) => (
                          <label className="pill" key={d}>
                            <input
                              type="checkbox"
                              checked={formData.preferred_days.includes(d)}
                              onChange={() => toggleArray("preferred_days", d)}
                            />
                            {d}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid2" style={{ marginTop: 12 }}>
                      <div className="field">
                        <label>
                          Preferred Meeting Time<span className="req">*</span>
                        </label>
                        <div className="row">
                          {TIME.map((d) => (
                            <label className="pill" key={d}>
                              <input
                                type="checkbox"
                                checked={formData.preferred_time.includes(d)}
                                onChange={() => toggleArray("preferred_time", d)}
                              />
                              {d}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="field">
                        <label>
                          Referred By<span className="req">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.referred_by}
                          onChange={(e) => setFormData((p) => ({ ...p, referred_by: e.target.value }))}
                          placeholder="Name or source"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Referred By for Zoom meeting path */}
                {connectionType === "zoom_meeting" && (
                  <div className="section">
                    <div className="field">
                      <label>Referred By<span className="req">*</span></label>
                      <input
                        type="text"
                        value={formData.referred_by}
                        onChange={(e) => setFormData((p) => ({ ...p, referred_by: e.target.value }))}
                        placeholder="Name or source"
                      />
                    </div>
                  </div>
                )}

                <div className="actions">
                  <button className="btn" type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Registration"
                    )}
                  </button>

                  {!canSubmit ? (
                    <div className="help" style={{ marginTop: 10 }}>
                      Tip: required fields include interest type, at least one selection in the enabled section(s),
                      name, phone, email,
                      {connectionType === "zoom_meeting"
                        ? " a selected meeting slot,"
                        : connectionType === "meeting_preference"
                        ? " meeting day(s) and time,"
                        : " your connection preference,"}
                      {" "}and referred-by.
                    </div>
                  ) : null}

                  {error ? <div className="error">{error}</div> : null}
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              className="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CheckCircle2 className="successIcon" />
              <div className="h1" style={{ fontSize: 28, margin: "6px 0 8px" }}>
                You're all set - your registration is submitted!
              </div>
              <p className="sub1" style={{ margin: 0 }}>
                {emailSent ? (
                  connectionType === "zoom_meeting" ? (
                    <>
                      A confirmation email with your <b>Zoom meeting calendar invite</b> has been sent to{" "}
                      <b>{formData.email}</b>. Please check your inbox and add the event to your calendar.
                    </>
                  ) : (
                    <>
                      A confirmation email has been sent to <b>{formData.email}</b>. Please check your inbox or spam folder.
                    </>
                  )
                ) : (
                  <>Registration received! We weren't able to send your confirmation email yet, but we'll reach out to you soon.</>
                )}
              </p>
              {connectionType === "zoom_meeting" && selectedSlotInfo && (
                <div style={{
                  margin: "14px auto 0",
                  padding: "12px 16px",
                  background: "#f0fdfa",
                  border: "1px solid var(--brand)",
                  borderRadius: 12,
                  maxWidth: 480,
                  fontSize: 14,
                  color: "var(--brand-dark)",
                }}>
                  📅 <b>Your Zoom session:</b> {selectedSlotInfo.dateLabel} · {selectedSlotInfo.timeLabel} CT
                </div>
              )}
              <p className="sub2" style={{ marginTop: 10 }}>
                We'll reach out to you soon. Thanks for choosing <b>AnNa Financial Group</b>!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
