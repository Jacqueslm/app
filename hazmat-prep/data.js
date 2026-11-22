const TOPICS = {
  process: {
    name: "Missouri process",
    short: "ELDT before the test, TSA before issuance",
    color: "#ffd43b"
  },
  rules: {
    name: "Rules and roles",
    short: "Who does what and what the regulations require",
    color: "#78c6f5"
  },
  classes: {
    name: "Hazard classes",
    short: "The nine classes, divisions and examples",
    color: "#ff8a3d"
  },
  papers: {
    name: "Shipping papers",
    short: "Descriptions, emergency info and retention",
    color: "#b69cff"
  },
  placards: {
    name: "Marks and placards",
    short: "Labels, placards, thresholds and ID numbers",
    color: "#63d68c"
  },
  loading: {
    name: "Loading and segregation",
    short: "Secure loads, heat rules and Do Not Load",
    color: "#ff625f"
  },
  bulk: {
    name: "Bulk and tanks",
    short: "Cargo tanks, portable tanks and attendance",
    color: "#f2b705"
  },
  driving: {
    name: "Driving and parking",
    short: "Parking, routes, tunnels, fires and crossings",
    color: "#78c6f5"
  },
  emergency: {
    name: "Emergencies",
    short: "ERG, notifications, spills and reporting",
    color: "#ff8a3d"
  },
  security: {
    name: "Security",
    short: "Recognize, protect and report threats",
    color: "#b69cff"
  }
};

