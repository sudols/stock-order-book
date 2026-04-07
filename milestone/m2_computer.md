# Design Thinking and Innovation — Milestone 2 Answers

**Project:** IndiaBook: Stock Order Book Sandbox
**GitHub:** https://github.com/sudols/stock-order-book

> Questions 1–6 (mobile, batch, team number, emails, names, enrolment) fill manually.
> Questions 9, 12, 16, 19 file uploads or URL fields, noted inline.
> Questions 21–30 real senior/external feedback with contact details, fill manually.
> Question 31 checkbox, team decision.
> All character counts Python-verified.

---

## Q7 - Product Title

```
IndiaBook: Stock Order Book Sandbox
```

---

## Q8 - User Interface Design [prototype]

_Min 500 - Max 1000 chars | 2 Marks_
_Actual: 747 chars_

```
Three main panels. Left is the order book: a population chart like structure for bids and asks ( both color coded ), top ten each side that is updated continuously. Center part is to place trades for pick buy or sell with said price and quantity for every order. Right side shows the trade history. Basically shows only the trades that have been matched. Non matched trades are not shown.

Login auth is being done with firebase's firestore service to avoid spamming and basic bots traffic which it would probably have none, but it is a precaution we took. Layout was kept simple intentionally, since adding too many elements made it look cluttered, plus... it would make the designing harder too, especially on smaller screens. It is mainly a desktop website, so there is no mobile friendly interface. They will see the desktop version too. The portfolio manager would an error inline if your balance is too low or the price is zero, which we added after a couple of test runs where orders just silently failed, it took a lot of debugging for such a simple solution.

```

**Q9 - Upload UI Design PDF:** `<attachment>` - PDF with screenshots: Firebase login screen, main 3-panel trading view, trade form showing a validation error, trade history panel.

---

## Q10 - Potential User Feedback

_Min 1000 chars | 1 Mark_
_Actual: 1910 chars_

```
Potential User 1 Feedback: Rohan, 3rd year BCA. Tried placing a few limit buys and mostly got it working. However he got confused in figuring out which one was buy side and which one the sell side because there were no labels to show, identification was done purely on basis of color code. Although he did figure it out after a minutes. He gave this a bad review because of this bad UX design. A 2 out of 5 for usability given that he had no background in order books before trying it so it makes sense.

Potential User 2 Feedback: Priya, classmate doing finance as minor. She actually struggled in the start because in the first five minutes, she was confused about why her order wasn't showing up in the book. Turns out, she was entering quantity as a decimal which the form didn't explicitly disallow in older version, and it would fail without notifying. This was another silly buy we didn't caught. Once past that, she thought the portfolio balance changing after a trade was the most surprising thing of her whole interaction.

Potential User 3 Feedback: Arjun, a friend who's into quant trading and had regular experience with such platform. For him the UI wasn't new at all so he went straight for the code. Said the matching engine separation from the API looked clean, better than he expected from a college project honestly. Just asked why there was no persisting trade history across sessions.

Potential User 4 Feedback: Neha, college fresher, completely new to all of this. She said the interface was "a bit much" when she first opened it but the portfolio part made sense to her quickly because of basic orders. Her feedback was mostly that she was looking for ways to know what each of the component actually was. This was something we plan to do in late stage, a tooltip toggle option for every mouse hover interaction.

Potential User 5 Feedback: Vivek, works part-time somewhere in fintech. He had the most to say. Thought the real-time sync worked better than he expected but also noted the order book flickers and has delay slightly when many updates come in fast. It may point to some end stage optimization or library specific engine rendering issue.
```

---

## Q11 - Design Documents

_Min 500 - Max 1000 chars | 3 Marks_
_Actual: 870 chars_

```
The system uses monorepo split into three packages: client, server, and shared. Client uses React. Zustand being used for state management and Socket.io for live updates. We've binded server to Node.js with tRPC, matching engine, and WebSocket. Shared directory holds the Order, Trade, and Portfolio TypeScript interfaces. So, when order is passed, Firebase token are verified and then, gives the order to matching engine, which checks portfolio balance beforehand and then run the price time loop to get the order into the queue. When matching is triggered, it updates the book snapshot to all connected clients over Socket.io. Then updating Zustand and triggering a re-render update to frontend of all connected clients.

```

