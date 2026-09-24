#!/usr/bin/env node
/*
Put the two Llaila O. Afrika books into the herb library.

    node tools/apply-herbs-books.js

Jacques, 24 Sep 2026: "put them in the herb part dont cre about medical
claims organize the herb part more make it more sufficient and more detailed".

WHAT THIS DOES

1.  Eighteen herbs the library did not have, taken from the two books — the
    kitchen seasonings Nutricide names that were missing, and the ones African
    Holistic Health names in its classifications and its remedy table. Each
    carries a new `bk` field, "From the books" — the book's own line for it.
2.  A new tab, **From the books**, holding what the books carry that is not a
    single herb: how they say to prepare a herb, the multi-vitamin method, the
    seasoning amounts, seasoning by food, what each seasoning is for, the blood
    cleansers, the immune builders, the book's short shelves, the nutritional
    approach, the twenty classes, the herbs-for-dis-eases table, vitamins and
    minerals, the doctrine of signatures, the diet it argues for, and a note on
    which book every part came from.
3.  Three new shelves under "By need" for the book's own material: blood
    cleansers, the immune shelf, and the kitchen seasonings.
4.  The stale "244 herbs" count in index.html → no number at all, because a
    number that is wrong is worse than no number.

WHY A SCRIPT AND NOT A TOOL

index.html is around a megabyte and the file tools will not land on it; that is
the same reason tools/apply-desk-wick.js and its neighbours exist. herbs.html is
smaller but is 244 single-line entries deep, so it is patched the same way.

Re-runnable: every edit carries a marker, and a run over a file that already has
the marker reports 'already applied' and changes nothing. Any anchor that does
not appear exactly once stops the run before anything is written.

NOT DONE HERE: no version bump. sw.js deliberately hands /herbs and /herbs.html
straight to the network (sw.js:136), so the page is never served from the cache
and nothing has to be invalidated for it.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HERBS = path.join(ROOT, 'herbs.html');
const INDEX = path.join(ROOT, 'index.html');

/* ── 1. the herbs the library did not have ─────────────────────────────────── */

