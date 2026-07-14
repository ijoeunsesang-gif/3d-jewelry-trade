-- 의뢰 등록 시 제작 옵션(카테고리/소재/사이즈 등) 저장을 위한 컬럼 추가 (전부 nullable)

ALTER TABLE commissions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS material TEXT;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS ring_size TEXT;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS ring_size_adjust BOOLEAN;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS necklace_triangle BOOLEAN;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS decoration BOOLEAN;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS hollow BOOLEAN;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS bottom_plate BOOLEAN;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS production_type TEXT;