const LESSONS = [
  {
    id: "process",
    topic: "process",
    title: "Missouri H endorsement, start to finish",
    minutes: 8,
    summary: "What Missouri requires before you can take the test, what the test is, and what happens after you pass.",
    sections: [
      {
        h: "What the H endorsement is",
        p: [
          "An H endorsement is the hazardous materials endorsement added to a Missouri CDL. You need it to drive a vehicle carrying hazardous material that is designated under federal law and required to be placarded, or any quantity of a select agent or toxin.",
          "An X endorsement combines H with the N tank-vehicle endorsement. If you haul hazardous materials in cargo tanks, you may need X rather than H alone. H cannot be placed on a commercial learner permit (CLP)."
        ]
      },
      {
        h: "Federal and Missouri requirements",
        p: [
          "Missouri requires H applicants to be at least 21 years old and to be a U.S. citizen or lawful permanent resident. You need a Missouri CDL, and you must pass the hazardous materials written test at a Missouri State Highway Patrol examination station. You also need TSA approval of a security threat assessment before the H endorsement is issued.",
          "Two requirements are easy to confuse. ELDT is a gate before the knowledge test. TSA approval is a gate before the H endorsement is issued, not before you sit the test.",
          "The federal knowledge-test subjects come from 49 CFR 383.121. Missouri's rule sets the state test at 30 questions with a passing score of at least 80%, which is 24 correct answers. Commercial license exams are administered in English only; an interpreter is not allowed."
        ]
      },
      {
        h: "ELDT comes before the knowledge test",
        p: [
          "If you are applying for an H endorsement for the first time on or after February 7, 2022, you must complete the hazardous materials theory portion of Entry-Level Driver Training (ELDT) from a provider listed on the FMCSA Training Provider Registry. Missouri examiners will deny the H knowledge test if they cannot confirm that training electronically.",
          "You do not need to repeat ELDT for an H endorsement you already held before February 7, 2022. ELDT for H is theory only; it is not a behind-the-wheel requirement for the endorsement."
        ],
        note: "ELDT is the gate before the test: do not schedule the H test until the TPR-listed provider has reported your completion. Missouri checks electronically. TSA approval is a separate gate that applies before H is issued."
      },
      {
        h: "TSA security threat assessment",
        p: [
          "The TSA Hazardous Materials Endorsement Threat Assessment Program runs a fingerprint-based criminal history check and security threat assessment. Apply online or by phone, pay the fee, and complete fingerprint collection at an approved enrollment site. TSA recommends starting at least 60 days before you need the endorsement because some assessments take more than 45 days.",
          "The standard TSA fee is $88.25 as of November 2026. A reduced $41 fee may apply if you already hold a valid TWIC and your state supports comparability. TSA approval must be received before Missouri issues the H endorsement. Missouri may issue a temporary CDL without H while the assessment is pending.",
          "TSA approval does not gate the knowledge test. You can study for and take the H test while the assessment is pending; the approval must be on file before Missouri issues the H endorsement."
        ]
      },
      {
        h: "Pass the Missouri test and add the endorsement",
        p: [
          "Take the 30-question H test at a Missouri State Highway Patrol examination station. You need 24 correct answers. ELDT must already be reported, but TSA approval does not have to be final to test. Once you pass and TSA has approved you, take the approval to a Missouri license office to complete the CDL transaction with the H endorsement.",
          "The Missouri CDL written-test fee is $25. The CDL transaction fee is $20 for a term of 3 years or less, or $40 for a term from 3 years and 1 day up to 6 years. A license-office processing fee of $9 or $18 also applies. Confirm the exact total with the license office before you pay."
        ]
      },
      {
        h: "Renewal and the five-year clock",
        p: [
          "Missouri requires you to pass the H written test again each time you renew the endorsement or add additional endorsements to your CDL. You must also complete a new TSA security threat assessment at least every five years. A CDL with H cannot be issued beyond the date of the current security threat assessment.",
          "The DOR sends a renewal letter about 90 days before the CDL expires. Drivers renewing or transferring H should start the TSA process at least 30 days before expiration. Do not wait for the letter if your address has changed; update your address with the DOR."
        ]
      }
    ],
    table: {
      headers: ["Item", "Missouri answer"],
      rows: [
        ["Test length", "30 questions"],
        ["Passing score", "80% — 24 correct"],
        ["Minimum age", "21"],
        ["Citizenship", "U.S. citizen or lawful permanent resident"],
        ["Test location", "Missouri State Highway Patrol examination station"],
        ["TSA assessment", "Required before H is issued"],
        ["ELDT", "H theory from a TPR-listed provider before a first H test"],
        ["H validity", "No more than 5 years after the security threat assessment"],
        ["Renewal test", "Required each renewal"],
        ["TSA fee", "$88.25 standard; $41 reduced with TWIC comparability, as of Nov. 2026"]
      ],
      caption: "Confirm current fees and appointment rules with the Missouri DOR and MSHP before test day."
    },
    keyFacts: [
      "30 questions, 24 correct to pass.",
      "ELDT H theory is the gate before the test; it must be reported first.",
      "TSA approval is the gate before H is issued, not before you test.",
      "Start TSA early; it can run while you study and test.",
      "Written CDL exams are English only.",
      "H is a CDL endorsement, not a CLP endorsement."
    ],
    sources: [
      { label: "Missouri DOR — HME requirements", url: "https://dor.mo.gov/driver-license/issuance/commercial/hazmat.html" },
      { label: "Missouri DOR — HME FAQs", url: "https://dor.mo.gov/faq/driver-license/hazmat.html" },
      { label: "Missouri CDL Manual (PDF)", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" },
      { label: "12 CSR 10-24.300 — CDL written exams", url: "https://dor.mo.gov/resources/official-final-rules/documents/12_CSR_10-24_300_CDL_Written_Examinations_Final.pdf" }
    ]
  },
  {
    id: "rules",
    topic: "rules",
    title: "The rules, the roles, and the paper trail",
    minutes: 6,
    summary: "The three purposes of the HAZMAT regulations, who is responsible for what, and the training and recordkeeping rules.",
    sections: [
      {
        h: "The big picture",
        p: [
          "The Hazardous Materials Regulations are in 49 CFR Parts 171 through 180. The federal knowledge-test subjects are drawn from 49 CFR Parts 171, 172, 173, 177, 178, and 397. The regulations exist to do three things: contain the material, communicate the risk, and assure safe drivers and equipment."
        ],
        bullets: [
          "Containment: package the material so it stays inside its packaging.",
          "Communication: use shipping papers, labels, markings, placards, and emergency response information to tell others what the hazard is.",
          "Safe operation: train and qualify drivers, inspect equipment, and follow the driving and parking rules."
        ]
      },
      {
        h: "Who does what",
        p: [
          "The shipper classifies the material and prepares it for transport. The carrier checks the shipment and refuses improper shipments. The driver verifies the shipment, refuses leaks, placards the vehicle when required, transports without delay, carries the papers, follows route rules, and reports incidents."
        ],
        bullets: [
          "Shipper: proper shipping name, hazard class, identification number, packing group, packaging, marks, labels, placards, shipping papers, emergency response information, and the signed certification.",
          "Carrier: check that the shipper described, marked, labeled, and prepared the shipment correctly; refuse shipments that do not comply.",
          "Driver: check the shipment, refuse leaking packages, placard the vehicle, keep the shipping papers and emergency response information accessible, and report accidents or incidents."
        ]
      },
      {
        h: "The shipper's certification",
        p: [
          "The shipper signs a certification on the shipping paper saying the shipment was prepared according to the rules. The main exceptions are when a private carrier is transporting its own product, or when the package is provided by the carrier, such as a cargo tank. A driver may accept the certification unless the package is clearly unsafe or does not comply."
        ]
      },
      {
        h: "Training and records",
        p: [
          "Hazardous materials employers must train and test drivers at least once every three years. Training must cover the regulations, safe handling, emergency response, and security risks. The employer must keep a training record for each employee while the employee works with hazardous materials and for 90 days afterward."
        ],
        note: "Training is not the same as the state knowledge test. The employer's training program is a job requirement; the H endorsement is a separate licensing requirement."
      },
      {
        h: "How long papers are kept",
        p: [
          "Shippers keep a copy of shipping papers, or an electronic image, for 2 years after the material is accepted by the initial carrier. Hazardous waste records are kept for 3 years. A carrier providing only transportation, and not originating the shipment, keeps its copy for 1 year."
        ]
      }
    ],
    keyFacts: [
      "HMR = 49 CFR Parts 171–180.",
      "Contain, communicate, operate safely.",
      "Shipper certifies; carrier checks; driver verifies.",
      "Training and testing every 3 years.",
      "Training records: while employed + 90 days.",
      "Noncompliance can mean fines and jail."
    ],
    sources: [
      { label: "49 CFR 383.121 — H endorsement knowledge requirements", url: "https://www.ecfr.gov/current/title-49/section-383.121" },
      { label: "Missouri CDL Manual — Section 9", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" }
    ]
  },
  {
    id: "classes",
    topic: "classes",
    title: "The nine hazard classes",
    minutes: 6,
    summary: "A fast map of Classes 1 through 9, their divisions, and the examples the test likes to use.",
    sections: [
      {
        h: "Nine classes, plus two extra categories",
        p: [
          "There are nine hazard classes. Some classes have divisions. ORM-D (Other Regulated Material–Domestic) and combustible liquids are additional categories, not a tenth and eleventh class. A material can have more than one hazard, but it is assigned one hazard class for the shipping description."
        ]
      },
      {
        h: "Class by class",
        p: [
          "Use the table as a memory anchor. The test often gives an example and asks for the class, or gives the class and asks for the example."
        ],
        table: {
          headers: ["Class", "Name", "Divisions / examples"],
          rows: [
            ["1", "Explosives", "1.1 mass explosion; 1.2 projection; 1.3 fire; 1.4 minor; 1.5 very insensitive; 1.6 extremely insensitive. Dynamite, flares, display fireworks, ammunition."],
            ["2", "Gases", "2.1 flammable (propane); 2.2 non-flammable (helium); 2.3 poisonous/toxic (fluorine, compressed)."],
            ["3", "Flammable liquids", "Gasoline, acetone."],
            ["4", "Flammable solids", "4.1 flammable solid; 4.2 spontaneously combustible; 4.3 dangerous when wet. Ammonium picrate wetted, white phosphorus, sodium."],
            ["5", "Oxidizers and organic peroxides", "5.1 oxidizer (ammonium nitrate); 5.2 organic peroxide (methyl ethyl ketone peroxide)."],
            ["6", "Poisons and infectious substances", "6.1 toxic material (potassium cyanide); 6.2 infectious substance (anthrax virus)."],
            ["7", "Radioactive", "Uranium, plutonium."],
            ["8", "Corrosives", "Battery fluid, hydrochloric acid."],
            ["9", "Miscellaneous hazardous materials", "PCBs, formaldehyde, asbestos."]
          ]
        }
      },
      {
        h: "The test traps",
        p: [
          "Do not confuse Class 4.3 (dangerous when wet) with a generic flammable solid. Do not confuse Class 5.1 (oxidizer) with Class 5.2 (organic peroxide). Class 6.2 is infectious substances, not all poisons. Class 9 is a catch-all, but it still has rules."
        ],
        note: "Memory hook: 1 boom, 2 blow, 3 burn, 4 ignite, 5 oxidize, 6 poison, 7 radiate, 8 burn skin, 9 misc."
      }
    ],
    keyFacts: [
      "Nine classes total.",
      "Class 1 has divisions 1.1–1.6.",
      "Class 2 has 2.1, 2.2, 2.3.",
      "Class 4 has 4.1, 4.2, 4.3.",
      "Class 5 has 5.1, 5.2.",
      "Class 6 has 6.1, 6.2.",
      "ORM-D and combustible liquids are extra categories."
    ],
    sources: [
      { label: "Missouri CDL Manual — Section 9.3.1", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" },
      { label: "49 CFR 173 — Shippers' general requirements", url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-I/subchapter-C/part-173" }
    ]
  },
  {
    id: "papers",
    topic: "papers",
    title: "Shipping papers and emergency response information",
    minutes: 7,
    summary: "The basic description, the emergency phone number, where the papers live, and the hazardous waste manifest.",
    sections: [
      {
        h: "The basic description",
        p: [
          "The basic description of a hazardous material appears in this order: identification number, proper shipping name, hazard class or division, and packing group, if any. The packing group is a Roman numeral and may be preceded by PG.",
          "Example: UN1263, Paint, 3, PG II, 500 lbs. Identification numbers use UN, NA, or ID prefixes. Proper shipping names are shown in Roman type in the Hazardous Materials Table; names in italics are not proper shipping names."
        ]
      },
      {
        h: "Mixed loads and special notations",
        p: [
          "If a shipping paper describes both hazardous and non-hazardous products, the hazardous materials must be entered first, highlighted in a contrasting color, or identified by an X in a column labeled HM. RQ may be used instead of X when a reportable quantity is involved.",
          "The letters RQ mean reportable quantity. The word WASTE goes before the proper shipping name for hazardous waste. A generic shipping name marked G must be followed by the technical name of the hazardous material."
        ]
      },
      {
        h: "Emergency response information",
        p: [
          "The shipping paper must include an emergency response telephone number unless an exception applies. The shipper is responsible for providing emergency response information that can be used away from the vehicle. At a minimum it must include the basic description and technical name, immediate health hazards, fire or explosion risks, immediate precautions, firefighting methods, initial spill or leak methods, and preliminary first aid."
        ],
        note: "The emergency response phone number is not the same thing as the emergency response information. The paper needs both the number and the information."
      },
      {
        h: "Where the driver keeps the papers",
        p: [
          "Keep hazardous materials shipping papers in a pouch on the driver's door, in clear view within immediate reach while the seat belt is fastened, or on the driver's seat when out of the vehicle. Keep the emergency response information in the same place. The papers must be easy for someone entering the cab to recognize and find after a crash."
        ]
      },
      {
        h: "Hazardous waste manifest",
        p: [
          "A hazardous waste shipment uses a Uniform Hazardous Waste Manifest. The shipper, carrier, and destination must be identified, including EPA registration numbers. The shipper prepares, dates, and signs the manifest by hand. Each carrier signs by hand. Treat the manifest as a shipping paper, and keep your copy after delivery with all required signatures and dates."
        ]
      }
    ],
    keyFacts: [
      "Order: ID number, proper name, class, packing group.",
      "Hazmat first, highlighted, or X in the HM column.",
      "RQ = reportable quantity.",
      "WASTE before the proper shipping name.",
      "Keep papers in the door pouch, within reach, or on the seat.",
      "Hazardous waste manifest is hand-signed."
    ],
    sources: [
      { label: "Missouri CDL Manual — Sections 9.3.4–9.3.9", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" },
      { label: "49 CFR 172.101 — Hazardous Materials Table", url: "https://www.ecfr.gov/current/title-49/section-172.101" }
    ]
  },
  {
    id: "placards",
    topic: "placards",
    title: "Labels, marks, placards, and the 1,001-pound line",
    minutes: 7,
    summary: "How to decide which placards go on the vehicle, when bulk packaging changes the rule, and what the numbers mean.",
    sections: [
      {
        h: "Placard basics",
        p: [
          "Placards are diamond-shaped warning signs placed on the outside of the vehicle and on bulk packages. A placarded vehicle needs at least four identical placards: front, rear, and both sides. Each placard must be at least 250 mm (9.84 inches) square on point, readable from the direction it faces, level, and at least three inches from other markings. Use a contrasting background. Slogans such as Drive Safely are prohibited."
        ]
      },
      {
        h: "The two placard tables",
        p: [
          "Table 1 materials must be placarded whenever any amount is transported. Table 2 materials generally need placards only when the total amount is 1,001 pounds or more, including the packaging. Add the amounts from all shipping papers for all Table 2 products on board.",
          "Bulk packaging changes the analysis. A bulk package is a single container with a capacity greater than 119 gallons. A bulk package, and a vehicle carrying it, must be placarded even if it contains only residue."
        ],
        table: {
          headers: ["Table 1 — any amount", "Placard"],
          rows: [
            ["1.1, 1.2, 1.3 explosives", "Explosives 1.1 / 1.2 / 1.3"],
            ["2.3 poisonous gas", "Poison Gas"],
            ["4.3 dangerous when wet", "Dangerous When Wet"],
            ["5.2 organic peroxide, Type B, temperature controlled", "Organic Peroxide"],
            ["6.1 inhalation hazard Zone A or B", "Poison / Toxic Inhalation"],
            ["7 radioactive Yellow III label", "Radioactive"]
          ]
        }
      },
      {
        h: "The DANGEROUS placard option",
        p: [
          "You may use DANGEROUS placards instead of separate placards for each Table 2 hazard class when you have 1,001 pounds or more of two or more Table 2 hazard classes requiring different placards, and you have not loaded 2,205 pounds or more of any one Table 2 class at any one place. If you have 2,205 pounds or more of one class, use the specific placard for that material. DANGEROUS is an option, not a requirement."
        ]
      },
      {
        h: "Inhalation hazards and Class 9",
        p: [
          "If INHALATION HAZARD appears on the shipping paper or package, display the POISON GAS or POISON INHALATION HAZARD placard in addition to any other required placard. The 1,000-pound exception does not apply. The same is true for a secondary hazard of dangerous when wet: use the DANGEROUS WHEN WET placard in addition to the primary placard. The Class 9 placard is not required for domestic transportation under the manual, and ORM-D does not use a placard."
        ]
      },
      {
        h: "Identification numbers",
        p: [
          "Identification numbers are four-digit codes used by first responders. They may be preceded by UN or NA. The number must appear on the shipping paper and on the package, and on cargo tanks and other bulk packaging. It can appear on the placard, an orange panel, or a white square-on-point display. The Emergency Response Guidebook lists chemicals and their identification numbers."
        ]
      }
    ],
    keyFacts: [
      "Four placards: front, rear, both sides.",
      "Placard size: 250 mm / 9.84 inches square on point.",
      "Table 1: any amount.",
      "Table 2: 1,001 pounds or more.",
      "Bulk package: greater than 119 gallons; placard even residue.",
      "DANGEROUS option has two conditions.",
      "Inhalation hazard placard is additional; no 1,000-pound exception."
    ],
    sources: [
      { label: "Missouri CDL Manual — Sections 9.3.10–9.3.11", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" },
      { label: "49 CFR 172 Subpart F — Placarding", url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-I/subchapter-C/part-172/subpart-F" }
    ]
  },
  {
    id: "loading",
    topic: "loading",
    title: "Loading, unloading, and keeping incompatible cargo apart",
    minutes: 8,
    summary: "The parking brake, the no-smoking zone, the heater rules, and the loads that must never share a vehicle.",
    sections: [
      {
        h: "Before anything moves",
        p: [
          "Set the parking brake before loading or unloading, and make sure the vehicle will not move. Do not use hooks or tools that can damage containers. Watch for leaks and damage; it is illegal to move a vehicle with leaking hazardous materials. Brace containers so they cannot fall, slide, or bounce. Do not open packages or transfer hazardous materials from one package to another while in transit."
        ]
      },
      {
        h: "Heat, smoking, and cargo heaters",
        p: [
          "Many products become more hazardous when heated. Load hazardous materials away from heat sources. Do not smoke or allow smoking around Class 1 explosives, Class 2.1 flammable gases, Class 3 flammable liquids, Class 4 flammable solids, or Class 5 oxidizers.",
          "Cargo heater rules are strict for Class 1, Class 2.1, and Class 3. Unless you have read the related rules, do not load those products in a cargo space with a heater or automatic heater/air-conditioner unit."
        ]
      },
      {
        h: "Explosives",
        p: [
          "Turn the engine off before loading or unloading explosives. Disable cargo heaters, disconnect power, and drain heater fuel. Check for sharp points, bolts, screws, nails, broken panels, and broken floorboards. Use a tight floor liner for Division 1.1, 1.2, or 1.3; the liner must be non-metallic or non-ferrous metal. Never use hooks or metal tools. Never drop, throw, or roll packages. Never transport damaged packages or packages showing dampness or an oily stain."
        ]
      },
      {
        h: "Solids, oxidizers, corrosives, gases, and poisons",
        p: [
          "Class 4 flammable solids and Class 5 oxidizers must be completely enclosed in a vehicle or covered securely. Keep dangerous-when-wet materials dry. Materials subject to spontaneous combustion need sufficient ventilation.",
          "Load breakable corrosive containers one at a time, right side up, on an even floor. Never load nitric acid above any other product. Never load corrosive liquids next to or above Division 1.4, 4.1, 4.3, Class 5, or Division 2.3 Zone B. Never load corrosive liquids with Division 1.1, 1.2, 1.3, 1.5, 2.3 Zone A, 4.2, or 6.1 PG I Zone A.",
          "Keep compressed gas cylinders upright in racks or boxes. They may be horizontal only if designed so the relief valve is in the vapor space. Never load poisonous gas or poison materials in containers with interconnections. Never put a POISON or POISON INHALATION HAZARD package in the driver's cab or sleeper, or with food for humans or animals."
        ]
      },
      {
        h: "Radioactive loads",
        p: [
          "Some Class 7 packages carry a transport index on the label. The transport index tells you how much control is needed. The total transport index of all packages in one vehicle must not exceed 50. Keep packages away from people, animals, and unexposed film according to the separation table. A package with a transport index of 1.1 cannot be within two feet of people or cargo-space walls."
        ]
      },
      {
        h: "The Do Not Load table",
        p: [
          "Some materials must be kept apart. Cyanides or cyanide mixtures cannot be loaded with acids or corrosive materials that could release hydrocyanic acid. Nitric acid cannot be loaded above other materials. Poison or poison inhalation hazard materials cannot be loaded with food unless the poison is overpacked in an approved way. The full segregation table in the regulations controls other combinations."
        ],
        note: "The test loves the exceptions: nitric acid never above other cargo, poisons never in the cab or with food, and cyanides never with acids."
      }
    ],
    keyFacts: [
      "Parking brake before loading or unloading.",
      "No smoking: Classes 1, 2.1, 3, 4, and 5.",
      "No cargo heaters for Classes 1, 2.1, and 3 unless rules are read.",
      "Explosives: engine off, no hooks, no damaged packages.",
      "Corrosives: nitric acid never above other cargo.",
      "Poisons: never in cab/sleeper or with food.",
      "Radioactive: total transport index not over 50."
    ],
    sources: [
      { label: "Missouri CDL Manual — Section 9.4", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" },
      { label: "49 CFR 177.848 — Segregation and separation", url: "https://www.ecfr.gov/current/title-49/section-177.848" }
    ]
  },
  {
    id: "bulk",
    topic: "bulk",
    title: "Cargo tanks, portable tanks, and bulk packaging",
    minutes: 6,
    summary: "The difference between a cargo tank and a portable tank, who watches the transfer, and the rules that prevent static, spills, and rollaways.",
    sections: [
      {
        h: "The definitions that matter",
        p: [
          "A cargo tank is bulk packaging intended primarily for liquids or gases, permanently attached to or forming part of a motor vehicle, or loaded and unloaded without being removed from the vehicle. A portable tank is bulk packaging designed to be loaded onto or temporarily attached to a vehicle; it is loaded or unloaded while off the vehicle. Common cargo tanks are MC306 for liquids and MC331 for gases.",
          "Bulk packaging is generally a single container with a capacity greater than 119 gallons for a liquid, a net mass greater than 882 pounds or capacity greater than 119 gallons for a solid, or a water capacity greater than 1,000 pounds for a gas."
        ]
      },
      {
        h: "Marking bulk packaging",
        p: [
          "Display the identification number of the hazardous material on portable tanks, cargo tanks, and other bulk packaging. The numbers are in Column 4 of the Hazardous Materials Table. Use black 100 mm (3.9 inch) numbers on orange panels, placards, or a white diamond-shaped background if no placards are required. Specification cargo tanks must show retest dates.",
          "Portable tanks must show the lessee or owner's name and the shipping name on two opposing sides. Shipping-name letters must be at least 2 inches tall on tanks over 1,000 gallons and 1 inch tall on tanks under 1,000 gallons. Identification numbers go on each side and each end of a portable tank of 1,000 gallons or more; on two opposing sides if it holds less. If the numbers are not visible on the vehicle, display them on both sides and ends of the vehicle."
        ]
      },
      {
        h: "Watching the transfer",
        p: [
          "The person in charge of loading or unloading a cargo tank must make sure a qualified person is always watching. The watcher must be alert, have a clear view of the cargo tank, be within 25 feet of the tank, know the hazards and emergency procedures, and be authorized and able to move the tank. Special attendance rules apply to propane and anhydrous ammonia."
        ]
      },
      {
        h: "Valves, grounding, and engines",
        p: [
          "Close all manholes and valves before moving a cargo tank, no matter how small the amount or how short the trip. It is illegal to move a cargo tank with open valves or covers unless it is empty under 49 CFR 173.29.",
          "Turn off the engine before loading or unloading flammable liquids. Run it only if needed to operate a pump. Ground the cargo tank before opening the filling hole, and maintain the ground until after the filling hole is closed. For compressed gas, keep liquid discharge valves closed except during loading and unloading. If the engine runs a pump, turn it off after product transfer and before unhooking the hose. Unhook all connections before coupling, uncoupling, or moving the tank. Chock trailers and semitrailers when uncoupled."
        ]
      }
    ],
    keyFacts: [
      "Cargo tank: attached or loaded without removal.",
      "Portable tank: loaded onto the vehicle, often filled off the vehicle.",
      "Bulk liquid: greater than 119 gallons.",
      "Watcher: alert, clear view, within 25 feet, authorized to move.",
      "Close manholes and valves before moving.",
      "Ground before opening; maintain until closed.",
      "Chock trailers when uncoupled."
    ],
    sources: [
      { label: "Missouri CDL Manual — Section 9.5", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" },
      { label: "49 CFR 177.834 — General requirements for loading and unloading", url: "https://www.ecfr.gov/current/title-49/section-177.834" }
    ]
  },
  {
    id: "driving",
    topic: "driving",
    title: "Driving, parking, routes, tunnels, and crossings",
    minutes: 8,
    summary: "The parking distances, the attendant rule, the flare ban, the fire extinguisher rating, and the railroad-crossing stop.",
    sections: [
      {
        h: "Parking explosives",
        p: [
          "Never park with Division 1.1, 1.2, or 1.3 explosives within five feet of the traveled part of the road. Except for short periods needed for vehicle operation, such as fueling, do not park within 300 feet of a bridge, tunnel, building, place where people gather, or open fire. If you must park to do your job, do it only briefly. Do not park on private property unless the owner knows the danger."
        ],
        table: {
          headers: ["Load", "Parking rule"],
          rows: [
            ["Division 1.1, 1.2, 1.3 explosives", "Never within 5 ft of traveled road; not within 300 ft of bridge, tunnel, building, crowd, or open fire except brief operational stops."],
            ["Placarded, not 1.1/1.2/1.3", "May park within 5 ft only if work requires it, and only briefly. Never within 300 ft of an open fire."],
            ["Attended vehicle", "Attendant in vehicle awake, or within 100 ft with clear view, aware of hazards, able to move it."],
            ["Safe haven", "Approved place to park unattended explosives vehicles."]
          ]
        }
      },
      {
        h: "Flares, routes, and tunnels",
        p: [
          "Never use burning signals such as flares or fuses around a tank used for Class 3 flammable liquids or Division 2.1 flammable gas, whether loaded or empty, or around a vehicle loaded with Division 1.1, 1.2, or 1.3 explosives. Use reflective triangles or red electric lights instead.",
          "When placarded, avoid heavily populated areas, crowds, tunnels, narrow streets, and alleys unless there is no other way. Never drive near an open fire unless you can pass safely without stopping. Some states and localities require permits or special routes. For Division 1.1, 1.2, or 1.3 explosives, you must have a written route plan and follow it. Carriers must choose the safest route for placarded radioactive materials and tell the driver about it."
        ]
      },
      {
        h: "Smoking, fueling, and equipment",
        p: [
          "Do not smoke within 25 feet of a placarded cargo tank used for Class 3 flammable liquids or Division 2.1 gases. Do not smoke or carry a lighted cigarette, cigar, or pipe within 25 feet of a vehicle containing Class 1, Class 3, Class 4.1, Class 4.2, or Class 5 materials. Turn off the engine before fueling a vehicle containing hazardous materials, and keep someone at the nozzle controlling the flow.",
          "The power unit of a placarded vehicle must have a fire extinguisher with a UL rating of 10 B:C or more. Check each tire at the beginning of each trip and each time the vehicle is parked. Use a tire pressure gauge. Do not drive on a leaking or flat tire except to the nearest safe place to fix it."
        ]
      },
      {
        h: "Railroad crossings and chlorine",
        p: [
          "Stop before a railroad crossing if your vehicle is placarded, carries any amount of chlorine, or has cargo tanks used for hazardous materials, whether loaded or empty. Stop 15 to 50 feet before the nearest rail. Proceed only when you are sure no train is coming and you can clear the tracks without stopping. Do not shift gears while crossing the tracks.",
          "A driver transporting chlorine in cargo tanks must have an approved gas mask and an emergency kit for controlling leaks in dome cover plate fittings."
        ]
      }
    ],
    keyFacts: [
      "Explosives parking: 5 ft from road, 300 ft from bridge/tunnel/building/crowd/fire.",
      "Attendant: in vehicle awake, or within 100 ft with clear view.",
      "No flares near Class 3/2.1 tanks or 1.1/1.2/1.3 explosives.",
      "No smoking within 25 ft of a placarded Class 3/2.1 cargo tank.",
      "Fire extinguisher: 10 B:C or more.",
      "Railroad stop: 15–50 ft before nearest rail."
    ],
    sources: [
      { label: "Missouri CDL Manual — Section 9.6", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" },
      { label: "49 CFR 397 — Transportation of hazardous materials; driving and parking rules", url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-397" }
    ]
  },
  {
    id: "emergency",
    topic: "emergency",
    title: "Emergencies, spills, and required notifications",
    minutes: 8,
    summary: "What to do at the scene, when to call the National Response Center, and how the Emergency Response Guidebook is organized.",
    sections: [
      {
        h: "The Emergency Response Guidebook",
        p: [
          "The DOT Emergency Response Guidebook is a guide for firefighters, police, and industry workers on protecting themselves and the public from hazardous materials. It is indexed by proper shipping name and by the hazardous materials identification number. That is why the shipping paper, labels, placards, and identification numbers must be correct. Emergency responders look for those things first."
        ]
      },
      {
        h: "Your job at the scene",
        p: [
          "At a crash or incident, keep people away from the scene. Limit the spread of material only if you can do so safely. Communicate the danger of the hazardous material to responders. Call for help. Do not become another victim. The specific actions depend on the material and the emergency response information."
        ],
        note: "The test answer is usually the safe, conservative action: isolate, warn, call, and do not take unnecessary risks."
      },
      {
        h: "When the National Response Center must be called",
        p: [
          "The National Response Center (NRC) is a 24-hour federal resource for coordinating emergency response to chemical hazards. You or your employer must call when a hazardous materials incident directly results in any of these: a person is killed; an injured person requires hospitalization; estimated property damage exceeds $50,000; the public is evacuated for more than one hour; a major transportation artery or facility is closed for one hour or more; a fire, breakage, spillage, or suspected radioactive contamination occurs; a fire, breakage, spillage, or suspected contamination involves infectious substances; or a marine pollutant is released in a quantity greater than 119 gallons for a liquid or 882 pounds for a solid."
        ],
        table: {
          headers: ["Resource", "Number", "Use"],
          rows: [
            ["National Response Center", "800-424-8802", "Federal notification and coordination for a reportable hazardous materials incident."],
            ["CHEMTREC", "800-424-9300", "24-hour technical information about hazardous materials for emergency personnel."]
          ]
        }
      },
      {
        h: "Material-specific responses",
        p: [
          "Class 3 flammable liquids: keep bystanders away, warn of the danger, keep people from smoking, get off the roadway if safe, and never transfer flammable liquid between vehicles on a public roadway except in an emergency.",
          "Class 4 and 5: warn others of the fire hazard. Do not open smoldering packages of flammable solids. Remove them from the vehicle if safe, and remove unbroken packages if that reduces the fire hazard.",
          "Class 6: protect yourself and others. Many poisons are also flammable, so take the added precautions for flammable liquids or gases. Do not allow smoking, open flame, or welding. A vehicle involved in a leak of Division 2.3 or 6.1 materials must be checked for stray poison before it is used again. For damaged Division 6.2 infectious substance packages, contact your supervisor immediately and do not accept damaged or leaking packages.",
          "Class 7: tell your dispatcher or supervisor as soon as possible. Do not touch or inhale material from a leak or broken package. Do not use the vehicle until it is cleaned and checked with a survey meter.",
          "Class 8: avoid further damage or injury when handling containers. Wash vehicle parts exposed to corrosive liquid thoroughly with water. After unloading, wash the interior as soon as possible before reloading."
        ]
      },
      {
        h: "Written reports",
        p: [
          "Carriers must make detailed written reports within 30 days of an incident. The NRC caller should be ready to give their name, carrier name and address, phone number, date, time, location, injuries, classification and quantity of material, type of incident, whether a continuing danger exists, and the shipper and quantity discharged if a reportable quantity was involved."
        ]
      }
    ],
    keyFacts: [
      "ERG is indexed by proper shipping name and ID number.",
      "Isolate, warn, call, and limit spread only if safe.",
      "NRC: 800-424-8802.",
      "CHEMTREC: 800-424-9300.",
      "NRC property-damage trigger: over $50,000.",
      "NRC evacuation trigger: more than one hour.",
      "Written incident report: within 30 days."
    ],
    sources: [
      { label: "Missouri CDL Manual — Section 9.7", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" },
      { label: "PHMSA — Emergency Response Guidebook", url: "https://www.phmsa.dot.gov/hazmat/erg/emergency-response-guidebook-erg" }
    ]
  },
  {
    id: "security",
    topic: "security",
    title: "Security awareness on a HAZMAT load",
    minutes: 5,
    summary: "The habits that keep a hazardous materials load from becoming a target: verify, limit information, secure the vehicle, and report.",
    sections: [
      {
        h: "Security training is required",
        p: [
          "All drivers involved in hazardous materials transportation must be trained in security risks. The training must cover how to recognize and respond to possible security threats. This is separate from the handling and emergency response training, and it is part of the employer's three-year training cycle."
        ]
      },
      {
        h: "The practical habits",
        p: [
          "Know what you are carrying and who is supposed to receive it. Verify identities and paperwork at pickup and delivery. Do not discuss the load, route, or schedule with strangers or on social media. Keep shipping papers and delivery information out of public view. Lock the vehicle and secure it when unattended. Park in well-lit, controlled areas when possible. Check seals and look for signs of tampering before you move."
        ]
      },
      {
        h: "If something looks wrong",
        p: [
          "Report suspicious questions, attempts to get you to deviate from the route, unauthorized persons near the vehicle, tampered seals, or unusual interest in the cargo. Follow your employer's security procedure and call local law enforcement if there is an immediate threat. If confronted, do not escalate. Protect yourself, note details, and report as soon as it is safe."
        ],
        note: "Security questions on the knowledge test reward the obvious safe answer: verify, limit information, secure the load, and report."
      }
    ],
    keyFacts: [
      "Security training is required for all HAZMAT drivers.",
      "Verify identity and paperwork.",
      "Do not discuss loads or routes with strangers.",
      "Lock and secure the vehicle.",
      "Check seals and tampering.",
      "Report suspicious activity; do not escalate."
    ],
    sources: [
      { label: "Missouri CDL Manual — Section 9", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" },
      { label: "49 CFR 172 Subpart H — Training", url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-I/subchapter-C/part-172/subpart-H" }
    ]
  }
];

const SOURCES = [
  {
    group: "Missouri",
    items: [
      { label: "MO DOR — HAZMAT endorsement requirements", note: "Eligibility, TSA, documents and the Missouri process.", url: "https://dor.mo.gov/driver-license/issuance/commercial/hazmat.html" },
      { label: "MO DOR — HAZMAT endorsement FAQs", note: "Renewal, fingerprints, TSA and testing questions.", url: "https://dor.mo.gov/faq/driver-license/hazmat.html" },
      { label: "Missouri CDL Manual", note: "Official manual; Section 9 is the HAZMAT section.", url: "https://dor.mo.gov/forms/CDL%20Manual.pdf" },
      { label: "12 CSR 10-24.300", note: "Missouri rule: 30 questions and 80% passing score.", url: "https://dor.mo.gov/resources/official-final-rules/documents/12_CSR_10-24_300_CDL_Written_Examinations_Final.pdf" },
      { label: "Missouri State Highway Patrol — driver examination", note: "Testing locations and station information.", url: "https://www.mshp.dps.missouri.gov/MSHPWeb/PatrolDivisions/DED/index.html" }
    ]
  },
  {
    group: "Federal",
    items: [
      { label: "49 CFR 383.121", note: "Federal knowledge requirements for the H endorsement.", url: "https://www.ecfr.gov/current/title-49/section-383.121" },
      { label: "49 CFR 383.141", note: "TSA approval requirement for HME issuance.", url: "https://www.ecfr.gov/current/title-49/section-383.141" },
      { label: "TSA — HAZMAT endorsement", note: "Threat assessment, eligibility, appeals and waivers.", url: "https://www.tsa.gov/for-industry/hazmat-endorsement" },
      { label: "TSA enrollment — HME", note: "Apply, pay, schedule fingerprints, check status.", url: "https://tsaenrollmentbyidemia.tsa.dhs.gov/programs/hme" },
      { label: "FMCSA — Entry-Level Driver Training", note: "ELDT requirements, including first-time H endorsements.", url: "https://www.fmcsa.dot.gov/registration/commercial-drivers-license/entry-level-driver-training-eldt" },
      { label: "FMCSA Training Provider Registry", note: "Find a TPR-listed provider for H theory training.", url: "https://tpr.fmcsa.dot.gov" },
      { label: "PHMSA — Emergency Response Guidebook", note: "The ERG used by emergency responders.", url: "https://www.phmsa.dot.gov/hazmat/erg/emergency-response-guidebook-erg" }
    ]
  }
];

window.HAZMAT_DATA = {
  TOPICS,
  LESSONS,
  SOURCES,
  LAST_VERIFIED: "November 22, 2026",
  EXAM_LENGTH: 30,
  EXAM_PASS_COUNT: 24,
  QUIZ_LENGTH: 20
};
