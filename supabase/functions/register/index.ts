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
  selected_slot?: string;        // local ISO datetime string "2025-05-05T18:00:00"
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

// Base64-encode a UTF-8 string (for ICS attachment)
function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Format a Date as ICS local datetime: YYYYMMDDTHHMMSS
function icsDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

// Generates an ICS VCALENDAR string for a 1-hour meeting in Central Time
function generateICS(
  slotLocalISO: string, // "2025-05-05T18:00:00"
  clientName: string,
  clientEmail: string
): string {
  // Parse the local ISO string (no timezone suffix) as local date components
  const [datePart, timePart] = slotLocalISO.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const startDt = new Date(year, month - 1, day, hour, minute, 0);
  const endDt = new Date(year, month - 1, day, hour + 1, minute, 0);

  const dtStamp = icsDateTime(new Date());
  const dtStart = icsDateTime(startDt);
  const dtEnd = icsDateTime(endDt);
  const uid = `${Date.now()}-anfg-meeting@anfg.com`;

  const description =
    "Join us for an Exclusive 360° Financial Solutions Meeting!\\n\\n" +
    "We will explore:\\n" +
    "✅ Business Entrepreneurship Opportunities\\n" +
    "✅ 360° Financial Solutions\\n" +
    "✅ Family Protection Strategies\\n\\n" +
    "─────────────────────────────\\n" +
    "JOIN OUR ZOOM MEETING\\n" +
    "─────────────────────────────\\n" +
    "Click to Join: https://us04web.zoom.us/j/9106338447?pwd=nmoPE8D31WH31nxBduZe7ihbrGToPy.1\\n" +
    "Meeting ID: 910 633 8447\\n" +
    "Passcode: AnNaFG2026\\n\\n" +
    "Warm regards,\\nChidam Alagar\\nFinancial Solutions Advisor\\nAnNa Financial Group | Leander\\, TX";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AnNa Financial Group//ANFG Meeting Scheduler//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP;TZID=America/Chicago:${dtStamp}`,
    `DTSTART;TZID=America/Chicago:${dtStart}`,
    `DTEND;TZID=America/Chicago:${dtEnd}`,
    "SUMMARY:Exclusive 360° Financial Solutions Meeting | AnNa Financial Group",
    `DESCRIPTION:${description}`,
    "LOCATION:https://us04web.zoom.us/j/9106338447?pwd=nmoPE8D31WH31nxBduZe7ihbrGToPy.1",
    "ORGANIZER;CN=Chidam Alagar:mailto:chidam.alagar@gmail.com",
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${clientName}:mailto:${clientEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:AnNa Financial Group Zoom Meeting in 30 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// Zoom invite email HTML using the provided template
function buildZoomInviteEmail(
  firstName: string,
  lastName: string,
  slotDate: string,
  slotLabel: string,
  logoUrl: string
): string {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="AnNa Financial Group" style="max-width:160px;height:auto;margin-bottom:10px;" />`
    : "";

  return `
<!doctype html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6;margin:0;padding:0;">
    <div style="max-width:640px;margin:0 auto;padding:28px 22px;">

      <div style="text-align:center;margin-bottom:24px;">
        ${logoHtml}
        <h2 style="margin:8px 0 4px;font-size:20px;color:#0f172a;">
          You're Invited – Exclusive 360° Financial Solutions Meeting
        </h2>
        <div style="color:#14b8a6;font-weight:700;font-size:14px;letter-spacing:0.04em;">
          AnNa Financial Group
        </div>
      </div>

      <p>Dear <b>${escapeHtml(firstName)} ${escapeHtml(lastName)}</b>,</p>

      <p>I hope this message finds you well! I'd love to connect with you for a complimentary <b>Financial Solutions Meeting</b> designed specifically with you and your family in mind.</p>

      <p style="font-weight:700;margin-bottom:6px;">During our session, we'll explore:</p>

      <p style="margin:6px 0;">✅ <b>Business Entrepreneurship Opportunities</b> – Discover pathways to grow or launch your own venture</p>
      <p style="margin:6px 0;">✅ <b>360° Financial Solutions</b> – A comprehensive approach covering protection, wealth-building, and planning</p>
      <p style="margin:6px 0;">✅ <b>Family Protection Strategies</b> – Ensuring your loved ones are financially secure no matter what life brings</p>

      <p>This is a <b>no-obligation conversation</b> — my goal is simply to understand your vision and share tools that can help you achieve it.</p>

      ${
        slotDate && slotLabel
          ? `<div style="background:#f0fdf9;border:1px solid #14b8a6;border-radius:12px;padding:14px 16px;margin:18px 0;">
              <div style="font-weight:700;font-size:15px;color:#0f766e;margin-bottom:4px;">📅 Your Scheduled Meeting</div>
              <div style="font-size:14px;color:#0f172a;">${escapeHtml(slotDate)}</div>
              <div style="font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(slotLabel)} Central Time (CT)</div>
            </div>`
          : ""
      }

      <div style="background:#f0f9ff;border:1px solid #0ea5e9;border-radius:12px;padding:16px 18px;margin:18px 0;">
        <div style="text-align:center;font-weight:700;font-size:15px;color:#0369a1;margin-bottom:12px;">
          ─────────────────────────────<br/>
          📅 JOIN OUR ZOOM MEETING<br/>
          ─────────────────────────────
        </div>
        <div style="margin:6px 0;font-size:14px;">
          👉 <b>Click to Join:</b>
          <a href="https://us04web.zoom.us/j/9106338447?pwd=nmoPE8D31WH31nxBduZe7ihbrGToPy.1"
             style="color:#0369a1;">
            https://us04web.zoom.us/j/9106338447
          </a>
        </div>
        <div style="margin:4px 0;font-size:14px;">📋 <b>Meeting ID:</b> 910 633 8447</div>
        <div style="margin:4px 0;font-size:14px;">🔑 <b>Passcode:</b> AnNaFG2026</div>
      </div>

      <p style="margin-top:8px;font-size:13px;color:#475569;">
        💡 A calendar invite (.ics) is attached to this email — click it to add this meeting to your Google Calendar or any other calendar app.
      </p>

      <p>I look forward to being a trusted partner on your financial journey. Please feel free to reply or call me directly to confirm your spot or ask any questions.</p>

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;">Warm regards,<br/>
        <b>Chidam Alagar</b><br/>
        Financial Solutions Advisor<br/>
        AnNa Financial Group | Leander, TX</p>
      </div>
    </div>
  </body>
</html>`.trim();
}

// Standard registration confirmation email
function buildRegistrationEmail(
  firstName: string,
  lastName: string,
  interestTypeFormatted: string,
  payload: {
    preferred_days: string[];
    preferred_time?: string | string[] | null;
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

  const preferredTime = Array.isArray(payload.preferred_time)
    ? payload.preferred_time.join(", ")
    : payload.preferred_time ?? "";

  return `
<!doctype html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif; color:#0f172a; line-height:1.2;">
    <div style="max-width:640px;margin:0 auto;padding:22px;">
      <div style="text-align:center;margin-bottom:18px;">
        ${logoHtml}
        <h2 style="margin:0;">Registration Confirmation</h2>
        <div style="color:#475569;font-size:13px;margin-top:6px;">We're excited to connect with you and introduce an opportunity that combines purpose with prosperity!</div>
      </div>

      <p>Dear <b>${escapeHtml(firstName)} ${escapeHtml(lastName)}</b>,</p>
      <p>Thank you for registering with <b>${escapeHtml(fromName)}</b>. We received your information and will contact you shortly.</p>

      <div style="background:#f8fafc;border-left:4px solid #14b8a6;padding:12px 14px;border-radius:10px;">
        <div style="font-weight:bold;margin-bottom:6px;">Summary</div>
        <div><b>Interested In:</b> ${interestTypeFormatted}</div>
        <div><b>Preferred Days:</b> ${(payload.preferred_days || []).join(", ")}</div>
        <div><b>Preferred Time:</b> ${preferredTime}</div>
        <div><b>Referred By:</b> ${escapeHtml(payload.referred_by)}</div>
      </div>

      <p style="margin-top:16px;"><b>Phone:</b> ${escapeHtml(payload.phone)}<br/>
      <b>Email:</b> ${escapeHtml(payload.email)}${payload.profession ? `<br/><b>Profession:</b> ${escapeHtml(payload.profession)}` : ""}</p>

      ${
        showEntrepreneurship
          ? `<div style="margin-top:16px;">
              <div style="font-weight:bold;">Entrepreneurship - Business Opportunity</div>
              <ul style="margin:8px 0 0 18px;">
                ${labelsFor(payload.business_opportunities, BUSINESS_OPPORTUNITY_LABELS).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }

      ${
        showClient
          ? `<div style="margin-top:16px;">
              <div style="font-weight:bold;">Client - Wealth Building Solutions</div>
              <ul style="margin:8px 0 0 18px;">
                ${labelsFor(payload.wealth_solutions, WEALTH_SOLUTION_LABELS).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }

      <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;color:#475569;">
        Regards,<br/>
        <b>${escapeHtml(fromName)}</b>
      </div>
    </div>
  </body>
</html>`.trim();
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

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const connectionType = body.connection_type ?? "meeting_preference";
  const isZoomMeeting = connectionType === "zoom_meeting";

  // Base required fields
  const missing: string[] = [];
  const baseRequired = ["interest_type", "first_name", "last_name", "phone", "email", "referred_by"];
  for (const k of baseRequired) {
    // deno-lint-ignore no-explicit-any
    const v = (body as any)[k];
    if (!v || String(v).trim() === "") missing.push(k);
  }

  if (!isValidEmail(body.email)) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid email" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (isZoomMeeting) {
    if (!body.selected_slot || String(body.selected_slot).trim() === "") {
      missing.push("selected_slot");
    }
  } else {
    // meeting_preference path requires days and time
    if (!Array.isArray(body.preferred_days) || body.preferred_days.length === 0) {
      missing.push("preferred_days");
    }
    const pt = body.preferred_time;
    const ptEmpty = !pt || (Array.isArray(pt) ? pt.length === 0 : String(pt).trim() === "");
    if (ptEmpty) missing.push("preferred_time");
  }

  if (missing.length) {
    return new Response(JSON.stringify({ ok: false, error: `Missing: ${missing.join(", ")}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const MAILJET_API_KEY = Deno.env.get("MAILJET_API_KEY")!;
  const MAILJET_SECRET_KEY = Deno.env.get("MAILJET_SECRET_KEY")!;
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL")!;
  const FROM_NAME = Deno.env.get("FROM_NAME") ?? "AnNa Financial Group";
  const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
  const LOGO_URL = Deno.env.get("LOGO_URL") ?? "";
  const BCC_EMAIL = Deno.env.get("BCC_EMAIL") ?? "";

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const preferredTimeNorm = Array.isArray(body.preferred_time)
    ? body.preferred_time.join(", ")
    : (body.preferred_time ?? null);

  const payloadToInsert = {
    status: "new",
    interest_type: interestType,
    business_opportunities: body.business_opportunities ?? [],
    wealth_solutions: body.wealth_solutions ?? [],
    first_name: String(body.first_name).trim(),
    last_name: String(body.last_name).trim(),
    phone: String(body.phone).trim(),
    email: String(body.email).trim(),
    profession: String(body.profession ?? "").trim(),
    preferred_days: body.preferred_days ?? [],
    preferred_time: preferredTimeNorm,
    referred_by: String(body.referred_by).trim(),
    connection_type: connectionType,
    selected_slot: body.selected_slot ?? null,
    selected_slot_label: body.selected_slot_label ?? null,
  };

  const { error: dbErr } = await supabase.from("client_registrations").insert(payloadToInsert);
  if (dbErr) {
    return new Response(JSON.stringify({ ok: false, error: dbErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const interestTypeFormatted =
    interestType === "both" ? "Both" : titleCase(interestType);

  const firstName = payloadToInsert.first_name;
  const lastName = payloadToInsert.last_name;
  const clientFullName = `${firstName} ${lastName}`;

  // Build email body depending on connection type
  let htmlBody: string;
  let emailSubject: string;
  let mailjetMessage: Record<string, unknown>;

  if (isZoomMeeting) {
    emailSubject =
      "You're Invited – Exclusive 360° Financial Solutions Meeting | AnNa Financial Group";
    htmlBody = buildZoomInviteEmail(
      firstName,
      lastName,
      body.selected_slot_date ?? "",
      body.selected_slot_label ?? "",
      LOGO_URL
    );

    // Generate ICS calendar invite
    const icsContent = generateICS(
      body.selected_slot!,
      clientFullName,
      payloadToInsert.email
    );
    const icsBase64 = encodeBase64(icsContent);

    mailjetMessage = {
      From: { Email: FROM_EMAIL, Name: FROM_NAME },
      To: [{ Email: payloadToInsert.email, Name: clientFullName }],
      ...(BCC_EMAIL ? { Bcc: [{ Email: BCC_EMAIL, Name: "AnNa Financial Group" }] } : {}),
      Subject: emailSubject,
      HTMLPart: htmlBody,
      Attachments: [
        {
          ContentType: "text/calendar; method=REQUEST",
          Filename: "meeting-invite.ics",
          Base64Content: icsBase64,
        },
      ],
    };
  } else {
    emailSubject = `Welcome ${firstName}, ${lastName}! - Registration Confirmation`;
    htmlBody = buildRegistrationEmail(
      firstName,
      lastName,
      interestTypeFormatted,
      {
        preferred_days: payloadToInsert.preferred_days,
        preferred_time: payloadToInsert.preferred_time,
        referred_by: payloadToInsert.referred_by,
        phone: payloadToInsert.phone,
        email: payloadToInsert.email,
        profession: payloadToInsert.profession,
        business_opportunities: payloadToInsert.business_opportunities,
        wealth_solutions: payloadToInsert.wealth_solutions,
      },
      showEntrepreneurship,
      showClient,
      FROM_NAME,
      LOGO_URL
    );

    mailjetMessage = {
      From: { Email: FROM_EMAIL, Name: FROM_NAME },
      To: [{ Email: payloadToInsert.email, Name: clientFullName }],
      ...(BCC_EMAIL ? { Bcc: [{ Email: BCC_EMAIL, Name: "AnNa Financial Group" }] } : {}),
      Subject: emailSubject,
      HTMLPart: htmlBody,
    };
  }

  async function sendMail(message: Record<string, unknown>) {
    return fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`),
      },
      body: JSON.stringify({ Messages: [message] }),
    });
  }

  const clientRes = await sendMail(mailjetMessage);

  if (!clientRes.ok) {
    const detail = await clientRes.text();
    console.error("Email send failed:", detail);
    return new Response(JSON.stringify({ ok: false, error: "Email failed", detail }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Admin notification
  if (ADMIN_NOTIFY_EMAIL) {
    const adminSubject = isZoomMeeting
      ? `New Zoom Meeting Booked: ${clientFullName} – ${body.selected_slot_date ?? ""} ${body.selected_slot_label ?? ""}`
      : `New Registration: ${clientFullName} - ${interestTypeFormatted}`;

    const adminHtml = htmlBody.replace(
      "Registration Confirmation",
      "New Client Registration"
    ).replace(
      "You're Invited",
      `New Zoom Booking: ${clientFullName}`
    );

    await sendMail({
      From: { Email: FROM_EMAIL, Name: FROM_NAME },
      To: [{ Email: ADMIN_NOTIFY_EMAIL, Name: "Admin" }],
      Subject: adminSubject,
      HTMLPart: adminHtml,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
