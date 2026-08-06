/* ==========================================================================
   Composite dishes.

   A dish is a recipe over `foods.js` entries, so its nutrition is derived
   rather than duplicated — one fix to an ingredient corrects every dish that
   uses it. The recipe also gives the photo analyser a ready-made ingredient
   breakdown to show (and to let the user correct item by item).

   parts: [foodId, grams] for one standard portion.
   ========================================================================== */

const DISHES = [];

function d(id, pl, meta, parts) {
  DISHES.push({
    id, name: pl, kind: 'dish',
    en: meta.en,
    cat: meta.cat || 'dish',
    emoji: meta.emoji,
    color: meta.color || [35, .4, .7],
    tex: meta.tex ?? .6,
    slot: meta.slot || null,          // preferred meal slot
    tags: meta.tags || [],
    parts,
    serving: parts.reduce((s, p) => s + p[1], 0),
  });
}

/* ---------------- śniadania ---------------- */

d('oatmeal_banana', 'Owsianka z bananem', { en: 'oatmeal porridge with banana and peanut butter', emoji: '🥣', slot: 'breakfast', color: [38, .35, .78], tex: .7, tags: ['przedtreningowe'] },
  [['oats', 70], ['milk', 250], ['banana', 100], ['peanut_butter', 15]]);

d('oatmeal_berries', 'Owsianka z owocami', { en: 'porridge with berries and yogurt', emoji: '🥣', slot: 'breakfast', color: [340, .3, .7], tex: .65 },
  [['oats', 60], ['yogurt', 150], ['blueberry', 60], ['raspberry', 40], ['honey', 15]]);

d('scrambled_eggs', 'Jajecznica', { en: 'scrambled eggs on a plate', emoji: '🍳', slot: 'breakfast', color: [48, .70, .92], tex: .6 },
  [['egg', 165], ['butter', 10], ['bread_rye', 70]]);

d('omelette_veg', 'Omlet z warzywami', { en: 'vegetable omelette', emoji: '🍳', slot: 'breakfast', color: [45, .55, .85], tex: .5 },
  [['egg', 165], ['pepper_red', 60], ['tomato', 60], ['spinach', 30], ['olive_oil', 8], ['cheese_gouda', 20]]);

d('sandwich_ham_cheese', 'Kanapki z szynką i serem', { en: 'ham and cheese sandwich', emoji: '🥪', slot: 'breakfast', color: [40, .35, .78], tex: .55 },
  [['bread_rye', 70], ['butter', 10], ['ham', 40], ['cheese_gouda', 30], ['tomato', 50], ['lettuce', 15]]);

d('avocado_toast', 'Tost z awokado i jajkiem', { en: 'avocado toast with poached egg', emoji: '🥑', slot: 'breakfast', color: [70, .45, .65], tex: .55 },
  [['bread_wholegrain', 80], ['avocado', 80], ['egg', 55], ['olive_oil', 5]]);

d('cottage_fruit', 'Twaróg z owocami', { en: 'cottage cheese with fruit', emoji: '🧀', slot: 'breakfast', color: [45, .15, .92], tex: .55, tags: ['białko'] },
  [['cottage_cheese', 150], ['strawberry', 80], ['honey', 10], ['flaxseed', 10]]);

d('yogurt_granola', 'Jogurt z granolą', { en: 'yogurt bowl with granola', emoji: '🥣', slot: 'breakfast', color: [38, .35, .82], tex: .7 },
  [['yogurt', 180], ['granola', 50], ['banana', 80]]);

d('cereal_milk', 'Płatki z mlekiem', { en: 'breakfast cereal with milk', emoji: '🥣', slot: 'breakfast', color: [40, .40, .80], tex: .65 },
  [['granola', 60], ['milk', 250]]);

d('skyr_shake', 'Shake proteinowy z bananem', { en: 'protein shake smoothie', emoji: '🥤', slot: 'snack', color: [35, .25, .85], tex: .15, tags: ['potreningowe'] },
  [['whey', 30], ['milk', 300], ['banana', 100], ['peanut_butter', 15]]);

