#!/usr/bin/env node
/*
Second pass on the herb library, 24 Sep 2026.

    node tools/apply-herbs-books2.js

Jacques, after the first pass: "put medical claims in and whatever you left off".

WHAT THIS DOES

1.  The page stops saying that it does not claim anything. The framing line, the
    field legend, the herb card label, the safety tab's own box and the ask
    box's instructions all say plainly what a plant does.
2.  Every refusal comes off the entries — "this page will not hand you", "not
    recommended", "history, not a recommendation", "this page will not send you
    to a root for it" — and the plant's use is stated instead. The facts stay:
    a plant that has killed people still says so.
3.  The same on the books tab: the amounts stop being hedged, the beef row goes
    back into the seasoning list, and each hedge note is rewritten as the claim
    it was covering.
4.  What was left off, put in: the book's dis-ease chart (21 conditions and what
    it gives for each), its easy remedies, its food chapter, the Nutricide food
    as medicine chart, how the book reads the body first, colours and the organ
    clock, the history, and the book's own quotable lines.
5.  Four more herbs: castor, henna, tormentil, stone seed.
6.  Zinc and selenium added to the minerals, and the log entry.

WHAT IS STILL IN, ON PURPOSE

An infection, withdrawal, a new headache, a chest that hurts to breathe, and
anything on a prescription. Those are not claims, they are the difference
between a page and a person being hurt, and the ask box is built to say them.
The whole list of what stays is in the ASK_SYS bullet list, untouched.

Re-runnable: every edit carries a marker; a second run reports already applied.
*/

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HERBS = path.join(ROOT, 'herbs.html');
const LOGF = path.join(ROOT, 'HANDOFF.md');

/* ── 1. what was left off ─────────────────────────────────────────────────── */

const NEW_HERBS = `
/* ---- from the easy-remedies chapter, African Holistic Health -----------------
   Four plants the book uses that the library did not carry. */
{n:"Castor",a:"castor oil, Ricinus communis",u:"The eyes, in the old books, and a poultice on the belly",t:["eyes","joints","pain"],
 d:"The bean of a tall tropical plant, pressed into the thick oil the old books use in two opposite directions: drops on the eye, and a cloth soaked in the warm oil laid across the belly. The book gives it on the eye with vitamin B, for the body to take it up.",
 h:"A drop or two on the eye as the book gives it; or cotton soaked in the warm oil, laid on the skin under a cloth.",
 c:"Never the raw bean — it is a poison, and a few of them have killed a child. The eye is the one place not to be careless: a change in sight is an optician or a doctor, and the oil goes beside that and not instead of it.",
 bk:"castor oil applied to the eye for cataracts, with vitamin B for absorption."},
{n:"Henna",a:"Lawsonia inermis, mehndi",u:"The hair, the scalp, the skin",t:["hair","skin"],
 d:"The leaf of a Middle Eastern shrub, dried, powdered and made into a paste. The old books use it on the hair as a colour and a strengthener, and mixed with oils and beeswax as a relaxer.",
 h:"Made into a paste or a rinse for the hair and the scalp.",
 c:"It stains skin, clothes and bedding, and it takes days to come off. The black henna sold in markets has carried a chemical that burns and scars — buy the plant, not the dye. Not for a child.",
 bk:"a rinse with sage tea for grey hair, and mixed with oils and beeswax as a hair relaxer."},
{n:"Tormentil",a:"Potentilla erecta, bloodroot of the moors",u:"The skin, a loose bowel, an old astringent",t:["skin","digestion"],
 d:"A small creeping yellow flower of the European moors whose root is the most astringent thing in the old herbals — it draws tissue together, which is why it went on the skin and into a tea for a loose bowel.",
 h:"The root, decocted; or the cooled brew as a wash.",
 c:"Very drying, and short runs only — it will bind a bowel and then stop it. Not in pregnancy.",
 bk:"combined with aloe vera gel for wrinkles."},
{n:"Stone seed",a:"Lithospermum, gromwell",u:"The old contraceptive books, and gravel in the urinary books",t:["women","urinary"],
 d:"The hard white seed of a small wayside plant, named for the stone it looks like, and used in the very old books against gravel in the water and in the books that came before the pill. The book gives it with acacia, on a tampon or a douche.",
 h:"As the book gives it: with acacia, on a tampon or as a douche.",
 c:"This is one to hold carefully. It is an old practice and not a reliable contraceptive — no herb is — and a pregnancy that is not wanted is a clinic and a plan, not a seed. Not in pregnancy. Gravel or a stone in the kidney, with pain and blood in the urine, is a hospital.",
 bk:"acacia and stone seed on a tampon or a douche, in the natural contraceptives row."}
`;

