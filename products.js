// ===== ALL PRODUCTS WITH CATEGORIES + ARTICLE CODES =====
// Format: ["Product Name", "ArticleCode"]
// Article codes from RRL Article Master March 26

const PRODUCTS = {
  "Black Tea": [
    ["Agni Leaf 1kg",           "490004178"],
    ["Agni Leaf 500g",          "490005069"],
    ["Agni Leaf 250g",          "490004179"],
    ["Agni Leaf 100g",          "490005068"],
    ["Tata Tea Premium 1kg",    "490004180"],
    ["Tata Tea Premium 600g",   "493634793"],
    ["Tata Tea Premium 250g",   "490002006"],
    ["Gold 1kg",                "490002007"],
    ["Gold 500g",               "490001341"],
    ["Gold 250g",               "490001340"],
    ["Gold 100g",               "490005061"]
  ],
  "Green Tea": [
    ["Tatley GTB GML 25's",                 "490755300"],
    ["Tatley GTB Mango 25's",               "491587091"],
    ["Tatley GTB Lemon and Honey 10's",     "490005234"],
    ["Oi Tulsi Green Tea Classic 100g Tin", "490058564"]
  ],
  "Coffee": [
    ["Tata Coffee Gold 100g",                  "492862026"],
    ["Tata Coffee Gold 50g",                   "492662934"],
    ["Tata Coffee Grand Instant Premium 100g", "493657505"],
    ["Tata Coffee Grand Instant Premium 50g",  "493657503"]
  ],
  "Spices": [
    ["TS Garam Masala 100g",          "491278350"],
    ["TS Kitchen King Masala 100g",   "491278355"],
    ["TS Dal Tadka Masala 100g",      "491278356"],
    ["TS Chicken Masala 100g",        "491278352"],
    ["TS Meat Masala 100g",           "491278351"],
    ["TS Paneer Masala 100g",         "491278354"],
    ["TS Punjabi Chhole Masala 100g", "491278353"]
  ],
  "Salt": [
    ["Tata Salt 1kg",      "490000073"],
    ["Tata Rock Salt 1kg", "491551213"],
    ["Tata Salt Lite 1kg", "490347196"]
  ],
  "Soda": [
    ["I-Sakti Soda 100g", "491188728"]
  ],
  "BFC Kids": [
    ["Soulfull Combo Pack of 6 Rs 99",     "491294940"],
    ["Soulfull Ragi Bite Chocofills 500g", "491706522"],
    ["SF RB No Maida Choco 170g",          "493911224"]
  ],
  "BFC Muesli": [
    ["Soulfull Fruit Nut Muesli 700g", "491551941"],
    ["Soulfull 0% Added Sugar 500g",   "493032001"]
  ],
  "Masala Oats": [
    ["Tata Soulfull Masala Oats+Mast Masala 38g",   "492862487"],
    ["Tata Soulfull Masala Oats+Desi Veggie 38g",   "492862488"],
    ["Tata Soulfull Masala Oats+Mast Masala 500g",  "492862491"],
    ["Tata Soulfull Masala Oats+Tomato Twist 500g", "492862493"],
    ["Tata Soulfull Masala Oats+Desi Veggie 500g",  "492862492"],
    ["SF Masala Oats+Desi Veggie 169g",             "494357200"]
  ],
  "Chings Chutney": [
    ["Chings Schezwan Chutney 590g", "491390742"],
    ["Chings Schezwan Chutney 250g", "490984255"],
    ["Chings Schezwan Chutney 30g",  "491073993"]
  ],
  "Chings Sauce": [
    ["Chings Chilli Sauce 680g",            "490088037"],
    ["Chings Green Chilli Sauce 680g",      "490088036"],
    ["Chings Dark Soy Sauce 210g",          "490000263"],
    ["Chings Green Chilli Sauce 190g",      "490000257"],
    ["Chings Red Chilli Sauce 200g",        "490000261"],
    ["Chings Schezwan Stir Fry Sauce 250g", "490000262"],
    ["Chings Schezwan Ketchup 485g",        "494435134"]
  ],
  "Chings Soups": [
    ["Chings Mix Veg Soup 55g",         "490353732"],
    ["Chings Hot and Sour Soup 55g",    "490353735"],
    ["Chings Manchow Soup 55g",         "490470658"],
    ["Chings Sweet Corn Soup 55g",      "490353733"],
    ["Chings Tomato Soup 55g",          "490470661"],
    ["Chings Inst Hot & Sour Soup 12g", "490993680"],
    ["Chings Manchow Soup 12g",         "490993684"],
    ["Chings Mix Veg Soup 12g",         "490993682"],
    ["Chings Sweet Corn Soup 13g",      "490993681"]
  ],
  "Smith & Jones Paste": [
    ["S&J Ginger Garlic Paste 300g", "494620431"]
  ],
  "Chings Hakka Noodles": [
    ["Chings Chowmein Noodles 140g",  "491984623"],
    ["Chings Veg Hakka Noodles 140g", "490000264"],
    ["Chings Veg Hakka Noodles 560g", "490870794"]
  ],
  "Chings Instant Noodles": [
    ["Chings Hot Garlic Noodles 60g",  "490470662"],
    ["Chings Schezwan Noodles 60g",    "490470663"],
    ["Chings Manchurian Noodles 240g", "490544387"],
    ["Chings Schezwan Noodles 240g",   "490544386"],
    ["Chings Hot Garlic Noodles 240g", "490544388"]
  ],
  "Chinese Masala": [
    ["Chings Hakka Noodles Masala 48x5x20g", "490919295"],
    ["S&J Soya Wadi Nutri Masala 6.5g",      "491439158"],
    ["S&J Pasta Masala 48x14x7g",            "491491701"]
  ]
};
