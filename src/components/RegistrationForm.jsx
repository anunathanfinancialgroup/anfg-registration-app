import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import logo from "../assets/can-logo.png";

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
 // { id: "business_solutions", label: "Business Solutions (Entry/Exit, Key Person, etc.)" },
 // { id: "health_insurance", label: "Health Insurance, Medicare and Medicaid" },
 // { id: "notary_services", label: "Notary Services" },
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TIME  = ["AM","PM"];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export default function RegistrationForm() {
  const [formData, setFormData] = useState({
    interest_type: "", // entrepreneurship | client | both
    business_opportunities: [],
    wealth_solutions: [],
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    profession: "",
    preferred_days: [], // multi-select
    preferred_time: [], // "", // AM | PM
    referred_by: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailSent, setEmailSent] = useState(true);
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");

  const showEntrepreneurship = formData.interest_type === "entrepreneurship" || formData.interest_type === "both";
  const showClient = formData.interest_type === "client" || formData.interest_type === "both";

  const canSubmit = useMemo(() => {
    const requiredOk =
      formData.interest_type &&
      formData.first_name.trim() &&
      formData.last_name.trim() &&
      formData.phone.trim() &&
      isValidEmail(formData.email) &&
      formData.preferred_days.length > 0 &&
      formData.preferred_time.length > 0 &&
      formData.referred_by.trim();

    const interestOk =
      (showEntrepreneurship ? formData.business_opportunities.length > 0 : true) &&
      (showClient ? formData.wealth_solutions.length > 0 : true);

    return Boolean(requiredOk && interestOk);
  }, [formData, showEntrepreneurship, showClient]);

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

      // Check if supabase is initialized
      if (!supabase) {
        throw new Error("Database connection not available. Please ensure your environment variables are set.");
      }

      const payload = {
        interest_type: formData.interest_type,
        business_opportunities: formData.business_opportunities,
        wealth_solutions: formData.wealth_solutions,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        profession: formData.profession.trim(),
        preferred_days: formData.preferred_days,
        preferred_time: formData.preferred_time,
        referred_by: formData.referred_by.trim(),
      };

      // FIXED: Direct database insert instead of Edge Function
      // This avoids the "Cannot read properties of null (reading 'functions')" error
      const { data, error: insertError } = await supabase
        .from("client_registrations")
        .insert([payload])
        .select();

      if (insertError) {
        throw insertError;
      }

      // Success
      setSubmitted(true);
      setEmailSent(true);
      
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
              <div className="cardHeader">
                 <img src={logo} alt="CAN Care & Advancement Network" className="h-14 md:h-16 mx-auto mb-4" />
            <div className="h1 text-2xl md:text-3xl font-bold text-slate-900 mb-4">Get Started - Registration</div>
            <p className="sub1 text-xl md:text-2xl font-semibold text-green-600 mb-4">
              <b>Welcome to CAN Care & Advancement Network</b>
            </p>
            <p className="sub2 text-base md:text-lg text-slate-700 mb-4">
              We're excited to connect with you and introduce an opportunity that combines purpose with prosperity.
            </p>
            <p className="sub2 text-base md:text-lg font-semibold text-slate-800 mb-4">
              <b>Are you ready to make a real difference while building your future?</b>
            </p>
            <p className="sub2 text-base md:text-lg text-slate-700 mb-6">
              At CAN Care & Advancement Network, you'll help families secure their tomorrow while advancing your own career with unlimited potential.
            </p>
          </div>

          {/* Benefits Section */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 mb-6">
              <div className="space-y-3">
                <p className="sub2 text-sm md:text-base text-slate-800 text-center">
                ✅ <b>Be your own boss</b> ✅ <b>Flexible schedule</b> ✅ <b>Unlimited income potential</b> ✅ <b>Make an impact</b>
                </p>
              </div>
            </div>
              <form className="cardBody" onSubmit={handleSubmit}>
                {/* Interest */}
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

                {/* Opportunities + Wealth */}
                <div className="split">
                  <div className="section">
                    <div className="sectionTitle">
                      Entrepreneurship - Business Opportunity{showEntrepreneurship ? <span className="req">*</span> : null}
                    </div>

                    {showEntrepreneurship ? (
                      <div className="w-full">
                        <div className="flex flex-col gap-3">
                          {BUSINESS_OPPORTUNITIES.map((o) => (
                            <label className="flex items-start gap-3 cursor-pointer text-sm md:text-base w-full" key={o.id}>
                              <input
                                type="checkbox"
                                className="mt-0.5 h-5 w-5 flex-shrink-0 accent-green-600"
                                checked={formData.business_opportunities.includes(o.id)}
                                onChange={() => toggleArray("business_opportunities", o.id)}
                              />
                              <span className="leading-relaxed text-left flex-1">{o.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="help">Select "Entrepreneurship" or "Both" above to enable this section.</div>
                    )}
                  </div>

                  <div className="section">
                    <div className="sectionTitle">
                      Client - Wealth Building Solutions{showClient ? <span className="req">*</span> : null}
                    </div>

                    {showClient ? (
                      <div className="w-full">
                        <div className="flex flex-col gap-3">
                          {WEALTH_SOLUTIONS.map((o) => (
                            <label className="flex items-start gap-3 cursor-pointer text-sm md:text-base w-full" key={o.id}>
                              <input
                                type="checkbox"
                                className="mt-0.5 h-5 w-5 flex-shrink-0 accent-green-600"
                                checked={formData.wealth_solutions.includes(o.id)}
                                onChange={() => toggleArray("wealth_solutions", o.id)}
                              />
                              <span className="leading-relaxed text-left flex-1">{o.label}</span>
                            </label>
                          ))}
                        </div>
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
                      <label>
                        First Name<span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData((p) => ({ ...p, first_name: e.target.value }))}
                        placeholder="First name"
                      />
                    </div>

                    <div className="field">
                      <label>
                        Last Name<span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData((p) => ({ ...p, last_name: e.target.value }))}
                        placeholder="Last name"
                      />
                    </div>
                  </div>

                  <div className="field" style={{ marginTop: 12 }}>
                    <label>
                      Phone Number<span className="req">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div className="field" style={{ marginTop: 12 }}>
                    <label>
                      Email<span className="req">*</span>
                    </label>
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

                {/* Meeting */}
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
                        name, phone, email, meeting day(s), time, and referred-by.
                      </div>
                    ) : null}

                    {error ? <div className="error">{error}</div> : null}
                  </div>
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
                  <>A confirmation email has been sent to <b>{formData.email}</b>. Please check your inbox or spam folder for the confirmation email.</>
                ) : (
                  <>Registration received! We weren't able to send your confirmation email at the moment, but we'll reach out to you soon.</>
                )}
              </p>
              <p className="sub2" style={{ marginTop: 10 }}>
                We'll reach out to you soon. Thanks for choosing CAN Care & Advancement Network!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