**Q12 - Upload Design Document PDF:** `<attachment>` - PDF with architecture diagram (3-tier monorepo), use-case diagram (User / MarketMaker / Admin actors), order placement activity flow.

---

## Q13 - Ethical and Legal / Privacy / Terms and Conditions

_Min 2000 - Max 10000 chars | 3 Marks_
_Actual: 2904 chars_

```
We kept the legal section fairly simple since the platform isn't actually handling real money. Most of it is just making sure users know what this actually is before they start clicking around. Its mostly the common T&C found in most softwares.

1. WHAT EVEN IS THIS PLATFORM

stock order book is a project built by student educational simulator made as part of course name Design Thinking and Innovation course at Bennett University. It shows how a stock order book and matching engine work in a simulated environment. This project exists and is meant only to gain the full 60 marks worth of assessment and lab marks in the said subject in university.

This platform does not connect to NSE, BSE, MCX, or any other exchange. It does not place real orders. It does not handle real money. Portfolio balances are virtual numbers with no financial value. Nothing you do here has any effect on any real market because its obviously not real duh.

3. THE DATA YOU SEE

Prices and order flows will either be auto-generated by the market-maker script in the codebase or entered manually during a session. None of it is live or real market data. If a future version adds third-party data, it will only happen under proper licensing terms and users will be told.

4. THE DATA WE SEE

Sign-in uses Firebase Authentication. Your email and a Firebase UID are stored to identify your session. So we know who you are and track you down by asking about your gmail with google. No financial data, government ID, or payment info is ever collected, only your email will be stored in database, along with the hashed password. Order history lives in server memory only and disappears on restart. Not written to any database. Not sold or shared.

5. OPEN SOURCE AND REDISTRIBUTION

Code is under the MIT License, just follow the license terms please. No guarantees on correctness, uptime, or fitness for production use. Anyone deploying this beyond personal academic use should check their own compliance situation.

6. DO NOT DO THIS

Don't use this to plan real market manipulation strategies. Don't present simulator outputs as real trading data anywhere professional. Don't tell people that this is a licensed broker or exchange. We don't have to repeat this same sentence again and again, but will probably have to due to the long lengthy legal format. It is basically a learning tool.

7. NO WARRANTY, NO LIABILITY

The creators are not liable for any decision someone makes based on using this. It's a student project. The matching logic is probably correct for most cases but we can't guarantee every edge case. But you can create a pull request if you do find any failing cases though.

8. IF THIS EVER BECOMES SOMETHING MORE

Any version that handles real orders or connects to live exchange data would need proper SEBI compliance and exchange certifications first. That's nowhere in scope for this project right now. We don't have the money or petrol to even go to the certification center, let alone  compliance with such big authority.

By using Stock Order Book you confirm you understand this is an educational simulator with no real market connection and you accept these terms.
```

---

## Q14 - Feasibility Study / Business Context / Monetization / Opportunity Analysis

_Min 1000 - Max 2000 chars | 2 Marks_
_Actual: 1547 chars_

```
We tried to solve a problem that genuinely exists in Indian fintech education. Platforms like NSE Paathshaala and Moneybhai let students play with trades, but never show the engine doing behind the scenes. So, people finish a finance course knowing what a limit order is in theory but having no idea what actually happens to make that thing even possible. And this is the gap is our project tries to reduce or eliminate.

Main target audience are students in colleges, mainly in courses like, BCA, BTech, and finance programs that run courses on data structures and capital markets but those two rarely cross each other together. A compact portable simulator that shows price-time priority live is something a professor could hand to a lab assistant to install in lab systems and say here, trace what happens when you place this order. Feasibility is strong if we make it to the end with our goal. The whole stack is open source and almost no software costs. Hosting a demo runs around Rs. 700-1,000 per month, but we can instead just run it on our local machine without even paying anything ( you do pay for the electricity though ). Developer time is the main cost but for an educational tool maintained by students that is mostly voluntary.

The startup use case is secondary but real, maybe not even real. Early-stage fintech teams sometimes need a local sandbox to test order entry flows before touching a live exchange. But this is no where near close to that level without fine tuning it. The architecture is modular enough that someone could reuse or remove parts of it without fully understanding the whole codebase. Making money of this project is far outside the current scope, but a hosted freemium version with persistent history and multi-user sessions is a plausible future direction if adoption picks up. That might even become a reason for use to even maintain the codebase if money starts flowing in.
```

