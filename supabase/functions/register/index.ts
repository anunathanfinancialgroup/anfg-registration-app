import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Payload = {
  interest_type: string;
  business_opportunities: string[];
  wealth_solutions: string[];
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  profession?: string;
  preferred_days: string[];
  preferred_time?: string | string[];
  referred_by: string;
  connection_type?: "zoom_meeting" | "meeting_preference";
  selected_slot?: string;        // local ISO "2025-05-05T18:00:00"
  selected_slot_label?: string;  // "6:00 PM – 7:00 PM"
  selected_slot_date?: string;   // "Monday, May 5, 2025"
};

const BUSINESS_OPPORTUNITY_LABELS: Record<string, string> = {
  financial_freedom: "Financial and Time Freedom",
  own_business: "Owning Your Own Business (No Business Experience Required)",
  successful_entrepreneur: "Becoming a Successful Entrepreneur",
  million_income: "Million Dollar Income (Dreamer)",
};

const WEALTH_SOLUTION_LABELS: Record<string, string> = {
  protection_planning: "Protection Planning",
  investment_planning: "Investment Planning",
  lifetime_income: "Lifetime Income, Guaranteed Income Stream",
  will_trust: "Will & Trust (W&T), Estate Planning",
  college_tuition: "College Tuition Planning",
  tax_optimization: "Tax Optimization",
  retirement: "Retirement",
  legacy: "Legacy",
};

function escapeHtml(input: string) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function labelsFor(ids: string[] | null | undefined, labels: Record<string, string>) {
  return (ids ?? []).map((id) => labels[id] ?? id);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function titleCase(x: string) {
  if (!x) return x;
  return x.charAt(0).toUpperCase() + x.slice(1);
}

// ── ICS line folding (RFC 5545 §3.1) ─────────────────────────────────────────
// Lines must be ≤75 octets. Longer lines are folded with CRLF + single SPACE.
function foldICSLine(line: string): string {
  const MAXLEN = 75;
  if (line.length <= MAXLEN) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, MAXLEN));
  let pos = MAXLEN;
  while (pos < line.length) {
    // continuation lines start with a space (counts as 1 char), so max content = 74
    chunks.push(" " + line.slice(pos, pos + 74));
    pos += 74;
  }
  return chunks.join("\r\n");
}

// ── Google Calendar URL ───────────────────────────────────────────────────────
// Both Chidam AND the client are added as guests via the 'add' param so that
// whoever clicks the button sees the other person pre-filled in the guest list.
function buildGoogleCalendarUrl(slotLocalISO: string, clientEmail = ""): string {
  try {
    const [datePart, timePart] = slotLocalISO.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour] = timePart.split(":").map(Number);
    const pad = (n: number) => String(n).padStart(2, "0");
    const offsetHours = (month >= 3 && month <= 11) ? 5 : 6;
    const startUTC = new Date(Date.UTC(year, month - 1, day, hour + offsetHours, 0, 0));
    const endUTC   = new Date(Date.UTC(year, month - 1, day, hour + offsetHours + 1, 0, 0));
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: "Exclusive 360° Financial Solutions Meeting | AnNa Financial Group",
      dates: `${fmt(startUTC)}/${fmt(endUTC)}`,
      details: "Join our Zoom Meeting:\nhttps://us04web.zoom.us/j/9106338447?pwd=nmoPE8D31WH31nxBduZe7ihbrGToPy.1\n\nMeeting ID: 910 633 8447\nPasscode: AnNaFG2026",
      location: "https://us04web.zoom.us/j/9106338447?pwd=nmoPE8D31WH31nxBduZe7ihbrGToPy.1",
    });
    // Always add Chidam so client sees him as a guest when they click the button
    params.append("add", "chidam.alagar@gmail.com");
    // Also add the client so Chidam sees them when he clicks his copy
    if (clientEmail) params.append("add", clientEmail);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch {
    return "https://calendar.google.com";
  }
}

