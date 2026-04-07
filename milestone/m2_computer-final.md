---

## Q8 - User Interface Design [prototype]

_Min 500 - Max 1000 chars | 2 Marks_
_Actual: 747 chars_

Three main panels. Left is the order book: a population chart like structure for bids and asks ( both color coded ), top ten each side that is updated continuously. Center part is to place trades for pick buy or sell with said price and quantity for every order. Right side shows the trade history. Basically shows only the trades that have been matched. Non matched trades are not shown.

Login auth is being done with firebase's firestore service to avoid spamming and basic bots traffic which it would probably have none, but it is a precaution we took. Layout was kept simple intentionally, since adding too many elements made it look cluttered, plus... it would make the designing harder too, especially on smaller screens. It is mainly a desktop website, so there is no mobile friendly interface. They will see the desktop version too. The portfolio manager would an error inline if your balance is too low or the price is zero, which we added after a couple of test runs where orders just silently failed, it took a lot of debugging for such a simple solution.

---

## Q10 - Potential User Feedback

_Min 1000 chars | 1 Mark_
_Actual: 1910 chars_

Potential User 1 Feedback: Rohan, 3rd year BCA. Tried placing a few limit buys and mostly got it working. However he got confused in figuring out which one was buy side and which one the sell side because there were no labels to show, identification was done purely on basis of color code. Although he did figure it out after a minutes. He gave this a bad review because of this bad UX design. A 2 out of 5 for usability given that he had no background in order books before trying it so it makes sense.

Potential User 2 Feedback: Priya, classmate doing finance as minor. She actually struggled in the start because in the first five minutes, she was confused about why her order wasn't showing up in the book. Turns out, she was entering quantity as a decimal which the form didn't explicitly disallow in older version, and it would fail without notifying. This was another silly buy we didn't caught. Once past that, she thought the portfolio balance changing after a trade was the most surprising thing of her whole interaction.

Potential User 3 Feedback: Arjun, a friend who's into quant trading and had regular experience with such platform. For him the UI wasn't new at all so he went straight for the code. Said the matching engine separation from the API looked clean, better than he expected from a college project honestly. Just asked why there was no persisting trade history across sessions.

Potential User 4 Feedback: Neha, college fresher, completely new to all of this. She said the interface was "a bit much" when she first opened it but the portfolio part made sense to her quickly because of basic orders. Her feedback was mostly that she was looking for ways to know what each of the component actually was. This was something we plan to do in late stage, a tooltip toggle option for every mouse hover interaction. It will be disabled by default to not become annoying.

Potential User 5 Feedback: Vivek, works part-time somewhere in fintech. He got the most words. He went straight to testing. The real-time sync worked better than he expected but also noted the order book flickers and has delay slightly when many updates come in fast. It may point to some end stage optimization or library specific engine rendering issue.

---

## Q11 - Design Documents

_Min 500 - Max 1000 chars | 3 Marks_
_Actual: 870 chars_

Initial plan was to maintain separate repository for frontend and backend. But that was making things complicated, so we instead used a monorepo. There are three main packages, that are: client, server, and shared. Client uses React. Zustand being used for state management and Socket.io for live updates. Server to built on Node.js, that contains tRPC, matching engine, and WebSocket. The third package, i.e the directory called "Shared" holds the Order, Trade, and Portfolio TypeScript interfaces. This one is mainly for debugging purposes, as it doesn't hold any meaning on its own. We were initially planning to create a auth system. But that was too much of hassle, so instead used Firebase.

---

## Q13 - Ethical and Legal / Privacy / Terms and Conditions

_Min 2000 - Max 10000 chars | 3 Marks_
_Actual: 2904 chars_

Most of it is just making sure users know what this actually is before they start clicking around. It's the common T&C found in most softwares, just reduced to be within the word limit.

1. WHAT IS THIS PLATFORM

stock order book is a project built by student as a educational simulator made part of course name Design Thinking and Innovation course at Bennett University. It shows how a stock order book and matching engine works in a simulated environment. This project exists and is meant only to gain the full 60 marks worth of assessment and lab marks in the said subject in university.

This platform does not connect to any real stock exchange ( NSE, BSE to name ). It does not place real orders. It does not handle real money. Portfolio balances are virtual numbers with no financial value similar to you. Nothing you do here has any effect on any real market because its obviously not real duh.

3. THE DATA YOU SEE

