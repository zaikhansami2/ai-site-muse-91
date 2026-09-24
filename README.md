# AI Canvas Builder

Build a modern, dark-themed AI Website Builder SaaS web application inspired by Bolt.diy, featuring a split-screen workspace with AI chat on the left and a live preview & code editor on the right, integrating all curated open-source libraries and architectural references.

### 1. Workspace Layout & Modes

- **Left Panel (AI Assistant):**

  - **Mode Toggle:** Support 3 distinct execution modes:

    - `Chat`: Idea discussion, advice, and brainstorming without writing code.

    - `Plan`: Generates a structured implementation checklist and architecture breakdown before coding, rendered with Marked (https://github.com/markedjs/marked).

    - `Build`: Generates and updates working multi-file website code with real-time streaming using Vercel AI SDK (https://github.com/vercel/ai).

  - **Prompt Input:** Resizable text area with image upload support (for screenshot-to-code) and preset inspiration chips.

  - **Streaming & Status:** Visual step-by-step indicators ("Analyzing request...", "Building components...", "Formatting files...").

- **Right Panel (Editor & Live Preview):**

  - **Tabs:**

    - `Preview`: Responsive sandboxed live iframe / Sandpack runtime (https://github.com/codesandbox/sandpack) with Mobile, Tablet, and Desktop viewport toggles and refresh button.

    - `Code`: Multi-file code editor with file tree navigation, 1-click copy via clipboard-copy (https://github.com/zenorocha/clipboard-copy), and auto-formatting using Prettier browser bundle (https://github.com/prettier/prettier).

    - `Canvas (Draw-to-Code)`: Integrated tldraw whiteboard canvas (https://github.com/tldraw/tldraw) allowing users to sketch UI wireframes and click "Generate Website from Sketch".

### 2. Standout Features & Open-Source Integrations

- **Core Architecture Inspiration:**

  - bolt.diy (https://github.com/stackblitz-labs/bolt.diy): Streaming chat, multi-file artifact tree, and in-browser preview patterns.

- **Screenshot-to-Code:**

  - Logic inspired by screenshot-to-code (https://github.com/abi/screenshot-to-code): User uploads a design screenshot or UI mock-up, and the vision model extracts layout, typography, and components into matching Tailwind CSS / HTML code.

- **Embedded AI Site Bots & Copilots:**

  - Ready-to-inject floating customer support / FAQ / lead capture chatbot widget based on assistant-ui (https://github.com/assistant-ui/assistant-ui) and CopilotKit (https://github.com/CopilotKit/CopilotKit).

- **Real-Time Web Intelligence:**

  - Live web search tool via duck-duck-scrape (https://github.com/Snazzah/duck-duck-scrape) and web extraction via Firecrawl (https://github.com/mendableai/firecrawl) to provide fresh data, competitor context, and live links during site generation.

- **Visuals & Marketing Video Engine:**

  - Automated project thumbnail / OpenGraph image capture using html2canvas (https://github.com/niklasvh/html2canvas).

  - Programmatic website showcase video and animation hooks inspired by Remotion (https://github.com/remotion-dev/remotion), Motion Canvas (https://github.com/motion-canvas/motion-canvas), AnimateDiff (https://github.com/guoyww/AnimateDiff), and Open-Sora (https://github.com/hpcaitech/Open-Sora).

### 3. Export & Deployment

- **ZIP Download:** Instant 1-click client-side download of the complete generated website folder using JSZip (https://github.com/Stuk/jszip).

- **GitHub Push:** Connect GitHub account or PAT to create repositories and commit code directly using Octokit.js (https://github.com/octokit/octokit.js).

- **Netlify Deploy:** 1-click publish flow that dispatches generated static files to Netlify's API and returns an instant live `.netlify.app` link.

### 4. Storage & Design System

- **Persistence:** Save all user projects, conversation history, and codebases locally in IndexedDB / LocalStorage.

- **Design & UI:** Modern dark SaaS styling using shadcn/ui (https://github.com/shadcn-ui/ui) design tokens, Lucide icons (https://github.com/lucide-icons/lucide), and smooth animated transitions via Framer Motion (https://github.com/framer/motion).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ai-site-muse-91.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/95b34a62-3e40-439f-898c-d4b296051b5a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