/* ---------------- obiady ---------------- */

d('chicken_rice_veg', 'Kurczak z ryżem i warzywami', { en: 'grilled chicken with rice and vegetables', emoji: '🍛', slot: 'lunch', color: [40, .35, .75], tex: .6, tags: ['klasyk'] },
  [['chicken_breast', 150], ['rice_white', 200], ['broccoli', 120], ['olive_oil', 10]]);

d('chicken_pasta', 'Makaron z kurczakiem', { en: 'pasta with chicken and tomato sauce', emoji: '🍝', slot: 'lunch', color: [15, .55, .70], tex: .6 },
  [['pasta', 220], ['chicken_breast', 130], ['tomato', 120], ['olive_oil', 10], ['cheese_gouda', 20]]);

d('spaghetti_bolognese', 'Spaghetti bolognese', { en: 'spaghetti bolognese', emoji: '🍝', slot: 'lunch', color: [10, .60, .60], tex: .65 },
  [['pasta', 220], ['ground_beef', 120], ['tomato', 150], ['onion', 40], ['olive_oil', 10], ['cheese_gouda', 20]]);

d('carbonara', 'Spaghetti carbonara', { en: 'spaghetti carbonara', emoji: '🍝', slot: 'lunch', color: [45, .40, .85], tex: .55 },
  [['pasta', 220], ['ham', 70], ['egg', 55], ['cheese_gouda', 40], ['cream', 40]]);

d('pork_cutlet_dinner', 'Schabowy z ziemniakami', { en: 'breaded pork cutlet with potatoes', emoji: '🍖', slot: 'lunch', color: [32, .55, .70], tex: .7, tags: ['klasyk'] },
  [['pork_cutlet', 160], ['potato', 250], ['cabbage', 100], ['butter', 10]]);

d('chicken_potatoes', 'Kurczak z ziemniakami', { en: 'roast chicken with potatoes', emoji: '🍗', slot: 'lunch', color: [38, .45, .78], tex: .6 },
  [['chicken_thigh', 160], ['potato', 250], ['green_beans', 120], ['butter', 10]]);

d('salmon_potatoes', 'Łosoś z ziemniakami', { en: 'baked salmon with potatoes and salad', emoji: '🐟', slot: 'lunch', color: [20, .50, .75], tex: .5, tags: ['omega3'] },
  [['salmon', 150], ['potato', 220], ['spinach', 80], ['olive_oil', 10]]);

d('fish_fries', 'Ryba z frytkami', { en: 'fried fish with french fries', emoji: '🍟', slot: 'lunch', color: [40, .60, .80], tex: .7 },
  [['cod', 150], ['fries', 180], ['mayo', 20]]);

d('beef_buckwheat', 'Gulasz z kaszą gryczaną', { en: 'beef stew with buckwheat', emoji: '🍲', slot: 'lunch', color: [22, .55, .45], tex: .7 },
  [['beef_lean', 150], ['buckwheat', 200], ['carrot', 60], ['onion', 40], ['rapeseed_oil', 10]]);

d('turkey_millet', 'Indyk z kaszą jaglaną', { en: 'turkey with millet and vegetables', emoji: '🍲', slot: 'lunch', color: [45, .45, .80], tex: .65 },
  [['turkey_breast', 150], ['millet', 200], ['zucchini', 100], ['olive_oil', 10]]);

d('lentil_stew', 'Gulasz z soczewicy', { en: 'lentil stew with vegetables', emoji: '🍲', slot: 'lunch', color: [25, .50, .50], tex: .7, tags: ['wege'] },
  [['lentils', 200], ['carrot', 70], ['tomato', 100], ['onion', 40], ['olive_oil', 10]]);