Prices and order flows will either be auto-generated by the market-maker script in the codebase or entered manually during a session and decided as market sees the value. None of it is live or real market data. If a future version adds third-party data, it will only be used once the user is notified.

4. THE DATA WE SEE

Sign-in uses Firebase Authentication. Your email and a Firebase UID are stored to identify your session. So we know who you are and track you down by asking about your gmail with google. No financial data, payment or government info is collected, only your email will be stored in database, along with the hashed password. Order history lives in server memory only and disappears on restart. Not written to any database.

5. OPEN SOURCE AND REDISTRIBUTION

This project is uses MIT License, just follow the license terms please. There is no guarantee on correctness of uptime for production use.

6. DO NOT DO THIS

It should not be used to plan real market manipulation strategies. Do not present simulator outputs as real trading data anywhere in professional. Don't tell people that this is a licensed broker or exchange. We don't have to repeat this same sentence again and again, but will probably have to due to the long lengthy legal format.

7. NO WARRANTY, NO LIABILITY

The creators are not liable for any decision someone makes based on using this. It's a student project. The matching logic is probably correct for most cases but we can't guarantee every edge case, if you find any. Fix it on your own or create a pull request on the github page.

8. IF THIS EVER BECOMES SOMETHING MORE

Any version that handles real orders or connects to live exchange data would need proper SEBI compliance and exchange certifications first. This is not in scope of this project right now. We don't have the money or petrol to even go to the certification center, let alone compliance with such big authority.

By using Stock Order Book you confirm you understand this is an educational simulator with no real market connection and you accept these terms.

---

## Q14 - Feasibility Study / Business Context / Monetization / Opportunity Analysis

_Min 1000 - Max 2000 chars | 2 Marks_
_Actual: 1547 chars_

Well, there are platforms like NSE paathshaala and moneybhai which lets student play with trades and similar stuff. And... that's it. Nothing more than doing trades. They don't have tutorials for things like how the engine does the matching. And what ends up happening is students would get the financial knowledge of how and what to trade but never understand how the trade actually work.
And we tried solving that problem with our platform. It's still a similar platform to the same function as the mentioned platforms, but the code is opensource with very good documentation.

For our project, we specifically targeted students who like to see the technical side. These are people in program of BCA, Btech and a hybrid technical side of MBA and finance programs that run on data structures. This project is built to be compact that really just needs a git clone and npm run dev on a machine. And it will work out of the box even on most of the potato hardware. But trades will be very slow if trades are scaled it up to millions. Professor can you the simulator along with our documentation to teach students how the trading matching works. And there's no need for any licensing because the whole stack is using open source technologies, and it's licensed with MIT. So people are free to modify or sell our project in their own name. It can even be hosted on cheap hardware for less than Rs. 1000 a month, but running locally would be better as its much cheaper.
For the maintenance part, we need at-least one developer to do the basic bug fixes and feature pushes. They may even be able to maintain it full time if the project doesn't scale too much.

Well that on the education side. This can also be used in a early fintech startup for doing some local sandbox testing too. This may very well be a safer option instead of touching the live exchange. The codebase was built to be modular that someone can just remove or add parts to it without going through the whole codebase ( because all that person needed to do was change the button style ). But this is it for this project. It is not something that we can use to make money off. The current scope is far beyond that point and we need to add paid features for this to even be possible.

---

## Q15 - Project Cost Estimation

_Min 500 - Max 1000 chars | 1 Mark_
_Actual: 789 chars_

COCOMO's basic model puts this in the organic category. This one was tough tho, as there this type of calculation is kind of complex for such a small non-professional project.
But we calculated it to roughly 2-3 KLOC across all three packages. It may go up or down as the feature list changes. For three of us, over one semester that's around 4-5 person-months. It might probably go even less if we accounted for the AI assistance but, I have no idea how to integrate such thing in COCOMO. If we add a student internship rate of Rs. 10,000 per month the initial build labor comes to Rs. 40,000-50,000.

Talking about hosting a demo server. It would run into Rs. 700-1,000 per month. We actually looked this up on AWS and it was closer to Rs. 800 for the instance size we'd need, so that's what we're using. Over three years that's roughly Rs. 29,000-36,000. But it really depends on the use case of the user too. A very light weight single digit user-base might even run on less than Rs. 200 per month. No software license costs, whole stack is open source. Domain name maybe Rs. 800-1,500 per year, buy they can be found for even no cost too.
Or we can just use our laptop or desktops to run the server with maybe needing a purchased domain or even that can be purchased for free. Though it may not be a permanent domain. So, a very not super production scale type of build would cost roughly same as a packet of lays chips, i.e INR 20, because all we're really paying for is the electricity cost here.