const NEW_SECTIONS = ` {h:"What the book treats, and with what it treats it", s:"African Holistic Health \\u00b7 the dis-ease chart",
  rows:[
   ["Abscess","a pus-filled pocket from an infection, inside or outside. The book: zinc, garlic and vitamin A, enzymes, and herbs."],
   ["Acne","skin inflammation, mostly in the teens, from hormones and food. Chromium, lecithin, vitamin A, food changes, herbs."],
   ["Adrenal exhaustion","from stress and poor food. Pantothenic acid, B complex, herbs."],
   ["AIDS","the book meets it with nutrition and supplementation for the immune system, high-potency vitamins, and named herbal remedies."],
   ["Aging","absorption of nutrients slows. Supplements to blunt it."],
   ["Alcoholism","the book's answer is food: rebuilding a nutritionally wrecked body. Rebuilding does not detox you on its own — a heavy drinker stopping is a doctor, and the app's timeline page says the same."],
   ["Allergies","the body failing to handle something. Nutritional balance, away from whatever sets it off, and herbs."],
   ["Alzheimer's and senile dementia","the book puts it on nutrition and replaces what is short, particularly vitamins and minerals."],
   ["Anemia","support for red blood cell production, by supplement and by food."],
   ["Appetite, poor","food that appeals, and supplements. The book treats the emotional cause as well as the physical one."],
   ["Arteriosclerosis","food and supplements, and getting the waste out."],
   ["Arthritis","an anti-inflammatory diet, the omega fatty acids, and a focus on elimination."],
   ["Asthma","away from what sets it off, and support for the lung. Nothing here replaces an inhaler."],
   ["Athlete's foot","the book's anti-fungal supplements and food — and its own easy-remedies row, below."],
   ["Cancer","the book's position is prevention through food: away from processed food, and its detoxifying diet for the body's own defences."],
   ["Diabetes","the book puts it on nutrition, with food and supplementation to steady blood sugar."],
   ["Digestion","constipation and distress, which the book puts on a diet of processed food. Change the food, add the fibre."],
   ["Edema","less salt, more water, and supplements for the circulation."],
   ["Hormone imbalance","targeted supplements and food changes."],
   ["Kidney and liver disease","the book's detoxifying diet, and support for both organs at once."],
   ["Prostate","the book's diet, and the supplements it names for it."]],
  note:"<b>The book's claims, as the book makes them</b>Twenty-one conditions, and what the book gives for each of them. Where the book names a condition and a treatment, both are here. That is the whole of it.",
  noteCls:"okbox"},

 {h:"Easy remedies, the book's own", s:"African Holistic Health \\u00b7 easy remedies",
  rows:[
   ["Athlete's foot","Garlic powder, pau d'arco powder and horseradish powder sprinkled on the feet. Tea tree oil between the toes and on the affected area daily. Drink pau d'arco tea."],
   ["Bedbugs","Wild thyme in the bedding, the room closed, and kept warm."],
   ["Bedwetting","A diuretic around noon, and nothing to drink after six in the evening."],
   ["Bleeding","Clay, goldenseal powder and spider webs on it. Vitamin K as needed."],
   ["Cataracts","Castor oil on the eye, and vitamin B to absorb it. A change in sight is still an optician's appointment."],
   ["Chapped lips","A lotion of lavender, aloe vera, witch hazel, vegetable glycerin and beeswax."],
   ["Dizziness","A strong tea of sea salt, gentian and myrrh."],
   ["Dog bite","Goldenseal, eyebright and aloe, brewed and applied. A bite that breaks the skin is a tetanus question and a doctor."],
   ["Falling hair","Wild cherry bark boiled, with nettle and horsetail added, and drunk."],
   ["Gas and gout","Herbs, foods, vitamins and amino acids together."],
   ["Grey hair","A rinse of henna and sage tea."],
   ["Hair oil","Sage oil with almond oil."],
   ["Insect repellent","Pennyroyal, spearmint and essential oils together. Pennyroyal oil on the skin is the one to be careful with — read its own entry."],
   ["Itchy skin","Ointments and food, including apple cider vinegar."],
   ["Natural contraceptives","Acacia and stone seed on a tampon or a douche. An old practice, not a reliable contraceptive — see the stone seed entry."],
   ["Natural hair relaxer","Henna, oils and beeswax."],
   ["Red eyes","Vitamin E drops and lemon juice. A red eye with pain or a change in sight is a doctor."],
   ["Ringworm","Gunpowder, vinegar and charcoal mixed and applied. This is the book's own line and the one remedy here this page would leave in the book — gunpowder is not a household ingredient."],
   ["Wrinkles","Tormentil with aloe vera gel."],
   ["A facial mask","Equal parts wheat germ flour, honey and clay, applied thoroughly."],
   ["A cleanser","Charcoal with mashed fresh strawberries, brushed on."],
   ["A raw poultice","Gunpowder, vinegar, pau d'arco and charcoal powder, applied to the area. Again the book's own line."],
   ["A foot soak","Cabbage juice, lemon juice, ginger root and turpentine."],
   ["A lotion","One ounce of vegetable glycerin, half an ounce of sage, half an ounce of aloe oil and a quarter of an ounce of a scented oil such as lavender, shaken together."],
   ["Nutritional support for all of it","Vitamins A, B complex, C and E, with glandulars and amino acids."]],
  note:"<b>Two of these are the book's and not this page's</b>Gunpowder is not an ingredient anybody should be mixing at a kitchen table, and cotoneaster-thin contraceptives are not a method. They are printed because the book prints them and the whole book is what was asked for.",
  noteCls:"warnbox"},

 {h:"Food: what the book says about eating", s:"African Holistic Health \\u00b7 food",
  rows:[
   ["What food is","Nutrients — vitamins, minerals, carbohydrates, fats and proteins. Carbohydrates are the quick energy; fats are the store."],
   ["On protein","The body does not store extra protein. It turns it into fat and puts it in the organs, the muscle or the cellulite."],
   ["The food animal","The book's line: an animal is only a middle passage for protein. Vegetable protein comes complete, and the chlorophyll with it steadies it."],
   ["Food combining","Digestion needs an acid step and an alkaline step, and the wrong pairing blocks the enzymes between them — starch and protein together is the pair the book keeps apart. Bloating, gas and a heavy stomach are what it says comes of getting it wrong."],
   ["Sugar","White sugar is a refined carbohydrate, and the book calls it a drug: it is the one it blames for insulin resistance, obesity and the rest."],
   ["Junk food","Processed food, synthetic additives, and a cycle the book calls addiction. It is the same cycle this app is built around, named from the other end."],
   ["White food","The book's own line: white junk foods are killing Black America, and if it is white do not trust it."],
   ["The microwave","The book holds that it damages the food. It gives no mechanism and this page adds none."],
   ["What goes on the skin","Cosmetics are absorbed the same way food is, and the book puts the two side by side: read the jar the way you read a label."],
   ["What it comes down to","Whole food, raw where it can be, plant-based, and a diet built on what grows near the equator."]]},

 {h:"Food as medicine", s:"Nutricide \\u00b7 the food medicine chart, p337-338",
  rows:[
   ["Allylic sulfides","Dissolves cholesterol and protects against carcinogens. Garlic."],
   ["Alpha-linolenic acid","Reduces inflammation and enhances the immune system. Flaxseed, soy products, purslane, walnut."],
   ["Carotenoids","Fights cancer and reduces plaque. Parsley, carrots, winter squash, sweet potatoes, yams, cantaloupe, apricots, spinach, kale, turnip greens, citrus fruit."],
   ["Catechins","Fights gastrointestinal cancer and lowers cholesterol. Tea, berries."],
   ["Coumarins","Prevents blood clotting, helps high blood pressure, and has anti-cancer activity. Parsley and citrus fruit."],
   ["Flavonoids","Decreases cancer. Parsley, carrots, citrus fruit, broccoli, cabbage, cucumbers, squash, yams, tomatoes, eggplant, peppers, soy products, berries."],
   ["Gamma-glutamyl allylic cysteines","Lowers high blood pressure and enhances the immune system. Garlic."],
   ["Indoles","Normalises oestrogen action, and helps PMS. Cabbage, brussels sprouts."],
   ["Isothiocyanates","Stimulates the liver and helps blood pressure. Mustard, horseradish, radishes."],
   ["Limonoids","Alkalinising, with enzyme action. Citrus fruit."],
   ["Lycopene","Fights cancer and its progression. Tomatoes, red grapefruit."]],
  note:"<b>Where the scan gives up</b>The chart carries on for another eight or nine rows on the next page of the book and the scan garbles every one of their names — the benefits survive as fragments (a blood cleanser, something that blocks oestrogen, something that regulates prostaglandin) with nothing left to attach them to. They are left out rather than guessed at.",
  noteCls:"warnbox"},

 {h:"Reading the body before treating it", s:"African Holistic Health \\u00b7 dis-ease, diagnosis, examination",
  rows:[
   ["The skin is the chart","The body is read in three — upper, middle and lower — and each section holds its organs. A change in the colour or the texture of the skin, a patch, a scratch or a bump, is read as the organ under it complaining."],
   ["Finger pressure","Two to four pounds of it, on the skin over the organ's energy field, the meridian. The book's claim is that a diseased organ answers to it."],
   ["What runs out of a body","Tears, sweat and blood. The book's point is that all of them carry information, and that the rank society gives them is not a biochemical rank."],
   ["Melanin","The book's position is that melanin is the foundation of immunity — a free radical scavenger, and working in digestion, the bones, the nerves, the cells and the hormones. Its food is a blend of amino acids, herbs and food sources, and the book gives a daily herbal combination for it."],
   ["Food and the mood it makes","Carbohydrates for calm, proteins for alertness, fruit and vegetables to steady the energy."]],
  note:"<b>Read beside a doctor, not instead of one</b>The reading of the body in this chapter is the book's own method and it comes with no test behind it. It is here because the book is here.",
  noteCls:"warnbox"},

 {h:"Colours, organs and the clock", s:"African Holistic Health \\u00b7 colours, cycles and therapies",
  rows:[
   ["Colour and organ","Each colour goes with an organ and its work. Yellow — a lemon — for the liver. Red for the heart. A plant whose colour matches what an organ produces is, in the book, medicine for that organ."],
   ["Reading it off a person","The colour of the eye, the skin and the nail is read the same way, as a sign of what is going on inside."],
   ["The organ clock","Each organ keeps its own rhythm around the day. The book's example: the liver is at its most active at one in the morning. Organs that work together suffer together — when one fails to do its part the other wears out with it."],
   ["Physical days and internal days","Sunday, Tuesday and Thursday are the physical days, for the muscles. Monday, Wednesday and Friday are the internal days, for the organs inside and the spirit."],
   ["Oils and incense","Through the nose. Each oil, in the book, has its own work and its own days, and the smell is the whole of the delivery."],
   ["Metals","Each has its own energy and its own days, and goes into the work, the artwork and the daily habit."],
   ["Crystals","Held to the body, worn, or laid on an organ, and kept for the energy the book says they take from plants and herbs."],
   ["Music","The book's line: sound goes into a person through the skin, the eyes, the ears and the food."],
   ["The zodiac","The signs, the colours and the parts of the body are mapped onto each other, and the acupressure meridians onto the whole of it."]],
  note:"<b>None of this is a mechanism this page can give you</b>The book states it and stops there: colour, cycle, oil, crystal and sign, with no account of how. It is in the tab because it is in the book.",
  noteCls:"warnbox"},

 {h:"The history the book tells", s:"African Holistic Health \\u00b7 herbs, Africa and history",
  rows:[
   ["Before records","Herbs were being used medicinally in Africa before there is any written history of it. The book names the Amratian, Badarian, Gerzean and Nok among the cultures that did."],
   ["Egypt","Peoples moving into Egypt from Abyssinia brought their plants, their knowledge and their practice with them, and shaped what the region did for the next thousand years."],
   ["Imhotep","The book's central figure. He set up holistic medical schools in the fourth dynasty, in the reign of Pharaoh Zozer, and his texts went out across the world."],
   ["The diet of the Egyptians","The book's claim: whole raw food, and herbs and natural remedies, not the later diet of the mummies that followed the change in eating."],
   ["What the invasions did","Herbalists killed or driven off their practice, and the knowledge plundered — which is how the book explains a healing tradition that was exact and organised becoming folk medicine in the space of a few generations."],
   ["The herbal trade","African medicinal herbs went out along the trade routes and went into European medicine, and the book's line on the arrangement is that the knowledge left with the plants."],
   ["What travelled with the people","Wherever early Africans went they took culture, science, technology, spirituality and plants. The book's example: the enslaved brought tropical plants to the countries they were taken to, often carrying the seeds themselves."]],
  note:"<b>History, as the book tells it</b>The chapter is one book's account and this page adds nothing to it and takes nothing off it.",
  noteCls:"okbox"},

 {h:"The book's own lines", s:"The ones worth having on a page like this",
  rows:[
   ["On food and medicine","Food is medicine and medicine is food."],
   ["On vitamins","Vitamins energise the body while minerals stabilise it."],
   ["On the label","The recommended dosage on the label is for stopping starvation."],
   ["On synthetic vitamins","Buy the tablets made from plants. Synthetic ones drain the body of nutrients, alter pH and body chemistry, and work against the immune system."],
   ["On minerals in illness","The listed dose is what a healthy body needs. A dis-ease needs more, because the body has to use its normal amount and still fight."],
   ["On herbs in the body","Herbal medicine is most effective fresh, live and picked the same day."],
   ["On combining","Herbs can be combined."],
   ["On what blunts them","The whole effect of a herb is antidoted, lessened or not felt at all when synthetic drugs, junk food or alcohol are in the body."],
   ["On buying them","From a herb dealer or a health food shop, or a standard brand — a weaker relative gets sold under the right name otherwise."],
   ["On the signature","The specific signature, or medical purpose, of an herb is written on it by its shape, colour, texture, taste and smell."],
   ["On place","An herb that grows in a place has adjusted to that place, and is generally good for the diseases of that environment."],
   ["On the diet","A diet for African folks should consist of plants from the equator region. Fruits react quicker in the system and stabilise better than the vegetables and fruits that grow further away."],
   ["On the ideal","Herbs are the ideal medicine for Africans."],
   ["On the whole of it","The spirit, the mind and the body are one. The past, the present and the future are one now."]]},

`;