const NEW_HERBS = `
/* ---- the kitchen seasonings, from Nutricide ---------------------------------
   Nutricide's "Herb Seasoning for Dis-ease" list, p341: the seasonings that
   shelf names and this library did not carry. bk is the book's own line. */
{n:"Allspice",a:"pimento, Jamaican pepper",u:"A heavy meal, gas, the taste of the islands",t:["seasoning","digestion"],
 d:"The dried unripe berry of a Caribbean tree, the one that tastes of clove and cinnamon and nutmeg at once. It goes into the pot wherever the islands cook, and a few berries are brewed as a tea after a heavy meal.",
 h:"Whole berries in the cooking pot; or a few crushed and brewed as a tea.",
 c:"Gentle as a spice. The oil is strong and is not for swallowing neat. Not a daily tea in quantity.",
 bk:"digestion, gas, diabetes, a stimulant."},
{n:"Chervil",a:"garden chervil, French parsley",u:"Water retention, swelling, a spring clean",t:["seasoning","skin"],
 d:"A soft aniseed-scented leaf of the French kitchen, used like parsley and brewed in the old books for a body holding water.",
 h:"The fresh leaf in food; or a small handful steeped as a tea.",
 c:"A food herb and gentle as one. The concentrated oil is not for swallowing. Not in quantity in pregnancy — it is a parsley-family plant.",
 bk:"swellings, edema, a diuretic, eczema, gout."},
{n:"Dill",a:"dill seed, dill weed",u:"Indigestion, gastritis, nausea, colic",t:["seasoning","digestion"],
 d:"The seed of the feathery kitchen herb, chewed after a meal and brewed for a stomach that is griping. The warm seed water is the old answer for a colicky baby, and it is the seed that goes in the pot, not the oil.",
 h:"Seed chewed, or crushed and brewed; the leaf in food.",
 c:"Gentle. Never the concentrated oil, and never the oil for a baby or a child.",
 bk:"indigestion, gastritis, croup, nausea."},
{n:"Marjoram",a:"sweet marjoram, knotted marjoram",u:"A headache, an acid stomach, a cold, a wound-up evening",t:["seasoning","cold","mood"],
 d:"A soft grey-green kitchen herb of the Mediterranean, put in the pot and brewed as a tea in the old books for a heavy head and an acid stomach. The old herbals also laid it on a bruise.",
 h:"The leaf in food; or a small handful steeped as a tea.",
 c:"Gentle as a spice and as a tea. The oil is not for swallowing, and not for a baby.",
 bk:"headaches, acidity, colds, measles, nervousness."},
{n:"Paprika",a:"sweet red pepper, Capsicum annuum",u:"A blocked sinus, a cold in the head",t:["seasoning","cold"],
 d:"Ground sweet red pepper, a kitchen colour and warmth rather than a heat, and the old books use it for the head that is stopped up.",
 h:"In food. A pinch in a soup or a stew.",
 c:"A spice, and a hot one for some stomachs. Not by the spoonful with an ulcer or a reflux. Keep it out of the eyes and off broken skin.",
 bk:"sinus trouble, colds."},
{n:"Savory",a:"summer savory, winter savory",u:"Colds, a slow digestion, the old earache books",t:["seasoning","digestion","cold"],
 d:"A peppery little kitchen herb of the bean pot, brewed in the old books for a cold and for a slow stomach. It is named in the books for ear trouble, which is the one use on this page to hold at arm's length.",
 h:"The leaf in food, especially with beans; or a small amount steeped as a tea.",
 c:"Gentle in food. Nothing goes in an ear here: an ear that is leaking, or that hurts a child at night with a fever, or an ear where the drum might be torn, is a doctor and not a herb.",
 bk:"ear trouble, colds, digestion, a stimulant."},
{n:"Vanilla",a:"vanilla bean, Vanilla planifolia",u:"Digestion, gas, settling the nerves",t:["seasoning","digestion","mood"],
 d:"The cured pod of a climbing orchid of Mexico, the most used scent in the kitchen and a settling one — the old books keep it for a nervous stomach and for the smell of it as much as the taste.",
 h:"The pod or the extract in food and in milk.",
 c:"Food and gentle. The extract sold in a shop carries alcohol, so a spoonful of it is not a drink. Not the neat oil.",
 bk:"digestion, gas, neurasthenia (soothing the nerves)."},
{n:"Wheatgrass",a:"wheat grass juice, young wheat leaf",u:"The blood, a spring clean, a green food",t:["blood","energy"],
 d:"The young blade of the wheat plant, grown on a tray and pressed for its juice. The old books drink it green and bitter for the blood, and it is food before it is medicine.",
 h:"The fresh juice, in a small glass, often with something sweeter.",
 c:"Food, and it turns the stomach of some people in the first days. It carries vitamin K, so it works against warfarin — ask before drinking it on a blood thinner. Not for somebody who cannot have wheat.",
 bk:"a blood cleanser, for the red blood cells."},
{n:"Grape seed",a:"grape seed extract, Vitis vinifera seed",u:"The body's own defences, a cold going round",t:["immune","cold"],
 d:"The pips left over from the wine press, ground and taken as an extract. The old use is the one the book names — building the defences — and it is the same family of thinking as pine bark beside it.",
 h:"The extract, in drops or a capsule, as sold.",
 c:"It thins the blood a little — stop before surgery and ask first on a blood thinner. Not in pregnancy.",
 bk:"an immune system builder, for infection."},
{n:"Pine bark",a:"pine bark extract, maritime pine, pycnogenol",u:"Colds, the defences, an old Spanish sailors' remedy",t:["immune","cold"],
 d:"The bark of the French maritime pine, taken as an extract. The story the books tell is the sailors on a long voyage who ate the bark and did not get the scurvy the others got.",
 h:"The extract, in a capsule or drops, as sold.",
 c:"Thins the blood a little and moves blood pressure — ask a pharmacist before adding it to a blood thinner or a blood pressure tablet. Not in pregnancy or while feeding.",
 bk:"an immune system builder, for colds and infection."},
{n:"Chaparral",a:"creosote bush, Larrea tridentata, greasewood",u:"An inflamed joint, a skin complaint, an old bitter tea",t:["joints","skin","immune"],
 d:"A resinous desert bush of the American south-west, brewed bitter by the peoples there and taken in the old books for inflamed tissue. It is one of the herbs this page keeps marked.",
 h:"The leaf, brewed short; or the leaf in a wash for the skin. The tablets are sold in shops.",
 c:"Read this one twice. Chaparral has been tied to real liver damage, and the United States food and drug administration warned about it in the 1990s. Short run only, never with a liver already under strain, never in pregnancy, never for a child. A skin or joint complaint that is not settling is a doctor.",
 bk:"one of its anti-inflammatory herbs, with arnica, cayenne and garlic."},
{n:"Buchu",a:"Agathosma betulina, bookoo, round leaf buchu",u:"Burning water, the waterworks, an old Cape remedy",t:["urinary"],
 d:"A small aromatic bush of the Cape in South Africa, brewed by the people there for the waterworks and carried into the European books by the same route as the ships.",
 h:"The leaf, a short tea, days at a stretch and not weeks.",
 c:"Not in pregnancy. The oil is not for swallowing. Real caution: burning water, a fever, or blood in the urine is a bladder or a kidney infection, and that is a doctor and a tablet — a tea will not clear it.",
 bk:"the book's example diuretic, with parsley."},
{n:"Wild violet",a:"Viola odorata, sweet violet",u:"A cough, a sore mouth, the old worm books",t:["lungs","mouth","skin"],
 d:"The small sweet violet of European hedgerows, the flower and leaf brewed for a cough and held in the mouth for a sore one. The book names it in the worm list, and the root is a different matter entirely.",
 h:"The leaf and flower in a tea; a cooled brew as a mouth rinse.",
 c:"The leaf and flower are gentle. The root is a strong emetic — it makes a person vomit hard — and is not for making at home. A worm is a doctor and a tablet, not a violet.",
 bk:"one of its anthelmintics — herbs against intestinal worms — with garlic and horseradish."},
{n:"Spikenard root",a:"Aralia racemosa, American spikenard",u:"An old spring tonic, the skin, the blood",t:["blood","skin","energy"],
 d:"A large sweet-smelling root of the North American woods, brewed in the old books as a slow tonic for a body that has gone dull. The American spikenard and the Asian one that goes in perfume are different plants with one name.",
 h:"The root, a long decoction, in the old tonic blends.",
 c:"Not in pregnancy. Ask a pharmacist if you take a prescription — the old alterative roots are usually taken beside other herbs and not alone.",
 bk:"one of its alternatives — a herb the book slows a cure down with so the body is not shocked — with sarsaparilla, echinacea, garlic and ginger."},
{n:"Blue cohosh",a:"Caulophyllum thalictroides, squaw root, papoose root",u:"A cramping cycle, a difficult labour, in the very old books",t:["women"],
 d:"A blue-berried woodland root of North America, kept in the midwife books for the last weeks of a pregnancy and for a cramping cycle. It is named in the book's own multi-vitamin formula.",
 h:"It is a midwife's or a practitioner's herb, not a household tea.",
 c:"Flatly: this is one of the ones the page will not hand over. It carries compounds that raise blood pressure and have harmed babies — the cases in the record are miscarriages and a distressed newborn. Not in pregnancy on any account, not while trying to conceive, not with blood pressure or diabetes medicine, not for a child, not long term. A cramping cycle that is disabling is a doctor.",
 bk:"one of the herbs in the book's multi-vitamin and mineral formula, paired there with black haw."},
{n:"Black haw",a:"Viburnum prunifolium, stag bush, sweet viburnum",u:"A cramping cycle, a nervous stomach",t:["women","pain","sleep"],
 d:"A small tree of the American south, its bark brewed in the old books for a period that doubles a person over and for a stomach that knots with nerves. It stands next to black haw's cousin cramp bark in the old lists, and the two are used alike.",
 h:"The dried bark, a decoction, at the first sign.",
 c:"Not with blood thinners, aspirin or a stomach that bleeds. Not in pregnancy except under a midwife. Hard on the stomach in quantity.",
 bk:"one of the herbs in the book's multi-vitamin and mineral formula, paired there with blue cohosh."},
{n:"Centaury",a:"Centaurium erythraea, the book writes it \\"Century\\"",u:"A poor appetite, a slow liver, an old anaemia tea",t:["digestion","liver","blood"],
 d:"A small pink bitter of dry European meadows, the classic bitter tonic of the old herbals — a little taken before food to wake an appetite. The book names it in its remedy table for anaemia.",
 h:"A short, very bitter, cold infusion before food.",
 c:"Very bitter and it does not suit an ulcer or a stomach that burns. Not in pregnancy. It is a bitter, not an iron tablet: anaemia is a blood test and a doctor.",
 bk:"one of the herbs it gives for anemia, with agrimony and comfrey."},
{n:"Gymnema",a:"Gymnema sylvestre, gurmar, the sugar destroyer",u:"Blood sugar, a craving for sugar, an old Indian tea",t:["digestion","energy","blood"],
 d:"A climbing vine of the Indian forests whose leaf, chewed, takes the taste of sugar out of the mouth for a while — which is where the name comes from. It is the herb the book's remedy table names for diabetes.",
 h:"The leaf, brewed as a tea; or the powder as sold.",
 c:"Real caution: it lowers blood sugar and it stacks with diabetes tablets and with insulin. Not in pregnancy or while feeding. Read the next line twice — diabetes is a doctor, a monitor and a prescription, and a leaf is never in place of any of those.",
 bk:"the herb it gives for diabetes, with bilberry."}
`;

