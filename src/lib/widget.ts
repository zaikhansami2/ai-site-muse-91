import type { ProjectFile } from "@/lib/files";

export type WidgetOptions = {
  business: string;
  welcome: string;
  accent: string;
  webhook?: string;
  endpoint: string;
};

export const WIDGET_PATH = "assistant-widget.js";

function plainText(html: string, limit = 9000) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

/** Everything the bot is allowed to answer from: the site's own copy. */
export function siteContext(files: ProjectFile[]) {
  const html = files.filter((file) => file.path.endsWith(".html")).map((file) => file.content);
  return html.map(plainText).join("\n\n").slice(0, 12000);
}

export function buildWidgetScript(options: WidgetOptions, context: string) {
  const config = JSON.stringify({
    business: options.business,
    welcome: options.welcome,
    accent: options.accent,
    webhook: options.webhook ?? "",
    endpoint: options.endpoint.replace(/\/+$/, ""),
    context,
  });

  return `/* Forge assistant widget — support, FAQ and lead capture. */
(function () {
  var CONFIG = ${config};
  var history = [];

  var css = document.createElement("style");
  css.textContent = [
    ".fw-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:56px;height:56px;border-radius:999px;border:0;cursor:pointer;background:" + CONFIG.accent + ";color:#06110f;box-shadow:0 12px 32px rgba(0,0,0,.28);font-size:24px;line-height:1}",
    ".fw-panel{position:fixed;right:20px;bottom:88px;z-index:2147483000;width:340px;max-width:calc(100vw - 32px);height:460px;max-height:calc(100vh - 120px);display:none;flex-direction:column;background:#0f1417;color:#e8edf0;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.4);font-family:system-ui,-apple-system,Segoe UI,sans-serif}",
    ".fw-panel.open{display:flex}",
    ".fw-head{padding:14px 16px;background:" + CONFIG.accent + ";color:#06110f;font-weight:600;font-size:14px;display:flex;justify-content:space-between;align-items:center}",
    ".fw-head button{background:none;border:0;color:inherit;cursor:pointer;font-size:18px}",
    ".fw-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;font-size:13.5px;line-height:1.5}",
    ".fw-msg{padding:9px 12px;border-radius:12px;max-width:85%;white-space:pre-wrap}",
    ".fw-user{align-self:flex-end;background:" + CONFIG.accent + ";color:#06110f}",
    ".fw-bot{align-self:flex-start;background:#1b2327}",
    ".fw-form{display:flex;gap:6px;padding:10px;border-top:1px solid #222c31}",
    ".fw-form input{flex:1;background:#151c20;border:1px solid #263036;color:#e8edf0;border-radius:10px;padding:9px 11px;font-size:13px;outline:none}",
    ".fw-form button{background:" + CONFIG.accent + ";color:#06110f;border:0;border-radius:10px;padding:0 14px;font-weight:600;cursor:pointer}",
    ".fw-lead{padding:12px 14px;border-top:1px solid #222c31;display:none;flex-direction:column;gap:6px}",
    ".fw-lead.open{display:flex}",
    ".fw-lead input{background:#151c20;border:1px solid #263036;color:#e8edf0;border-radius:10px;padding:8px 11px;font-size:13px}",
    ".fw-lead button{background:" + CONFIG.accent + ";color:#06110f;border:0;border-radius:10px;padding:9px;font-weight:600;cursor:pointer}",
    ".fw-link{background:none;border:0;color:" + CONFIG.accent + ";font-size:12px;cursor:pointer;text-align:left;padding:8px 14px}"
  ].join("");
  document.head.appendChild(css);

  var button = document.createElement("button");
  button.className = "fw-btn";
  button.setAttribute("aria-label", "Chat with us");
  button.innerHTML = "&#128172;";

  var panel = document.createElement("div");
  panel.className = "fw-panel";
  panel.innerHTML =
    '<div class="fw-head"><span>' + CONFIG.business + "</span><button data-close>&times;</button></div>" +
    '<div class="fw-log"></div>' +
    '<button class="fw-link" data-lead>Leave your email instead &rarr;</button>' +
    '<form class="fw-lead"><input name="name" placeholder="Your name" /><input name="email" type="email" placeholder="Email address" required /><button type="submit">Send</button></form>' +
    '<form class="fw-form"><input name="q" placeholder="Ask a question..." autocomplete="off" /><button type="submit">Send</button></form>';

  document.body.appendChild(button);
  document.body.appendChild(panel);

  var log = panel.querySelector(".fw-log");
  var chatForm = panel.querySelector(".fw-form");
  var leadForm = panel.querySelector(".fw-lead");

  function bubble(role, text) {
    var el = document.createElement("div");
    el.className = "fw-msg " + (role === "user" ? "fw-user" : "fw-bot");
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  bubble("bot", CONFIG.welcome);

  button.addEventListener("click", function () {
    panel.classList.toggle("open");
  });
  panel.querySelector("[data-close]").addEventListener("click", function () {
    panel.classList.remove("open");
  });
  panel.querySelector("[data-lead]").addEventListener("click", function () {
    leadForm.classList.toggle("open");
  });

  chatForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var input = chatForm.q;
    var question = input.value.trim();
    if (!question) return;
    input.value = "";
    bubble("user", question);
    history.push({ role: "user", content: question });
    var out = bubble("bot", "...");
    try {
      var response = await fetch(CONFIG.endpoint + "/api/public/widget-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, context: CONFIG.context, business: CONFIG.business })
      });
      if (!response.ok || !response.body) throw new Error("bad response");
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var answer = "";
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        answer += decoder.decode(chunk.value, { stream: true });
        out.textContent = answer;
        log.scrollTop = log.scrollHeight;
      }
      history.push({ role: "assistant", content: answer });
    } catch (error) {
      out.textContent = "Sorry, I could not reach the assistant. Please leave your email and we'll reply.";
      leadForm.classList.add("open");
    }
  });

  leadForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var payload = {
      name: leadForm.name.value,
      email: leadForm.email.value,
      message: history.map(function (m) { return m.role + ": " + m.content; }).join("\\n"),
      site: location.href,
      webhook: CONFIG.webhook
    };
    try {
      var response = await fetch(CONFIG.endpoint + "/api/public/widget-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("bad response");
      leadForm.classList.remove("open");
      bubble("bot", "Thanks! We'll be in touch at " + payload.email + ".");
      leadForm.reset();
    } catch (error) {
      bubble("bot", "That did not send. Please try again in a moment.");
    }
  });
})();
`;
}