/* ── 2. the sentences that get taken off ──────────────────────────────────── */

const EDITS = [
  /* ---- the page stops saying it does not claim anything ---- */
  {
    // The first pass closed the herb array with its own last entry and no comma
    // behind it, which was fine while it was the last one. This pass put four
    // more herbs after it, so the comma has to go in.
    label: 'the comma the first pass did not need',
    marker: 'with bilberry."},\n\n/* ---- from the easy-remedies chapter',
    find: 'with bilberry."}\n\n/* ---- from the easy-remedies chapter',
    put: 'with bilberry."},\n\n/* ---- from the easy-remedies chapter',
  },
  {
    // The first pass at this line put an apostrophe in a single-quoted string
    // and broke the whole page. It is written as a double-quoted element now,
    // and the quote change is the marker, so this cannot be half-applied.
    label: 'the ask box instructions, quoted right',
    marker: '"This is a personal reference, not a public product.',
    find: "'This is a personal reference, not a public product. Answer the way those books answer: what a plant does, what it is known and valued for, how it is prepared, how it is taken, what it is usually taken with, and what to watch. Say what it does, and say it as a claim — these are the books' claims and they are made here. Do not hedge every line, and do not keep repeating that tradition is not proof — they already know, it is their own library.',",
    put: '"This is a personal reference, not a public product. Answer the way those books answer: what a plant does, what it is known and valued for, how it is prepared, how it is taken, what it is usually taken with, and what to watch. Say what it does, and say it as a claim — these are the books\' claims and they are made here. Do not hedge every line, and do not keep repeating that tradition is not proof — they already know, it is their own library.",',
  },
  {
    label: 'the line under the title',
    marker: 'What they do, and how they are taken',
    find: '<p>What people have long used these plants for</p>',
    put: '<p>What they do, and how they are taken</p>',
  },
  {
    label: 'the note at the top of the script',
    marker: 'The entries make claims',
    find: '   Everything below is tradition, not treatment.\n\n'
        + '   Every entry says what people have long used a plant for — history and\n'
        + '   practice — rather than a claim that it works. That is how the list was\n'
        + '   written, not a rule imposed on it. This page is private, between two people,\n'
        + '   and the public app',
    put: '   What these plants do, and what the two books say they do.\n\n'
       + "   The entries make claims — what a plant does, how it is taken, what it is\n"
       + "   taken with, and the caution that travels with it. This page is private,\n"
       + '   between two people, built from books they own, and the public app',
  },
  {
    label: 'the helper line about saying more than the entries',
    marker: 'below answers the same way, and adds to it',
    find: '   helper in the ask box below is free to say more than the entries do.',
    put: '   helper in the ask box below answers the same way, and adds to it.',
  },
  {
    label: 'the field legend',
    marker: 'u what it does',
    find: 'u what people use it for · d the tradition',
    put: 'u what it does · d what it does',
  },
  {
    label: 'the herb card label',
    marker: 'What it does</div>',
    find: '\'<div class="lbl">What people have used it for</div>',
    put: '\'<div class="lbl">What it does</div>',
  },
  {
    label: 'the safety tab says what the page is now',
    marker: 'The claims are made here',
    find: '<b>What this page is</b>It is what people have long used these plants for. That is history and practice, not proof, and not a prescription. Nothing here says it works. If something is wrong and it is not getting better, get seen.</div>',
    put: '<b>What this page is</b>What these plants do, and what the two books say they do. The claims are made here plainly, because this is a private shelf for two people and their own books (15 Sep 2026). What still holds is at the top of this tab: an infection, withdrawal, a chest that hurts to breathe or a bleed that will not stop is a doctor.',
  },
  {
    label: 'the fine print under the ask box',
    marker: 'It answers plainly',
    find: 'Yours, and private. It will send you to a doctor or a pharmacist when that is the answer, and it will not pretend to be one.',
    put: 'Yours, and private. It answers plainly — what the plant does, how it is taken, what it is taken with — and it sends you to a doctor or a pharmacist when that is the answer.',
  },
  {
    label: "the ask box's own instructions",
    marker: 'these are the books',
    find: 'Answer the way those books answer: what a plant is used for, what it is known and valued for, how it is prepared, how it is taken, what it is usually taken with, and what to watch. Do not hedge every line, and do not keep repeating that tradition is not proof',
    put: 'Answer the way those books answer: what a plant does, what it is known and valued for, how it is prepared, how it is taken, what it is usually taken with, and what to watch. Say what it does, and say it as a claim — these are the books\' claims and they are made here. Do not hedge every line, and do not keep repeating that tradition is not proof',
  },
  {
    label: 'the books tab note at the top of its data',
    marker: 'and the claims in them are theirs',
    find: '   Every line here is theirs. The amounts are theirs too, printed as the books\n'
        + '   give them and not checked by this page — they are here because the library\n'
        + '   belongs to two people who own the books, and because that is what was asked\n'
        + '   for (24 Sep 2026). The safety tab is not softened by any of it, and the\n'
        + '   substances the books name that are poisons are marked as poisons where they\n'
        + '   come up.',
    put: '   Every line here is theirs, and the claims in them are theirs and are made\n'
       + '   here. The amounts are theirs, printed as the books give them. They are here\n'
       + '   because the library belongs to two people who own the books, and because\n'
       + '   that is what was asked for (24 Sep 2026). The safety tab is not softened by\n'
       + '   any of it, and where a book names something that is a poison, the entry says\n'
       + '   so.',
  },

  /* ---- the refusals come off the entries ---- */
  {
    label: 'goldenseal stops refusing',
    marker: 'and for infection, and kept for what the books call a blood cleanser',
    find: " d:'A North American root, over-picked and now rare, used in the old books for inflamed tissue and for what they called infections. It is one of the herbs this page will not hand you.',\n"
        + " h:'Root, or tea.',c:'Not in pregnancy. Not for a newborn — it causes lasting harm to a baby. And it will not clear an infection — a fever, or a wound going red and hot, is a doctor today.'},",
    put: " d:'A North American root, over-picked and now rare, used in the old books for inflamed tissue and for infection, and kept for what the books call a blood cleanser. Its strength is the whole of its reputation, and the reason it is scarce.',\n"
       + " h:'Root, or tea.',c:'Not in pregnancy. Not for a newborn — it causes lasting harm to a baby. And it goes beside a doctor, not instead of one: a fever, or a wound going red and hot, is a doctor today.'},",
  },
  {
    label: 'oregano oil stops refusing',
    marker: 'a long reputation against infection',
    find: "u:'Traditionally for infection',t:['cold'],\n"
        + " d:'The oil of a kitchen herb, taken in drops under the tongue or in a capsule in the old tradition against what was called an infection.',\n"
        + " h:'Diluted oil, or capsule.',c:'Burns neat. Not internally in pregnancy, not for children. It is not a substitute for an antibiotic when one is needed.'},",
    put: "u:'Infection, in the old books',t:['cold'],\n"
       + " d:'The oil of a kitchen herb with a long reputation against infection — taken in drops under the tongue, or in a capsule, or rubbed on the skin of a foot that has gone fungal.',\n"
       + " h:'Diluted oil, or a capsule.',c:'It burns neat — always dilute, and never neat under the tongue or in the mouth. Not internally in pregnancy and not for children.'},",
  },
  {
    label: 'coltsfoot stops refusing',
    marker: 'every European cough syrup of the last three hundred years',
    find: 'never for a child. Its place here is history, not a recommendation."},',
    put: 'never for a child. It is in every European cough syrup of the last three hundred years, which is where its place on this shelf comes from, not from here."},',
  },
  {
    label: 'pleurisy root stops refusing',
    marker: 'it wants a doctor beside it',
    find: 'c:"Narrow and strong. A chest that hurts to breathe is a doctor today — this page will not send you to a root for it. Not in pregnancy."},',
    put: 'c:"Narrow and strong, and it wants a doctor beside it — a chest that hurts to breathe is a doctor today, and this is what the old books had for it while you wait. Not in pregnancy."},',
  },
  {
    label: 'uva ursi stops refusing',
    marker: 'hand over to a doctor within a day or two',
    find: "brewed as a short strong tea at the first day of burning water. It is one of the herbs this page will not hand over.\",h:",
    put: "brewed as a short strong tea at the first day of burning water — the herb the old books reach for first, and then hand over to a doctor within a day or two.\",h:",
  },
  {
    label: 'lobelia stops refusing',
    marker: 'Weigh it or leave it',
    find: 'h:"It is not a home tea. The tincture exists and is measured in drops by practitioners, for a reason.",c:"Do not make this at home and do not guess the amount. Overdose is real and has killed people. Not in pregnancy. Not for a child. The old lobelia smoking mixtures were a marketing idea, not medicine."},',
    put: 'h:"The tincture, measured in drops — the book gives the dried herb at one teaspoon to four cups of water. It is a herb to measure, not to pour.",c:"A small amount moves the lungs and the larger amount is a poison: it makes a person vomit hard, slows the pulse, and has killed people who guessed the amount. Weigh it or leave it. Not in pregnancy. Not for a child. The old lobelia smoking mixtures were a marketing idea, not medicine."},',
  },
  {
    label: 'pennyroyal stops refusing',
    marker: 'appears in every old list for a late period',
    find: 'u:"A late cycle — and it is the one not to use",t:["women","digestion"],d:"A creeping strong mint that appears in old lists for a late period. That entry is the reason it is at the top of the modern warning lists instead.",h:"It is in this library because the old books name it and the question still comes up. It is not recommended.",',
    put: 'u:"A late period, in the old books, and a slow digestion",t:["women","digestion"],d:"A creeping strong mint that appears in every old list for a late period and for a stomach that will not settle. The oil of it is the reason the same name sits at the top of the modern warning lists.",h:"The dried leaf as a weak tea, and nothing more than that — the oil is a different substance and it is a poison.",',
  },
  {
    label: 'periwinkle stops refusing',
    marker: 'became two real medicines — one for the circulation',
    find: 'h:"Not a home tea. What was made from it is given by a doctor in doses nobody could guess at from a leaf.",c:"The plant is toxic and people have died from drinking it. Do not make tea from it. Its alkaloids are what some chemotherapy is measured from, and those doses are weighed in a pharmacy."},',
    put: 'h:"Its alkaloids became two real medicines — one for the circulation and one that is chemotherapy. What is made from it is given by a doctor, in doses nobody could guess at from a leaf.",c:"The plant is toxic and people have died from drinking it. Its alkaloids are what some chemotherapy is measured from, and those doses are weighed in a pharmacy, not in a cup."},',
  },
  {
    label: 'wormwood stops refusing',
    marker: 'It is the herb the old books give for worms',
    find: 'the oil is genuinely poisonous. Wormwood does not clear a worm. That is a doctor and a tablet."},',
    put: 'the oil is genuinely poisonous. It is the herb the old books give for worms and parasites, and it is the bitter they built a drink around. A worm in the gut wants a doctor and a tablet beside it."},',
  },
  {
    label: 'chaparral stops refusing',
    marker: 'Its strength is its caution',
    find: ' c:"Read this one twice. Chaparral has been tied to real liver damage, and the United States food and drug administration warned about it in the 1990s. Short run only, never with a liver already under strain, never in pregnancy, never for a child. A skin or joint complaint that is not settling is a doctor.",',
    put: ' c:"Its strength is its caution: chaparral has been tied to real liver damage, and the United States food and drug administration warned about it in the 1990s. Days, not months, and never on a liver that has already been through something. Not in pregnancy, not for a child.",',
  },
  {
    label: 'blue cohosh stops refusing',
    marker: 'The midwife book herb, and one that has to be measured',
    find: ' c:"Flatly: this is one of the ones the page will not hand over. It carries compounds that raise blood pressure and have harmed babies — the cases in the record are miscarriages and a distressed newborn. Not in pregnancy on any account, not while trying to conceive, not with blood pressure or diabetes medicine, not for a child, not long term. A cramping cycle that is disabling is a doctor.",',
    put: ' c:"The midwife book herb, and one that has to be measured: it carries compounds that raise blood pressure and have harmed babies — the cases in the record are miscarriages and a distressed newborn. Not in pregnancy on any account, not while trying to conceive, not with blood pressure or diabetes medicine, not for a child, not long term.",',
  },

  /* ---- the refusals come off the books tab ---- */
  {
    label: 'the amounts stop being hedged',
    marker: 'printed as the book gives them as claims',
    find: '["The amounts","Every measurement in this tab is the book\'s own, printed as the book gives it. No one has checked them and this page is not a doctor\'s dose."],',
    put: '["The amounts","Every measurement in this tab is the book\'s own, printed exactly as the book gives it. They are stated as claims, which is what they are."],',
  },
  {
    label: 'the first note of the tab',
    marker: 'printed as the book gives them as claims</b>',
    find: 'not as advice</b>The book gives them plainly, so they are printed plainly. A figure being written down in a book is not the same as a figure being safe, and nothing in this tab is something to try because it is here.',
    put: 'printed as the book gives them as claims</b>The book gives them plainly, so they are printed plainly, and taken as claims.',
  },
  {
    label: 'the multi-vitamin note',
    marker: 'Both lobelia and blue cohosh are named in the book',
    find: 'Lobelia is measured in drops for a reason and has killed people who guessed the amount, and blue cohosh is one of the herbs <i>this</i> page will not hand over. Both are in the book',
    put: 'Both lobelia and blue cohosh are named in the book',
  },
  {
    label: 'the seasoning note stops refusing',
    marker: 'and where the book is the source the claim is the book',
    find: 'the book names them, this page is not repeating them as something to act on.',
    put: 'the book names them, and where the book is the source the claim is the book\'s.',
  },
  {
    label: 'the beef row comes back',
    marker: '["Beef","Bay leaf',
    find: '   ["Beets","Lemon juice, dill, cloves, allspice, ginger, savory, thyme, ginger."],',
    put: '   ["Beef","Bay leaf, basil, dry mustard, nutmeg, green pepper, sage, marjoram, onion, pepper, thyme, dill seed, oregano, caraway, garlic, parsley, rosemary, savory, turmeric, allspice, celery seed. The book\'s row, back in."],\n'
       + '   ["Beets","Lemon juice, dill, cloves, allspice, ginger, savory, thyme, ginger."],',
  },
  {
    label: 'and the note about it is dropped',
    marker: 'All of it is here now',
    find: '  note:"<b>The book also lists beef</b>This library is kept by two people in recovery and the beef row is the one line of that list left out. Everything else is as printed.",\n  noteCls:"warnbox"},',
    put: '  note:"<b>All of it is here now</b>The book\'s list as printed, beef and all.",\n  noteCls:"warnbox"},',
  },
  {
    label: 'the blood cleansers stop hedging',
    marker: 'the bitterest thing in the European herbals. Days at a time',
    find: 'the book gives it here for parasites and worms — and wormwood is the bitterest and harshest thing in the European herbals, days at a time and never in pregnancy. A worm is a doctor and a tablet.',
    put: 'the book gives it here for parasites and worms, and it is the bitterest thing in the European herbals. Days at a time and never in pregnancy. A worm wants a doctor and a tablet beside it.',
  },
  {
    label: 'the vitamin C row',
    marker: 'Its figure, printed the way the book prints it',
    find: 'the book gives 25,000 to 60,000 mg, and says 300 mg every two hours, for an infection. That is many times any label figure and it is printed here as the book prints it.',
    put: 'the book gives 25,000 to 60,000 mg, and 300 mg every two hours, for an infection. Its figure, printed the way the book prints it.',
  },
  {
    label: 'the yohimbe row',
    marker: 'Its own entry carries the caution that has to travel with it',
    find: 'energy and the reproductive organs — and the book pairs it with damiana for a woman. See the yohimbe entry on this page before going near it: it is dangerous with anything acting on serotonin or on blood pressure.',
    put: 'energy and the reproductive organs, and the book pairs it with damiana for a woman. Its own entry carries the caution that has to travel with it: it is dangerous with anything acting on serotonin or on blood pressure.',
  },
  {
    label: 'the goldenseal row',
    marker: "It has harmed newborns, and it sits on the safety tab",
    find: 'the book gives it broadly, for all types of disease. This page will not: goldenseal is on the safety tab by name, and it has harmed newborns.',
    put: 'the book gives it broadly, for all types of disease. It has harmed newborns, and it sits on the safety tab by name for that reason.',
  },
  {
    label: 'the diet note',
    marker: "as the book gives it</b>The corner of it",
    find: 'note:"<b>This is the book\'s diet, not a plan written for anybody here</b>The corner of it that matters in this house is the first line of it: no street drugs, and coming off alcohol, benzodiazepines or opioids is a doctor.",',
    put: 'note:"<b>The book\'s diet, as the book gives it</b>The corner of it that matters in this house is the drug line of it: no street drugs, and coming off alcohol, benzodiazepines or opioids is a doctor.",',
  },
  {
    label: 'the classes note',
    marker: 'The class is what a plant does',
    find: 'note:"<b>Where the class clashes with the caution</b>Comfrey is a demulcent and an emollient and it is also the herb on this page that is never taken internally. A class says what a plant is for; it does not say a plant is safe.",',
    put: 'note:"<b>One plant can be two classes</b>Comfrey is a demulcent and an emollient on this list, and it is also the herb on this page that is never taken internally. The class is what a plant does; the caution is how far to take it.",',
  },
  {
    label: 'the homeopathy note',
    marker: 'homeopathy is a different tradition from every other entry in this library',
    find: 'Several of the raw plants are poisons. They are on this list because the book has them, not as anything to go and take, and homeopathy is a different tradition from every other entry in this library.',
    put: 'Several of the raw plants are poisons. They are on this list because the book has them, and homeopathy is a different tradition from every other entry in this library.',
  },
  {
    label: 'where the copy stops',
    marker: 'is where this one ends',
    find: '["Where the copy stops","The summary in this repo cuts off in the middle of the mineral guide, at phosphorus. There is no fuller list to put here from it, and nothing is being filled in by guesswork."]',
    put: '["Where the copy stops","The summary in this repo cuts off in the middle of the mineral guide, at phosphorus, and that is where this one ends. There is no fuller list to put here from it."]',
  },
  {
    label: 'the doctrine of signatures row',
    marker: 'that is how a healer uses a strong plant',
    find: '["The one line this page does not act on","The book also holds that no herb is poisonous if it is properly combined with an antidote, which is how it explains a healer using a strong plant. This page does not work that way: the poisonous ones on it are marked poisonous and left where they are."]',
    put: '["On the poisonous ones","The book\'s own line, and it is stated here as the book\'s: no herb is poisonous if it is properly combined with an antidote, and that is how a healer uses a strong plant. The poisonous ones on this shelf carry their poison in their own entry, which is what an old herbal did too."]',
  },
  {
    label: 'zinc and selenium',
    marker: '["Zinc",',
    find: '   ["Calcium","Bone, teeth and muscle. Short of it: soft bone, nervousness, muscle cramps, heart trouble. Its herbs: aloe root, horsetail, red clover. Its foods: broccoli, raw vegetables, leafy greens."],',
    put: '   ["Calcium","Bone, teeth and muscle. Short of it: soft bone, nervousness, muscle cramps, heart trouble. Its herbs: aloe root, horsetail, red clover. Its foods: broccoli, raw vegetables, leafy greens."],\n'
       + '   ["Zinc","Cell and tissue growth, the prostate, healing wounds and burns, taste and smell — and vital to enzymes, in the book\'s words."],\n'
       + '   ["Selenium","Liver function, less energy lost, protection from toxins, the prostate, and an antioxidant."],',
  },
  {
    label: 'the new sections',
    marker: '"What the book treats, and with what it treats it"',
    find: ' {h:"What came from where", s:"So the next hand can find it",',
    put: NEW_SECTIONS + ' {h:"What came from where", s:"So the next hand can find it",',
  },
  {
    label: 'and the sources for them',
    marker: 'the dis-ease chart, the easy remedies, the food chapter',
    find: '   ["African Holistic Health","How to prepare a herb, and the two amounts it gives by name. The multi-vitamin method and the herbs in it. The twenty classes. The herbs for dis-eases and the homeopathic quick reference. The vitamin and mineral guides. The doctrine of signatures. The sample menu."],',
    put: '   ["African Holistic Health","How to prepare a herb, and the two amounts it gives by name. The multi-vitamin method and the herbs in it. The twenty classes. The herbs for dis-eases and the homeopathic quick reference. The vitamin and mineral guides. The doctrine of signatures. The sample menu. Added in the second pass on 24 Sep: the dis-ease chart, the easy remedies, the food chapter, the diagnosis chapter, colours and the cycles, the history chapter, and the book\'s own lines."],\n'
       + '   ["Nutricide","and its food medicine chart (p337-338), in the second pass."],',
  },
  {
    label: 'the four new herbs',
    marker: 'from the easy-remedies chapter, African Holistic Health',
    find: '\n];\n\n/* "By need"',
    put: NEW_HERBS + '\n];\n\n/* "By need"',
  },
  {
    label: 'the running log, second entry',
    file: LOGF,
    marker: '## 24 Sep 2026 — the claims go in',
    append: `
## 24 Sep 2026 — the claims go in, and everything held back goes back (\`tools/apply-herbs-books2.js\`)

His words after the first pass: *"put medical claims in and whatever you left off"*.

**The page stopped saying it does not claim anything.** The line under the title,
the note at the top of the inline script, the field legend, the label on every
herb card (\`What people have used it for\` → \`What it does\`), the safety tab's
own box and the ask box's instructions all now state what a plant does. The old
box said *"Nothing here says it works"*; it now says the claims are made here.

**Every refusal came off the entries.** Gone: \`this page will not hand you\`,
\`this page will not hand over\`, \`Its place here is history, not a
recommendation\`, \`this page will not send you to a root for it\`, \`It is not
recommended\`, \`Do not make this at home\`, \`Do not make tea from it\`. Affected:
goldenseal, oregano oil, coltsfoot, pleurisy root, uva ursi, lobelia, pennyroyal,
periwinkle, wormwood, chaparral, blue cohosh. **The facts stayed** — a plant that
has killed people still says so, in the plant's own entry. The tab's hedges went
the same way, and the **beef row went back into the seasoning list**.

**What was left off went in**, eight new sections: the book's dis-ease chart (21
conditions and what it gives for each), its easy remedies, the food chapter (food
combining, white sugar as a drug, the microwave), the **food as medicine chart**
from Nutricide p337-338, how the book reads the body before treating it, colours
and the organ clock, the history chapter, and the book's own quotable lines.
**Four more herbs**: castor, henna, tormentil, stone seed. Zinc and selenium
added to the minerals.

**Still in, on purpose:** an infection, withdrawal (988), a new and sudden
headache, a chest that hurts to breathe, and anything on a prescription — the
\`ASK_SYS\` bullet list is untouched. Those are not claims, they are the
difference between a page and a person being hurt, and the ask box is built to
say them. He has not asked for those out; if he does, that is the one list to
change.

**Not added, deliberately:** the race-and-history polemic in the middle of
Nutricide (the \`White Folks Thinking\` chapter and the grease-and-candles
passage). It is not herb content and it is not health content; the herb part is
what he asked for. Said so to him rather than doing it quietly.

**Tests:** \`server/test/herbs-books.test.js\` updated — the refusals are now
asserted **absent**, the claim language asserted present, and the new sections
covered. \`npm test\` 476 pass / 0 fail. No version bump (the same reason as
above: /herbs never comes from the cache).
`,
  },
];

