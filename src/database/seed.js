const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const mysql = require("mysql2/promise");
const env = require("../config/env");
const { calculateBmi, getBmiCategory } = require("../utils/nutrition");

const demoUserId = "11111111-1111-4111-8111-111111111111";

const foods = [
  ["Nasi Putih", "White Rice", "lunch", "nasi", "centong", 100, 175, 3.3, 38.9, 0.3, 0.3, 0, 5, true, ["nasi", "karbohidrat", "pokok"]],
  ["Nasi Merah", "Brown Rice", "lunch", "nasi", "centong", 100, 165, 3.5, 34, 1.8, 1.8, 0.7, 5, true, ["nasi", "sehat", "serat"]],
  ["Nasi Goreng", "Fried Rice", "breakfast", "nasi", "porsi", 200, 340, 8, 56, 10, 1.5, 2, 650, true, ["nasi", "goreng", "populer"]],
  ["Bubur Ayam", "Chicken Porridge", "breakfast", "bubur", "mangkuk", 300, 250, 12, 35, 7, 0.5, 1, 580, true, ["bubur", "ayam", "sarapan"]],
  ["Roti Tawar", "White Bread", "breakfast", "roti", "lembar", 30, 77, 2.5, 14.8, 0.9, 0.4, 1.2, 135, false, ["roti", "sarapan"]],
  ["Roti Gandum", "Whole Wheat Bread", "breakfast", "roti", "lembar", 30, 70, 3, 12, 1, 2, 0.8, 120, false, ["roti", "gandum", "sehat"]],
  ["Oatmeal", "Oatmeal", "breakfast", "sereal", "porsi", 80, 290, 10.7, 51, 5, 8, 0.5, 5, false, ["oat", "sarapan", "serat"]],
  ["Dada Ayam Panggang", "Grilled Chicken Breast", "lunch", "lauk", "potong", 100, 165, 31, 0, 3.6, 0, 0, 74, true, ["ayam", "protein", "diet"]],
  ["Telur Rebus", "Boiled Egg", "breakfast", "lauk", "butir", 60, 90, 7.9, 0.6, 6.3, 0, 0.6, 71, false, ["telur", "protein"]],
  ["Telur Dadar", "Omelette", "breakfast", "lauk", "porsi", 120, 185, 12, 2, 14, 0, 1, 350, true, ["telur", "dadar"]],
  ["Ikan Salmon", "Salmon", "dinner", "lauk", "fillet", 120, 235, 25, 0, 15, 0, 0, 59, false, ["ikan", "omega3"]],
  ["Ikan Tuna Kaleng", "Canned Tuna", "lunch", "lauk", "kaleng kecil", 80, 100, 22, 0, 1, 0, 0, 290, false, ["tuna", "protein"]],
  ["Tempe Goreng", "Fried Tempeh", "lunch", "lauk", "potong", 50, 108, 7.5, 8, 5.5, 1.8, 0, 5, true, ["tempe", "protein nabati"]],
  ["Tahu Goreng", "Fried Tofu", "lunch", "lauk", "potong", 80, 110, 7.2, 4.5, 7, 0.5, 0.5, 10, true, ["tahu", "vegan"]],
  ["Daging Sapi Rendang", "Beef Rendang", "dinner", "lauk", "porsi", 100, 295, 25, 6, 18, 1, 2, 450, true, ["rendang", "sapi"]],
  ["Udang Rebus", "Boiled Shrimp", "dinner", "lauk", "porsi", 100, 99, 24, 0.2, 0.3, 0, 0, 111, false, ["udang", "protein"]],
  ["Bayam Rebus", "Boiled Spinach", "lunch", "sayur", "porsi", 100, 23, 2.9, 3.6, 0.4, 2.2, 0.4, 70, true, ["sayur", "zat besi"]],
  ["Brokoli Kukus", "Steamed Broccoli", "lunch", "sayur", "porsi", 100, 34, 2.8, 6.6, 0.4, 2.6, 1.7, 33, false, ["brokoli", "vitamin c"]],
  ["Kangkung Tumis", "Stir-fried Water Spinach", "lunch", "sayur", "porsi", 100, 25, 3, 3.1, 0.3, 2.1, 0.9, 113, true, ["kangkung", "sayur"]],
  ["Wortel Rebus", "Boiled Carrot", "lunch", "sayur", "porsi", 80, 35, 0.8, 8.2, 0.2, 2.3, 4.7, 58, false, ["wortel", "vitamin a"]],
  ["Timun", "Cucumber", "snack", "sayur", "buah", 100, 15, 0.7, 3.6, 0.1, 0.5, 1.7, 2, false, ["timun", "hidrasi"]],
  ["Tomat", "Tomato", "snack", "sayur", "buah", 100, 18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, false, ["tomat", "antioksidan"]],
  ["Pisang", "Banana", "snack", "buah", "buah", 120, 107, 1.3, 27.2, 0.4, 3.1, 14.4, 1, true, ["pisang", "energi"]],
  ["Apel", "Apple", "snack", "buah", "buah", 182, 95, 0.5, 25.1, 0.3, 4.4, 18.9, 2, false, ["apel", "serat"]],
  ["Jeruk", "Orange", "snack", "buah", "buah", 130, 62, 1.2, 15.4, 0.2, 3.1, 12.2, 0, true, ["jeruk", "vitamin c"]],
  ["Mangga", "Mango", "snack", "buah", "buah", 200, 135, 1.1, 35.2, 0.6, 3.7, 30.6, 3, true, ["mangga", "tropis"]],
  ["Pepaya", "Papaya", "snack", "buah", "potong", 150, 59, 0.9, 14.9, 0.4, 2.3, 9, 11, true, ["pepaya", "pencernaan"]],
  ["Alpukat", "Avocado", "snack", "buah", "buah", 200, 320, 4, 17, 29.5, 13.5, 1.3, 14, false, ["alpukat", "lemak sehat"]],
  ["Soto Ayam", "Chicken Soto", "lunch", "sup", "mangkuk", 350, 285, 18, 25, 12, 2, 3, 650, true, ["soto", "ayam"]],
  ["Gado-Gado", "Gado-gado", "lunch", "salad", "porsi", 250, 320, 12.5, 30, 17.5, 5.5, 5, 480, true, ["gado-gado", "sayur"]],
  ["Pecel", "Pecel", "lunch", "salad", "porsi", 250, 280, 10, 32, 13, 5, 4, 420, true, ["pecel", "jawa"]],
  ["Bakso", "Meatball Soup", "lunch", "sup", "mangkuk", 300, 310, 18, 28, 14, 1, 2, 750, true, ["bakso", "populer"]],
  ["Mie Goreng", "Fried Noodles", "lunch", "mie", "porsi", 200, 380, 10, 55, 14, 2, 5, 850, true, ["mie", "goreng"]],
  ["Ketoprak", "Ketoprak", "lunch", "salad", "porsi", 300, 330, 14, 42, 12, 4.5, 6, 510, true, ["ketoprak", "jakarta"]],
  ["Siomay", "Siomay", "snack", "jajanan", "porsi", 200, 280, 15, 30, 10, 2, 3, 520, true, ["siomay", "bandung"]],
  ["Lontong Sayur", "Vegetable Lontong", "breakfast", "nasi", "porsi", 350, 320, 9, 52, 8, 4, 3.5, 580, true, ["lontong", "sarapan"]],
  ["Air Putih", "Water", "drink", "air", "gelas", 250, 0, 0, 0, 0, 0, 0, 0, false, ["air", "hidrasi"]],
  ["Susu Skim", "Skim Milk", "breakfast", "minuman", "gelas", 250, 83, 8.5, 12, 0.2, 0, 12, 130, false, ["susu", "protein"]],
  ["Jus Jeruk Segar", "Fresh Orange Juice", "breakfast", "minuman", "gelas", 250, 112, 1.7, 26, 0.5, 0.5, 20.8, 2, false, ["jus", "vitamin c"]],
  ["Teh Tanpa Gula", "Unsweetened Tea", "drink", "minuman", "gelas", 250, 2, 0, 0.5, 0, 0, 0, 7, true, ["teh", "rendah kalori"]],
  ["Kopi Hitam", "Black Coffee", "breakfast", "minuman", "cangkir", 200, 5, 0.3, 0.7, 0, 0, 0, 5, true, ["kopi", "energi"]],
  ["Smoothie Pisang", "Banana Smoothie", "breakfast", "minuman", "gelas", 300, 195, 5, 42, 2.5, 3.5, 22, 55, false, ["smoothie", "pisang"]],
  ["Yakult", "Yakult", "snack", "minuman", "botol", 65, 50, 0.8, 11.6, 0, 0, 10.5, 16, false, ["probiotik"]],
  ["Kacang Almond", "Almond", "snack", "kacang", "genggam", 30, 173, 6, 6.1, 14.9, 3.5, 1.4, 0, false, ["kacang", "lemak sehat"]],
  ["Kacang Edamame", "Edamame", "snack", "kacang", "porsi", 100, 121, 11.9, 8.9, 5.2, 5.2, 2.2, 6, false, ["edamame", "protein nabati"]],
  ["Granola Bar", "Granola Bar", "snack", "sereal", "buah", 40, 180, 3.5, 29, 7, 1.5, 12, 65, false, ["granola", "energi"]],
  ["Greek Yogurt", "Greek Yogurt", "snack", "dairy", "cup", 150, 100, 17, 6, 0.7, 0, 5, 65, false, ["yogurt", "protein"]],
  ["Biskuit Gandum", "Whole Grain Crackers", "snack", "snack", "bungkus", 30, 120, 3, 22, 2.5, 2, 2, 150, false, ["biskuit", "gandum"]]
];