const TAG = `<script src="./${WIDGET_PATH}" defer></script>`;

/** Add (or refresh) the widget file and its script tag in every HTML page. */
export function injectWidget(files: ProjectFile[], options: WidgetOptions): ProjectFile[] {
  const script = buildWidgetScript(options, siteContext(files));
  const next = files
    .filter((file) => file.path !== WIDGET_PATH)
    .map((file) => {
      if (!file.path.endsWith(".html")) return file;
      if (file.content.includes(WIDGET_PATH)) return file;
      const content = file.content.includes("</body>")
        ? file.content.replace("</body>", `  ${TAG}\n</body>`)
        : `${file.content}\n${TAG}\n`;
      return { ...file, content };
    });
  return [...next, { path: WIDGET_PATH, content: script }];
}

export function hasWidget(files: ProjectFile[]) {
  return files.some((file) => file.path === WIDGET_PATH);
}

export function removeWidget(files: ProjectFile[]): ProjectFile[] {
  return files
    .filter((file) => file.path !== WIDGET_PATH)
    .map((file) =>
      file.path.endsWith(".html")
        ? {
            ...file,
            content: file.content.replace(
              new RegExp(`\\s*<script src="\\./${WIDGET_PATH}"[^>]*></script>`, "g"),
              "",
            ),
          }
        : file,
    );
}
