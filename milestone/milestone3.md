<div style="text-align:center; page-break-after: always;">
  <img src="cover-page-1.png" alt="Cover Page" style="width:100%; height:auto; display:block; margin:0 auto;" />
</div>

# DECLARATION

I/We hereby declare that the work presented in this report entitled **"Stock Order Book with Real-Time Matching Engine"** is an authentic record of our own work carried out at School of Computer Science Engineering and Technology, Bennett University, Greater Noida.

The matter and results presented in this report have not been submitted by us for the award of any other degree or diploma elsewhere.

**Apoorva Pandey**  
(**S24BCAU0120**)

**Ansh Shirvastav**  
(**S24BCAU0102**)

**Sameer Bhati**  
(**S24BCAU0106**)

<div class="page-break"></div>

# ACKNOWLEDGEMENT

We would like to express our sincere thanks to our mentor, faculty members, and the School of Computer Science Engineering and Technology for giving us the guidance and support needed during this project. So, this project took many rounds of designing, coding, debugging, changing things again, and then testing one more time, and the help from teachers and teammates really mattered in that whole process.

Also, we are thankful to our friends and classmates who gave feedback on the system and helped in checking the usability of the order book screens. And, finally, we thank our team members because this project had both frontend work and backend system logic, so it was not possible without proper division of work.

**Signature of Candidate(s)**

**Apoorva Pandey**  
(**S24BCAU0120**)

**Ansh Shirvastav**  
(**S24BCAU0102**)

**Sameer Bhati**  
(**S24BCAU0106**)

<div class="page-break"></div>

# TABLE OF CONTENTS

- [LIST OF TABLES](#list-of-tables)
- [LIST OF FIGURES](#list-of-figures)
- [LIST OF ABBREVIATIONS](#list-of-abbreviations)
- [ABSTRACT](#abstract)
- [1. INTRODUCTION](#1-introduction)
  - [1.1 Problem Statement](#11-problem-statement)
- [2. BACKGROUND RESEARCH](#2-background-research)
  - [2.1 Proposed System](#21-proposed-system)
  - [2.2 Goals and Objectives](#22-goals-and-objectives)
- [3. PROJECT PLANNING](#3-project-planning)
  - [3.1 Project Lifecycle](#31-project-lifecycle)
  - [3.2 Project Setup](#32-project-setup)
  - [3.3 Stakeholders](#33-stakeholders)
  - [3.4 Project Resources](#34-project-resources)
  - [3.5 Assumptions](#35-assumptions)
- [4. PROJECT TRACKING](#4-project-tracking)
  - [4.1 Tracking](#41-tracking)
  - [4.2 Communication Plan](#42-communication-plan)
  - [4.3 Deliverables](#43-deliverables)
- [5. SYSTEM ANALYSIS AND DESIGN](#5-system-analysis-and-design)
  - [5.1 Overall Description](#51-overall-description)
  - [5.2 Users and Roles](#52-users-and-roles)
  - [5.3 Design Diagrams / UML / Flow / E-R](#53-design-diagrams--uml--flow--e-r)
    - [5.3.1 Product Backlog Items](#531-product-backlog-items)
    - [5.3.2 Architecture Diagram](#532-architecture-diagram)
    - [5.3.3 Use Case Diagram](#533-use-case-diagram)
    - [5.3.4 Class Diagram](#534-class-diagram)
    - [5.3.5 Activity Diagram](#535-activity-diagram)
    - [5.3.6 Sequence Diagram](#536-sequence-diagram)
    - [5.3.7 Data Architecture / ER Diagram](#537-data-architecture--er-diagram)
- [6. USER INTERFACE](#6-user-interface)
  - [6.1 UI Description](#61-ui-description)
  - [6.2 UI Mockup](#62-ui-mockup)
- [7. ALGORITHMS / PSEUDO CODE](#7-algorithms--pseudo-code)
- [8. PROJECT CLOSURE](#8-project-closure)
  - [8.1 Goals / Vision](#81-goals--vision)
  - [8.2 Delivered Solution](#82-delivered-solution)
  - [8.3 Remaining Work](#83-remaining-work)
- [REFERENCES](#references)

<div class="page-break"></div>

# LIST OF TABLES

1. Table 1: Goals and Objectives
2. Table 2: Project Setup Decisions
3. Table 3: Stakeholders
4. Table 4: Project Resources
5. Table 5: Assumptions
6. Table 6: Tracking Information
7. Table 7: Regularly Scheduled Meetings
8. Table 8: Information To Be Shared Within Our Group
9. Table 9: Information To Be Provided To Other Groups
10. Table 10: Information Needed From Other Groups
11. Table 11: Deliverables
12. Table 12: Users and Roles

<div class="page-break"></div>

# LIST OF FIGURES

1. Figure 1: Architecture Diagram
2. Figure 2: Use Case Diagram
3. Figure 3: Class Diagram
4. Figure 4: Activity Diagram
5. Figure 5: Sequence Diagram
6. Figure 6: ER Diagram
7. Figure 7: UI Mockup

<div class="page-break"></div>

# LIST OF ABBREVIATIONS

| Abbreviation | Meaning                           |
| ------------ | --------------------------------- |
| API          | Application Programming Interface |
| ER           | Entity Relationship               |
| FIFO         | First In First Out                |
| JSON         | JavaScript Object Notation        |
| SRP          | Single Responsibility Principle   |
| tRPC         | Type-safe Remote Procedure Call   |
| UI           | User Interface                    |
| WS           | WebSocket                         |

<div class="page-break"></div>

# ABSTRACT

Our project presents you with a real-time stock order book system that simulates a real-alike trading platform where users can place buy and sell orders and receive live updates in the interface. We created this project as a monorepo project with a React, Node.js, and GO matching ending all in a single repository. We designed the backend logic with absolute separation where the order book stores market state, the matching engine handles business rules, while the portfolio manager manages the money balance.

Our main idea was to implement a price time priority matching system that was fast enough for repeated read and writes. With earlier implementations using a simple array sorting method, which was very inefficient but helped us to get the basic matching book understanding. Then we moved to a HashMap method which was faster for lookups but still had inefficiency in order removals.