d('tofu_stirfry', 'Tofu z warzywami i ryżem', { en: 'tofu stir fry with rice', emoji: '🥡', slot: 'lunch', color: [50, .40, .70], tex: .6, tags: ['wege'] },
  [['tofu', 150], ['rice_white', 200], ['broccoli', 100], ['pepper_red', 70], ['rapeseed_oil', 10]]);

d('risotto', 'Risotto z pieczarkami', { en: 'mushroom risotto', emoji: '🍚', slot: 'lunch', color: [42, .30, .80], tex: .5 },
  [['rice_white', 220], ['mushroom', 120], ['cream', 40], ['cheese_gouda', 25], ['butter', 10]]);

d('pierogi_ruskie', 'Pierogi ruskie', { en: 'polish dumplings pierogi', emoji: '🥟', slot: 'lunch', color: [45, .25, .88], tex: .45, tags: ['klasyk'] },
  [['potato', 160], ['cottage_cheese', 60], ['bread_wheat', 90], ['onion', 30], ['butter', 15]]);

d('lasagne', 'Lasagne', { en: 'lasagne', emoji: '🍽️', slot: 'lunch', color: [12, .55, .60], tex: .6 },
  [['pasta', 150], ['ground_beef', 120], ['tomato', 120], ['mozzarella', 60], ['cream', 40]]);

d('kotlet_mielony', 'Kotlet mielony z ziemniakami', { en: 'meat patty with potatoes', emoji: '🍖', slot: 'lunch', color: [28, .55, .55], tex: .7 },
  [['ground_beef', 140], ['potato', 250], ['sauerkraut', 100], ['rapeseed_oil', 10]]);

d('zapiekanka', 'Zapiekanka', { en: 'baked cheese baguette', emoji: '🥖', slot: 'snack', color: [35, .55, .75], tex: .6 },
  [['roll', 120], ['mushroom', 60], ['cheese_gouda', 50], ['ketchup', 25]]);

d('tortilla_chicken', 'Tortilla z kurczakiem', { en: 'chicken wrap tortilla', emoji: '🌯', slot: 'lunch', color: [40, .35, .80], tex: .5 },
  [['tortilla', 62], ['chicken_breast', 120], ['lettuce', 30], ['tomato', 50], ['mayo', 15], ['cheese_gouda', 20]]);

d('burger', 'Burger wołowy', { en: 'beef burger with bun', emoji: '🍔', slot: 'lunch', color: [28, .55, .60], tex: .65 },
  [['roll', 90], ['ground_beef', 130], ['cheese_gouda', 25], ['lettuce', 20], ['tomato', 30], ['ketchup', 20], ['mayo', 15]]);

d('pizza_margherita', 'Pizza margherita', { en: 'margherita pizza', emoji: '🍕', slot: 'dinner', color: [25, .60, .75], tex: .55 },
  [['bread_wheat', 200], ['mozzarella', 100], ['tomato', 120], ['olive_oil', 15]]);

d('pizza_pepperoni', 'Pizza z salami', { en: 'pepperoni pizza slice', emoji: '🍕', slot: 'dinner', color: [15, .65, .70], tex: .6 },
  [['bread_wheat', 200], ['mozzarella', 100], ['tomato', 110], ['kabanos', 60], ['olive_oil', 12]]);

d('kebab', 'Kebab', { en: 'doner kebab', emoji: '🌯', slot: 'dinner', color: [30, .55, .65], tex: .6 },
  [['tortilla', 90], ['chicken_thigh', 150], ['cabbage', 60], ['tomato', 50], ['mayo', 25], ['ketchup', 15]]);

d('sushi_set', 'Zestaw sushi', { en: 'sushi rolls plate', emoji: '🍣', slot: 'dinner', color: [15, .35, .85], tex: .4 },
  [['rice_white', 220], ['salmon', 90], ['avocado', 40], ['cucumber', 40]]);

/* ---------------- zupy ---------------- */

d('rosol', 'Rosół', { en: 'chicken noodle soup', emoji: '🍜', slot: 'lunch', color: [45, .55, .80], tex: .3, tags: ['klasyk'] },
  [['chicken_breast', 60], ['pasta', 80], ['carrot', 50], ['parsley', 5], ['onion', 20]]);