const detailedFoodIngredients = {
  "Nasi Goreng": [["Nasi putih matang", 180, "g", "Pantry"], ["Telur ayam", 1, "butir", "Protein"], ["Minyak goreng", 1, "sdm", "Pantry"], ["Bawang merah", 2, "siung", "Produce"], ["Bawang putih", 1, "siung", "Produce"], ["Kecap manis", 1, "sdm", "Condiments"]],
  "Bubur Ayam": [["Beras", 55, "g", "Pantry"], ["Dada ayam suwir", 45, "g", "Protein"], ["Kaldu ayam", 250, "ml", "Pantry"], ["Daun bawang", 10, "g", "Produce"], ["Bawang goreng", 5, "g", "Condiments"]],
  "Telur Dadar": [["Telur ayam", 2, "butir", "Protein"], ["Minyak goreng", 1, "sdm", "Pantry"], ["Daun bawang", 10, "g", "Produce"]],
  "Daging Sapi Rendang": [["Daging sapi", 100, "g", "Protein"], ["Santan", 80, "ml", "Dairy & Coconut"], ["Cabai merah", 20, "g", "Produce"], ["Bawang merah", 25, "g", "Produce"], ["Bawang putih", 10, "g", "Produce"], ["Lengkuas", 8, "g", "Spices"], ["Serai", 1, "batang", "Spices"]],
  "Soto Ayam": [["Dada ayam", 70, "g", "Protein"], ["Bihun", 40, "g", "Pantry"], ["Kol", 40, "g", "Produce"], ["Tauge", 30, "g", "Produce"], ["Kaldu ayam", 300, "ml", "Pantry"], ["Bumbu soto", 1, "porsi", "Spices"]],
  "Gado-Gado": [["Kangkung", 45, "g", "Produce"], ["Tauge", 35, "g", "Produce"], ["Tahu", 50, "g", "Protein"], ["Tempe", 50, "g", "Protein"], ["Telur rebus", 1, "butir", "Protein"], ["Saus kacang", 60, "g", "Condiments"], ["Lontong", 80, "g", "Pantry"]],
  "Pecel": [["Bayam", 50, "g", "Produce"], ["Kacang panjang", 45, "g", "Produce"], ["Tauge", 35, "g", "Produce"], ["Kol", 35, "g", "Produce"], ["Sambal kacang", 55, "g", "Condiments"], ["Peyek", 15, "g", "Pantry"]],
  "Bakso": [["Bakso sapi", 5, "pcs", "Protein"], ["Kuah kaldu sapi", 300, "ml", "Pantry"], ["Mie kuning", 40, "g", "Pantry"], ["Bihun", 25, "g", "Pantry"], ["Sawi hijau", 40, "g", "Produce"], ["Seledri", 5, "g", "Produce"]],
  "Mie Goreng": [["Mie telur", 120, "g", "Pantry"], ["Telur ayam", 1, "butir", "Protein"], ["Kol", 40, "g", "Produce"], ["Sawi hijau", 35, "g", "Produce"], ["Kecap manis", 1, "sdm", "Condiments"], ["Minyak goreng", 1, "sdm", "Pantry"]],
  "Ketoprak": [["Lontong", 120, "g", "Pantry"], ["Tahu", 80, "g", "Protein"], ["Tauge", 50, "g", "Produce"], ["Bihun", 45, "g", "Pantry"], ["Saus kacang", 65, "g", "Condiments"]],
  "Siomay": [["Siomay ikan", 4, "pcs", "Protein"], ["Kentang", 80, "g", "Produce"], ["Kol", 50, "g", "Produce"], ["Tahu", 50, "g", "Protein"], ["Saus kacang", 45, "g", "Condiments"]],
  "Lontong Sayur": [["Lontong", 150, "g", "Pantry"], ["Labu siam", 80, "g", "Produce"], ["Santan", 100, "ml", "Dairy & Coconut"], ["Telur rebus", 1, "butir", "Protein"], ["Bumbu kuning", 1, "porsi", "Spices"]],
  "Smoothie Pisang": [["Pisang", 1, "buah", "Produce"], ["Susu skim", 200, "ml", "Dairy & Coconut"], ["Oatmeal", 25, "g", "Pantry"], ["Es batu", 1, "gelas", "Pantry"]],
  "Jus Jeruk Segar": [["Jeruk segar", 3, "buah", "Produce"], ["Air", 50, "ml", "Pantry"]],
  "Oatmeal": [["Oat", 80, "g", "Pantry"], ["Air atau susu", 200, "ml", "Dairy & Coconut"]],
  "Greek Yogurt": [["Greek yogurt", 150, "g", "Dairy & Coconut"]]
};