/* ── run ──────────────────────────────────────────────────────────────────── */

function count(hay, needle) {
  let n = 0, at = 0;
  for (;;) {
    const i = hay.indexOf(needle, at);
    if (i === -1) return n;
    n += 1;
    at = i + needle.length;
  }
}

// The marker for the log entry above was written with an escaped em dash while
// the file has a real one, so the entry was appended once per run. Keep the
// first copy and drop the rest. Safe to run any number of times.
{
  const head = '## 24 Sep 2026 — the claims go in';
  let src = fs.readFileSync(LOGF, 'utf8');
  let n = 0;
  for (;;) {
    const first = src.indexOf(head);
    if (first === -1) break;
    const second = src.indexOf(head, first + 1);
    if (second === -1) break;
    src = src.slice(0, second).replace(/\s*$/, '') + '\n';
    n += 1;
  }
  if (n) {
    fs.writeFileSync(LOGF, src);
    console.log(`deduped: the log entry was in ${n + 1} times (one kept)`);
  }
}

EDITS.push({
  label: 'the test count in the log entry',
  file: LOGF,
  marker: '`npm test` 476 pass / 0 fail',
  find: '`npm test` 478 pass / 0 fail',
  put: '`npm test` 476 pass / 0 fail',
});

const byFile = new Map();
let failed = 0;

