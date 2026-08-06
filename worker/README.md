# Sentinel AI Worker

The background automation and orchestration worker service for Sentinel.

## Features
- **Goal planning** using Gemini 2.5 Flash to convert natural language goals into a structured step plan.
- **Playwright browser sessions** to navigate, search, and populate checkout forms.
- **LLM extraction** to parse checkout summaries and products into structured contracts.
- **Rule engine** for checking pricing, discount, margin, and inventory.
- **BullMQ + Redis** job queueing for processing runs asynchronously.
- **SSE Stream** for pushing agent activity updates.
- **HITL coordination** to block runs and wait for human resolution signals.

## Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- PostgreSQL database
- Redis cache instance

### Setup
1. Copy `.env.example` to `.env` and fill in API keys and connection URLs:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Boot the development hot-reloading server:
   ```bash
   npm run dev
   ```

The worker HTTP service runs on port `3001` by default.