const achievements = [
  ["FIRST_LOG", "Langkah Pertama", "Log makanan pertama kali", "target", "milestone", 10, "total_food_logs", 1],
  ["STREAK_3", "Konsisten 3 Hari", "Log makanan 3 hari berturut-turut", "flame", "consistency", 20, "streak_days", 3],
  ["STREAK_7", "Seminggu Penuh", "Log makanan 7 hari berturut-turut", "dumbbell", "consistency", 50, "streak_days", 7],
  ["STREAK_30", "Warrior Sehat", "Log makanan 30 hari berturut-turut", "trophy", "consistency", 200, "streak_days", 30],
  ["WATER_WEEK", "Terhidrasi", "Minum 8 gelas per hari selama 7 hari", "droplet", "hydration", 30, "water_streak_days", 7],
  ["WEIGHT_LOST_1", "Turun 1 KG", "Berhasil turun 1 kg dari berat awal", "arrow-down", "weight", 50, "weight_lost_kg", 1],
  ["WEIGHT_LOST_5", "Turun 5 KG", "Berhasil turun 5 kg dari berat awal", "party", "weight", 200, "weight_lost_kg", 5],
  ["PROTEIN_WEEK", "Protein Champion", "Capai target protein 7 hari berturut", "beef", "nutrition", 40, "protein_streak_days", 7],
  ["BALANCED_DAY", "Nutrisi Seimbang", "Semua makro dalam target dalam 1 hari", "scale", "nutrition", 30, "balanced_days", 1],
  ["FIRST_MEAL_PLAN", "Perencana Handal", "Buat meal plan pertama kali", "calendar", "milestone", 15, "total_meal_plans", 1],
  ["TARGET_REACHED", "Target Tercapai", "Mencapai berat badan target", "medal", "milestone", 500, "target_reached", 1],
  ["CHALLENGE_FINISHER", "Challenge Finisher", "Selesaikan satu health challenge komunitas.", "trophy", "milestone", 100, "challenge_completed", 1]
];