for (const e of EDITS) {
  const file = e.file || HERBS;
  const src = byFile.has(file) ? byFile.get(file) : fs.readFileSync(file, 'utf8');
  const name = path.relative(ROOT, file);
  if (src.includes(e.marker)) {
    console.log(`already applied: ${e.label} (${name})`);
    byFile.set(file, src);
    continue;
  }
  if (e.append !== undefined) {
    byFile.set(file, src.replace(/\s*$/, '') + '\n' + e.append);
    console.log(`applied: ${e.label} (${name})`);
    continue;
  }
  const n = count(src, e.find);
  if (n !== 1) {
    console.error(`STOP: ${e.label} — the anchor appears ${n} times in ${name}, and it has to appear once.`);
    failed = 1;
    break;
  }
  byFile.set(file, src.replace(e.find, () => e.put));
  console.log(`applied: ${e.label} (${name})`);
}

if (failed) process.exit(1);

for (const [file, src] of byFile) fs.writeFileSync(file, src);
console.log(`\nwrote ${[...byFile.keys()].map((f) => path.relative(ROOT, f)).join(', ')}`);

/* ── check that what landed is what was meant ─────────────────────────────── */

const herbs = fs.readFileSync(HERBS, 'utf8');

const REFUSALS = [
  'this page will not hand you', 'page will not hand over',
  'Its place here is history, not a recommendation',
  'this page will not send you to a root',
  'It is not recommended', 'Do not make this at home', 'Do not make tea from it',
  'the page will not hand over', 'not as advice',
  'not a plan written for anybody here',
  'it does not say a plant is safe',
  'this page is not repeating them',
  'not as anything to go and take',
  'Nothing here says it works',
  'tradition, not treatment',
  'Every entry says what people have long used a plant for',
];

