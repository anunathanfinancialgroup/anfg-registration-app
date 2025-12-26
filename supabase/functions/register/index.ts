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
  preferred_time: "AM" | "PM";
  referred_by: string;
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
//  business_solutions: "Business Solutions (Entry/Exit, Key Person, etc.)",
//  health_insurance: "Health Insurance, Medicare and Medicaid",
// notary_services: "Notary Services",
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

  // Basic validation
  const missing: string[] = [];
  const must = ["interest_type","first_name","last_name","phone","email","preferred_time","referred_by"];
  for (const k of must) {
    // deno-lint-ignore no-explicit-any
    const v = (body as any)[k];
    if (!v || String(v).trim() === "") missing.push(k);
  }
  if (!Array.isArray(body.preferred_days) || body.preferred_days.length === 0) missing.push("preferred_days");
  if (!isValidEmail(body.email)) return new Response(JSON.stringify({ ok: false, error: "Invalid email" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

  const interestType = String(body.interest_type || "").toLowerCase();
  const showEntrepreneurship = interestType === "entrepreneurship" || interestType === "both";
  const showClient = interestType === "client" || interestType === "both";

  if (showEntrepreneurship && (!Array.isArray(body.business_opportunities) || body.business_opportunities.length === 0)) {
    return new Response(JSON.stringify({ ok: false, error: "Select at least one entrepreneurship option" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  if (showClient && (!Array.isArray(body.wealth_solutions) || body.wealth_solutions.length === 0)) {
    return new Response(JSON.stringify({ ok: false, error: "Select at least one wealth solution option" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (missing.length) {
    return new Response(JSON.stringify({ ok: false, error: `Missing: ${missing.join(", ")}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const MAILJET_API_KEY = Deno.env.get("MAILJET_API_KEY")!;
  const MAILJET_SECRET_KEY = Deno.env.get("MAILJET_SECRET_KEY")!;
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL")!;
  const FROM_NAME = Deno.env.get("FROM_NAME") ?? "CAN Financial Solutions";
  const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
  const LOGO_URL = Deno.env.get("LOGO_URL") ?? "";
  const BCC_EMAIL = Deno.env.get("BCC_EMAIL") ?? "canfinancialsolutions@gmail.com";

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
    preferred_time: body.preferred_time,
    referred_by: String(body.referred_by).trim(),
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

  // Branded HTML email (simple + clean)
  const htmlBody = `
<!doctype html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif; color:#0f172a; line-height:1.2;">
    <div style="max-width:640px;margin:0 auto;padding:22px;">
      <div style="text-align:center;margin-bottom:18px;">
        ${LOGO_URL ? `<img src="${LOGO_URL}" alt="CAN Financial Solutions" style="max-width:160px;height:auto;margin-bottom:10px;" />` : ""}
        <h2 style="margin:0;">Registration Confirmation</h2>
        <div style="color:#475569;font-size:13px;margin-top:6px;">We're excited to help you achieve your financial goals!</div>
      </div>

      <p>Dear <b>${escapeHtml(payloadToInsert.first_name)} ${escapeHtml(payloadToInsert.last_name)}</b>,</p>
      <p>Thank you for registering with <b>${FROM_NAME}</b>.Thank you for registering with CAN Financial Solutions. We received your information and will contact you shortly.</p>

      <div style="background:#f8fafc;border-left:4px solid #14b8a6;padding:12px 14px;border-radius:10px;">
        <div style="font-weight:bold;margin-bottom:6px;">Summary</div>
        <div><b>Interested In:</b> ${interestTypeFormatted}</div>
        <div><b>Preferred Days:</b> ${(payloadToInsert.preferred_days || []).join(", ")}</div>
        <div><b>Preferred Time:</b> ${payloadToInsert.preferred_time}</div>
        <div><b>Referred By:</b> ${escapeHtml(payloadToInsert.referred_by)}</div>
      </div>

      <p style="margin-top:16px;"><b>Phone:</b> ${escapeHtml(payloadToInsert.phone)}<br/>
      <b>Email:</b> ${escapeHtml(payloadToInsert.email)}${payloadToInsert.profession ? `<br/><b>Profession:</b> ${escapeHtml(payloadToInsert.profession)}` : ""}</p>

      ${
        showEntrepreneurship
          ? `<div style="margin-top:16px;">
              <div style="font-weight:bold;">Entrepreneurship - Business Opportunity</div>
              <ul style="margin:8px 0 0 18px;">
                ${labelsFor(payloadToInsert.business_opportunities, BUSINESS_OPPORTUNITY_LABELS).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }

      ${
        showClient
          ? `<div style="margin-top:16px;">
              <div style="font-weight:bold;">Client - Wealth Building Solutions</div>
              <ul style="margin:8px 0 0 18px;">
                ${labelsFor(payloadToInsert.wealth_solutions, WEALTH_SOLUTION_LABELS).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }

      <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;color:#475569;">
        Regards,<br/>
        <b>${FROM_NAME}</b>
      </div>
    </div>
  </body>
</html>`.trim();

  async function sendMail(toEmail: string, toName: string, subject: string, html: string) {
    const res = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`),
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: FROM_EMAIL, Name: FROM_NAME },
            To: [{ Email: toEmail, Name: toName }],
            ...(BCC_EMAIL ? { Bcc: [{ Email: BCC_EMAIL, Name: "CAN Financial Solutions" }] } : {}),
            Subject: subject,
            HTMLPart: html,
          },
        ],
      }),
    });
    return res;
  }

  // Email to client
  const clientRes = await sendMail(
    payloadToInsert.email,
    `${escapeHtml(payloadToInsert.first_name)} ${escapeHtml(payloadToInsert.last_name)}`,
    "Registration Confirmation - CAN Financial Solutions",
    htmlBody
  );

  if (!clientRes.ok) {
    const detail = await clientRes.text();
    return new Response(JSON.stringify({ ok: false, error: "Email failed", detail }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Optional admin notification
  if (ADMIN_NOTIFY_EMAIL) {
    const adminHtml = htmlBody.replace("Registration Confirmation", "New Client Registration");
    await sendMail(ADMIN_NOTIFY_EMAIL, "Admin", "New Client Registration - CAN Financial Solutions", adminHtml);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