const communityChallenges = [
  [
    "Mediterranean Meal Prep",
    "Complete four colorful lunches this week with balanced protein, fiber, and healthy fats.",
    "HOT",
    "orange",
    "2.4K",
    "/assets/remote/remote-001-100fa2b2f7.jpg"
  ],
  [
    "Hydration Hero",
    "Hit your water target for seven straight days and keep your energy steady.",
    "HIGH IMPACT",
    "purple",
    "1.8K",
    "/assets/remote/remote-002-0eb63fe01f.jpg"
  ]
];

const communityChallengeTasks = {
  "Mediterranean Meal Prep": [
    [1, "Log one balanced meal", "Catat minimal satu makanan yang mendukung challenge hari ini.", "food_log", 1, "meal", 15, 1],
    [1, "Plan a colorful lunch", "Siapkan atau rencanakan lunch dengan protein, fiber, dan healthy fat.", "manual", 1, "check", 15, 2],
    [2, "Share a meal prep update", "Bagikan update challenge agar buddy komunitas bisa memberi cheers.", "challenge_post", 1, "post", 20, 3]
  ],
  "Hydration Hero": [
    [1, "Drink 1.5L water", "Catat asupan air minimal 1.500 ml hari ini.", "water_intake", 1500, "ml", 15, 1],
    [1, "Hydration reflection", "Check-in singkat: energi, fokus, dan rasa lapar setelah hidrasi cukup.", "manual", 1, "check", 10, 2],
    [2, "Share hydration win", "Posting update challenge setelah target hidrasi tercapai.", "challenge_post", 1, "post", 20, 3]
  ]
};

