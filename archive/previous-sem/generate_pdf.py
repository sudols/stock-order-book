import re
import os
import subprocess

def create_report_html(page_numbers=None):
    if page_numbers is None:
        page_numbers = {i: "..." for i in range(1, 18)}

    toc_items = [
        (1, "Final problem statement and motivation"),
        (2, "Background and context"),
        (3, "Literature and existing solution review"),
        (4, "Gap analysis"),
        (5, "Stakeholder and target user analysis"),
        (6, "Customer and user requirements"),
        (7, "SDG mapping and rationale"),
        (8, "Proposed solution and methodology"),
        (9, "Functional and non-functional requirements"),
        (10, "Technology and tool selection with justification"),
        (11, "Feasibility study (technical, economic, operational, legal and ethical)"),
        (12, "Scope, exclusions, and limitations"),
        (13, "Risk analysis and mitigation strategy"),
        (14, "Work breakdown structure (WBS)"),
        (15, "Project timeline and expected deliverables"),
        (16, "Expected outcomes and success criteria"),
        (17, "References"),
    ]

    toc_rows_html = ""
    for num, title in toc_items:
        p_val = page_numbers.get(num, str(num + 2))
        toc_rows_html += f"""
        <div class="toc-line">
          <span class="toc-num">{num:02d}.</span>
          <span class="toc-title">{title}</span>
          <span class="toc-leader"></span>
          <span class="toc-page">Page {p_val}</span>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Glass-Box: Milestone 1 Report</title>
<style>
@page {{
  size: A4;
  margin: 18mm 18mm 18mm 18mm;
  @top-left {{ content: normal; }}
  @top-right {{ content: normal; }}
  @top-center {{ content: normal; }}
  @bottom-left {{ content: normal; }}
  @bottom-center {{ content: normal; }}
  @bottom-right {{
    content: "Page " counter(page);
    font-size: 8.5pt;
    font-family: Arial, Helvetica, sans-serif;
    color: #000000;
  }}
}}

@page cover-page {{
  size: A4;
  margin: 22mm 20mm 20mm 20mm;
  @top-left {{ content: normal; }}
  @top-right {{ content: normal; }}
  @top-center {{ content: normal; }}
  @bottom-left {{ content: normal; }}
  @bottom-center {{ content: normal; }}
  @bottom-right {{ content: normal; }}
}}

@page index-page {{
  size: A4;
  margin: 18mm 18mm 18mm 18mm;
  @top-left {{ content: normal; }}
  @top-right {{ content: normal; }}
  @top-center {{ content: normal; }}
  @bottom-left {{ content: normal; }}
  @bottom-center {{ content: normal; }}
  @bottom-right {{
    content: "Page 2";
    font-size: 8.5pt;
    font-family: Arial, Helvetica, sans-serif;
    color: #000000;
  }}
}}

* {{
  box-sizing: border-box;
  border-radius: 0 !important;
}}

body {{
  font-family: Arial, Helvetica, sans-serif;
  color: #000000;
  line-height: 1.45;
  font-size: 9pt;
  margin: 0;
  padding: 0;
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}

/* ================= COVER PAGE ================= */
.cover-container {{
  page: cover-page;
  page-break-after: always;
  height: 100%; min-height: 245mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #ffffff;
}}

.cover-header {{
  border-bottom: 2px solid #000000;
  padding-bottom: 12px;
}}

.inst-name {{
  font-size: 15pt;
  font-weight: bold;
  letter-spacing: 0.5px;
  color: #000000;
  text-transform: uppercase;
  margin: 0 0 3px 0;
}}

.inst-sub {{
  font-size: 10pt;
  font-weight: bold;
  color: #000000;
  text-transform: uppercase;
  margin: 0 0 2px 0;
}}

.inst-dept {{
  font-size: 9pt;
  color: #333333;
  margin: 0;
}}

.cover-body {{
  margin: auto 0;
  padding: 10px 0;
}}

.milestone-tag {{
  font-size: 9.5pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #000000;
  border: 1px solid #000000;
  padding: 4px 10px;
  display: inline-block;
  margin-bottom: 14px;
}}

.project-title {{
  font-size: 24pt;
  font-weight: bold;
  color: #000000;
  line-height: 1.15;
  margin: 0 0 8px 0;
}}

.project-subtitle {{
  font-size: 11.5pt;
  color: #333333;
  line-height: 1.35;
  margin: 0 0 16px 0;
}}

.project-abstract-box {{
  border: 1px solid #000000;
  padding: 10px 12px;
  font-size: 8.5pt;
  color: #000000;
  line-height: 1.45;
  margin-bottom: 18px;
  background: #ffffff;
}}

/* Excel-Style Tables */
table.excel-table {{
  width: 100%;
  border-collapse: collapse;
  font-size: 8pt;
  margin: 6px 0 8px 0;
  border: 1px solid #000000;
  background: #ffffff;
  break-inside: avoid;
  page-break-inside: avoid;
}}

table.excel-table th {{
  background-color: #f2f2f2;
  color: #000000;
  font-weight: bold;
  border: 1px solid #7f7f7f;
  padding: 3.5px 6px;
  text-align: left;
  font-size: 8pt;
}}

table.excel-table td {{
  border: 1px solid #bfbfbf;
  padding: 3.5px 6px;
  color: #000000;
  vertical-align: top;
  line-height: 1.35;
}}

table.excel-table tr.highlight td {{
  font-weight: bold;
}}

.cover-footer {{
  border-top: 1px solid #000000;
  padding-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 8pt;
  color: #333333;
}}

/* ================= INDEX / TOC PAGE (PAGE 2) ================= */
.index-container {{
  page: index-page;
  page-break-after: always;
}}

.section-header-title {{
  font-size: 14pt;
  font-weight: bold;
  color: #000000;
  margin: 0 0 2px 0;
  text-transform: uppercase;
  border-bottom: 2px solid #000000;
  padding-bottom: 4px;
}}

.section-header-sub {{
  font-size: 8.5pt;
  color: #444444;
  margin: 4px 0 10px 0;
}}

.toc-list {{
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
}}

.toc-line {{
  display: flex;
  align-items: baseline;
  padding: 5px 2px;
  font-size: 9pt;
  color: #000000;
}}

.toc-num {{
  width: 24px;
  font-weight: bold;
  color: #000000;
}}

.toc-title {{
  font-weight: normal;
  color: #000000;
}}

.toc-leader {{
  flex-grow: 1;
  border-bottom: 1px dotted #888888;
  margin: 0 6px;
  position: relative;
  top: -3px;
}}

.toc-page {{
  font-weight: bold;
  color: #000000;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 8.5pt;
  white-space: nowrap;
}}

/* ================= CONTENT PAGES (PAGE 3+) ================= */
.content-section {{
  margin-bottom: 10px;
}}

.page-break-before {{
  break-before: page;
  page-break-before: always;
}}

.sec-title {{
  font-size: 9.8pt;
  font-weight: bold;
  color: #000000;
  margin: 8px 0 4px 0;
  padding-bottom: 2px;
  border-bottom: 1px solid #000000;
  break-after: avoid;
  page-break-after: avoid;
  text-transform: uppercase;
}}

p {{
  margin: 0 0 4px 0;
  color: #000000;
  text-align: justify;
  font-size: 8.6pt;
  line-height: 1.4;
}}

ul, ol {{
  margin: 0 0 5px 0;
  padding-left: 18px;
  color: #000000;
  font-size: 8.6pt;
  line-height: 1.4;
}}

li {{
  margin-bottom: 2px;
}}

/* Code & Monospace */
code {{
  font-family: 'Courier New', Courier, monospace;
  font-size: 8.2pt;
  background: #ffffff;
  border: 1px solid #999999;
  color: #000000;
  padding: 0 3px;
}}

/* Architecture Black-and-White Box */
.arch-card-bw {{
  border: 1px solid #000000;
  margin: 10px 0;
  background: #ffffff;
  break-inside: avoid;
  page-break-inside: avoid;
}}

.arch-card-bw-header {{
  background: #f2f2f2;
  border-bottom: 1px solid #000000;
  padding: 5px 8px;
  font-weight: bold;
  font-size: 8pt;
  text-transform: uppercase;
  color: #000000;
  display: flex;
  justify-content: space-between;
}}

.arch-card-bw-body {{
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}}

.arch-tier {{
  border: 1px solid #7f7f7f;
  padding: 5px 7px;
  background: #ffffff;
}}

.arch-tier-title {{
  font-weight: bold;
  font-size: 7.5pt;
  text-transform: uppercase;
  margin-bottom: 4px;
  border-bottom: 1px solid #bfbfbf;
  padding-bottom: 2px;
}}

.arch-tier-items {{
  font-size: 7.5pt;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}}

.arch-item-box {{
  border: 1px solid #bfbfbf;
  padding: 2px 6px;
  background: #ffffff;
  font-size: 7.2pt;
}}

.arch-arrow {{
  text-align: center;
  font-size: 7.5pt;
  font-weight: bold;
  line-height: 1;
  color: #000000;
}}

/* WBS Clean Outlines */
.wbs-grid-container {{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 6px;
}}

.wbs-item {{
  border: 1px solid #7f7f7f;
  padding: 4px 6px;
  break-inside: avoid;
  page-break-inside: avoid;
  background: #ffffff;
}}

.wbs-item-title {{
  font-weight: bold;
  font-size: 8pt;
  color: #000000;
  margin-bottom: 2px;
}}

.wbs-sub {{
  font-size: 7.6pt;
  padding-left: 14px;
  margin: 0;
  color: #000000;
}}

/* Callouts / Scenarios */
.note-box {{
  border: 1px solid #000000;
  padding: 6px 10px;
  margin: 6px 0;
  font-size: 8.5pt;
  background: #ffffff;
  break-inside: avoid;
}}

/* References */
.ref-list {{
  list-style: none;
  padding: 0;
  margin: 0;
}}

.ref-item {{
  font-size: 8pt;
  color: #000000;
  padding: 3px 0 3px 20px;
  text-indent: -20px;
  line-height: 1.35;
  border-bottom: 1px solid #e0e0e0;
}}

.math {{
  font-family: 'Times New Roman', serif;
  font-style: italic;
}}
</style>
</head>
<body>

<!-- ================= PAGE 1: COVER PAGE ================= -->
<div class="cover-container">
  <div class="cover-header">
    <div class="inst-name">Bennett University</div>
    <div class="inst-sub">School of Computer Science Engineering & Technology (SCSET)</div>
    <div class="inst-dept">Bachelor of Computer Applications (BCA) • Major Project Specification</div>
  </div>

  <div class="cover-body">
    <div class="milestone-tag">Milestone-1: Project Proposal, Requirements & Feasibility</div>
    <h1 class="project-title">Glass-Box</h1>
    <div class="project-subtitle">Interactive Multi-Symbol Market Microstructure & ACID Transaction Simulator with Agentic AI</div>

    <table class="excel-table" style="margin-top: 18px;">
      <thead>
        <tr>
          <th style="width: 30%;">Project Attribute</th>
          <th style="width: 70%;">Specification Details</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Course & Context</strong></td>
          <td>Major Project / Capstone Specification (Milestone 1)</td>
        </tr>
        <tr>
          <td><strong>Academic Program</strong></td>
          <td>Bachelor of Computer Applications (BCA)</td>
        </tr>
        <tr>
          <td><strong>Institution</strong></td>
          <td>School of Computer Science Engineering & Technology (SCSET), Bennett University</td>
        </tr>
      </tbody>
    </table>

    <table class="excel-table" style="margin-top: 16px;">
      <thead>
        <tr>
          <th style="width: 35%;">Roll Number</th>
          <th style="width: 65%;">Student Name</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>S24BCAU0120</strong></td>
          <td>Apoorva Pandey</td>
        </tr>
        <tr>
          <td><strong>S24BCAU0106</strong></td>
          <td>Sameer Bhati</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="cover-footer">
    <div>School of Computer Science Engineering & Technology (SCSET), Bennett University</div>
    <div>Greater Noida, Uttar Pradesh, India</div>
  </div>
</div>

<!-- ================= PAGE 2: INDEX / TABLE OF CONTENTS ================= -->
<div class="index-container">
  <div class="section-header-title">Table of Contents</div>
  <div class="section-header-sub">Milestone 1 Section Index</div>

  <div class="toc-list" style="margin-top: 14px;">
    {toc_rows_html}
  </div>
</div>

<!-- ================= CONTENT PAGES (PAGE 3+) ================= -->
<div class="content-container">

  <!-- Section 1 -->
  <div class="content-section" id="sec-1">
    <div class="sec-title">1. Final Problem Statement and Motivation</div>
    <p>
      Most retail trading simulators like TradingView paper trading or Moneybhai let people submit simulated buy and sell orders, but they conceal the internal mechanics of the exchange. Users cannot inspect order queue priority, examine counterparty allocation, observe order book depth changes, or see why aggressive market orders incur severe price slippage when liquidity thins out. The exchange operates as an opaque black box returning only a single aggregated confirmation price.
    </p>
    <p>
      Simultaneously, computer science curricula typically introduce database concurrency control and ACID transactions through simplistic toy scenarios such as a single balance transfer from Account A to Account B. This fails to expose students to high-contention enterprise database dynamics, where concurrent multi-party order sweeps contend for the same row locks, multi-account settlements must commit atomically across <span class="math"><em>k</em> + 1</span> portfolios, and in-memory matching speeds directly conflict with disk write latency.
    </p>
    <p>
      Because of this dual educational disconnect, <strong>Glass-Box</strong> is proposed as an open-source, web-native educational electronic exchange, market microstructure simulator, and database concurrency laboratory. It exposes continuous double auction internals, displays row-level lock contention in PostgreSQL, and integrates an agentic AI tutor to provide mathematically grounded explanations of live market dynamics.
    </p>
  </div>

  <!-- Section 2 -->
  <div class="content-section" id="sec-2">
    <div class="sec-title">2. Background and Context</div>
    <p>
      Markets operate by matching bids and asks in an order book using price-time priority, which simply means that better prices get filled first and orders at the identical price level get processed in the order they arrived.
    </p>
    <p>
      Bids are what buyers want to pay. Asks are what sellers want to get.
    </p>
    <p>
      The spread between them widens when liquidity dries up, and when someone drops a large market order into thin book depth, prices degrade across price tiers, producing slippage and changing the average price. That changes execution cost. In India, equity exchanges like NSE operate with specific constraints including a tick size of 5 paise, single-share lot sizes, and daily price bands that limit swings to ten percent. We use symbols like TCS, INFY, RELIANCE, and HDFCBANK as mock instruments so the environment feels familiar. On the database side, memory matching runs in microseconds while relational disk persistence takes milliseconds, creating an interesting throughput bottleneck where memory state has to stay aligned with PostgreSQL tables. Things get out of sync easily if not handled carefully.
    </p>
  </div>

  <!-- Section 3 -->
  <div class="content-section" id="sec-3">
    <div class="sec-title">3. Literature and Existing Solution Review</div>
    <p>
      There are already several types of tools available, though each category leaves out parts of what we want to demonstrate. We looked at three of them.
    </p>
    <ol>
      <li>
        <strong>Commercial paper trading apps:</strong> Platforms like TradingView, Moneybhai, and NSE Paathshaala focus on technical analysis and charting indicators. They treat order fulfillment as an instant fill at whatever the last traded price was, meaning they skip simulated queue positions, slippage across multiple price tiers, and internal transaction logs. The server code is closed source. You cannot see how trades settle.
      </li>
      <li>
        <strong>Academic simulation engines:</strong> Systems like ABIDES or PyLOB simulate limit order books in detail, often with automated trading agents written for research papers. They are usually command-line tools written in Python or C++, often configured for US market settings, and setting them up takes work since they do not come with web interfaces or links to database learning. They work well for machine learning experiments, but are hard for beginners to inspect.
      </li>
      <li>
        <strong>Institutional and classroom trading simulators:</strong> Platforms like Stevens SHIFT (Stevens High Frequency Trading Simulation System), FTS Interactive Markets, and Rotman Interactive Trader (RIT) simulate electronic exchanges for university finance courses and trading competitions. However, these tools are built strictly from an external <em>market participant's</em> viewpoint students send orders to a closed binary via client tickets or FIX APIs without access to the matching engine's internal queues or database transactions. In addition, they are proprietary, expensive to license, US-centric, and run as legacy desktop software rather than open-source, web-native systems.
      </li>
    </ol>
  </div>

  <!-- Section 4 -->
  <div class="content-section page-break-before" id="sec-4">
    <div class="sec-title">4. Gap Analysis</div>
    <p>
      Existing options hide the exchange internals. Glass-Box inverts this paradigm, allowing students to inspect both the matching queue and database transaction execution in real time.
    </p>
    <table class="excel-table">
      <thead>
        <tr>
          <th style="width: 24%;">Dimension</th>
          <th style="width: 19%;">Retail paper trading (TradingView, Moneybhai)</th>
          <th style="width: 19%;">Academic engines (ABIDES, PyLOB)</th>
          <th style="width: 19%;">Institutional simulators (Stevens SHIFT, FTS)</th>
          <th style="width: 19%;">Glass-Box (this project)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Matching queue visibility</strong></td>
          <td>Hidden behind chart interface</td>
          <td>Terminal logs or text files</td>
          <td>Proprietary client / API depth only</td>
          <td>Visual depth ladder with queue rank</td>
        </tr>
        <tr>
          <td><strong>Partial fill and slippage trace</strong></td>
          <td>Single average fill price</td>
          <td>Raw event logs</td>
          <td>Aggregated fill confirmation</td>
          <td>Step-by-step collision tree breakdown modal</td>
        </tr>
        <tr>
          <td><strong>ACID transaction inspection</strong></td>
          <td>None</td>
          <td>None</td>
          <td>None (In-memory / Proprietary)</td>
          <td>PostgreSQL tables with row locking queries</td>
        </tr>
        <tr>
          <td><strong>Double-entry accounting checks</strong></td>
          <td>Basic balance subtraction</td>
          <td>None</td>
          <td>Hidden internal accounting</td>
          <td>Ledger entries checking debits equal credits</td>
        </tr>
        <tr>
          <td><strong>Crash recovery check</strong></td>
          <td>Not simulated</td>
          <td>Available</td>
          <td>Not exposed to students</td>
          <td>Replaying events from a write-ahead log</td>
        </tr>
        <tr>
          <td><strong>Interactive AI assistant</strong></td>
          <td>Generic chatbot or none</td>
          <td>None</td>
          <td>None</td>
          <td>LLM querying live database state via tools</td>
        </tr>
        <tr>
          <td><strong>Accessibility & Cost</strong></td>
          <td>Closed proprietary web apps</td>
          <td>CLI scripts (complex setup)</td>
          <td>Expensive commercial licenses</td>
          <td>Browser interface with open source (MIT)</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Section 5 -->
  <div class="content-section" id="sec-5">
    <div class="sec-title">5. Stakeholder and Target User Analysis</div>
    <p>
      Different groups of users have distinct reasons to care about this kind of setup. Computer science and BCA students studying database management need concrete examples of transaction isolation, row locks, and how write-ahead logs recover data after an unexpected process crash. While finance and business students often want to observe how bid-ask spreads fluctuate, what happens when an aggressive order eats through resting liquidity, and how volume-weighted average price gets calculated across multiple fills. They do not need to read database query plans. Faculty and lab instructors benefit from having pre-built lab exercises where they can intentionally simulate a crash, allowing students to observe recovery without writing complex code themselves. Small fintech teams or hobbyist algo developers could also use it as a lightweight sandbox to test order logic locally before connecting to production APIs. It avoids exchange fees.
    </p>
  </div>

  <!-- Section 6 -->
  <div class="content-section" id="sec-6">
    <div class="sec-title">6. Customer and User Requirements</div>
    <p>The functional requirements can be expressed through realistic user scenarios.</p>
    <ul>
      <li>As a computer science student, I want to send multiple market orders at once so that I can see PostgreSQL row lock waits and isolation level rollbacks happen on screen.</li>
      <li>As a finance student, I want to watch an incoming market order sweep through several price levels so that I can see how slippage and volume-weighted pricing actually work.</li>
      <li>As a student trying to understand a sudden price change, I want an AI helper that can call database query tools to check depth and recent trades before answering, so that the explanation is based on actual recorded data.</li>
      <li>As an instructor running a lab, I want to simulate an engine crash by killing the process so that students can test whether the write-ahead log restores the state properly.</li>
    </ul>
  </div>

  <!-- Section 7 -->
  <div class="content-section" id="sec-7">
    <div class="sec-title">7. SDG Mapping and Rationale</div>
    <ul>
      <li>
        <strong>SDG 4: Quality education (target 4.4):</strong> The simulator provides an open source laboratory where students can experiment with financial market mechanisms and database internals directly in a browser without paying software licensing costs. Interactive tools tend to help practical understanding.
      </li>
      <li>
        <strong>SDG 8: Decent work and economic growth (targets 8.2 and 8.10):</strong> Learning both backend database engineering and market microstructure concepts helps students build skills relevant to financial technology software development. Fintech systems require careful transaction handling.
      </li>
      <li>
        <strong>SDG 9: Industry, innovation and infrastructure (targets 9.5 and 9.b):</strong> Building an inspectable educational exchange tool supports local technology training and reduces the need for expensive proprietary software for classroom demonstrations. Code is open for anyone to inspect.
      </li>
    </ul>
  </div>

  <!-- Section 8 -->
  <div class="content-section page-break-before" id="sec-8">
    <div class="sec-title">8. Proposed Solution and Methodology</div>
    <p>
      The project is split into four main architectural layers that interact over local and WebSocket network connections:
    </p>

    <!-- Visual 5-Tier Architecture Diagram representing Mermaid graph TD -->
    <div class="arch-card-bw">
      <div class="arch-card-bw-header">
        <span>Glass-Box System Architecture</span>
        <span>Architectural Layers & Event Flows</span>
      </div>
      <div class="arch-card-bw-body">
        <div class="arch-tier">
          <div class="arch-tier-title">Client Layer (Browser)</div>
          <div class="arch-tier-items">
            <div class="arch-item-box">React 18 + Vite UI Cockpit</div>
            <div class="arch-item-box">Depth Ladder & OBI Gauge</div>
            <div class="arch-item-box">Collision Tree Modal</div>
            <div class="arch-item-box">Time-Travel Replay Scrubber</div>
            <div class="arch-item-box">Agentic AI Tutor Chat</div>
          </div>
        </div>

        <div class="arch-arrow">&uarr;&darr; WebSockets (Socket.io) Event Bus &uarr;&darr;</div>

        <div class="arch-tier">
          <div class="arch-tier-title">Real-Time Transport Layer</div>
          <div class="arch-tier-items">
            <div class="arch-item-box">WebSockets (Socket.io) Event Bus</div>
          </div>
        </div>

        <div class="arch-arrow">&uarr;&darr; Asynchronous Event Dispatch &uarr;&darr;</div>

        <div class="arch-tier">
          <div class="arch-tier-title">High-Performance Matching Core</div>
          <div class="arch-tier-items">
            <div class="arch-item-box">Go In-Memory Matching Engine</div>
            <div class="arch-item-box">Price-Time FIFO Order Book</div>
            <div class="arch-item-box">Asynchronous Trade Dispatcher</div>
          </div>
        </div>

        <div class="arch-arrow">&darr; Asynchronous Persist &amp; WAL Replay &darr;</div>

        <div class="arch-tier">
          <div class="arch-tier-title">Relational Persistence & Concurrency</div>
          <div class="arch-tier-items">
            <div class="arch-item-box">PostgreSQL 16 (3NF Schema)</div>
            <div class="arch-item-box">Atomic Settlement Engine (SELECT FOR UPDATE)</div>
            <div class="arch-item-box">Double-Entry Ledger Triggers (Debits == Credits)</div>
            <div class="arch-item-box">Write-Ahead Log (market_events_wal)</div>
          </div>
        </div>

        <div class="arch-arrow">&uarr;&darr; Database Inspection Tools (Depth, Slippage, VWAP) &uarr;&darr;</div>

        <div class="arch-tier">
          <div class="arch-tier-title">Agentic Intelligence Layer</div>
          <div class="arch-tier-items">
            <div class="arch-item-box">Google Gemini API (Function Calling)</div>
            <div class="arch-item-box">Database Inspection Tools (Depth, Slippage, VWAP)</div>
          </div>
        </div>
      </div>
    </div>

    <ul>
      <li>
        <strong>The In-Memory Matching Engine (Go):</strong> Maintained in-memory using doubly linked lists and hash maps to enforce price-time priority (FIFO) execution with sub-10-microsecond matching latency.
      </li>
      <li>
        <strong>Relational Persistence & Atomic Settlement (PostgreSQL 3NF):</strong> An asynchronous pipeline transfers executed trades to PostgreSQL. A normalized third-normal-form schema executes multi-counterparty atomic settlements across <span class="math"><em>k</em> + 1</span> accounts under pessimistic row-level locking (<code>SELECT ... FOR UPDATE</code>).
      </li>
      <li>
        <strong>Auditability & Financial Invariants:</strong> A bank-grade double-entry ledger table (<code>ledger_entries</code>) verifies mathematical balance equality (<span class="math">&sum; Debits &equiv; &sum; Credits</span>) and <code>CHECK (balance &gt;= 0)</code> constraints.
      </li>
      <li>
        <strong>Write-Ahead Log (WAL) & Crash Recovery:</strong> An append-only table (<code>market_events_wal</code>) records every event sequentially; an automated recovery script replays uncommitted events into RAM upon server restart (<code>kill -9</code>).
      </li>
      <li>
        <strong>Agentic AI Market Tutor:</strong> Embedded Google Gemini model equipped with structured tool-calling functions (<code>get_orderbook_depth</code>, <code>calculate_slippage</code>, <code>inspect_recent_trades</code>) to analyze live database state and deliver mathematically grounded causal explanations.
      </li>
      <li>
        <strong>Frontend Dashboard:</strong> Built with React 18 and Vite, streaming real-time depth ladders, Order Book Imbalance (OBI) gauges, collision tree execution traces, and latency telemetry over WebSockets.
      </li>
    </ul>
    <p>
      For methodology, development follows an <strong>Agile / Scrum framework</strong> with 2-week sprint cadences and Test-Driven Development (TDD) for financial invariants and matching correctness.
    </p>
  </div>

  <!-- Section 9 -->
  <div class="content-section page-break-before" id="sec-9">
    <div class="sec-title">9. Functional and Non-Functional Requirements</div>
    <p>The requirements separate baseline exchange operations from educational inspection features.</p>
    
    <p style="margin: 6px 0 3px 0;"><strong>Functional requirements:</strong></p>
    <ul>
      <li>Baseline features include submitting limit and market orders, rendering real-time order book depth for multiple symbols, tracking user portfolios, and handling order cancellations cleanly.</li>
      <li>Orders must cancel without ghost entries.</li>
      <li>Educational features include a step-by-step collision tree modal that unpacks how a single order swept multiple bids, an AI tutor with database query tools, tick-by-tick time travel playback, and an automated recovery test that replays events from write-ahead logs.</li>
      <li>Users can also tweak engine parameters like tick size to see how spreads react.</li>
    </ul>

    <p style="margin: 8px 0 3px 0;"><strong>Non-functional requirements:</strong></p>
    <ul>
      <li><strong>Throughput:</strong> The in-memory matching engine should process at least 50,000 orders per second, while PostgreSQL settlement should handle at least 1,000 multi-party transactions per second under simulated load.</li>
      <li><strong>Latency:</strong> Memory matching should complete within microseconds, database transaction commits should generally stay below 15 milliseconds, and WebSocket updates to the browser should take under 30 milliseconds.</li>
      <li>Fast UI updates prevent lag.</li>
      <li><strong>Consistency:</strong> Balance tables must strictly satisfy debit and credit equality, with database check constraints preventing negative balances or unbacked share transfers.</li>
      <li><strong>Recovery:</strong> When the backend process terminates unexpectedly, replaying the write-ahead log should restore the order book state in under five seconds with zero lost trades.</li>
      <li><strong>Accessibility:</strong> The application should run in standard modern browsers without extra software installs.</li>
    </ul>
  </div>

  <!-- Section 10 -->
  <div class="content-section" id="sec-10">
    <div class="sec-title">10. Technology and Tool Selection with Justification</div>
    <p>Here is how the core tech stack was chosen based on trade-offs between complexity and performance.</p>
    <table class="excel-table">
      <thead>
        <tr>
          <th style="width: 20%;">Component</th>
          <th style="width: 18%;">Selected tool</th>
          <th style="width: 22%;">Alternatives considered</th>
          <th style="width: 40%;">Reasoning and trade-offs</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Matching engine</td>
          <td>Go</td>
          <td>C++, Node.js</td>
          <td>Go offers fast goroutines and pointer manipulation without manual memory management headaches typical of C++.</td>
        </tr>
        <tr>
          <td>Relational database</td>
          <td>PostgreSQL 16</td>
          <td>Redis, MongoDB</td>
          <td>Strong ACID support, pessimistic row locking with <code>FOR UPDATE</code>, and reliable check constraints outweigh the raw write speed of key-value stores.</td>
        </tr>
        <tr>
          <td>AI assistant</td>
          <td>Google Gemini API</td>
          <td>Local open weights LLMs</td>
          <td>Structured function calling works out of the box and avoids needing dedicated GPU hardware for local model inference.</td>
        </tr>
        <tr>
          <td>Web frontend</td>
          <td>React 18 with Vite</td>
          <td>Next.js, plain JavaScript</td>
          <td>Vite provides quick build times and React handles dynamic state updates from high-frequency WebSocket streams cleanly.</td>
        </tr>
        <tr>
          <td>Communication layer</td>
          <td>WebSockets</td>
          <td>HTTP REST polling</td>
          <td>Bidirectional socket streaming gives lower latency for live depth book changes than repeated polling requests.</td>
        </tr>
      </tbody>
    </table>
    <p>
      We considered running everything in Node.js initially, but separating high-speed matching in Go from persistence in PostgreSQL gives a much better demonstration of realistic systems architecture. Node handles the API glue easily.
    </p>
  </div>

  <!-- Section 11 -->
  <div class="content-section page-break-before" id="sec-11">
    <div class="sec-title">11. Feasibility Study (Technical, Economic, Operational, Legal and Ethical)</div>
    <p>Feasibility looks reasonable across the main areas considered.</p>
    <table class="excel-table">
      <thead>
        <tr>
          <th style="width: 25%;">Area</th>
          <th style="width: 75%;">Feasibility Evaluation</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Technical feasibility:</strong></td>
          <td>The core Go matching engine and early Node server benchmarks are already functioning in the project repository. PostgreSQL handles row locking and transactions predictably, and integrating the Gemini API for tool calling is straightforward using standard REST endpoints, so the technical risk is manageable. The pieces already communicate.</td>
        </tr>
        <tr>
          <td><strong>Economic feasibility:</strong></td>
          <td>The financial cost to build and run this project is practically zero. All libraries, databases, and programming languages used are open source, and the entire system can run locally on student laptops or within free hosting tiers on platforms like Render if volume is low. However, a low to medium cost dedicated instance may be required if larger volumes of trading are expected.</td>
        </tr>
        <tr>
          <td><strong>Operational feasibility:</strong></td>
          <td>University computer labs only need a web browser and Docker or Node installed to run the lab modules. The interface is designed so students can follow guided lab steps without needing deep terminal expertise.</td>
        </tr>
        <tr>
          <td><strong>Legal and ethical considerations:</strong></td>
          <td>The application is purely educational and does not connect to real financial markets, handle real money, or execute orders through regulated brokers. Clear disclaimers will state that this is a simulated sandbox. We use synthetic order data and publicly known stock tickers without storing personal user information. Privacy risk is minimal.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Section 12 -->
  <div class="content-section" id="sec-12">
    <div class="sec-title">12. Scope, Exclusions, and Limitations</div>
    <p>Defining boundaries early prevents the project from becoming too broad.</p>
    <table class="excel-table">
      <thead>
        <tr>
          <th style="width: 50%;">Included in scope:</th>
          <th style="width: 50%;">Excluded from scope:</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <ul style="margin: 0; padding-left: 16px;">
              <li>Continuous double auction matching for four Indian stock symbols including TCS, INFY, RELIANCE, and HDFCBANK.</li>
              <li>Limit and market orders handled with price-time priority.</li>
              <li>Multi-party atomic trade settlement in PostgreSQL with double-entry ledger.</li>
              <li>AI tutoring agent with database query tools to inspect live depth and past executions.</li>
              <li>Replay crash recovery testing via write-ahead logs.</li>
            </ul>
          </td>
          <td>
            <ul style="margin: 0; padding-left: 16px;">
              <li>Options and futures pricing such as Black-Scholes formulas.</li>
              <li>Live connectivity to actual exchange networks via FIX protocol.</li>
              <li>Margin lending, short selling mechanics, or automated collateral liquidation.</li>
              <li>Distributed consensus protocols like Raft across multiple engine nodes. This was initially considered, however, Raft exceeded project complexity, hence it was excluded.</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
    <p>
      <strong>Limitations:</strong> The architecture runs on a single primary node, meaning distributed replication is not addressed in this milestone. Browser rendering also has practical limits, so WebSocket updates are capped at 60 frames per second to avoid UI stutter. Browsers drop frames because of heavy DOM painting.
    </p>
  </div>

  <!-- Section 13 -->
  <div class="content-section page-break-before" id="sec-13">
    <div class="sec-title">13. Risk Analysis and Mitigation Strategy</div>
    <table class="excel-table">
      <thead>
        <tr>
          <th style="width: 32%;">Risk description</th>
          <th style="width: 12%;">Type</th>
          <th style="width: 11%;">Likelihood</th>
          <th style="width: 10%;">Impact</th>
          <th style="width: 35%;">Planned mitigation</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Database deadlocks during multi-seller settlement</strong></td>
          <td>Technical</td>
          <td>Medium</td>
          <td>High</td>
          <td>Sort row locks deterministically by user ID and symbol ID before executing <code>SELECT FOR UPDATE</code>.</td>
        </tr>
        <tr>
          <td><strong>AI hallucination when explaining market state</strong></td>
          <td>Technical</td>
          <td>High</td>
          <td>High</td>
          <td>Restrict the model to tool calling so answers require data returned from actual database queries.</td>
        </tr>
        <tr>
          <td><strong>Inconsistency between memory book and PostgreSQL tables</strong></td>
          <td>Technical</td>
          <td>Medium</td>
          <td>High</td>
          <td>Maintain a sequence number in the event log to detect missing or reordered records.</td>
        </tr>
        <tr>
          <td><strong>Scope creep into complex financial derivatives</strong></td>
          <td>Project</td>
          <td>High</td>
          <td>Medium</td>
          <td>Keep derivatives strictly off the task list until core matching and settlement are finished.</td>
        </tr>
        <tr>
          <td><strong>Uneven work distribution among teammates</strong></td>
          <td>Team</td>
          <td>Low</td>
          <td>Low</td>
          <td>Assign separate module ownership for backend matching and frontend visualizations with GitHub pull requests.</td>
        </tr>
      </tbody>
    </table>
    <p>
      Multi-seller sweeps are vulnerable to cyclic deadlocks if portfolio and holding rows are locked out of sequence. To systematically prevent circular-wait conditions, our transaction pipeline enforces deterministic lock acquisition ordering by sorting account IDs prior to issuing <code>SELECT ... FOR UPDATE</code>.
    </p>
  </div>

  <!-- Section 14 -->
  <div class="content-section" id="sec-14">
    <div class="sec-title">14. Work Breakdown Structure (WBS)</div>
    <p>The project scope is structured into six hierarchical work packages (WBS 1.0 to 6.0), each with defined, testable deliverables:</p>
    
    <div class="wbs-grid-container">
      <div class="wbs-item">
        <div class="wbs-item-title">1.0 Project Planning, Requirements & Systems Architecture</div>
        <ul class="wbs-sub">
          <li>1.1 Problem formulation, academic literature review, and gap analysis</li>
          <li>1.2 System specification, non-functional latency/throughput budgets, and SDG alignment</li>
          <li>1.3 Ethics, regulatory boundary definition (SEBI circulars), and sandbox disclaimer drafting</li>
        </ul>
      </div>

      <div class="wbs-item">
        <div class="wbs-item-title">2.0 High-Performance In-Memory Matching Core</div>
        <ul class="wbs-sub">
          <li>2.1 Order object modeling (limit, market, cancellation) and multi-symbol state routing</li>
          <li>2.2 Doubly-linked list + hash map FIFO price-time priority order book implementation</li>
          <li>2.3 Synthetic burst generation harness and microsecond-level matching benchmark suite</li>
        </ul>
      </div>

      <div class="wbs-item">
        <div class="wbs-item-title">3.0 Relational Persistence & Concurrency Settlement Layer (PostgreSQL 3NF)</div>
        <ul class="wbs-sub">
          <li>3.1 3NF relational schema design (users, portfolios, securities_holdings, orders, trades)</li>
          <li>3.2 Atomic multi-party settlement engine with deterministic pessimistic locking (<code>SELECT ... FOR UPDATE</code>)</li>
          <li>3.3 Double-entry ledger journal (<code>ledger_entries</code>) with database balance invariant triggers (<span class="math">&sum; Debits &equiv; &sum; Credits</span>)</li>
          <li>3.4 Append-only Write-Ahead Log (<code>market_events_wal</code>) and automated state replay routine for crash recovery</li>
        </ul>
      </div>

      <div class="wbs-item">
        <div class="wbs-item-title">4.0 Frontend Educational Dashboard & Microstructure Visualizations (React + Vite)</div>
        <ul class="wbs-sub">
          <li>4.1 Real-time depth ladder and animated Order Book Imbalance (OBI) gauge</li>
          <li>4.2 Interactive "Glass-Box" Collision Tree execution trace modal (queue rank, VWAP, slippage breakdown)</li>
          <li>4.3 Tick-by-tick deterministic time-travel scrubber bar (0.25&times;, 0.5&times;, 1.0&times; replay)</li>
          <li>4.4 Systems latency telemetry cockpit (in-memory matching vs. database commit vs. network transport)</li>
        </ul>
      </div>

      <div class="wbs-item">
        <div class="wbs-item-title">5.0 Agentic AI Market Microstructure Tutor (Google Gemini API)</div>
        <ul class="wbs-sub">
          <li>5.1 Structured function-calling tool definition (<code>get_orderbook_depth</code>, <code>calculate_slippage</code>, <code>inspect_recent_trades</code>)</li>
          <li>5.2 Contextual prompt engineering to eliminate financial hallucination and enforce database-grounded explanations</li>
          <li>5.3 Conversational tutor UI integration within the dashboard</li>
        </ul>
      </div>

      <div class="wbs-item">
        <div class="wbs-item-title">6.0 Verification, Concurrency Benchmarking & Empirical Trials</div>
        <ul class="wbs-sub">
          <li>6.1 Parallel concurrency test suite (50+ simultaneous market orders evaluating lock contention and rollbacks)</li>
          <li>6.2 Simulated process crash (<code>kill -9</code>) durability verification and recovery time objective (RTO) benchmarking</li>
          <li>6.3 Pilot lab trial execution with student cohort and quantitative pedagogical clarity evaluation</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Section 15 -->
  <div class="content-section page-break-before" id="sec-15">
    <div class="sec-title">15. Project Timeline and Expected Deliverables</div>
    <p>The work is laid out across twelve weeks divided into four development sprints.</p>
    <p style="margin: 4px 0 6px 0;"><strong>Sprint breakdown:</strong></p>
    
    <table class="excel-table">
      <thead>
        <tr>
          <th style="width: 15%;">Sprint</th>
          <th style="width: 18%;">Timeline</th>
          <th style="width: 15%;">Status</th>
          <th style="width: 52%;">Deliverables</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Sprint 1</strong></td>
          <td>Weeks 1 to 3</td>
          <td>Done</td>
          <td>Basic matching engine, limit order queues, and initial Go benchmarks.</td>
        </tr>
        <tr>
          <td><strong>Sprint 2</strong></td>
          <td>Weeks 4 to 6</td>
          <td>Current focus</td>
          <td>PostgreSQL 3NF schema, atomic multi-party settlement, and double-entry triggers.</td>
        </tr>
        <tr>
          <td><strong>Sprint 3</strong></td>
          <td>Weeks 7 to 9</td>
          <td>Upcoming</td>
          <td>Gemini tool calling endpoints and the visual collision tree breakdown component.</td>
        </tr>
        <tr>
          <td><strong>Sprint 4</strong></td>
          <td>Weeks 10 to 12</td>
          <td>Final sprint</td>
          <td>Crash recovery replay verification, concurrency stress testing, and user feedback collection.</td>
        </tr>
      </tbody>
    </table>
    <p>
      Dates might shift slightly depending on complexity that arises during the project.
    </p>
  </div>

  <!-- Section 16 -->
  <div class="content-section" id="sec-16">
    <div class="sec-title">16. Expected Outcomes and Success Criteria</div>
    <p>Success will be measured by both technical reliability and how clearly user can follow the concepts.</p>
    
    <table class="excel-table">
      <thead>
        <tr>
          <th style="width: 50%;">Technical targets:</th>
          <th style="width: 50%;">Educational targets:</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <ul style="margin: 0; padding-left: 16px;">
              <li>State restoration from the write-ahead log should recover all confirmed trades after a sudden engine kill.</li>
              <li>Account balances must maintain strict debit-credit equality without negative balances appearing under concurrent load.</li>
              <li>In-memory matching should comfortably exceed 50,000 orders per second in local benchmarks.</li>
              <li>Numbers should stay stable under test.</li>
            </ul>
          </td>
          <td>
            <ul style="margin: 0; padding-left: 16px;">
              <li>Students in lab sessions should be able to trigger row lock contention and explain why the delay occurred using the UI telemetry.</li>
              <li>The AI assistant should correctly answer student queries about slippage and order depth using live database tool outputs.</li>
              <li>Post-lab surveys aim for over 80 percent positive ratings regarding conceptual clarity of database concurrency and order matching mechanics.</li>
              <li>Feedback will help refine the UI.</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Section 17 -->
  <div class="content-section" id="sec-17">
    <div class="sec-title">17. References</div>
    <ol style="margin: 0; padding-left: 18px; line-height: 1.5;">
      <li style="margin-bottom: 6px;">
        Glosten, L. R., and Milgrom, P. R. (1985). Bid, ask and transaction prices in a specialist market with heterogeneously informed traders. Journal of Financial Economics, 14(1), 71-100.
      </li>
      <li style="margin-bottom: 6px;">
        Securities and Exchange Board of India. (2023). Master circular for stock exchanges and clearing corporations.
      </li>
      <li style="margin-bottom: 6px;">
        Kleppmann, M. (2017). Designing data-intensive applications: the big ideas behind reliable, scalable, and maintainable systems. O'Reilly Media.
      </li>
      <li style="margin-bottom: 6px;">
        Harris, L. (2003). Trading and exchanges: market microstructure for practitioners. Oxford University Press.
      </li>
    </ol>
  </div>

</div>

</body>
</html>"""
    return html

