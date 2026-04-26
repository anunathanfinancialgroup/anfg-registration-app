import React, { useEffect, useMemo, useState } from "react";
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
const AUTO_RESET_SECONDS = 60;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function formatDisplayTime(hour) {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:00 ${period}`;
}

function formatLocalISO(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00:00`;
}

function generateAvailableSlots() {
  const slots = [];
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 42);

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor <= end) {
    const dow = cursor.getDay();
    let hours = [];
    if (dow >= 1 && dow <= 5) hours = [18, 19];
    else if (dow === 6) hours = [10, 11, 16, 17];
    else if (dow === 0) hours = [15, 16, 17];

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

const INITIAL_FORM = {
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
};

export default function RegistrationForm() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [connectionType, setConnectionType] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_RESET_SECONDS);
  const [error, setError] = useState("");

  const showEntrepreneurship = formData.interest_type === "entrepreneurship" || formData.interest_type === "both";
  const showClient = formData.interest_type === "client" || formData.interest_type === "both";

  const availableSlots = useMemo(() => generateAvailableSlots(), []);
  const selectedSlotInfo = useMemo(
    () => availableSlots.find((s) => s.value === selectedSlot) || null,
    [availableSlots, selectedSlot]
  );

  // Auto-reset countdown after successful submission
  useEffect(() => {
    if (!submitted) return;
    setCountdown(AUTO_RESET_SECONDS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); resetForm(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  function resetForm() {
    setFormData(INITIAL_FORM);
    setConnectionType("");
    setSelectedSlot("");
    setSubmitted(false);
    setError("");
    setCountdown(AUTO_RESET_SECONDS);
  }

  const canSubmit = useMemo(() => {
    const baseOk =
      formData.interest_type &&
      formData.first_name.trim() &&
      formData.last_name.trim() &&
      formData.phone.trim() &&
      isValidEmail(formData.email) &&
      connectionType;

    // Referred By is optional — no longer required

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
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...prev, [field]: Array.from(set) };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!canSubmit) { setError("Please complete all required fields before submitting."); return; }

    try {
      setSubmitting(true);

      const payload = {
        ...formData,
        connection_type: connectionType,
        // Always send non-empty preferred_days + preferred_time so the edge function
        // (whether old or new deployment) never rejects on those fields.
        preferred_days:
          connectionType === "zoom_meeting"
            ? ["Zoom Session"]
            : formData.preferred_days,
        // Always send a non-empty preferred_time so the edge function never
        // sees a missing/empty value, regardless of connection type.
        preferred_time:
          connectionType === "zoom_meeting"
            ? "Zoom Meeting"
            : formData.preferred_time.length > 0
              ? formData.preferred_time.join(", ")
              : "Not specified",
        // referred_by defaults to "Direct" if blank (edge function requires non-empty)
        referred_by: formData.referred_by.trim() || "Direct",
        selected_slot: selectedSlot || null,
        selected_slot_label: selectedSlotInfo ? selectedSlotInfo.timeLabel : null,
        selected_slot_date: selectedSlotInfo ? selectedSlotInfo.dateLabel : null,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        profession: formData.profession.trim(),
      };

      const { data, error: fnError } = await supabase.functions.invoke("register", {
        body: payload,
      });

      if (fnError) {
        // Try to extract the real error message from the response body
        let msg = fnError.message;
        try {
          const ctx = await fnError.context?.json?.();
          if (ctx?.error) msg = ctx.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (!data?.ok) throw new Error(data?.error || "Submission failed.");

      setSubmitted(true);
    } catch (err) {
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
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center", marginTop: "32px", marginBottom: "0px", minHeight: "140px",
                }}>
                  <div />
                  <img src={logo} alt="AnNa Financial Group" style={{
                    height: "clamp(100px, 13vw, 150px)", width: "auto",
                    objectFit: "contain", display: "block", background: "transparent",
                  }} />
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <img src={agentPhoto} alt="Financial Agent" style={{
                      height: "clamp(100px, 13vw, 150px)", width: "auto",
                      objectFit: "contain", objectPosition: "top center",
                      background: "transparent", display: "block",
                    }} />
                  </div>
                </div>
                <h1 style={{ fontSize: "23px", fontWeight: "bold", color: "#0f172a", margin: "0 0 10px 0", lineHeight: 1.2, textAlign: "center" }}>
                  Get Started - Registration
                </h1>
                <p className="sub2 text-base md:text-lg text-slate-700 mb-4">
                  We're excited to connect with you and introduce an opportunity that combines purpose with prosperity.
                </p>
                <p className="sub2 text-base md:text-lg text-slate-700 mb-6">
                  At <b>AnNa Financial Group</b>, you'll help families secure their tomorrow and advance your career with unlimited potential.
                </p>
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 mb-6 mx-auto max-w-4xl">
                  <p className="sub2 text-sm md:text-base text-slate-800 text-center">✅ <b>Be your own boss</b> ✅ <b>Flexible schedule</b></p>
                  <p className="sub2 text-sm md:text-base text-slate-800 text-center">✅ <b>Unlimited income potential</b> ✅ <b>Make an impact</b></p>
                </div>
              </div>

              <form className="cardBody" onSubmit={handleSubmit}>
                {/* Interest Type */}
                <div className="section">
                  <div className="sectionTitle">Interested In Business/Client?<span className="req">*</span></div>
                  <div className="row">
                    {[
                      { id: "entrepreneurship", label: "Entrepreneurship" },
                      { id: "client", label: "Client" },
                      { id: "both", label: "Both" },
                    ].map((opt) => (
                      <label className="pill" key={opt.id}>
                        <input type="radio" name="interest_type" value={opt.id}
                          checked={formData.interest_type === opt.id}
                          onChange={(e) => setFormData((p) => ({ ...p, interest_type: e.target.value }))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <div className="help">Choose one. Selecting "Both" shows both sections.</div>
                </div>

                {/* Entrepreneurship & Client */}
                <div className="grid2">
                  <div className="section">
                    <div className="sectionTitle">Entrepreneurship – Business Opportunity</div>
                    {showEntrepreneurship ? (
                      <div className="choices">
                        {BUSINESS_OPPORTUNITIES.map((o) => (
                          <label className="pill" key={o.id}>
                            <input type="checkbox"
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
                            <input type="checkbox"
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
                      <input type="text" value={formData.first_name}
                        onChange={(e) => setFormData((p) => ({ ...p, first_name: e.target.value }))}
                        placeholder="First name" />
                    </div>
                    <div className="field">
                      <label>Last Name<span className="req">*</span></label>
                      <input type="text" value={formData.last_name}
                        onChange={(e) => setFormData((p) => ({ ...p, last_name: e.target.value }))}
                        placeholder="Last name" />
                    </div>
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>Phone Number<span className="req">*</span></label>
                    <input type="tel" value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="(555) 123-4567" />
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>Email<span className="req">*</span></label>
                    <input type="email" value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      placeholder="name@email.com" />
                    {formData.email && !isValidEmail(formData.email) ? (
                      <div className="help" style={{ color: "var(--danger)" }}>Please enter a valid email.</div>
                    ) : null}
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>Profession</label>
                    <input type="text" value={formData.profession}
                      onChange={(e) => setFormData((p) => ({ ...p, profession: e.target.value }))}
                      placeholder="Profession" />
                  </div>
                </div>

                {/* Connection Type */}
                <div className="section">
                  <div className="sectionTitle">Ready to Take the Next Step?<span className="req">*</span></div>
                  <div className="help" style={{ marginBottom: 12 }}>
                    Choose how you'd like to move forward — schedule a live Zoom meeting or let us know your general availability.
                  </div>
                  <div className="row">
                    <label className={`connectionPill${connectionType === "zoom_meeting" ? " connectionPillActive" : ""}`}>
                      <input type="radio" name="connection_type" value="zoom_meeting"
                        checked={connectionType === "zoom_meeting"}
                        onChange={() => { setConnectionType("zoom_meeting"); setSelectedSlot(""); }}
                      />
                      📅 Book a Live Zoom Meeting
                    </label>
                    <label className={`connectionPill${connectionType === "meeting_preference" ? " connectionPillActive" : ""}`}>
                      <input type="radio" name="connection_type" value="meeting_preference"
                        checked={connectionType === "meeting_preference"}
                        onChange={() => setConnectionType("meeting_preference")}
                      />
                      🗓 Set My Meeting Preference
                    </label>
                  </div>
                </div>

                {/* Zoom Slot Picker */}
                {connectionType === "zoom_meeting" && (
                  <div className="section">
                    <div className="sectionTitle">When Can We Connect With You?<span className="req">*</span></div>
                    <div className="help" style={{ marginBottom: 10 }}>
                      All times are in <b>Central Time (CT)</b>. Available: Mon–Fri 6–8 PM · Sat 10 AM–12 PM &amp; 4–6 PM · Sun 3–6 PM
                    </div>
                    <div className="field">
                      <select value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)}>
                        <option value="">— Select a date &amp; time slot —</option>
                        {availableSlots.map((slot) => (
                          <option value={slot.value} key={slot.value}>
                            {slot.shortDate} | {slot.timeLabel} CT
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedSlotInfo && (
                      <div style={{ marginTop: 10, padding: "8px 12px", background: "#f0fdfa",
                        border: "1px solid var(--brand)", borderRadius: 10, fontSize: 13,
                        color: "var(--brand-dark)", fontWeight: 600 }}>
                        ✅ Selected: {selectedSlotInfo.dateLabel} · {selectedSlotInfo.timeLabel} CT
                      </div>
                    )}
                  </div>
                )}

                {/* Meeting Preference */}
                {connectionType === "meeting_preference" && (
                  <div className="section">
                    <div className="sectionTitle">Meeting Preferences</div>
                    <div className="field">
                      <label>Preferred Meeting Day (Select all that apply)<span className="req">*</span></label>
                      <div className="row">
                        {DAYS.map((d) => (
                          <label className="pill" key={d}>
                            <input type="checkbox"
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
                        <label>Preferred Meeting Time<span className="req">*</span></label>
                        <div className="row">
                          {TIME.map((d) => (
                            <label className="pill" key={d}>
                              <input type="checkbox"
                                checked={formData.preferred_time.includes(d)}
                                onChange={() => toggleArray("preferred_time", d)}
                              />
                              {d}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label>Referred By</label>
                        <input type="text" value={formData.referred_by}
                          onChange={(e) => setFormData((p) => ({ ...p, referred_by: e.target.value }))}
                          placeholder="Name or source (optional)" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Referred By – Zoom path (optional) */}
                {connectionType === "zoom_meeting" && (
                  <div className="section">
                    <div className="field">
                      <label>Referred By</label>
                      <input type="text" value={formData.referred_by}
                        onChange={(e) => setFormData((p) => ({ ...p, referred_by: e.target.value }))}
                        placeholder="Name or source (optional)" />
                    </div>
                  </div>
                )}

                <div className="actions">
                  <button className="btn" type="submit" disabled={submitting}>
                    {submitting ? (
                      <><Loader2 size={18} className="spin" /> Submitting...</>
                    ) : "Submit Registration"}
                  </button>

                  {!canSubmit && (
                    <div className="help" style={{ marginTop: 10 }}>
                      Required: interest type, selections for enabled section(s), name, phone, email
                      {connectionType === "zoom_meeting"
                        ? ", and a selected Zoom time slot"
                        : connectionType === "meeting_preference"
                        ? ", preferred day(s) and time"
                        : ", and your connection preference"}.
                    </div>
                  )}

                  {error ? <div className="error">{error}</div> : null}
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div key="success" className="success"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            >
              <CheckCircle2 className="successIcon" />
              <div className="h1" style={{ fontSize: 28, margin: "6px 0 8px" }}>
                You're all set — registration submitted!
              </div>

              <p className="sub1" style={{ margin: 0 }}>
                {connectionType === "zoom_meeting" ? (
                  <>A confirmation email with your <b>Zoom meeting invite</b> has been sent to <b>{formData.email}</b>.</>
                ) : (
                  <>A confirmation email has been sent to <b>{formData.email}</b>. Check your inbox or spam folder.</>
                )}
              </p>

              {connectionType === "zoom_meeting" && selectedSlotInfo && (
                <div style={{ margin: "14px auto 0", padding: "12px 16px", background: "#f0fdfa",
                  border: "1px solid var(--brand)", borderRadius: 12, maxWidth: 480,
                  fontSize: 14, color: "var(--brand-dark)" }}>
                  📅 <b>Your Zoom session:</b> {selectedSlotInfo.dateLabel} · {selectedSlotInfo.timeLabel} CT
                </div>
              )}

              <p className="sub2" style={{ marginTop: 10 }}>
                We'll reach out to you soon. Thanks for choosing <b>AnNa Financial Group</b>!
              </p>

              {/* Auto-reset countdown + manual button */}
              <div style={{ marginTop: 24 }}>
                <button
                  className="btn"
                  style={{ maxWidth: 280, margin: "0 auto" }}
                  onClick={resetForm}
                >
                  🔄 Connect Again
                </button>
                <div className="help" style={{ marginTop: 10 }}>
                  Returning to the form in <b>{countdown}s</b>…
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