const communityLeaderboard = [
  ["Elena", 31, "/assets/remote/remote-103-8125076983.jpg", true],
  ["Marcus", 24, "/assets/remote/remote-104-f61b0c45bd.jpg", false],
  ["Nadia", 19, "/assets/remote/remote-105-a1d5c3dbf1.jpg", false]
];

const communityBuddies = [
  ["Maya Chen", "Morning runner - macro focused", "/assets/remote/remote-106-452cb5ee02.jpg", 94, "Protein goals"],
  ["Ardi Putra", "Meal prep beginner", "/assets/remote/remote-107-ba28e4d23e.jpg", 88, "Weight loss"],
  ["Sofia Lee", "Plant-forward cook", "/assets/remote/remote-108-362b1244b4.jpg", 82, "Fiber target"]
];

const communityPosts = [
  [
    "Rina Mahendra",
    "Balanced Plate Crew",
    "/assets/remote/remote-109-1523cefa16.jpg",
    "Swapped fried snacks for Greek yogurt and fruit this week. Energy after lunch feels so much better.",
    "/assets/remote/remote-110-a772a15655.jpg",
    128,
    18
  ]
];

const helpCategories = [
  ["Akun", "Kelola profil, password, dan preferensi login NutriTrack.", "User", "bg-success-light text-primary"],
  ["Nutrisi", "Pelajari pelacakan kalori, makro, dan database makanan.", "Utensils", "bg-red-50 text-error-red"],
  ["Perangkat", "Hubungkan wearable, sinkronisasi data, dan izin aplikasi.", "Settings", "bg-blue-50 text-info-blue"],
  ["Pembayaran", "Atur paket, invoice, dan riwayat tagihan.", "CreditCard", "bg-orange-50 text-energy-orange"]
];

const helpTutorials = [
  [
    "Memulai meal plan pertama",
    "Buat jadwal makan mingguan dari target kalori dan preferensi dapur.",
    "4 min",
    "/assets/remote/remote-029-69c4ae2e87.jpg"
  ],
  [
    "Cara membaca progress makro",
    "Pahami protein, karbohidrat, lemak, dan fiber dengan cepat.",
    "3 min",
    "/assets/remote/remote-110-a772a15655.jpg"
  ]
];

const helpFaqs = [
  ["Bagaimana cara mengganti target kalori?", "Buka Settings, pilih preferensi nutrisi, lalu simpan target kalori harian baru.", "nutrition"],
  ["Apakah data saya tersinkron otomatis?", "Data tersimpan ke akun Anda saat backend aktif dan koneksi internet tersedia.", "account"],
  ["Bagaimana mengelola paket Pro?", "Buka Settings lalu gunakan bagian NutriTrack Pro untuk melihat pengelolaan paket dan riwayat tagihan.", "billing"]
];

async function upsertFood(connection, food) {
  const [existing] = await connection.execute("SELECT id FROM food_database WHERE name = ? AND is_custom = FALSE LIMIT 1", [food[0]]);
  const id = existing[0]?.id || randomUUID();

  await connection.execute(
    `INSERT INTO food_database
     (id, name, name_en, category, sub_category, serving_unit, serving_size_g, calories, protein_g,
      carbohydrates_g, fat_g, fiber_g, sugar_g, sodium_mg, is_indonesian, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      name_en = VALUES(name_en),
      category = VALUES(category),
      sub_category = VALUES(sub_category),
      serving_unit = VALUES(serving_unit),
      serving_size_g = VALUES(serving_size_g),
      calories = VALUES(calories),
      protein_g = VALUES(protein_g),
      carbohydrates_g = VALUES(carbohydrates_g),
      fat_g = VALUES(fat_g),
      fiber_g = VALUES(fiber_g),
      sugar_g = VALUES(sugar_g),
      sodium_mg = VALUES(sodium_mg),
      is_indonesian = VALUES(is_indonesian),
      tags = VALUES(tags)`,
    [id, ...food.slice(0, 14), JSON.stringify(food[14])]
  );

  return id;
}

async function insertIfMissing(connection, table, lookup, insertSql, values) {
  const where = Object.keys(lookup).map((key) => `${key} = ?`).join(" AND ");
  const [rows] = await connection.execute(`SELECT id FROM ${table} WHERE ${where} LIMIT 1`, Object.values(lookup));
  if (!rows.length) {
    await connection.execute(insertSql, values);
  }
}

