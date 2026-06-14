CREATE TABLE IF NOT EXISTS food_ingredients (
  id CHAR(36) PRIMARY KEY,
  food_id CHAR(36) NOT NULL,
  ingredient_name VARCHAR(180) NOT NULL,
  quantity_per_serving DECIMAL(10,2) DEFAULT 1,
  unit VARCHAR(40) DEFAULT 'porsi',
  category VARCHAR(80) DEFAULT 'Groceries',
  sort_order INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_food_ingredient_unique (food_id, ingredient_name, unit),
  INDEX idx_food_ingredients_food (food_id),
  CONSTRAINT fk_food_ingredients_food
    FOREIGN KEY (food_id) REFERENCES food_database(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TEMPORARY TABLE seed_food_ingredients (
  food_name VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  ingredient_name VARCHAR(180) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  quantity_per_serving DECIMAL(10,2) DEFAULT 1,
  unit VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'porsi',
  category VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Groceries',
  sort_order INT DEFAULT 0
) ENGINE=Memory DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO seed_food_ingredients
  (food_name, ingredient_name, quantity_per_serving, unit, category, sort_order)
VALUES
  ('Nasi Goreng', 'Nasi putih matang', 180, 'g', 'Pantry', 1),
  ('Nasi Goreng', 'Telur ayam', 1, 'butir', 'Protein', 2),
  ('Nasi Goreng', 'Minyak goreng', 1, 'sdm', 'Pantry', 3),
  ('Nasi Goreng', 'Bawang merah', 2, 'siung', 'Produce', 4),
  ('Nasi Goreng', 'Bawang putih', 1, 'siung', 'Produce', 5),
  ('Nasi Goreng', 'Kecap manis', 1, 'sdm', 'Condiments', 6),
  ('Bubur Ayam', 'Beras', 55, 'g', 'Pantry', 1),
  ('Bubur Ayam', 'Dada ayam suwir', 45, 'g', 'Protein', 2),
  ('Bubur Ayam', 'Kaldu ayam', 250, 'ml', 'Pantry', 3),
  ('Bubur Ayam', 'Daun bawang', 10, 'g', 'Produce', 4),
  ('Bubur Ayam', 'Bawang goreng', 5, 'g', 'Condiments', 5),
  ('Telur Dadar', 'Telur ayam', 2, 'butir', 'Protein', 1),
  ('Telur Dadar', 'Minyak goreng', 1, 'sdm', 'Pantry', 2),
  ('Telur Dadar', 'Daun bawang', 10, 'g', 'Produce', 3),
  ('Daging Sapi Rendang', 'Daging sapi', 100, 'g', 'Protein', 1),
  ('Daging Sapi Rendang', 'Santan', 80, 'ml', 'Dairy & Coconut', 2),
  ('Daging Sapi Rendang', 'Cabai merah', 20, 'g', 'Produce', 3),
  ('Daging Sapi Rendang', 'Bawang merah', 25, 'g', 'Produce', 4),
  ('Daging Sapi Rendang', 'Bawang putih', 10, 'g', 'Produce', 5),
  ('Daging Sapi Rendang', 'Lengkuas', 8, 'g', 'Spices', 6),
  ('Daging Sapi Rendang', 'Serai', 1, 'batang', 'Spices', 7),
  ('Soto Ayam', 'Dada ayam', 70, 'g', 'Protein', 1),
  ('Soto Ayam', 'Bihun', 40, 'g', 'Pantry', 2),
  ('Soto Ayam', 'Kol', 40, 'g', 'Produce', 3),
  ('Soto Ayam', 'Tauge', 30, 'g', 'Produce', 4),
  ('Soto Ayam', 'Kaldu ayam', 300, 'ml', 'Pantry', 5),
  ('Soto Ayam', 'Bumbu soto', 1, 'porsi', 'Spices', 6),
  ('Gado-Gado', 'Kangkung', 45, 'g', 'Produce', 1),
  ('Gado-Gado', 'Tauge', 35, 'g', 'Produce', 2),
  ('Gado-Gado', 'Tahu', 50, 'g', 'Protein', 3),
  ('Gado-Gado', 'Tempe', 50, 'g', 'Protein', 4),
  ('Gado-Gado', 'Telur rebus', 1, 'butir', 'Protein', 5),
  ('Gado-Gado', 'Saus kacang', 60, 'g', 'Condiments', 6),
  ('Gado-Gado', 'Lontong', 80, 'g', 'Pantry', 7),
  ('Pecel', 'Bayam', 50, 'g', 'Produce', 1),
  ('Pecel', 'Kacang panjang', 45, 'g', 'Produce', 2),
  ('Pecel', 'Tauge', 35, 'g', 'Produce', 3),
  ('Pecel', 'Kol', 35, 'g', 'Produce', 4),
  ('Pecel', 'Sambal kacang', 55, 'g', 'Condiments', 5),
  ('Pecel', 'Peyek', 15, 'g', 'Pantry', 6),
  ('Bakso', 'Bakso sapi', 5, 'pcs', 'Protein', 1),
  ('Bakso', 'Kuah kaldu sapi', 300, 'ml', 'Pantry', 2),
  ('Bakso', 'Mie kuning', 40, 'g', 'Pantry', 3),
  ('Bakso', 'Bihun', 25, 'g', 'Pantry', 4),
  ('Bakso', 'Sawi hijau', 40, 'g', 'Produce', 5),
  ('Bakso', 'Seledri', 5, 'g', 'Produce', 6),
  ('Mie Goreng', 'Mie telur', 120, 'g', 'Pantry', 1),
  ('Mie Goreng', 'Telur ayam', 1, 'butir', 'Protein', 2),
  ('Mie Goreng', 'Kol', 40, 'g', 'Produce', 3),
  ('Mie Goreng', 'Sawi hijau', 35, 'g', 'Produce', 4),
  ('Mie Goreng', 'Kecap manis', 1, 'sdm', 'Condiments', 5),
  ('Mie Goreng', 'Minyak goreng', 1, 'sdm', 'Pantry', 6),
  ('Ketoprak', 'Lontong', 120, 'g', 'Pantry', 1),
  ('Ketoprak', 'Tahu', 80, 'g', 'Protein', 2),
  ('Ketoprak', 'Tauge', 50, 'g', 'Produce', 3),
  ('Ketoprak', 'Bihun', 45, 'g', 'Pantry', 4),
  ('Ketoprak', 'Saus kacang', 65, 'g', 'Condiments', 5),
  ('Siomay', 'Siomay ikan', 4, 'pcs', 'Protein', 1),
  ('Siomay', 'Kentang', 80, 'g', 'Produce', 2),
  ('Siomay', 'Kol', 50, 'g', 'Produce', 3),
  ('Siomay', 'Tahu', 50, 'g', 'Protein', 4),
  ('Siomay', 'Saus kacang', 45, 'g', 'Condiments', 5),
  ('Lontong Sayur', 'Lontong', 150, 'g', 'Pantry', 1),
  ('Lontong Sayur', 'Labu siam', 80, 'g', 'Produce', 2),
  ('Lontong Sayur', 'Santan', 100, 'ml', 'Dairy & Coconut', 3),
  ('Lontong Sayur', 'Telur rebus', 1, 'butir', 'Protein', 4),
  ('Lontong Sayur', 'Bumbu kuning', 1, 'porsi', 'Spices', 5),
  ('Smoothie Pisang', 'Pisang', 1, 'buah', 'Produce', 1),
  ('Smoothie Pisang', 'Susu skim', 200, 'ml', 'Dairy & Coconut', 2),
  ('Smoothie Pisang', 'Oatmeal', 25, 'g', 'Pantry', 3),
  ('Smoothie Pisang', 'Es batu', 1, 'gelas', 'Pantry', 4),
  ('Jus Jeruk Segar', 'Jeruk segar', 3, 'buah', 'Produce', 1),
  ('Jus Jeruk Segar', 'Air', 50, 'ml', 'Pantry', 2),
  ('Oatmeal', 'Oat', 80, 'g', 'Pantry', 1),
  ('Oatmeal', 'Air atau susu', 200, 'ml', 'Dairy & Coconut', 2),
  ('Greek Yogurt', 'Greek yogurt', 150, 'g', 'Dairy & Coconut', 1);

INSERT INTO food_ingredients
  (id, food_id, ingredient_name, quantity_per_serving, unit, category, sort_order)
SELECT
  UUID(),
  fd.id,
  sfi.ingredient_name,
  sfi.quantity_per_serving,
  sfi.unit,
  sfi.category,
  sfi.sort_order
FROM seed_food_ingredients sfi
JOIN food_database fd ON fd.name = sfi.food_name
WHERE NOT EXISTS (
  SELECT 1
  FROM food_ingredients fi
  WHERE fi.food_id = fd.id
    AND fi.ingredient_name = sfi.ingredient_name
    AND fi.unit = sfi.unit
);

INSERT INTO food_ingredients
  (id, food_id, ingredient_name, quantity_per_serving, unit, category, sort_order)
SELECT
  UUID(),
  fd.id,
  fd.name,
  1,
  COALESCE(fd.serving_unit, 'porsi'),
  CASE
    WHEN fd.category IN ('drink') THEN 'Drinks'
    WHEN fd.sub_category IN ('buah', 'sayur') THEN 'Produce'
    WHEN fd.sub_category IN ('lauk', 'dairy', 'kacang') THEN 'Protein'
    WHEN fd.category IN ('breakfast', 'lunch', 'dinner') THEN 'Pantry'
    ELSE 'Groceries'
  END,
  99
FROM food_database fd
WHERE NOT EXISTS (
  SELECT 1
  FROM food_ingredients fi
  WHERE fi.food_id = fd.id
);

DROP TEMPORARY TABLE seed_food_ingredients;