d('tomato_soup', 'Zupa pomidorowa', { en: 'tomato soup with rice', emoji: '🍲', slot: 'lunch', color: [8, .70, .70], tex: .25 },
  [['tomato', 200], ['rice_white', 100], ['cream', 30], ['carrot', 30]]);

d('barszcz', 'Barszcz czerwony', { en: 'beetroot soup borscht', emoji: '🍲', slot: 'lunch', color: [345, .75, .40], tex: .2 },
  [['beetroot', 200], ['potato', 60], ['carrot', 40], ['cream', 20]]);

d('vegetable_soup', 'Zupa warzywna', { en: 'vegetable soup', emoji: '🍲', slot: 'lunch', color: [45, .50, .65], tex: .35 },
  [['carrot', 70], ['potato', 90], ['peas', 60], ['green_beans', 60], ['parsley', 5]]);

/* ---------------- sałatki i lekkie ---------------- */

d('greek_salad', 'Sałatka grecka', { en: 'greek salad', emoji: '🥗', slot: 'dinner', color: [90, .45, .65], tex: .55, tags: ['lekkie'] },
  [['tomato', 120], ['cucumber', 100], ['pepper_red', 60], ['cheese_gouda', 60], ['onion', 30], ['olive_oil', 15]]);

d('tuna_salad', 'Sałatka z tuńczykiem', { en: 'tuna salad bowl', emoji: '🥗', slot: 'dinner', color: [70, .40, .70], tex: .6, tags: ['białko'] },
  [['tuna_can', 120], ['lettuce', 60], ['tomato', 80], ['corn', 60], ['egg', 55], ['olive_oil', 10]]);

d('chicken_salad', 'Sałatka z kurczakiem', { en: 'grilled chicken salad', emoji: '🥗', slot: 'dinner', color: [80, .40, .70], tex: .6 },
  [['chicken_breast', 130], ['lettuce', 70], ['tomato', 80], ['cucumber', 60], ['olive_oil', 12]]);

d('caprese', 'Caprese', { en: 'caprese salad with mozzarella', emoji: '🍅', slot: 'dinner', color: [10, .55, .80], tex: .4 },
  [['tomato', 150], ['mozzarella', 80], ['olive_oil', 12]]);

d('hummus_veg', 'Hummus z warzywami', { en: 'hummus with vegetable sticks', emoji: '🥕', slot: 'snack', color: [42, .45, .78], tex: .5, tags: ['wege'] },
  [['hummus', 80], ['carrot', 80], ['pepper_red', 60], ['bread_wholegrain', 40]]);

/* ---------------- przekąski ---------------- */

d('nuts_mix', 'Mieszanka orzechów', { en: 'mixed nuts', emoji: '🌰', slot: 'snack', color: [32, .45, .60], tex: .8 },
  [['almonds', 15], ['walnuts', 15], ['cashews', 10], ['raisins', 10]]);

d('rice_cakes_pb', 'Wafle z masłem orzechowym', { en: 'rice cakes with peanut butter', emoji: '🍘', slot: 'snack', color: [38, .40, .78], tex: .7 },
  [['rice_cake', 20], ['peanut_butter', 25], ['banana', 60]]);

d('fruit_bowl', 'Miska owoców', { en: 'bowl of mixed fruit', emoji: '🍓', slot: 'snack', color: [10, .55, .85], tex: .4 },
  [['banana', 100], ['apple', 100], ['orange', 100], ['blueberry', 50]]);

d('post_workout_snack', 'Przekąska potreningowa', { en: 'post workout snack with banana and shake', emoji: '💪', slot: 'snack', color: [45, .45, .85], tex: .4, tags: ['potreningowe'] },
  [['whey', 30], ['banana', 120], ['dates', 30]]);

export default DISHES;
export const DISH_INDEX = new Map(DISHES.map((x) => [x.id, x]));