// The page's own script has to compile, or none of the rest of this means
// anything. A page with a SyntaxError in it looks finished and does nothing —
// which is exactly what happened on the first run of this pass.
let parses = true, parseErr = '';
try {
  let src = '';
  for (const m of herbs.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(m[1])) continue;
    src += m[2] + '\n;\n';
  }
  new vm.Script(src, { filename: 'herbs.html' });
} catch (e) {
  parses = false;
  parseErr = e.message;
}

const CHECKS = [
  [`the page's script compiles${parseErr ? ` (${parseErr})` : ''}`, parses],
  ['the labels claim', /<div class="lbl">What it does<\/div>/.test(herbs)],
  ['the page says the claims are made here', /The claims are made here/.test(herbs)],
  ['the ask box says to make the claim', /these are the books' claims and they are made here/.test(herbs)],
  ['the dis-ease chart is in', /What the book treats, and with what it treats it/.test(herbs)],
  ['the easy remedies are in', /Easy remedies, the book's own/.test(herbs)],
  ['the food chapter is in', /Food: what the book says about eating/.test(herbs)],
  ['the food medicine chart is in', /the food medicine chart, p337-338/.test(herbs)],
  ['reading the body is in', /Reading the body before treating it/.test(herbs)],
  ['colours and the clock are in', /Colours, organs and the clock/.test(herbs)],
  ['the history is in', /The history the book tells/.test(herbs)],
  ["the book's own lines are in", /The book's own lines/.test(herbs)],
  ['the beef row is back', /\["Beef","Bay leaf/.test(herbs)],
  ['zinc and selenium are in', /\["Zinc",/.test(herbs) && /\["Selenium",/.test(herbs)],
  ['the four new herbs are in', /n:"Castor"/.test(herbs) && /n:"Henna"/.test(herbs) && /n:"Tormentil"/.test(herbs) && /n:"Stone seed"/.test(herbs)],
  ['the safety tab still stands', /An infection is a doctor/.test(herbs)],
  ['the ask box still names the crisis line', /988/.test(herbs)],
  ['the ask box still answers in English', /- In English, always\./.test(herbs)],
  ['WHAT STILL HOLDS survives', /WHAT STILL HOLDS/.test(herbs)],
  ['the public caution is still absent', !/Never claim a herb works/.test(herbs)],
  ...REFUSALS.map((r) => [`no refusal left: "${r}"`, !herbs.includes(r)]),
];

let ok = true;
for (const [what, pass] of CHECKS) {
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${what}`);
  if (!pass) ok = false;
}

console.log(`\nherb entries: ${(herbs.match(/\{n:/g) || []).length}`);
console.log(`book sections: ${(herbs.match(/\{h:"/g) || []).length}`);
console.log(ok ? 'all checks passed' : 'SOMETHING IS WRONG — see the FAIL lines above');
process.exit(ok ? 0 : 1);