// ── ICS calendar invite ───────────────────────────────────────────────────────
// ORGANIZER = chidam.alagar@gmail.com  → event lives on Chidam's Google Calendar
// ATTENDEE  = client email             → client sees Accept / Decline buttons
// METHOD:REQUEST  → Gmail renders Yes/No/Maybe buttons automatically
// Line folding applied to every property so no line exceeds 75 octets (RFC 5545)
// DESCRIPTION uses ICS escape: \n = literal backslash-n (newline in calendar app)
function buildICSInvite(slotLocalISO: string, clientEmail: string, clientName: string): string {
  try {
    const [datePart, timePart] = slotLocalISO.split("T");
    const [year, month, day]   = datePart.split("-").map(Number);
    const [hour]               = timePart.split(":").map(Number);
    const pad = (n: number) => String(n).padStart(2, "0");
    const offsetHours = (month >= 3 && month <= 11) ? 5 : 6;
    const startUTC = new Date(Date.UTC(year, month - 1, day, hour + offsetHours, 0, 0));
    const endUTC   = new Date(Date.UTC(year, month - 1, day, hour + offsetHours + 1, 0, 0));
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
    const uid = `zoom-${startUTC.getTime()}@annafg.com`;

    // ICS lines — each one is folded individually before joining with CRLF
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AnNa Financial Group//NONSGML v1.0//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(startUTC)}`,
      `DTEND:${fmt(endUTC)}`,
      // SUMMARY: plain text title shown in the calendar event
      "SUMMARY:Exclusive 360 Financial Solutions Meeting | AnNa Financial Group",
      // DESCRIPTION: \n = ICS line-break (renders as newline in calendar app)
      "DESCRIPTION:Join our Zoom Meeting:\n" +
        "https://us04web.zoom.us/j/9106338447?pwd=nmoPE8D31WH31nxBduZe7ihbrGToPy.1\n\n" +
        "Meeting ID: 910 633 8447\n" +
        "Passcode: AnNaFG2026",
      // LOCATION: shown as the map/link pin in the calendar event
      "LOCATION:https://us04web.zoom.us/j/9106338447?pwd=nmoPE8D31WH31nxBduZe7ihbrGToPy.1",
      // ORGANIZER must match the Google account that owns the event
      "ORGANIZER;CN=Chidam Alagar:mailto:chidam.alagar@gmail.com",
      // ATTENDEE gets Accept/Decline/Maybe buttons in Gmail
      `ATTENDEE;CN=${clientName};RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:mailto:${clientEmail}`,
      "STATUS:CONFIRMED",
      "SEQUENCE:0",
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder: AnNa Financial Group Zoom Meeting in 30 minutes",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    // Fold every line to ≤75 octets then join with CRLF as required by RFC 5545
    return lines.map(foldICSLine).join("\r\n");
  } catch {
    return "";
  }
}

