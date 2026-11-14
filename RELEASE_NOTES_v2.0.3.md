# Alf 2.0.3 : The Autonomous AI Copilot with Persistent Memory and Edge Acceleration

![Version](https://img.shields.io/badge/version-2.0.3-blue.svg?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078D6.svg?style=for-the-badge&logo=windows)
![Architecture](https://img.shields.io/badge/stack-Tauri%20v2%20%7C%20Rust%20%7C%20React%2019-24C8D8.svg?style=for-the-badge)
![Protocol](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-22C55E.svg?style=for-the-badge)
![Hardware](https://img.shields.io/badge/Hardware-ASUS%20NPU%20%26%20RTX%20Ready-DC2626.svg?style=for-the-badge)

---

> **Alf 2.0.3** marks the official initial public release of an autonomous, multimodal personal AI assistant. Originally engineered and battle-tested as an in-house production copilot for the **WARM-TV** rock/metal webzine and **The French Miller** communication agency, this milestone delivers an installable desktop experience with **local persistent memory**, **zero-latency custom voice cloning**, **autonomous evaluation mode**, and **on-device edge acceleration readiness**.

---

## 📸 Interface Preview

<!-- DRAG AND DROP YOUR APPLICATION SCREENSHOT HERE IN GITHUB -->
*(Drop a screenshot of the Alf 2.0.3 interface here to display it in high resolution)*

---

## 🌟 What's New in Version 2.0.3

### 🧠 Long-Term Persistent Memory (Inter-Session Learning)
- **Zero-Cloud Memory Journal**: Alf now maintains an on-disk memory file (`MEMOIRE_ALF.md`) that automatically captures user preferences, account configurations, editorial guidelines, and past milestones.
- **Dynamic Context Injection**: Loaded on startup and seamlessly merged into the system instructions, allowing Alf to evolve and retain context across sessions without external vector databases.
- **Dedicated Memory Inspector**: A new `🧠 Mémoire` header button opens a clean modal to view and audit the agent's long-term memory in real time.

### ⚡ Instant Standalone Demonstration Mode
- **Zero-Configuration Evaluation**: Evaluators and users can test Alf immediately without entering any private credentials or API keys.
- **One-Click Real-World Scenarios**:
  - 🎸 **Music Journalism**: Generates pre-formatted WARM-TV album reviews with automated visual asset insertion and Yoast SEO compliance.
  - 📧 **Press Relations Triage**: Simulates inbox scanning, VIP email extraction, and promo visual sorting.
  - 💻 **Architecture & Code Audit**: Inspects project codebases and outlines edge hardware optimizations.

### 🌐 Resilient Bilingual Vocal Engine & Zero-Latency Voice Cloning
- **Automatic Language Detection**: Evaluates prompts in real time; responds in fluent French or English.
- **On-Device Neural Voice Cloning (`safetensors`)**: Alf now supports instant custom voice cloning running 100% locally on CPU/NPU. Audio prompts are pre-encoded into optimized model tensors (`alf.safetensors` via `pocket-tts export-voice`), bypassing runtime encoding overhead.
- **Hugging Face Hub Integration**: Authenticated voice weights verification via `HF_TOKEN` for Kyutai community-licensed models.
- **Dual-Tier Resilient Fallback**:
  - **Tier 1 (Local Neural TTS)**: High-fidelity natural custom voice (`alf.safetensors`), with native catalog fallback (`estelle`, `javert`).
  - **Tier 2 (Operating System Fallback)**: Automatically falls back to native Windows/Edge speech synthesis (Microsoft Natural English or French voices) when running on a system without local Python/uvx.

### ⚡ Edge-First & Next-Gen Hardware Acceleration
- **Engineered for AI PCs**: Built to leverage the dedicated Neural Processing Units (NPU) and NVIDIA GeForce RTX Tensor Cores found on modern hardware such as ASUS ROG, TUF, and ProArt machines.
- **Roadmap to 100% Offline AI**: Modular architecture allowing seamless transition from cloud APIs to local open-weights inference (Llama, Mistral, Qwen) via Ollama and ONNX.

---

## 📊 Capabilities Matrix

| Domain | Capabilities | Core Technologies |
| :--- | :--- | :--- |
| **Desktop Runtime** | Native Windows desktop application, lightweight footprint, zero web server requirement | Tauri v2, Rust, NSIS |
| **Frontend UI** | Reactive desktop dashboard, animated speech avatar, action validation panels | React 19, Tailwind CSS, Vite |
| **Tool Orchestration** | 24 business tools across 5 isolated domains with human-in-the-loop security | Model Context Protocol (MCP) |
| **Memory System** | On-disk markdown memory ledger, inter-session persistence, memory inspector modal | Local File System, Context Injection |
| **Media & Vision** | High-resolution album art extraction, press kit image triage, noise elimination | Multimodal Vision, Sharp, Canvas |
| **Vocal Interface** | Real-time speech transcription, on-device neural voice cloning (`safetensors`), and natural voice synthesis with OS fallback | Web Speech API, Pocket TTS, uvx |

---

## 🚀 Quick Start Guide

### 1. Download & Install
1. Download **`Alf_2.0.3_x64-setup.exe`** from the Assets section below.
2. Run the installer on **Windows 10 or Windows 11 (64-bit)**.
3. Launch **Alf** directly from your Windows Start Menu or Desktop shortcut.

### 2. Exploring Features
- **Try Demo Mode**: Click any of the interactive prompt cards to see Alf process music journalism, PR emails, or code reviews in seconds.
- **Inspect Long-Term Memory**: Click the `🧠 Mémoire` button in the header to audit what Alf knows and remembers.
- **Connect Live API**: Click `⚙ Clé API` to optionally supply your Google Gemini API key and unlock unbounded live reasoning.

---

<details>
<summary><b>🔧 Technical Architecture & Connected MCP Servers (Click to Expand)</b></summary>

Alf connects to 5 modular Model Context Protocol (MCP) servers providing 24 specialized tools:

1. **Email MCP (`mcp-email.js`)**: Multi-account IMAP/SMTP triage across professional and personal mailboxes, attachment extraction, and CDN deduplication.
2. **WordPress MCP (`mcp-wordpress.js`)**: Full REST API integration with automated visual classification, featured media assignment, and strict Yoast SEO validation.
3. **Instagram MCP (`mcp-instagram.js`)**: Graph API performance metrics, reach analytics, and audience engagement tracking.
4. **Dev MCP (`mcp-dev.js`)**: Filesystem exploration, codebase navigation, Gemini Vision image analysis, and PDF press kit extraction.
5. **WebSearch MCP (Brave Search)**: Real-time web and local search for fact verification and music release dates.

</details>

---

*Engineered with passion by **Erwan Meunier** for **The French Miller** & **WARM-TV**.*