def main():
    workspace_dir = "/home/ark/dev/stock-order-book"
    html_path = os.path.join(workspace_dir, "milestone_report.html")
    pdf_path = os.path.join(workspace_dir, "milestone-1.pdf")
    
    # Pass 1: generate initial HTML
    print("Generating initial HTML...")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(create_report_html())
        
    print("Compiling Pass 1 PDF with Chromium...")
    cmd1 = [
        "chromium",
        "--headless=new",
        "--no-sandbox",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        html_path
    ]
    subprocess.run(cmd1, check=True)
    
    # Extract text and detect page numbers for each section
    print("Detecting section page numbers via pdftotext...")
    txt_out = subprocess.check_output(["pdftotext", pdf_path, "-"], text=True)
    pages = txt_out.split('\x0c')
    
    sec_pages = {}
    for p_num in range(3, len(pages) + 1):
        page_content = pages[p_num - 1]
        for sec_idx in range(1, 18):
            if sec_idx not in sec_pages:
                pattern = rf'(?:^|\n)\s*{sec_idx}\.\s+[A-Z]'
                if re.search(pattern, page_content):
                    sec_pages[sec_idx] = str(p_num)
                    
    print("Detected section page mapping (Content starts Page 3):")
    for s in range(1, 18):
        print(f"  Section {s}: Page {sec_pages.get(s, 'N/A')}")
        
    # Pass 2: generate HTML with accurate page numbers
    print("Generating Pass 2 HTML with accurate TOC page numbers...")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(create_report_html(sec_pages))
        
    print("Compiling final PDF with Chromium...")
    subprocess.run(cmd1, check=True)
    
    pdf_size = os.path.getsize(pdf_path)
    print(f"Final PDF generated successfully: {pdf_path} ({pdf_size} bytes)")

if __name__ == "__main__":
    main()