/* ── 2. the book sections, and the tab that shows them ─────────────────────── */

const BOOKS_DATA = `
/* ---- FROM THE BOOKS ---------------------------------------------------------
   What the two Afrika books carry that is not one herb: the classifications,
   the preparation methods, the book's own amounts, its lists and its shelves.

   Every line here is theirs. The amounts are theirs too, printed as the books
   give them and not checked by this page — they are here because the library
   belongs to two people who own the books, and because that is what was asked
   for (24 Sep 2026). The safety tab is not softened by any of it, and the
   substances the books name that are poisons are marked as poisons where they
   come up.

   African Holistic Health (the copy in this repo is Bookey's summary of it) and
   Nutricide. Page numbers are Nutricide's.
--------------------------------------------------------------------------- */
var BOOKS = [
 {h:"What this tab is, and where each line came from", s:"Read this one first",
  rows:[
   ["The two books","African Holistic Health and Nutricide, both by Llaila O. Afrika. They sit beside this library. Everything in this tab, and every entry with a From the books line on it, is theirs rather than the page's."],
   ["The copy of African Holistic Health here","is Bookey's summary of the book — chapter summaries, quoted pages, and questions and answers. Where a line below says the book, that is the summary's words about the book. It is not the whole book."],
   ["The copy of Nutricide here","is a rough scan read as text. The seasonings, the nutritional approach, the blood cleansers and the immune builders in this tab are transcribed from it."],
   ["The amounts","Every measurement in this tab is the book's own, printed as the book gives it. No one has checked them and this page is not a doctor's dose."],
   ["What has not changed","The safety tab stands exactly as it was. An infection, coming off alcohol or a drug, pregnancy, a child, and anything you take on a prescription still go where they went before."],
   ["Why it is a tab and not entries","The books' own material is mostly not about one plant. Classes, methods, amounts, shelves and tables do not fit a herb card, so they got their own shelf instead of being cut up into one."]],
  note:"<b>Read the amounts as the book\\u2019s, not as advice</b>The book gives them plainly, so they are printed plainly. A figure being written down in a book is not the same as a figure being safe, and nothing in this tab is something to try because it is here.",
  noteCls:"warnbox"},

 {h:"How the books say to prepare a herb", s:"African Holistic Health · the herbs chapter",
  rows:[
   ["Tea or infusion","One teaspoon of herb per cup of water. Roots and barks are simmered 20 to 30 minutes; leaves and flowers go in after the pot comes off the heat and steep 10 to 30 minutes."],
   ["Sun tea","The herbs in water, left in the sun for several hours, so the warmth draws it out without a flame."],
   ["Poultice","Mixed with water, spread on a cloth, laid on the skin — the skin oiled first — and covered."],
   ["Extract or tincture","The herb with alcohol, left to steep for two weeks, then strained."],
   ["Salve","Sixteen ounces of herb with oils and beeswax, simmered and strained."],
   ["Syrup","The herb simmered with honey, grain syrup or molasses until it thickens, then stored."],
   ["Liniment","The herbs with rubbing alcohol, left to steep and strained, for the skin."],
   ["Fresh against dried","Fresh, picked the same day, is the strongest in the book's view. Dried is weaker, and in some cases the book says it does not act."],
   ["What blunts a herb","The book's line: synthetic drugs, junk food and alcohol antidote or lessen what a herb does."],
   ["Buying","From a herb dealer or a health food shop, or a standard brand — the book's reason is that a weaker relative gets sold under the right name."],
   ["The two amounts it gives by name","Lobelia at one teaspoon to four cups of water. Cayenne and garlic at one eighth of a teaspoon to four cups."]]},

 {h:"The multi-vitamin and mineral brew", s:"African Holistic Health · vitamins and minerals",
  rows:[
   ["The method","One cup of water for each teaspoon of herb, plus two glasses for the pot. Boil it, turn it low, and simmer the roots, barks and seeds at least 30 minutes."],
   ["Then the leaves","Off the heat, the leaves and flowers go in and stand 30 minutes or more."],
   ["Straining and keeping","Strain it while it is warm, and keep it in dark glass in the refrigerator."],
   ["To keep it longer","One tablespoon of vegetable glycerin per four to five cups of liquid, or honey at the same rate."],
   ["The ratio","One teaspoon of herb per cup of water, or one ounce of herb to twenty ounces of water."],
   ["Substituting","A herb can be swapped for one in the same family or with a similar content."],
   ["Adding for a complaint","Extra herbs for a particular complaint go into the pot the same way — though the book says to take those separately."],
   ["The herbs it names","Alfalfa. Shavegrass. Licorice. Peppermint. Blue cohosh, or black haw. Red raspberry leaves. Mullein. Plantain. Burdock. Marshmallow. Moss, or kelp. Lobelia. Dandelion root. Yellow dock. Cayenne. Garlic."]],
  note:"<b>Two of those are not casual</b>Lobelia is measured in drops for a reason and has killed people who guessed the amount, and blue cohosh is one of the herbs <i>this</i> page will not hand over. Both are in the book\\u2019s formula and both carry their own caution on their own entry here.",
  noteCls:"warnbox"},

 {h:"Seasoning: how much the book uses", s:"Nutricide · seasoning for food, p339",
  rows:[
   ["How much","About one eighth to one quarter of a teaspoon of a herbal spice for every four servings."],
   ["Two together","A quarter teaspoon of each herb, and a quarter to an eighth of a teaspoon of each spice, for four servings."],
   ["The book's own examples","A quarter teaspoon of dill seed and a quarter teaspoon of dry mustard on vegetables. Or a quarter teaspoon of basil and an eighth of a teaspoon of garlic powder in bean or soy patties."],
   ["Its own line about it","You can use your seasonings as a medicine and taste. The book's argument is that seasonings were the original medicaments, and that the shelf stopped being read that way."]]},

 {h:"What each seasoning is for", s:"Nutricide · herb seasoning for dis-ease, p341",
  rows:[
   ["Allspice","digestion, gas, diabetes, a stimulant"],
   ["Anise","digestion, the liver, colic, a tonic, colds, spasm"],
   ["Basil","rheumatism, cramps, vomiting, mucous"],
   ["Chervil","swellings, edema, a diuretic, eczema, gout"],
   ["Cinnamon","diarrhea, poliomyelitis, upset stomach"],
   ["Coriander","a stomach tonic, digestion problems, rheumatism, joint pain"],
   ["Dill","indigestion, gastritis, croup, nausea"],
   ["Fennel","a laxative, a diuretic, digestion, sores"],
   ["Garlic","hypertension, infections, high blood pressure, worms"],
   ["Ginger","nausea, cramps, meningitis, edema"],
   ["Horseradish","dysmenorrhea, high blood pressure, a diuretic, arthritis"],
   ["Kelp","the thyroid, goiter"],
   ["Marjoram","headaches, acidity, colds, measles, nervousness"],
   ["Mustard","gastritis, the liver, rheumatism, digestion"],
   ["Oregano","leukorrhea, colds, headaches, asthma, a tonic"],
   ["Paprika","sinus trouble, colds"],
   ["Parsley","a diuretic, dropsy, edema, colds"],
   ["Pepper","neuralgia — nerve pain"],
   ["Rosemary","colds, arthritis, memory, digestion, spasm"],
   ["Sage","sores, bleeding wounds, depression, stopping sweats, a sore throat"],
   ["Savory","ear trouble, colds, digestion, a stimulant"],
   ["Thyme","headaches, colds, hypothyroidism, worms, loss of appetite, diarrhea"],
   ["Turmeric","fever, colds, skin problems, a diuretic, high blood pressure"],
   ["Vanilla","digestion, gas, neurasthenia — soothing the nerves"]],
  note:"<b>The list as the book has it</b>One line each, in the book\\u2019s own words. Three of them are named for a cancer, a meningitis and a poliomyelitis, and those are a hospital \\u2014 the book names them, this page is not repeating them as something to act on. And nothing goes in an ear from this list: an ear that leaks, or that hurts a child at night with a fever, is a doctor.",
  noteCls:"warnbox"},

 {h:"Which seasoning goes on which food", s:"Nutricide · seasoning for food, p339",
  rows:[
   ["Asparagus","Lemon juice, dry mustard, marjoram, sesame seed, pepper, thyme."],
   ["Beets","Lemon juice, dill, cloves, allspice, ginger, savory, thyme, ginger."],
   ["Broccoli","Lemon juice, pepper, caraway seed, dry mustard, nutmeg, basil, curry, oregano, garlic."],
   ["Cabbage and cauliflower","Lemon juice, caraway seed, dill seed, cumin, allspice, celery seed, mace, mint, dry mustard, savory, tarragon, oregano, parsley, rosemary, pepper."],
   ["Carrots","Parsley, cinnamon, lemon juice, allspice, nutmeg, mint, bay leaf, caraway seed, dill seed, ginger, mace, thyme, marjoram, pepper."],
   ["Corn","Green pepper, onion, paprika, pepper, curry."],
   ["Eggplant","Lemon juice, onion, bay leaf, pepper."],
   ["Eggs","Basil, curry, dry mustard, green pepper, onion, paprika, parsley, nutmeg, cardamom, pepper."],
   ["Fish","Bay leaf, basil, curry, cumin, dry mustard, green pepper, lemon juice, paprika, marjoram, allspice, fennel, mace, onion, nutmeg, turmeric, parsley, sesame seed."],
   ["Fruit and fruit desserts","Allspice, cinnamon, cloves, ginger, mace, mint, nutmeg, vanilla, or herbal extracts."],
   ["Greens","Lemon juice, onion, allspice, pepper."],
   ["Lima beans","Sage, lemon juice, chives, pepper, onion."],
   ["Okra","Lemon juice, pepper, onion."],
   ["Onion","Caraway seed, nutmeg, oregano, sage, thyme, pepper, basil, marjoram."],
   ["Macaroni and noodles","Allspice, onion, poppy seed, dill seed, whole grain, green pepper."],
   ["Green peas","Onion, mint, sage, rosemary, parsley, savory, green pepper, basil, oregano, poppy seed, lettuce leaf, pepper, garlic."],
   ["Potatoes","Onion, basil, mace, parsley, paprika, bay leaf, green pepper, chives, celery seed, oregano, poppy seed, rosemary, thyme, pepper, garlic, mint, nutmeg."],
   ["Poultry","Bay leaf, cranberries, thyme, paprika, parsley, green peppers, sage, curry, dill seed, pepper, ginger, marjoram, nutmeg, tarragon."],
   ["Rice","Turmeric, cumin, allspice, nutmeg, cinnamon, onion, green pepper, pepper."],
   ["Spinach","Lemon juice, onion, allspice, basil, mace, oregano, pepper."],
   ["Squash","Ginger, mace, allspice, onion, basil, cinnamon, cloves, nutmeg, fennel, rosemary, pepper."],
   ["String beans","Marjoram, lemon juice, nutmeg, savory, dill seed, thyme, dry mustard, oregano, onion, caraway seed, sage, garlic, pepper."],
   ["Tomatoes","Basil, marjoram, thyme, onion, lemon juice, oregano, green pepper, pepper, caraway seed, sage, sesame seed."]],
  note:"<b>The book also lists beef</b>This library is kept by two people in recovery and the beef row is the one line of that list left out. Everything else is as printed.",
  noteCls:"warnbox"},

 {h:"Blood cleansers", s:"Nutricide · p342",
  rows:[
   ["What the shelf is","The book's own list of what it sends to the blood. It is a food and root shelf in a diet already built on raw food, not a bottle of drops."],
   ["Burdock","the root, brewed — the old spring-clean root, with dandelion."],
   ["Dandelion root","brewed or roasted, the bitter of the same pair."],
   ["Elecampane","for a congested lung and the blood."],
   ["Garlic","the book's line is for the white blood cells. Raw, crushed and rested."],
   ["Green vegetables","eaten generously — the whole shelf's argument in one line."],
   ["Milk thistle","to protect the liver and the blood."],
   ["Pleurisy","for lung congestion and the blood."],
   ["Red clover","the field flower, brewed as a tea."],
   ["Wheat grass juice","the book's line is for the red blood cells. A small glass; it carries vitamin K, so it works against warfarin."],
   ["Spirulina","a green food, bought from a source that tests it."],
   ["Wormwood","the book gives it here for parasites and worms — and wormwood is the bitterest and harshest thing in the European herbals, days at a time and never in pregnancy. A worm is a doctor and a tablet."]]},

 {h:"Immune system builders", s:"Nutricide · p342-343",
  rows:[
   ["Spirituality","first on the list, as helping to use God's help."],
   ["Exercise","the book's best builder, ahead of anything in a bottle."],
   ["Garlic","the book calls it an antibiotic, and gives it for parasites."],
   ["Vitamin C","the book gives 25,000 to 60,000 mg, and says 300 mg every two hours, for an infection. That is many times any label figure and it is printed here as the book prints it."],
   ["Echinacea extract","infection."],
   ["Grape seed extract","infection."],
   ["Pine bark extract","colds, infection."],
   ["Yohimbe extract","energy and the reproductive organs — and the book pairs it with damiana for a woman. See the yohimbe entry on this page before going near it: it is dangerous with anything acting on serotonin or on blood pressure."],
   ["Goldenseal extract","the book gives it broadly, for all types of disease. This page will not: goldenseal is on the safety tab by name, and it has harmed newborns."],
   ["Vitamin E","up to 800 i.u. a day, as the book gives it."],
   ["Ginseng","energy."],
   ["Lecithin","the book gives it for the nerves."],
   ["Lysine","1000 mg, for infection and for herpes."],
   ["Biotin","given for energy — the rough scan of the book reads fotin here."],
   ["Ginger","digestion, edema."],
   ["Glutathione","the book's line is that it removes cellular waste."],
   ["Creatine","the book's line is that it builds healthy tissue."]]},

 {h:"The book's other short shelves", s:"Nutricide · p343",
  rows:[
   ["Skin","MSM tablets and lotion. Lysine cream. Zinc cream."],
   ["Yeast infection","Pau d'arco — see its own entry on this page. Its whole caution is that it thins the blood and it is not a long daily tea."],
   ["Sleep","Valerian. Catnip. Chamomile. Kava. Passion flower. Hops. All six have their own entry here, and kava's is the one to read first if the liver has had a bad time."],
   ["Digestive enzyme","Tablets — the book's use is that they improve the breakdown of supplements, herbs and food."]]},

 {h:"The nutritional approach", s:"Nutricide · p342",
  rows:[
   ["Raw whole food","Fruit, vegetables, grains and beans, eaten fresh and raw."],
   ["Cooked","Whole grains and lightly steamed vegetables."],
   ["Green","Dark green leafy vegetables and the juice of the dark green leaves, generously."],
   ["Off the table","No dairy products. No fried food."],
   ["Animals","No animals, no fish, no fowl. The book's own line is that dead food produces dead cells."],
   ["Garlic","fresh, raw and organically grown where it can be had."],
   ["Drugs","none of any kind in the book's words — prescribed, over the counter or street. It says drugs destroy the immune system."],
   ["Herbal extracts and teas","The book's reason for preferring them: they go straight to the bloodstream and act better and faster than pills and capsules."]],
  note:"<b>This is the book's diet, not a plan written for anybody here</b>The corner of it that matters in this house is the first line of it: no street drugs, and coming off alcohol, benzodiazepines or opioids is a doctor.",
  noteCls:"okbox"},

 {h:"The twenty classes of herb", s:"African Holistic Health · herb classifications",
  rows:[
   ["Alternatives","Slow down the action of a curative herb so the body is not shocked. Spikenard root, sarsaparilla root, echinacea root, garlic, ginger."],
   ["Anthelmintics","Remove worms from the gut. Garlic, horseradish, wild violet."],
   ["Antiperiodics","Reduce seizures from a fever or a nervous disorder. Vervain, arnica, red raspberry."],
   ["Anti-inflammatory","Against inflammation in a disease state. Arnica, cayenne, garlic, chaparral."],
   ["Antipyretics","Bring a temperature down. Eucalyptus, feverfew."],
   ["Antiseptics and disinfectants","Against harmful bacteria. Anise, myrrh, thyme, garlic."],
   ["Astringents","Contract tissue and tighten skin and mucous membrane. Alum root — cranesbill — and witch hazel."],
   ["Bitter tonics","Help digestion and wake the appetite. Chamomile, dandelion."],
   ["Calmatives","Bring relaxation and a sense of well-being. Chamomile, valerian."],
   ["Cathartics","Laxatives, for constipation. Cascara sagrada, senna."],
   ["Demulcents","Soothe and protect the organs inside. Licorice, marshmallow, oatmeal."],
   ["Diaphoretics","Raise a sweat, to carry impurities out. Ginger, sage, yarrow."],
   ["Diuretics","Move water and flush it out. Buchu, parsley."],
   ["Emollients","Soften and soothe, outside and inside. Comfrey, marshmallow."],
   ["Expectorants","Bring phlegm up out of the chest. Elecampane, mullein."],
   ["Nervines","Relax the nervous system. Valerian, catnip."],
   ["Stimulants","Raise nerve reaction and energise. Coffee bean, guarana."],
   ["Refrigerants","Cool the body. Mints, eucalyptus."],
   ["Sedatives","Calm pain and anxiety. Chamomile, cramp bark."],
   ["Vulnerary","Heal wounds and the skin. Aloe vera, comfrey."]],
  note:"<b>Where the class clashes with the caution</b>Comfrey is a demulcent and an emollient and it is also the herb on this page that is never taken internally. A class says what a plant is for; it does not say a plant is safe.",
  noteCls:"warnbox"},

 {h:"Which herb the book gives for what", s:"African Holistic Health · remedies",
  rows:[
   ["Abscesses","Lobelia, mugwort, slippery elm."],
   ["Aches","Black cohosh, goldenseal."],
   ["Anemia","Agrimony, centaury — the trial copy reads century — and comfrey."],
   ["Asthma","Catnip and peppermint; and in the book's answers, lobelia, mullein and hyssop. An asthma that needs a reliever is not a herb problem: keep the inhaler and see a doctor."],
   ["Blood circulation","Cayenne and ginseng; and ginkgo biloba."],
   ["Bowel problems","Dandelion and slippery elm."],
   ["Burns","Aloe vera, goldenseal, marshmallow — on the skin, never the neat oil."],
   ["Colds","Aconite and bryonia; and allium cepa, the onion. Allium cepa is the onion and is not homeopathy; aconite and bryonia are."],
   ["Coughs","Coltsfoot, mullein and thyme; and in the book's answers, lobelia, hyssop and mullein. Coltsfoot is the one on the safety list: a few days at most, never for a child."],
   ["Diabetes","Gymnema sylvestre and bilberry. Diabetes is a doctor, a monitor and a prescription — a herb is never in place of any of them."],
   ["Diarrhea","Arsenicum, bryonia."],
   ["Fever","Aconite, belladonna, nux vomica."],
   ["Headache","Bryonia, belladonna, nux vomica. A headache that is new and the worst of your life is an emergency."],
   ["Indigestion","Nux vomica, arsenicum."],
   ["Inflammation","Anise, catnip, thyme."],
   ["Menstrual problems","Belladonna, bryonia, calc. phos."],
   ["Skin eruptions","Aloe vera, goldenseal, chickweed."],
   ["Throat irritation","Catnip, goldenseal, hypericum."],
   ["Allergy and hay fever","Apis and arsenicum, for an acute attack, in the homeopathic quick reference."]],
  note:"<b>Half of the second half is homeopathy, not the plants on this page</b>Aconite, belladonna, bryonia, nux vomica, arsenicum, cantharis, apis and calc. phos. are homeopathic remedies — given by name and in dilution. Several of the raw plants are poisons. They are on this list because the book has them, not as anything to go and take, and homeopathy is a different tradition from every other entry in this library.",
  noteCls:"warnbox"},

 {h:"Vitamins and minerals, as the book has them", s:"African Holistic Health · vitamin and mineral guides",
  rows:[
   ["What a vitamin is","The book's framing: vitamins energise the body, minerals stabilise it, and vitamins are either water-soluble or oil-soluble."],
   ["Which to buy","Plant-derived over synthetic, and whole food over processed."],
   ["On the printed dose","The book's argument is that the amount printed on a label is often not enough for what it calls a therapeutic want, and that the water-soluble ones in particular can be raised. It also says a child's dose is not an adult's."],
   ["Vitamin A","Tissue and immunity. Short of it, the skin and the sight suffer. Carrots and leafy greens."],
   ["B complex","Metabolism, energy and mental health."],
   ["Vitamin C","The glands, and resistance to disease. Short of it, wounds and gums."],
   ["Vitamin D","Draws minerals in and builds bone. Short of it, growth and energy suffer."],
   ["Vitamin E","Tissue health and circulation."],
   ["Vitamin K","Clotting and energy."],
   ["Also named","Vitamin F, the fatty acids. Vitamin T, for making blood. Vitamin U, for healing a wound. Vitamin P, for protecting a cell."],
   ["Minerals","Chelated rather than synthetic, bought from a health food shop in the book's words — and two to three times the ordinary amount when treating something."],
   ["Iron","Makes blood. Short of it: low mental sharpness, anemia, tiredness, headaches. Its herbs: burdock root, chamomile, fennel. Its foods: almonds, spinach, whole grains."],
   ["Calcium","Bone, teeth and muscle. Short of it: soft bone, nervousness, muscle cramps, heart trouble. Its herbs: aloe root, horsetail, red clover. Its foods: broccoli, raw vegetables, leafy greens."],
   ["Where the copy stops","The summary in this repo cuts off in the middle of the mineral guide, at phosphorus. There is no fuller list to put here from it, and nothing is being filled in by guesswork."]]},

 {h:"The doctrine of signatures", s:"African Holistic Health · the doctrine of signature",
  rows:[
   ["The idea","The sign of what a plant is for is written on the plant — its shape, colour, texture, taste and smell. The book's point is that the first herbalists read the plant rather than a textbook."],
   ["Leaves","Lobed leaves for the lung. Wrinkled leaves for the skin. Smooth leaves for the organs inside. Complicated veins for nerve and circulation."],
   ["Where it grows","A short plant is rich in minerals, for bone. A tall one for breathing. A vine for the nervous system. A flower for the skin and the digestion."],
   ["Roots","Roots steady a nutrient and can flush the body out. A red root for the blood; a yellow root for the bowel."],
   ["Taste and colour","Bitter closes and dries; sweet opens and moistens."],
   ["The one line this page does not act on","The book also holds that no herb is poisonous if it is properly combined with an antidote, which is how it explains a healer using a strong plant. This page does not work that way: the poisonous ones on it are marked poisonous and left where they are."]]},

 {h:"The diet the book argues for", s:"African Holistic Health · sample menu and recipes",
  rows:[
   ["The argument","The book's position is that the right diet is made of plants that grow near the equator, and that the traditional one was raw fruit, vegetables, whole grains and herbs."],
   ["The fruit it names","Acerola cherry, apricot, avocado, banana, cantaloupe, coconut, mango, papaya, pineapple."],
   ["The morning","A glass of water; the book says wait 30 to 40 minutes before breakfast. Rolled oats with fruit or vegetable juice, and flax seed if there is any."],
   ["The heaviest meal","Between ten and two in the book's example. Brown rice with cauliflower, with brewer's yeast and peanut flour on top."]]},

 {h:"What came from where", s:"So the next hand can find it",
  rows:[
   ["Nutricide","The seasoning amounts and the list of which seasoning goes on which food (p339). What each seasoning is for (p341). The nutritional approach and the blood cleansers (p342). The immune builders, and the short shelves for skin, yeast, sleep and digestive enzymes (p342-343)."],
   ["African Holistic Health","How to prepare a herb, and the two amounts it gives by name. The multi-vitamin method and the herbs in it. The twenty classes. The herbs for dis-eases and the homeopathic quick reference. The vitamin and mineral guides. The doctrine of signatures. The sample menu."],
   ["When","Both read and put in on 24 Sep 2026."],
   ["The rest of the two books","The middle of both is not transcribed here and was not read line by line. Nothing in this tab is invented to fill a gap, and the places where the copies run out are said so in the row they run out in."]]}
];

/* Each section opens and shuts like a herb card does, so the page keeps one
   way of doing it — the click handler on the view already toggles by data-h. */
function bsec(b,i){
  var id='bk'+i, open=openId===id;
  var out='<div class="card'+(open?' open':'')+'" data-h="'+id+'">'
   +'<div class="row"><div class="row-txt"><b>'+esc(b.h)+'</b>'
   +(b.s?'<span>'+esc(b.s)+'</span>':'')+'</div><div class="chev">&#8250;</div></div>'
   +'<div class="body">';
  (b.rows||[]).forEach(function(r){ out+='<p><b>'+esc(r[0])+'</b> &mdash; '+esc(r[1])+'</p>' });
  if(b.note) out+='<div class="big '+(b.noteCls||'warnbox')+'">'+b.note+'</div>';
  out+='</div></div>';
  return out;
}
`;