async function upsertFoodIngredients(connection, foodId, foodName, fallbackUnit, fallbackCategory) {
  const ingredients = detailedFoodIngredients[foodName] || [[foodName, 1, fallbackUnit || "porsi", fallbackCategory || "Groceries"]];
  for (const [index, ingredient] of ingredients.entries()) {
    await connection.execute(
      `INSERT INTO food_ingredients
       (id, food_id, ingredient_name, quantity_per_serving, unit, category, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         quantity_per_serving = VALUES(quantity_per_serving),
         category = VALUES(category),
         sort_order = VALUES(sort_order)`,
      [randomUUID(), foodId, ingredient[0], ingredient[1], ingredient[2], ingredient[3], index + 1]
    );
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database
  });

  const passwordHash = await bcrypt.hash("nutritrack123", 12);

  await connection.beginTransaction();
  try {
    await connection.execute(
      `INSERT INTO users (id, email, password_hash, full_name, avatar_url, email_verified_at)
       VALUES (?, 'alex@nutritrack.app', ?, 'Alex Carter', '/assets/remote/remote-112-d263952e2e.jpg', NOW())
       ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        full_name = VALUES(full_name),
        avatar_url = VALUES(avatar_url)`,
      [demoUserId, passwordHash]
    );

    await connection.execute(
      `INSERT INTO profiles
       (id, full_name, avatar_url, date_of_birth, gender, height_cm, current_weight_kg, target_weight_kg,
        activity_level, goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g,
        target_fiber_g, target_water_ml, diet_type, allergies, cuisine_preferences, weekly_weight_goal_kg,
        target_date, bmr, tdee, onboarding_completed, streak_days, total_points)
       VALUES
       (?, 'Alex Carter', '/assets/remote/remote-112-d263952e2e.jpg',
        '1995-05-15', 'male', 178, 78.5, 74, 'moderately_active', 'lose_weight', 2100, 180, 300, 75,
        35, 2500, 'omnivore', ?, ?, -0.5, '2026-09-30', 1780, 2450, TRUE, 7, 320)
       ON DUPLICATE KEY UPDATE
        current_weight_kg = VALUES(current_weight_kg),
        target_weight_kg = VALUES(target_weight_kg),
        target_calories = VALUES(target_calories),
        target_protein_g = VALUES(target_protein_g),
        target_carbs_g = VALUES(target_carbs_g),
        target_fat_g = VALUES(target_fat_g),
        target_fiber_g = VALUES(target_fiber_g),
        onboarding_completed = VALUES(onboarding_completed)`,
      [demoUserId, JSON.stringify(["seafood"]), JSON.stringify(["indonesian", "high-protein"])]
    );

    await connection.execute(
      `INSERT INTO user_settings (user_id, theme, locale, timezone)
       VALUES (?, 'light', 'id-ID', 'Asia/Jakarta')
       ON DUPLICATE KEY UPDATE theme = VALUES(theme), locale = VALUES(locale), timezone = VALUES(timezone)`,
      [demoUserId]
    );

    const scheduleRows = [
      ["breakfast", "07:00:00", "Waktunya sarapan! Mulai hari dengan baik."],
      ["morning_snack", "10:00:00", "Snack pagi dulu yuk."],
      ["lunch", "12:30:00", "Makan siang sehat jangan terlewat."],
      ["afternoon_snack", "15:30:00", "Saatnya cemilan sore."],
      ["dinner", "19:00:00", "Makan malam sehat."],
      ["late_snack", "21:00:00", "Snack malam opsional."]
    ];

    for (const [mealType, time, message] of scheduleRows) {
      await connection.execute(
        `INSERT INTO meal_schedules
         (id, user_id, meal_type, scheduled_time, reminder_enabled, reminder_minutes_before, custom_message, days_of_week)
         VALUES (?, ?, ?, ?, ?, 15, ?, ?)
         ON DUPLICATE KEY UPDATE scheduled_time = VALUES(scheduled_time), custom_message = VALUES(custom_message)`,
        [randomUUID(), demoUserId, mealType, time, mealType !== "late_snack", message, JSON.stringify([1, 2, 3, 4, 5, 6, 7])]
      );
    }

    const foodIdByName = {};
    for (const food of foods) {
      foodIdByName[food[0]] = await upsertFood(connection, food);
      await upsertFoodIngredients(connection, foodIdByName[food[0]], food[0], food[4], food[3]);
    }

    for (const achievement of achievements) {
      await connection.execute(
        `INSERT INTO achievements (id, code, name, description, icon, category, points, condition_type, condition_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          description = VALUES(description),
          icon = VALUES(icon),
          category = VALUES(category),
          points = VALUES(points),
          condition_type = VALUES(condition_type),
          condition_value = VALUES(condition_value)`,
        [randomUUID(), ...achievement]
      );
    }

    const today = new Date();
    const isoDate = (offsetDays) => {
      const date = new Date(today);
      date.setDate(date.getDate() + offsetDays);
      return date.toISOString().slice(0, 10);
    };

    const foodLogs = [
      [isoDate(0), "breakfast", "Oatmeal", 1],
      [isoDate(0), "breakfast", "Kopi Hitam", 1],
      [isoDate(0), "lunch", "Gado-Gado", 1],
      [isoDate(0), "afternoon_snack", "Apel", 1],
      [isoDate(0), "dinner", "Dada Ayam Panggang", 1.5],
      [isoDate(-1), "breakfast", "Telur Rebus", 2],
      [isoDate(-1), "lunch", "Soto Ayam", 1],
      [isoDate(-1), "dinner", "Ikan Salmon", 1]
    ];

    for (const [date, mealType, foodName, amount] of foodLogs) {
      const foodId = foodIdByName[foodName];
      const [foodRows] = await connection.execute("SELECT * FROM food_database WHERE id = ?", [foodId]);
      const food = foodRows[0];
      await insertIfMissing(
        connection,
        "food_logs",
        { user_id: demoUserId, food_name: foodName, log_date: date, meal_type: mealType },
        `INSERT INTO food_logs
         (id, user_id, food_id, food_name, meal_type, log_date, serving_amount, serving_unit, serving_size_g,
          calories, protein_g, carbohydrates_g, fat_g, fiber_g, sugar_g, sodium_mg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          demoUserId,
          foodId,
          foodName,
          mealType,
          date,
          amount,
          food.serving_unit,
          food.serving_size_g,
          Number(food.calories) * amount,
          Number(food.protein_g) * amount,
          Number(food.carbohydrates_g) * amount,
          Number(food.fat_g) * amount,
          Number(food.fiber_g) * amount,
          Number(food.sugar_g) * amount,
          Number(food.sodium_mg) * amount
        ]
      );
    }

    const mealPlans = [
      [isoDate(0), "breakfast", "07:30:00", "Greek Yogurt", 1, 100],
      [isoDate(0), "lunch", "12:30:00", "Nasi Merah", 1, 165],
      [isoDate(0), "dinner", "19:00:00", "Daging Sapi Rendang", 1, 295],
      [isoDate(1), "breakfast", "07:30:00", "Roti Gandum", 2, 140],
      [isoDate(1), "lunch", "12:30:00", "Pecel", 1, 280],
      [isoDate(1), "dinner", "19:00:00", "Ikan Tuna Kaleng", 1, 100]
    ];

    for (const [date, mealType, plannedTime, foodName, amount, calories] of mealPlans) {
      await insertIfMissing(
        connection,
        "meal_plans",
        { user_id: demoUserId, food_name: foodName, plan_date: date, meal_type: mealType },
        `INSERT INTO meal_plans
         (id, user_id, plan_name, plan_date, meal_type, planned_time, food_id, food_name, serving_amount, serving_unit, target_calories)
         VALUES (?, ?, 'Weekly Plan', ?, ?, ?, ?, ?, ?, 'porsi', ?)
         ON DUPLICATE KEY UPDATE planned_time = VALUES(planned_time)`,
        [randomUUID(), demoUserId, date, mealType, plannedTime, foodIdByName[foodName], foodName, amount, calories]
      );
      await connection.execute(
        "UPDATE meal_plans SET planned_time = ? WHERE user_id = ? AND food_name = ? AND plan_date = ? AND meal_type = ?",
        [plannedTime, demoUserId, foodName, date, mealType]
      );
    }

    await connection.execute(
      `UPDATE meal_plans
       SET planned_time = CASE meal_type
         WHEN 'breakfast' THEN '07:30:00'
         WHEN 'morning_snack' THEN '10:00:00'
         WHEN 'lunch' THEN '12:30:00'
         WHEN 'afternoon_snack' THEN '15:30:00'
         WHEN 'dinner' THEN '19:00:00'
         WHEN 'late_snack' THEN '21:00:00'
         ELSE '12:00:00'
       END
       WHERE user_id = ? AND planned_time IS NULL`,
      [demoUserId]
    );

    for (let i = 0; i < 8; i += 1) {
      const date = isoDate(-7 + i);
      const weight = 79.4 - i * 0.13;
      const bmi = calculateBmi(weight, 178);
      await connection.execute(
        `INSERT INTO weight_logs (id, user_id, weight_kg, bmi, bmi_category, log_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, 'Sample progress seed')
         ON DUPLICATE KEY UPDATE weight_kg = VALUES(weight_kg), bmi = VALUES(bmi), bmi_category = VALUES(bmi_category)`,
        [randomUUID(), demoUserId, weight.toFixed(2), bmi, getBmiCategory(bmi), date]
      );
    }

    await insertIfMissing(
      connection,
      "water_logs",
      { user_id: demoUserId, log_date: isoDate(0), amount_ml: 500 },
      "INSERT INTO water_logs (id, user_id, amount_ml, log_date) VALUES (?, ?, 500, ?)",
      [randomUUID(), demoUserId, isoDate(0)]
    );

    const notifications = [
      ["Waktunya makan siang", "Jaga energi siang ini dengan menu yang sudah direncanakan.", "meal_reminder"],
      ["Target protein hampir tercapai", "Tambahkan makanan tinggi protein untuk menutup target harian.", "system"],
      ["Laporan mingguan siap", "Progress minggu ini sudah bisa kamu cek.", "weekly_report"]
    ];

    for (const [title, message, type] of notifications) {
      await insertIfMissing(
        connection,
        "notifications",
        { user_id: demoUserId, title },
        "INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)",
        [randomUUID(), demoUserId, title, message, type]
      );
    }

    for (const [index, challenge] of communityChallenges.entries()) {
      await insertIfMissing(
        connection,
        "community_challenges",
        { title: challenge[0] },
        `INSERT INTO community_challenges
         (id, title, description, badge, badge_tone, participants_label, image_url, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), ...challenge, index + 1]
      );
      await connection.execute(
        `UPDATE community_challenges
         SET reward_points = COALESCE(reward_points, 100),
             reward_badge = COALESCE(reward_badge, CONCAT(title, ' Badge')),
             reward_achievement_code = COALESCE(reward_achievement_code, 'CHALLENGE_FINISHER')
         WHERE title = ?`,
        [challenge[0]]
      );
      const [[challengeRow]] = await connection.execute("SELECT id FROM community_challenges WHERE title = ? LIMIT 1", [challenge[0]]);
      const tasks = communityChallengeTasks[challenge[0]] || [];
      for (const task of tasks) {
        await connection.execute(
          `INSERT INTO community_challenge_tasks
           (id, challenge_id, day_number, title, description, task_type, target_value, target_unit, points, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            description = VALUES(description),
            task_type = VALUES(task_type),
            target_value = VALUES(target_value),
            target_unit = VALUES(target_unit),
            points = VALUES(points),
            sort_order = VALUES(sort_order)`,
          [randomUUID(), challengeRow.id, ...task]
        );
      }
    }

    for (const [index, member] of communityLeaderboard.entries()) {
      await insertIfMissing(
        connection,
        "community_leaderboard",
        { name: member[0] },
        `INSERT INTO community_leaderboard (id, name, streak_days, avatar_url, is_top, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), ...member, index + 1]
      );
    }

    for (const [index, buddy] of communityBuddies.entries()) {
      await insertIfMissing(
        connection,
        "community_buddies",
        { name: buddy[0] },
        `INSERT INTO community_buddies (id, name, meta, avatar_url, match_percent, focus, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), ...buddy, index + 1]
      );
    }

    for (const post of communityPosts) {
      await insertIfMissing(
        connection,
        "community_posts",
        { author_name: post[0], body: post[3] },
        `INSERT INTO community_posts
         (id, author_name, author_badge, author_avatar_url, body, image_url, cheers_count, comments_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), ...post]
      );
    }

    for (const [index, category] of helpCategories.entries()) {
      await insertIfMissing(
        connection,
        "help_categories",
        { title: category[0] },
        `INSERT INTO help_categories (id, title, description, icon, tone, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), ...category, index + 1]
      );
    }

    for (const [index, tutorial] of helpTutorials.entries()) {
      await insertIfMissing(
        connection,
        "help_tutorials",
        { title: tutorial[0] },
        `INSERT INTO help_tutorials (id, title, description, duration, image_url, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), ...tutorial, index + 1]
      );
    }

    for (const [index, faq] of helpFaqs.entries()) {
      await insertIfMissing(
        connection,
        "help_faqs",
        { question: faq[0] },
        `INSERT INTO help_faqs (id, question, answer, category, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), ...faq, index + 1]
      );
    }

    await connection.commit();
    console.log("Seed completed.");
    console.log("Demo login: alex@nutritrack.app / nutritrack123");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
