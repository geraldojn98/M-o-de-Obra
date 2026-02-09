-- Adiciona a categoria de profissional "Piscineiro" em service_categories
INSERT INTO service_categories (name, icon)
SELECT 'Piscineiro', 'Droplets'
WHERE NOT EXISTS (
    SELECT 1 FROM service_categories WHERE name = 'Piscineiro'
);