/* ── the running log ──────────────────────────────────────────────────────── */

const LOG = `

## 24 Sep 2026 — the two Afrika books go into the herb library (no version bump)

Jacques put two books in the repo and asked for them in the herb part: *"put
them in the herb part dont cre about medical claims organize the herb part more
make it more sufficient and more detailed"*. The two are **African Holistic
Health** (the copy in the repo is Bookey's **summary** of it, not the book) and
an OCR scan of **Nutricide**. Both were read in the same session.

\`herbs.html\` was 244 herbs, a search box, four tabs and an ask box. It now carries:

- **Eighteen herbs it did not have** — the kitchen seasonings Nutricide names
  that were missing (allspice, chervil, dill, marjoram, paprika, savory,
  vanilla), and the ones African Holistic Health names in its classifications
  and its remedy table (wheatgrass, grape seed, pine bark, chaparral, buchu,
  wild violet, spikenard root, blue cohosh, black haw, centaury, gymnema). Each
  has a new **\`bk\`** field — *From the books* — with the book's own line for it.
- **A new tab, From the books**, sixteen sections: how the books say to prepare a
  herb; the multi-vitamin method and the herbs in it; the seasoning amounts
  (Nutricide p339); which seasoning goes on which food; what each seasoning is
  for (p341); the blood cleansers (p342); the immune builders (p342-343); the
  book's short shelves for skin, yeast, sleep and digestive enzymes; the
  nutritional approach; **the twenty classes of herb**; the herbs-for-dis-eases
  table; the vitamin and mineral guides; the doctrine of signatures; the diet it
  argues for; and a section naming which book every part came from.
- **Three new shelves** under By need: blood cleansers, building the defences,
  kitchen seasonings.
- The tabs, the cards and the click handling are unchanged — a book section
  opens and shuts through the same \`data-h\` toggle a herb card uses.

**The books' own amounts are printed as the book's, and labelled as the book's**
in the tab before the reader reaches them. That is the whole of what makes
printing them honest, and a test holds it. Three things the books name are marked
rather than handed over, on the page and on their own entries: **blue cohosh**
(harmed babies), **lobelia** (measured in drops; has killed people who guessed)
and **chaparral** (liver damage; an FDA warning in the 1990s). The safety tab is
untouched, and the twenty classes carry the line that a class says what a plant
is for, not that it is safe.

Also: **\`index.html\` no longer prints "244 herbs"** — a count that is wrong is
worse than no count — and the row says *herbs, seasonings and cleansers* instead.

**No version bump.** \`sw.js:136\` hands \`/herbs\` and \`/herbs.html\` straight to
the network, so that page is never served from the cache and nothing has to be
invalidated for it. Version stays 5.1.

**How it was changed:** \`tools/apply-herbs-books.js\` — re-runnable, one anchor per
edit, refuses to write unless every anchor appears exactly once, and checks what
landed afterwards.

**Tests:** \`server/test/herbs-books.test.js\`, 7 new — the eighteen named herbs
and their \`bk\` lines; no herb pointing at a shelf that does not exist (the way a
hand-typed list goes silently missing); no empty shelf; the tab rendering with
the book material in it; the figures staying labelled as the book's; search
reaching a herb by its book words; and no count printed in \`index.html\`.
\`npm test\` 474 pass / 0 fail.

**Not verified:** there is no browser in this environment, so the tab was run
through the same stub DOM the other page tests use — the wiring and the markup,
not the pixels, and not on a phone.
`;

