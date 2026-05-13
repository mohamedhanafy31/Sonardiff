# Product Requirements Document (PRD): Web Monitoring SaaS

## 1. Executive Summary

This document outlines the first two development phases of a high-performance website change-monitoring platform. [cite_start]The product is designed for professionals (marketers, pricing analysts, compliance officers) who need to track digital changes in real-time[cite: 55]. [cite_start]By capitalizing on competitor vulnerabilities—namely unpredictable billing, rigid scheduling constraints, and high rates of false-positive alerts [cite: 26, 27]—this product prioritizes transparent pricing, deterministic rule-setting, and an intuitive user experience.

---

## 2. Phase 1: The Core Engine (MVP)

[cite_start]**Objective:** Deliver a hyper-reliable baseline product that allows users to monitor URLs, detect structural or text changes, and receive immediate email notifications[cite: 76, 77].

### Feature 1.1: The Deterministic Scraping Engine

* [cite_start]**Description:** The backend system capable of fetching full page content, including dynamically loaded JavaScript elements, and comparing it against a stored historical baseline[cite: 32, 35].
* **Main Logic:** 1. User inputs a target URL.
  2. [cite_start]The system utilizes a headless browser instance to fully render the page (bypassing the limitation of simple HTML fetchers)[cite: 32].
  3. [cite_start]The system captures the Document Object Model (DOM) and raw text[cite: 36].
  4. [cite_start]On subsequent checks, the system performs a strict visual and text-based diff calculation[cite: 36, 37]. If the delta exceeds a 0% threshold, an event is triggered.
* **Example:** A user wants to monitor a competitor's pricing page. They paste the URL. The system takes a snapshot of the page as it exists right now. Two hours later, the competitor changes the price from "$49" to "$39". The system detects the text delta and triggers the alert pipeline.
* **Competitor Weakness Addressed:** Many legacy tools fail to render modern, dynamic websites properly, resulting in missed changes. By utilizing full headless execution from day one, we guarantee high-fidelity data capture.

### Feature 1.2: Transparent, Tiered Scheduling

* **Description:** A job-queue system that executes monitoring checks based on strictly defined, user-selected frequencies tied directly to their transparent subscription tier.
* **Main Logic:** 1. When creating a monitor, the user selects a frequency (e.g., Every 24 hours, Every 1 hour, Every 5 minutes).
  2. The available frequencies are hard-capped by the user's plan.
  3. The system clearly displays the total number of monthly checks this will consume before the user saves the monitor.
* **Example:** A user on the "Pro" tier sets a monitor to check a stock-status page every 15 minutes. The UI calculates: `4 checks/hour * 24 hours * 30 days = 2,880 checks/month`. This is deducted from their visible monthly quota.
* [cite_start]**Competitor Weakness Addressed (The "Billing Trap"):** Competitors often lock schedules to arbitrary times (e.g., exactly 9 am and 9 pm) or obscure how high-frequency checks will rapidly deplete quotas, leading to unexpected overage charges or sudden annual billing spikes[cite: 26, 27]. Our logic calculates and displays exact usage upfront, eliminating "surprise billing."

### Feature 1.3: Core Alerting Pipeline

* [cite_start]**Description:** A reliable notification system that sends a "Before & After" summary to the user's registered email[cite: 77].
* **Main Logic:** When the scraping engine detects a change, the system generates an email payload containing the URL, the timestamp of the change, and a highlighted diff (e.g., Red for removed text, Green for added text).
* **Example:** The user receives an email with the subject line: *Alert: Change detected on [Competitor Pricing Page]*. The body shows exactly what text was deleted and what was added.

---

## 3. Phase 2: The Noise Filter (Precision Targeting)

**Objective:** Eliminate alert fatigue. [cite_start]Websites are full of irrelevant dynamic content (rotating ad banners, live timestamps, carousel images)[cite: 40]. Phase 2 introduces deterministic filtering so users only receive alerts for meaningful changes.

### Feature 2.1: Element-Specific Targeting

* **Description:** Allows the user to monitor only a specific section of a webpage rather than the entire document.
* **Main Logic:** 1. During setup, the user is presented with a visual preview of the webpage.
  2. The user clicks on the specific element they care about (e.g., the specific HTML `div` containing the price or the "Out of Stock" button).
  3. [cite_start]The system generates and stores the exact CSS path for that element[cite: 36]. Subsequent scrapes will discard the rest of the page and only calculate diffs on that specific CSS path.
* **Example:** A user only wants to know if a specific product goes on sale. They visually select the price tag on the page. Even if the website changes its banner image or footer links, the user will not be alerted unless that specific price tag changes.

### Feature 2.2: Content Exclusion Rules

* [cite_start]**Description:** Gives power users the ability to write rules that tell the engine what *not* to look at[cite: 81].
* [cite_start]**Main Logic:** 1. User defines exclusion parameters via standard text input (keywords) or Regular Expressions (Regex)[cite: 40].
  2. The scraping engine fetches the page data.
  3. *Crucial Step:* Before calculating the diff, the system runs the exclusion rules, stripping any matching text or DOM elements from the snapshot.
  4. The diff is calculated on the sanitized data.
* **Example:** A news website has a live "Current Time: 12:45 PM" clock in the header. The user sets a Regex exclusion rule for `\d{1,2}:\d{2}\s[AM|PM]`. The system strips the clock out of the data before comparing, preventing an alert from firing every single minute.
* [cite_start]**Competitor Weakness Addressed (The "AI Guessing Game"):** Competitors attempt to solve alert fatigue by routing data through expensive, unpredictable AI models to guess if a change is "meaningful"[cite: 40, 58]. This increases operational costs (passed to the user) and often filters out changes the user actually wanted to see. Our deterministic logic empowers the user to define exactly what is noise, guaranteeing 100% predictable filtering with vastly lower computing overhead.

---

## 4. Success Metrics for Phases 1 & 2

* **System Reliability:** 99.9% success rate on fetching dynamically rendered pages without triggering anti-bot captchas.
* **User Retention:** A high percentage of users successfully converting from the free trial to the paid tier due to the transparent quota dashboard and lack of unexpected limits.
* **Alert Accuracy:** A near-zero rate of false-positive alerts once users configure their Phase 2 exclusion rules.