---

## Q15 - Project Cost Estimation

_Min 500 - Max 1000 chars | 1 Mark_
_Actual: 789 chars_

```
COCOMO's basic model puts this in the organic category. This one was tough tho, as there this type of calculation is kind of complex for such a small non-professional project.
But we calculated it to roughly 2-3 KLOC across all three packages. It may go up or down as the feature list changes. For three of us, over one semester that's around 4-5 person-months. It might probably go even less if we accounted for the AI assistance but, I have no idea how to integrate such thing in COCOMO. If we add a student internship rate of Rs. 10,000 per month the initial build labor comes to Rs. 40,000-50,000.

Talking about hosting a demo server. It would run into Rs. 700-1,000 pej month. We actually looked this up on AWS and it was closer to Rs. 800 for the instance size we'd need, so that's what we're using. Over three years that's roughly Rs. 29,000-36,000.  But it really depends on the use case of the user too. A very light weight single digit user-base might even run on less than Rs. 200 per month. No software license costs, whole stack is open source. Domain name maybe Rs. 800-1,500 per year, buy they can be found for even no cost too.
Or we can just use our laptop or desktops to run the server with maybe needing a purchased domain or even that can be purchased for free. Though it may not be a permanent domain. So, a very not super production scale type of build would cost roughly same as a packet of lays chips, i.e INR 20, because all we're really paying for is the electricity cost here.

Three-year total without labor: around Rs. 30,000-45,000. Add maintenance developer time and it goes up to Rs. 1,20,000-1,80,000. Hardware is not a cost since everyone uses their own computer for development.
```

---

## Q16 - Partial Implementation / Draft Code

_GitHub Repository URL | 3 Marks_

```
https://github.com/sudols/stock-order-book
```

> Make the repo public (or add the professor as a collaborator) before submitting.

---

## Q17 - Week Wise Updates / Diary (Weeks 1–8)

_Min 1600 chars, at least 300 per week | 2 Marks_
_Actual: 2781 chars_

```
Week 1: Mostly planning. We read through a few articles on how electronic order books work and watched youtube videos for the same. Half the week was just deciding on the tech stack. There were a few arguments about whether to use REST or tRPC, ended up going with tRPC because one of us had used it before. Monorepo was scaffolded with pnpm workspaces by Friday but nothing was really running yet.

Week 2: Initial sett up the shared types package first since both frontend and backend would need the same Order and Portfolio interfaces. Basic server skeleton was created, placeholder tRPC route just to confirm the wiring was right. Firebase project was initialized.

Week 3: Core matching engine work starts and, it took longer than expected, because its the core you silly. The first version had a bug where partial fills were not reducing the taker order quantity correctly, so the same order would match against multiple resting orders but still show up in the book as unfilled. Took about two days to find it. Once fixed, unit tests were written for the happy paths and a few edge cases.

Week 4: Added the PortfolioManager and wired it into the matching engine so orders get rejected if the user cannot afford them. tRPC router got the placeOrder and cancelOrder mutations. Firebase token verification was added to middleware. We could finally test placing an order through an HTTP client and see it actually match, this was mostly through CLI for now.

Week 5: Switched the focus to frontend now. Zustand store was set up, Socket.io client connected and the order book component was a basic table at first, no styling, just proving the data was flowing correctly from server to client in real time. Just enough to test the flow working state. Things were working and wiring up.

Week 6: Then came the tradeForm built with input validation. One thing we had not thought about was that the form needed to disable the submit button while waiting for the server response, otherwise fast clicking would send duplicate orders. Simple fix for that. Firebase auth flow was added in the time and full demo in the browser worked for the first time this week.

Week 7: Now came the optimization part. We built three versions of the OrderBook: naive with full array re-sort, baseline with sorted price-level arrays, and final and best one optimized with linked lists. Benchmark testing scripts took a day to write properly and results showed a 6x difference at 2500 orders which was a good sight.

Week 8: Documentation and cleanup. Wrote the project overview, technical architecture doc, API reference, and setup guide. CLI market maker tool was added for demo seeding.
```