Three-year total without labor: around Rs. 30,000-45,000. Add maintenance developer time and it goes up to Rs. 1,20,000-1,80,000. Hardware is not a cost since everyone uses their own computer for development.

---

## Q17 - Week Wise Updates / Diary (Weeks 1–8)

_Min 1600 chars, at least 300 per week | 2 Marks_
_Actual: 2781 chars_

Week 1: This is mostly planning. We read through a few articles and youtube videos on how order books work. Half the week was just deciding on the tech stack, the main issue was choosing between using REST or tRPC, and we ended up going with tRPC because one of us had used it before. Monorepo was scaffolded with pnpm workspaces by Friday but nothing was really running yet.

Week 2: Now the initial setup of shared types package was initiated. Since both frontend and backend would need the same Order and Portfolio interfaces, so we used monorepo. Basic server skeleton was created, and placeholder tRPC route just to confirm the wiring was right. Firebase project was also initialized.

Week 3: Core matching engine work starts and, it took longer than expected, because its the core you silly, obviously it will take time. The first version had a bug where partial fills were not reducing the taker order quantity correctly, so the same order would match against multiple resting orders but still show up in the book as unfilled. Took about two days to find it. Once fixed, unit tests were written for the happy paths and a few edge cases.

Week 4: Added the PortfolioManager and wired it into the matching engine so orders get rejected if the user cannot afford them. Implemented tRPC router with placeOrder and cancelOrder. Firebase token verification was added to middleware. We could finally test placing an order through an HTTP client and see it actually match, this was mostly just running Curl command on the endpoints.

Week 5: This was when frontend work started with Zustand and Socket.io client connected and the order book component was a basic table at first, no styling, just proving the data was flowing correctly from server to client in real time. Just enough to test the flow working state.

Week 6: Form with input validation was added. One thing we had not thought about was the form needed to disable the submit button while waiting for the server response, otherwise fast clicking would send duplicate orders. Simple fix for that. Firebase auth flow was added in the time and full demo in the browser worked for the first time this week.

Week 7: Another intensive feature was on the way. Optimization. We built three versions of the OrderBook: naive with full array re-sort, baseline with sorted price arrays, and final which was best optimized with linked lists. Benchmark testing scripts took a day to write properly and results showed a 6x difference between worst and best version.

Week 8: The lightest week so far. We got some breathing done here. Most just documentation and cleanup. Wrote the project overview, technical architecture doc. CLI market maker tool was added for demo seeding.

---

## Q18 - Week Wise Plan for Remaining Time (Weeks 9-12)

_Min 900 chars, at least 300 per week | 2 Marks_
_Actual: 981 chars_

Week 9: Need to get a live demo URL up so the professor doesn't have to run it locally just to look at it. Cloudflare workers might be used for this persistent demo. Also, planning to add at least a tooltip explaining the bid and ask since some people during testing had no idea what they even meant and we only got the know once ChatGPT was looking at their screenshots to troubleshoot.

Week 10: Add edge case tests. Want to write a short dev guide too, because README alone isn't enough for someone coming in cold, and for me too who will probably come back at this project again in future. Also want to add a automated CI/CD with github actions so the live URL gets updated automatically one very git commits.

Week 11: Mostly presentation prep and fix any tests that broken during week 10 testing. Slide deck, screen recording, repo cleanup so it doesn't look half finished when someone opens it, because nothing better than a looking at a clean github repo in first sight.

Week 12: Check the whole thing works on a fresh machine and probably create a docker yaml for portable simulation testings. Rehearse demo and... submit.

---

## Q20 - Patent Applicability

_Min 300 - Max 1000 chars | 1 Mark_
_Actual: 882 chars_

This is not a innovation. We are just re-inventing the wheel. But the invention is for learning and not actual application, because they already exist in the market. And they are far better than our project.

All of the things that we use in this project, be that Price-time priority matching, HashMap-based order book storage, WebSocket state sync, all of these are well-documented and commonly used world-wide. We didn't invent any of it, it was simply a reshuffling of these technologies to stitch something different. We used existing techniques and made them open source for an educational purposes or more like a course assessment project purely meant for getting good grades.