/* ── the edits ────────────────────────────────────────────────────────────── */

const EDITS = [
  {
    label: 'the herbs the library did not have',
    file: HERBS,
    marker: '/* ---- the kitchen seasonings, from Nutricide',
    find: '\n];\n\n/* "By need"',
    put: NEW_HERBS + '\n];\n\n/* "By need"',
  },
  {
    label: 'the book sections and the tab that opens them',
    file: HERBS,
    marker: 'var BOOKS = [',
    find: "var KEY='tsid_herb_notes_v1';",
    put: BOOKS_DATA + "\nvar KEY='tsid_herb_notes_v1';",
  },
  {
    label: 'three shelves for the book material',
    file: HERBS,
    marker: "{k:'seasoning', t:'Kitchen seasonings'",
    find: " {k:'eyes', t:'Eyes and tired sight', s:''}\n];",
    put: " {k:'eyes', t:'Eyes and tired sight', s:''},\n"
       + " {k:'blood', t:'Blood cleansers', s:'The book\\u2019s own shelf'},\n"
       + " {k:'immune', t:'Building the defences', s:'The book\\u2019s own shelf'},\n"
       + " {k:'seasoning', t:'Kitchen seasonings', s:'Seasoning as medicine'}\n];",
  },
  {
    label: 'the From the books tab',
    file: HERBS,
    marker: 'data-t="books"',
    find: '    <div class="tab" data-t="safety">',
    put: '    <div class="tab" data-t="books">From the books</div>\n'
       + '    <div class="tab" data-t="safety">',
  },
  {
    label: 'the tab renders',
    file: HERBS,
    marker: "if(tab==='books')",
    find: "  if(tab==='safety'){",
    put: "  if(tab==='books'){\n"
       + "    out='<div class=\"sec\">'+BOOKS.map(bsec).join('')+'</div>';\n"
       + "  }\n\n"
       + "  if(tab==='safety'){",
  },
  {
    label: 'the book line on a herb card',
    file: HERBS,
    marker: "'<div class=\"lbl\">From the books</div>",
    find: "  +(h.c?'<div class=\"lbl\">Caution</div><p>'+esc(h.c)+'</p>':'')\n  +'<div class=\"lbl\">Ask about this one</div>'",
    put: "  +(h.c?'<div class=\"lbl\">Caution</div><p>'+esc(h.c)+'</p>':'')\n"
       + "  +(h.bk?'<div class=\"lbl\">From the books</div><p>'+esc(h.bk)+'</p>':'')\n"
       + "  +'<div class=\"lbl\">Ask about this one</div>'",
  },
  {
    label: 'search sees the book line',
    file: HERBS,
    marker: 'h.n,h.a,h.u,h.d,h.h,h.c,h.bk',
    find: '  var hay=[h.n,h.a,h.u,h.d,h.h,h.c].join(\' \').toLowerCase();',
    put: '  var hay=[h.n,h.a,h.u,h.d,h.h,h.c,h.bk].join(\' \').toLowerCase();',
  },
  {
    label: 'the ask box is handed the book line too',
    file: HERBS,
    marker: 'What the books say about it:',
    find: "  if(h.c) s+='Caution on the entry: '+h.c+'\\n';",
    put: "  if(h.c) s+='Caution on the entry: '+h.c+'\\n';\n"
       + "  if(h.bk) s+='What the books say about it: '+h.bk+'\\n';",
  },
  {
    label: 'the helper is told the tab exists',
    file: HERBS,
    marker: 'the From the books tab',
    find: "'',\n'HOW YOU ANSWER'",
    put: "'This page also carries a From the books tab: how the two books say to prepare a herb, their classifications, their own measurements, their shelves and their lists. Use them. When you give one of their figures, say whose figure it is.',\n'',\n'HOW YOU ANSWER'",
  },
  {
    label: 'the footer',
    file: HERBS,
    marker: 'the shelves and the From the books tab',
    find: 'Kept beside <i>African Holistic Health</i> and <i>Nutricide</i> (Llaila O. Afrika).',
    put: 'Kept beside <i>African Holistic Health</i> and <i>Nutricide</i> (Llaila O. Afrika),<br>'
       + 'both of them in the shelves and the From the books tab.',
  },
  {
    label: 'the herb count in the app, which is now wrong by twenty',
    file: INDEX,
    marker: 'Herbs, seasonings and cleansers',
    find: '244 herbs, and what people have long used them for',
    put: 'Herbs, seasonings and cleansers, and what people have long used them for',
  },
  {
    label: 'the running log entry',
    file: path.join(ROOT, 'HANDOFF.md'),
    marker: '## 24 Sep 2026 \u2014 the two Afrika books go into the herb library',
    append: LOG,
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

const byFile = new Map();
let failed = 0;

for (const e of EDITS) {
  const src = byFile.has(e.file) ? byFile.get(e.file) : fs.readFileSync(e.file, 'utf8');
  const name = path.relative(ROOT, e.file);
  if (src.includes(e.marker)) {
    console.log(`already applied: ${e.label} (${name})`);
    byFile.set(e.file, src);
    continue;
  }
  if (e.append !== undefined) {
    // Newest entry at the foot of the log, which is where the log runs.
    byFile.set(e.file, src.replace(/\s*$/, '') + '\n' + e.append);
    console.log(`applied: ${e.label} (${name})`);
    continue;
  }
  const n = count(src, e.find);
  if (n !== 1) {
    console.error(`STOP: ${e.label} — the anchor appears ${n} times in ${name}, and it has to appear once.`);
    failed = 1;
    break;
  }
  // A function replacement, so nothing in the new text is read as a $ pattern.
  byFile.set(e.file, src.replace(e.find, () => e.put));
  console.log(`applied: ${e.label} (${name})`);
}

if (failed) process.exit(1);

for (const [file, src] of byFile) fs.writeFileSync(file, src);
console.log(`\nwrote ${[...byFile.keys()].map((f) => path.relative(ROOT, f)).join(', ')}`);

/* ── check that what landed is what was meant ─────────────────────────────── */

const herbs = fs.readFileSync(HERBS, 'utf8');
const index = fs.readFileSync(INDEX, 'utf8');

const CHECKS = [
  ['the new herbs are in the library', /n:"Gymnema"/.test(herbs)],
  ['the book sections are in the page', /var BOOKS = \[/.test(herbs)],
  ['the tab is in the tab bar', /data-t="books"/.test(herbs)],
  ['the tab is rendered', /if\(tab==='books'\)/.test(herbs)],
  ['the section renderer is defined', /function bsec\(/.test(herbs)],
  ['a herb card shows the book line', /From the books<\/div><p>'\+esc\(h\.bk\)/.test(herbs)],
  ['search reads the book line', /h\.n,h\.a,h\.u,h\.d,h\.h,h\.c,h\.bk/.test(herbs)],
  ['the book shelves exist', /k:'blood'/.test(herbs) && /k:'immune'/.test(herbs) && /k:'seasoning'/.test(herbs)],
  ['the ask box still carries its safety line', /An infection is a doctor/.test(herbs)],
  ['the ask box still names the crisis line', /988/.test(herbs)],
  ['the ask box still answers in English', /- In English, always\./.test(herbs)],
  ['WHAT STILL HOLDS survives', /WHAT STILL HOLDS/.test(herbs)],
  ['the public caution is still absent from it', !/Never claim a herb works/.test(herbs)],
  ['index.html no longer prints a herb count', !/244 herbs/.test(index)],
  ['index.html still links the library', /location\.href='\/herbs'/.test(index)],
  ['the log has the entry', /## 24 Sep 2026/.test(fs.readFileSync(path.join(ROOT, 'HANDOFF.md'), 'utf8'))],
];

let ok = true;
for (const [what, pass] of CHECKS) {
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${what}`);
  if (!pass) ok = false;
}

const herbsCount = (herbs.match(/\{n:/g) || []).length;
console.log(`\nherb entries: ${herbsCount}`);
console.log(ok ? 'all checks passed' : 'SOMETHING IS WRONG — see the FAIL lines above');
process.exit(ok ? 0 : 1);