// Zoom invite email using the provided branded template
function buildZoomInviteEmail(
  firstName: string,
  lastName: string,
  slotDate: string,
  slotLabel: string,
  slotLocalISO: string,
  logoUrl: string,
  clientEmail = ""
): string {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="AnNa Financial Group" style="max-width:160px;height:auto;margin-bottom:10px;" />`
    : "";

  const gcalUrl = slotLocalISO ? buildGoogleCalendarUrl(slotLocalISO, clientEmail) : "";

  return `<!doctype html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6;margin:0;padding:0;">
    <div style="max-width:640px;margin:0 auto;padding:28px 22px;">

      <div style="text-align:center;margin-bottom:24px;">
        ${logoHtml}
        <h2 style="margin:8px 0 4px;font-size:20px;color:#0f172a;">
          You're Invited &ndash; Exclusive 360&deg; Financial Solutions Meeting
        </h2>
        <div style="color:#14b8a6;font-weight:700;font-size:14px;letter-spacing:0.04em;">
          AnNa Financial Group
        </div>
      </div>

      <p>Dear <b>${escapeHtml(firstName)} ${escapeHtml(lastName)}</b>,</p>

      <p>I hope this message finds you well! I'd love to connect with you for a complimentary <b>Financial Solutions Meeting</b> designed specifically with you and your family in mind.</p>

      <p style="font-weight:700;margin-bottom:6px;">During our session, we'll explore:</p>
      <p style="margin:6px 0;">&#x2705; <b>Business Entrepreneurship Opportunities</b> &ndash; Discover pathways to grow or launch your own venture</p>
      <p style="margin:6px 0;">&#x2705; <b>360&deg; Financial Solutions</b> &ndash; A comprehensive approach covering protection, wealth-building, and planning</p>
      <p style="margin:6px 0;">&#x2705; <b>Family Protection Strategies</b> &ndash; Ensuring your loved ones are financially secure no matter what life brings</p>

      <p>This is a <b>no-obligation conversation</b> &mdash; my goal is simply to understand your vision and share tools that can help you achieve it.</p>

      ${slotDate && slotLabel ? `
      <div style="background:#f0fdf9;border:1px solid #14b8a6;border-radius:12px;padding:14px 16px;margin:18px 0;">
        <div style="font-weight:700;font-size:15px;color:#0f766e;margin-bottom:4px;">&#x1F4C5; Your Scheduled Meeting</div>
        <div style="font-size:14px;color:#0f172a;">${escapeHtml(slotDate)}</div>
        <div style="font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(slotLabel)} Central Time (CT)</div>
        ${gcalUrl ? `<div style="margin-top:10px;"><a href="${gcalUrl}" style="display:inline-block;background:#14b8a6;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">&#x1F4C5; Add to Google Calendar</a></div>` : ""}
      </div>` : ""}

      <div style="background:#f0f9ff;border:1px solid #0ea5e9;border-radius:12px;padding:16px 18px;margin:18px 0;">
        <div style="text-align:center;font-weight:700;font-size:15px;color:#0369a1;margin-bottom:12px;">
          &#x2015;&#x2015;&#x2015;&#x2015;&#x2015;&#x2015;&#x2015;&#x2015;&#x2015;<br/>
          &#x1F4C5; JOIN OUR ZOOM MEETING<br/>
          &#x2015;&#x2015;&#x2015;&#x2015;&#x2015;&#x2015;&#x2015;&#x2015;&#x2015;
        </div>
        <div style="margin:6px 0;font-size:14px;">
          &#x1F449; <b>Click to Join:</b>
          <a href="https://us04web.zoom.us/j/9106338447?pwd=nmoPE8D31WH31nxBduZe7ihbrGToPy.1" style="color:#0369a1;">
            https://us04web.zoom.us/j/9106338447
          </a>
        </div>
        <div style="margin:4px 0;font-size:14px;">&#x1F4CB; <b>Meeting ID:</b> 910 633 8447</div>
        <div style="margin:4px 0;font-size:14px;">&#x1F511; <b>Passcode:</b> AnNaFG2026</div>
      </div>

      <p>I look forward to being a trusted partner on your financial journey. Please feel free to reply or call me directly to confirm your spot or ask any questions.</p>

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;">Warm regards,<br/>
        <b>Chidam Alagar</b><br/>
        Financial Solutions Advisor<br/>
        AnNa Financial Group | Leander, TX</p>
      </div>
    </div>
  </body>
</html>`;
}

// Standard registration confirmation email
function buildRegistrationEmail(
  firstName: string,
  lastName: string,
  interestTypeFormatted: string,
  payload: {
    preferred_days: string[];
    preferred_time?: string | null;
    referred_by: string;
    phone: string;
    email: string;
    profession?: string;
    business_opportunities: string[];
    wealth_solutions: string[];
  },
  showEntrepreneurship: boolean,
  showClient: boolean,
  fromName: string,
  logoUrl: string
): string {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="AnNa Financial Group" style="max-width:160px;height:auto;margin-bottom:10px;" />`
    : "";

  return `<!doctype html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.2;">
    <div style="max-width:640px;margin:0 auto;padding:22px;">
      <div style="text-align:center;margin-bottom:18px;">
        ${logoHtml}
        <h2 style="margin:0;">Registration Confirmation</h2>
        <div style="color:#475569;font-size:13px;margin-top:6px;">We're excited to connect with you!</div>
      </div>
      <p>Dear <b>${escapeHtml(firstName)} ${escapeHtml(lastName)}</b>,</p>
      <p>Thank you for registering with <b>${escapeHtml(fromName)}</b>. We received your information and will contact you shortly.</p>
      <div style="background:#f8fafc;border-left:4px solid #14b8a6;padding:12px 14px;border-radius:10px;">
        <div style="font-weight:bold;margin-bottom:6px;">Summary</div>
        <div><b>Interested In:</b> ${interestTypeFormatted}</div>
        <div><b>Preferred Days:</b> ${(payload.preferred_days || []).join(", ")}</div>
        ${payload.preferred_time ? `<div><b>Preferred Time:</b> ${escapeHtml(payload.preferred_time)}</div>` : ""}
        <div><b>Referred By:</b> ${escapeHtml(payload.referred_by)}</div>
      </div>
      <p style="margin-top:16px;"><b>Phone:</b> ${escapeHtml(payload.phone)}<br/>
      <b>Email:</b> ${escapeHtml(payload.email)}${payload.profession ? `<br/><b>Profession:</b> ${escapeHtml(payload.profession)}` : ""}</p>
      ${showEntrepreneurship ? `<div style="margin-top:16px;">
        <div style="font-weight:bold;">Entrepreneurship - Business Opportunity</div>
        <ul style="margin:8px 0 0 18px;">${labelsFor(payload.business_opportunities, BUSINESS_OPPORTUNITY_LABELS).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </div>` : ""}
      ${showClient ? `<div style="margin-top:16px;">
        <div style="font-weight:bold;">Client - Wealth Building Solutions</div>
        <ul style="margin:8px 0 0 18px;">${labelsFor(payload.wealth_solutions, WEALTH_SOLUTION_LABELS).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </div>` : ""}
      <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;color:#475569;">
        Regards,<br/><b>${escapeHtml(fromName)}</b>
      </div>
    </div>
  </body>
</html>`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    let body: Payload;
    try {
      body = (await req.json()) as Payload;
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionType = body.connection_type ?? "meeting_preference";
    const isZoomMeeting = connectionType === "zoom_meeting";

    // ── Validate base fields ──────────────────────────────────────────────────
    const missing: string[] = [];
    for (const k of ["interest_type", "first_name", "last_name", "phone", "email"]) {
      // deno-lint-ignore no-explicit-any
      const v = (body as any)[k];
      if (!v || String(v).trim() === "") missing.push(k);
    }

    if (body.email && !isValidEmail(body.email)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isZoomMeeting) {
      // Zoom path: only a selected_slot is required.
      // preferred_time is NOT validated here — it is always set to "Zoom Meeting" below.
      if (!body.selected_slot || String(body.selected_slot).trim() === "") missing.push("selected_slot");
    } else {
      // Meeting-preference path: both preferred_days and preferred_time are required.
      if (!Array.isArray(body.preferred_days) || body.preferred_days.length === 0) missing.push("preferred_days");
      const pt = body.preferred_time;
      if (!pt || (Array.isArray(pt) ? pt.length === 0 : String(pt).trim() === "")) missing.push("preferred_time");
    }

    if (missing.length) {
      return new Response(JSON.stringify({ ok: false, error: `Missing fields: ${missing.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const interestType = String(body.interest_type || "").toLowerCase();
    const showEntrepreneurship = interestType === "entrepreneurship" || interestType === "both";
    const showClient = interestType === "client" || interestType === "both";

    if (showEntrepreneurship && (!Array.isArray(body.business_opportunities) || body.business_opportunities.length === 0)) {
      return new Response(JSON.stringify({ ok: false, error: "Select at least one entrepreneurship option" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (showClient && (!Array.isArray(body.wealth_solutions) || body.wealth_solutions.length === 0)) {
      return new Response(JSON.stringify({ ok: false, error: "Select at least one wealth solution option" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Environment ───────────────────────────────────────────────────────────
    const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MAILJET_API_KEY    = Deno.env.get("MAILJET_API_KEY")!;
    const MAILJET_SECRET_KEY = Deno.env.get("MAILJET_SECRET_KEY")!;
    const FROM_EMAIL         = Deno.env.get("FROM_EMAIL")!;
    const FROM_NAME          = Deno.env.get("FROM_NAME") ?? "AnNa Financial Group";
    const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
    const LOGO_URL           = Deno.env.get("LOGO_URL") ?? "";
    const BCC_EMAIL          = Deno.env.get("BCC_EMAIL") ?? "";

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // preferred_time: for zoom meetings always use "Zoom Meeting" regardless of what
    // the client sends, so we never hit a missing/null value on insert.
    const preferredTimeNorm: string = isZoomMeeting
      ? "Zoom Meeting"
      : Array.isArray(body.preferred_time)
        ? body.preferred_time.join(", ")
        : (body.preferred_time ? String(body.preferred_time) : "");

    const firstName   = String(body.first_name).trim();
    const lastName    = String(body.last_name).trim();
    const email       = String(body.email).trim();
    const clientFullName = `${firstName} ${lastName}`;

    // ── DB Insert (with fallback if migration 002 not yet applied) ────────────
    // BOP_Date: stores the confirmed Zoom slot as a timestamptz value.
    // BOP_Status: set to 'In-Progress' once a Zoom meeting is successfully booked.
    const bopDate: string | null = isZoomMeeting && body.selected_slot
      ? body.selected_slot   // local ISO e.g. "2025-05-05T18:00:00" — Postgres casts to timestamptz
      : null;
    const bopStatus: string | null = isZoomMeeting ? "In-Progress" : null;

    const fullPayload = {
      status: "new",
      interest_type: interestType,
      business_opportunities: body.business_opportunities ?? [],
      wealth_solutions: body.wealth_solutions ?? [],
      first_name: firstName,
      last_name: lastName,
      phone: String(body.phone).trim(),
      email,
      profession: String(body.profession ?? "").trim(),
      preferred_days: body.preferred_days ?? [],
      preferred_time: preferredTimeNorm,
      referred_by: String(body.referred_by).trim(),
      connection_type: connectionType,
      selected_slot: body.selected_slot ?? null,
      selected_slot_label: body.selected_slot_label ?? null,
      // BOP fields — only populated for confirmed Zoom bookings
      BOP_Date: bopDate,
      BOP_Status: bopStatus,
    };

    let { error: dbErr } = await supabase.from("client_registrations").insert(fullPayload);

    if (dbErr) {
      // Fallback: newer columns (connection_type, selected_slot, BOP_Date, BOP_Status)
      // may not exist in older migrations — retry with only the base columns.
      console.error("Full insert failed, trying base payload:", dbErr.message);
      const basePayload = {
        status: fullPayload.status,
        interest_type: fullPayload.interest_type,
        business_opportunities: fullPayload.business_opportunities,
        wealth_solutions: fullPayload.wealth_solutions,
        first_name: fullPayload.first_name,
        last_name: fullPayload.last_name,
        phone: fullPayload.phone,
        email: fullPayload.email,
        profession: fullPayload.profession,
        preferred_days: fullPayload.preferred_days,
        preferred_time: fullPayload.preferred_time,
        referred_by: fullPayload.referred_by,
        // BOP_Date and BOP_Status intentionally omitted — not present in older schemas
      };
      const fallback = await supabase.from("client_registrations").insert(basePayload);
      dbErr = fallback.error;
    }

    if (dbErr) {
      console.error("DB insert failed:", dbErr.message);
      return new Response(JSON.stringify({ ok: false, error: dbErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build email ───────────────────────────────────────────────────────────
    const interestTypeFormatted = interestType === "both" ? "Both" : titleCase(interestType);

    let htmlBody: string;
    let emailSubject: string;

    if (isZoomMeeting) {
      emailSubject = "You're Invited – Exclusive 360° Financial Solutions Meeting | AnNa Financial Group";
      htmlBody = buildZoomInviteEmail(
        firstName, lastName,
        body.selected_slot_date ?? "",
        body.selected_slot_label ?? "",
        body.selected_slot ?? "",
        LOGO_URL,
        email  // passed so Google Calendar link pre-fills the client as a guest
      );
    } else {
      emailSubject = `Welcome ${firstName} ${lastName}! - Registration Confirmation`;
      htmlBody = buildRegistrationEmail(
        firstName, lastName, interestTypeFormatted,
        {
          preferred_days: fullPayload.preferred_days,
          preferred_time: fullPayload.preferred_time || null,
          referred_by: fullPayload.referred_by,
          phone: fullPayload.phone,
          email: fullPayload.email,
          profession: fullPayload.profession,
          business_opportunities: fullPayload.business_opportunities,
          wealth_solutions: fullPayload.wealth_solutions,
        },
        showEntrepreneurship, showClient, FROM_NAME, LOGO_URL
      );
    }

    // ── Send email via Mailjet ────────────────────────────────────────────────
    // ccList   : array of {Email, Name} objects to CC
    // icsData  : raw ICS string — attached as calendar.ics so Gmail shows Accept/Decline
    async function sendMail(
      toEmail: string,
      toName: string,
      subject: string,
      html: string,
      ccList: { Email: string; Name: string }[] = [],
      icsData = ""
    ) {
      const message: Record<string, unknown> = {
        From:    { Email: FROM_EMAIL, Name: FROM_NAME },
        To:      [{ Email: toEmail, Name: toName }],
        Subject: subject,
        HTMLPart: html,
      };
      if (ccList.length > 0) message.Cc = ccList;
      if (icsData) {
        // Base64-encode the ICS and attach — Gmail/Outlook show Accept/Decline buttons
        const encoded = btoa(unescape(encodeURIComponent(icsData)));
        message.Attachments = [{
          ContentType: "text/calendar; method=REQUEST",
          Filename:    "invite.ics",
          Base64Content: encoded,
        }];
      }

      const res = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic " + btoa(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`),
        },
        body: JSON.stringify({ Messages: [message] }),
      });
      return res;
    }

    // ── Email routing ─────────────────────────────────────────────────────────
    // TO:  client
    // CC:  AnNa Financial Group <anunathanfinancialgroup@gmail.com>
    //      Chidam Alagar <chidam.alagar@gmail.com>
    // ICS: attached for zoom bookings so the client sees Accept/Decline buttons
    //      and accepting puts the event on Chidam's Google Calendar automatically.
    const CHIDAM_EMAIL  = "chidam.alagar@gmail.com";
    const ANFG_EMAIL    = "anunathanfinancialgroup@gmail.com";

    const ccList = [
      { Email: ANFG_EMAIL,   Name: "AnNa Financial Group" },
      { Email: CHIDAM_EMAIL, Name: "Chidam Alagar" },
    ];

    // Build ICS for zoom meetings so Gmail shows Accept/Decline calendar buttons
    const icsData = isZoomMeeting && body.selected_slot
      ? buildICSInvite(body.selected_slot, email, clientFullName)
      : "";

    const clientRes = await sendMail(email, clientFullName, emailSubject, htmlBody, ccList, icsData);

    if (!clientRes.ok) {
      const detail = await clientRes.text();
      console.error("Mailjet send failed:", detail);
      return new Response(JSON.stringify({ ok: false, error: "Email delivery failed", detail }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin notification — sent separately to ADMIN_NOTIFY_EMAIL if configured,
    // with a subject that makes the booking immediately obvious in the inbox.
    if (ADMIN_NOTIFY_EMAIL && ADMIN_NOTIFY_EMAIL !== ANFG_EMAIL && ADMIN_NOTIFY_EMAIL !== CHIDAM_EMAIL) {
      const adminSubject = isZoomMeeting
        ? `New Zoom Booking: ${clientFullName} — ${body.selected_slot_date ?? ""} ${body.selected_slot_label ?? ""}`
        : `New Registration: ${clientFullName} - ${interestTypeFormatted}`;
      await sendMail(ADMIN_NOTIFY_EMAIL, "Admin", adminSubject, htmlBody);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    // Catch any unhandled exception so the function never crashes silently
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