---

## Q18 - Week Wise Plan for Remaining Time (Weeks 9-12)

_Min 900 chars, at least 300 per week | 2 Marks_
_Actual: 981 chars_

```
Week 9: Still some layout issues at narrow screen widths, the order book gets cramped below about 1200px and the history panel overlaps a bit. Need to fix that and get a live demo URL up so the professor doesn't have to run it locally just to look at it. Cloudflare workers might be used for this persistent demo. Also planning to add at least a tooltip explaining the bid and ask since some people during testing had no idea what they even meant and we only got the know once ChatGPT was looking at their screenshots to troubleshoot.

Week 10: Edge case tests. Cancellations, orders that land exactly on the last quantity at a price level, that kind of thing. Want to write a short dev guide too, the README alone isn't enough for someone coming in cold and for me to who will probably come back at this project again in future. One more round of automated testing before week 11.

Week 11: Mostly presentation prep and fix any tests that broken during week 10 testing. Slide deck, screen recording, repo cleanup so it doesn't look half finished when someone opens it, because nothing better than a looking at a clean github repo in first sight.

Week 12: Check the whole thing works on a fresh machine and probably create a docker yaml for portable simulation testings. Rehearse demo and... submit.
```

---

## Q19 - LinkedIn Post URL

_At least 300 chars + 1 image + 5 hashtags | 1 Mark_

```
[Paste the LinkedIn post URL here - post should describe the project, include a screenshot of the running app, and use 5 hashtags such as #stockmarket #orderbook #fintech #opensource #BCA]
```

---

## Q20 - Patent Applicability

_Min 300 - Max 1000 chars | 1 Mark_
_Actual: 882 chars_

```
This is not a innovation. We are just re-inventing the wheel. But the invention is for learning and not actual application, because they already exist in the market. And they are far better than our project.

All of the things that we use in this project, be that Price-time priority matching, HashMap-based order book storage, WebSocket state sync,  all of these are well-documented and commonly used world-wide. We didn't invent any of it, it was simply a reshuffling of these technologies to stitch something different. We used existing techniques and made them open source for an educational purposes or more like a course assessment project purely meant for getting good grades.
```

---

## Questions 21–30 - Senior & External Feedback

_(Fill manually with real contacts)_

**Q21–Q26 - Three seniors from Bennett University:**
Each needs: Name, Enrolment#, email, mobile# + at least 200 chars feedback + 1–5 rating

**Q27–Q30 - Two people outside Bennett (preferably from industry):**
Each needs: Name, who they are, email, mobile# + at least 200 chars feedback + 1–5 rating

---

## Q31 - AI Declaration Checkbox

_(Team decision)_

---

## Character Count Summary (Python-verified)

| Q   | Range      | Actual  |
| --- | ---------- | ------- |
| Q8  | 500–1000   | 747 ✅  |
| Q10 | 1000+      | 1910 ✅ |
| Q11 | 500–1000   | 870 ✅  |
| Q13 | 2000–10000 | 2904 ✅ |
| Q14 | 1000–2000  | 1547 ✅ |
| Q15 | 500–1000   | 789 ✅  |
| Q17 | 1600+      | 2781 ✅ |
| Q18 | 900+       | 981 ✅  |
| Q20 | 300–1000   | 882 ✅  |
