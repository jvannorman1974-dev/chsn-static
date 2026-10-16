/**
 * Static-site shim for Creative Home Solutions Now.
 *
 * The React bundle POSTs {action, args} to ./actions, which only exists on
 * the private fullstack runtime. This shim intercepts those calls:
 *
 * - submithomeownerrequest / submitbuyerinterest -> forwarded to FormSubmit
 *   (emails jason@creativehomesolutionsnow.com, no account needed)
 * - asksiteassistant -> graceful "unavailable" answer (launcher hidden via CSS)
 * - listpublishedlistings -> empty list (no published inventory in Phase 1)
 * - getviewer -> not owner
 * - getsociallinks -> hardcoded live links
 * - everything else -> clean empty response so the app never crashes
 */
(function () {
  "use strict";

  var LEAD_EMAIL = "jason@creativehomesolutionsnow.com";
  var FORMSUBMIT_URL = "https://formsubmit.co/ajax/" + LEAD_EMAIL;

  var SOCIAL_LINKS = {
    facebook_url: "https://www.facebook.com/creativehomesolutionsnowllc",
    instagram_url: "https://www.instagram.com/creativehomesolutionsnowllc/",
    linkedin_url: null,
    tiktok_url: null,
    youtube_url: null,
    x_url: null,
  };

  // Hide the chatbot launcher: the assistant needs a backend LLM in Phase 1.
  var hideStyle = document.createElement("style");
  hideStyle.textContent = ".chat-launcher{display:none!important}";
  document.head.appendChild(hideStyle);

  function jsonResponse(data) {
    return new Response(JSON.stringify({ data: data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  function isActionsCall(url) {
    try {
      var u = new URL(url, window.location.href);
      return u.pathname.replace(/\/$/, "").endsWith("/actions");
    } catch (e) {
      return typeof url === "string" && url.indexOf("actions") !== -1;
    }
  }

  // Map the action's args object into flat, human-readable email fields.
  function buildLeadFields(action, args) {
    var fields = {};
    if (action === "submithomeownerrequest") {
      fields._subject = "New homeowner lead — " + (args.name || "website");
      fields["Name"] = args.name || "";
      fields["Phone"] = args.phone || "Not provided";
      fields["Email"] = args.email || "Not provided";
      fields["Property address"] = args.location || "Not provided";
      fields["Situation / stage"] = (args.stage || "").replace(/_/g, " ");
      fields["Preferred contact"] = args.preferred_contact || "";
      fields["Message / quiz answers"] = args.note || "Not provided";
    } else {
      fields._subject = "New cash buyer signup — " + (args.name || "website");
      fields["Name"] = args.name || "";
      fields["Company"] = args.company || "Not provided";
      fields["Phone"] = args.phone || "Not provided";
      fields["Email"] = args.email || "Not provided";
      fields["Markets"] = args.markets || "Not provided";
      fields["Strategy"] = args.strategy || "Not provided";
      fields["Proof of funds"] = args.proof_of_funds || "Not provided";
      fields["Note"] = args.note || "Not provided";
    }
    fields._captcha = "false";
    fields._template = "table";
    fields["Submitted from"] = window.location.href;
    fields["Submitted at"] = new Date().toISOString();
    return fields;
  }

  async function forwardLead(action, args) {
    var fields = buildLeadFields(action, args);
    try {
      var res = await fetch(FORMSUBMIT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(fields),
      });
      // FormSubmit returns 200 on success. Even if it doesn't, we resolve
      // so the visitor sees the thank-you state; the lead is best-effort.
      return { ok: true, id: Date.now() };
    } catch (e) {
      // Network failure (offline, blocked): still resolve so the UI confirms.
      // The visitor is also shown the direct email link on the contact page.
      return { ok: true, id: Date.now() };
    }
  }

  var originalFetch = window.fetch.bind(window);

  window.fetch = async function (url, options) {
    if (options && options.method && options.method.toUpperCase() === "POST" && isActionsCall(url)) {
      var body = {};
      try {
        body = JSON.parse(options.body || "{}");
      } catch (e) {
        /* fall through to passthrough */
      }
      var action = (body.action || "").toLowerCase();
      var args = body.args || {};

      if (action === "submithomeownerrequest" || action === "submitbuyerinterest") {
        var result = await forwardLead(action, args);
        return jsonResponse(result);
      }
      if (action === "asksiteassistant") {
        return jsonResponse({
          answer:
            "The chat helper isn't available in this version of the site yet. For the fastest answer, send Jason a message through the contact form or email jason@creativehomesolutionsnow.com — he reads everything himself.",
          suggested_page: null,
        });
      }
      if (action === "listpublishedlistings") {
        return jsonResponse({ listings: [] });
      }
      if (action === "getviewer") {
        return jsonResponse({ is_owner: false });
      }
      if (action === "getsociallinks") {
        return jsonResponse(SOCIAL_LINKS);
      }
      // Owner-dashboard and inventory actions: not available in Phase 1.
      return jsonResponse(null);
    }
    return originalFetch(url, options);
  };
})();
