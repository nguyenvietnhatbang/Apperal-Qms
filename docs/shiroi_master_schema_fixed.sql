-- SHIROI ARIKA - MASTER DATABASE SCHEMA (FIXED / ONE-SHOT)
-- Chạy toàn bộ file này trong Supabase SQL Editor.
-- File có thể chạy lại: table/index dùng IF NOT EXISTS; trigger/policy được DROP trước khi CREATE.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET LOCAL search_path = public, extensions;

-- ==========================================================

-- 🍀 SHIROI ARIKA - MASTER DATABASE SCHEMA (FINAL CONSOLIDATED)

-- Phiên bản: v36.final - Performance, Security & Gamification

-- ==========================================================



-- ==========================================

-- 1. CẤU TRÚC BẢNG CỐT LÕI (CORE TABLES) 🏗️

-- ==========================================



-- Bảng Truyện (Mangas)

CREATE TABLE IF NOT EXISTS public.mangas (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title TEXT NOT NULL,

    description TEXT,

    author TEXT DEFAULT 'Khuyết danh',

    cover_image TEXT,

    genres TEXT[], 

    status TEXT DEFAULT 'ONGOING' CHECK (status IN ('ONGOING', 'COMPLETED')),

    is_featured BOOLEAN DEFAULT false,

    default_reading_mode TEXT DEFAULT 'scroll',

    size_kb FLOAT DEFAULT 300,

    total_chapters INTEGER DEFAULT 0,

    latest_chapter_number NUMERIC,

    latest_chapter_id UUID,

    uploader_id UUID,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()

);



-- Bảng Chương (Chapters)

CREATE TABLE IF NOT EXISTS public.chapters (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    manga_id UUID REFERENCES public.mangas(id) ON DELETE CASCADE,

    chapter_number NUMERIC NOT NULL,

    title TEXT,

    uploader_id UUID,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(manga_id, chapter_number)

);



-- Bảng Trang (Pages)

CREATE TABLE IF NOT EXISTS public.pages (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,

    page_number INTEGER NOT NULL,

    image_url TEXT NOT NULL,

    size_kb FLOAT DEFAULT 150,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(chapter_id, page_number)

);



-- Bảng Người dùng (Users)

CREATE TABLE IF NOT EXISTS public.shiroi_users (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username TEXT UNIQUE NOT NULL,

    password TEXT NOT NULL,

    display_name TEXT,

    avatar_url TEXT,

    bio TEXT,

    role TEXT DEFAULT 'user',

    xp INTEGER DEFAULT 0,

    level INTEGER DEFAULT 1,

    last_check_in TIMESTAMPTZ,

    last_lucky_draw TIMESTAMPTZ,

    check_in_streak INTEGER DEFAULT 0,

    selected_badge TEXT DEFAULT 'Lữ Khách',

    unlocked_badges TEXT[] DEFAULT '{}',

    fcm_token TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()

);



-- Bảng Bình luận (Comments)

CREATE TABLE IF NOT EXISTS public.comments (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    manga_id UUID REFERENCES mangas(id) ON DELETE CASCADE,

    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,

    user_id UUID REFERENCES shiroi_users(id) ON DELETE CASCADE,

    user_name TEXT NOT NULL,

    content TEXT NOT NULL,

    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,

    likes_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()

);



-- Nhật ký XP (XP Logs)

CREATE TABLE IF NOT EXISTS public.shiroi_xp_logs (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES shiroi_users(id) ON DELETE CASCADE,

    amount INTEGER NOT NULL,

    type TEXT NOT NULL,

    reason TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()

);



-- Thống kê tháng (Monthly Stats Cache)

CREATE TABLE IF NOT EXISTS public.shiroi_monthly_stats (

    user_id UUID REFERENCES shiroi_users(id) ON DELETE CASCADE,

    month_year DATE,

    amount BIGINT DEFAULT 0,

    PRIMARY KEY (user_id, month_year)

);



-- Lịch sử đọc (History)

CREATE TABLE IF NOT EXISTS public.shiroi_history (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES shiroi_users(id) ON DELETE CASCADE,

    username TEXT,

    manga_id UUID REFERENCES mangas(id) ON DELETE CASCADE,

    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,

    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(user_id, manga_id)

);



-- Chương đã đọc (Read Chapters)

CREATE TABLE IF NOT EXISTS public.shiroi_read_chapters (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES public.shiroi_users(id) ON DELETE CASCADE,

    username TEXT,

    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,

    manga_id UUID REFERENCES public.mangas(id) ON DELETE CASCADE,

    read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(user_id, chapter_id)

);



-- Thông báo (Notifications)

CREATE TABLE IF NOT EXISTS public.shiroi_notifications (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES public.shiroi_users(id) ON DELETE CASCADE,

    title TEXT NOT NULL,

    body TEXT NOT NULL,

    type TEXT DEFAULT 'chapter_update',

    data JSONB DEFAULT '{}',

    is_read BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT now()

);



-- Bảng Báo cáo (Reports)

CREATE TABLE IF NOT EXISTS public.shiroi_reports (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES public.shiroi_users(id) ON DELETE SET NULL,

    manga_id UUID REFERENCES public.mangas(id) ON DELETE CASCADE,

    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,

    type TEXT NOT NULL,

    description TEXT,

    status TEXT DEFAULT 'pending',

    created_at TIMESTAMPTZ DEFAULT now()

);



CREATE TABLE IF NOT EXISTS public.shiroi_report_messages (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    report_id UUID REFERENCES public.shiroi_reports(id) ON DELETE CASCADE,

    sender_id UUID REFERENCES public.shiroi_users(id) ON DELETE SET NULL,

    message TEXT NOT NULL,

    is_admin_reply BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT now()

);



-- Các bảng bổ sung để tránh lỗi RLS (Được thêm dựa trên phần cấu hình RLS ở dưới)

CREATE TABLE IF NOT EXISTS public.shiroi_mission_claims (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES public.shiroi_users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT now()

);



CREATE TABLE IF NOT EXISTS public.shiroi_follows (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES public.shiroi_users(id) ON DELETE CASCADE,

    manga_id UUID REFERENCES public.mangas(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(user_id, manga_id)

);





-- ==========================================

-- 2. LOGIC TỰ ĐỘNG (TRIGGERS & FUNCTIONS) ⚙️

-- ==========================================



-- [Manga Stats] Cập nhật số chương và chương mới nhất

CREATE OR REPLACE FUNCTION public.update_manga_stats_and_time()

RETURNS TRIGGER AS $$

DECLARE

    latest_chap RECORD;

BEGIN

    SELECT id, chapter_number INTO latest_chap 

    FROM public.chapters 

    WHERE manga_id = COALESCE(NEW.manga_id, OLD.manga_id) 

    ORDER BY chapter_number DESC LIMIT 1;



    UPDATE public.mangas SET 

        total_chapters = (SELECT COUNT(*) FROM public.chapters WHERE manga_id = COALESCE(NEW.manga_id, OLD.manga_id)),

        latest_chapter_number = latest_chap.chapter_number,

        latest_chapter_id = latest_chap.id,

        updated_at = now()

    WHERE id = COALESCE(NEW.manga_id, OLD.manga_id);



    RETURN NULL;

END;

$$ LANGUAGE plpgsql;



DROP TRIGGER IF EXISTS trg_update_manga_all ON public.chapters;

CREATE TRIGGER trg_update_manga_all 

AFTER INSERT OR DELETE OR UPDATE OF chapter_number ON public.chapters

FOR EACH ROW EXECUTE FUNCTION public.update_manga_stats_and_time();



-- [XP & Monthly Stats] Đồng bộ XP từ Log vào User Profile và Monthly Stats

CREATE OR REPLACE FUNCTION public.fn_sync_user_xp_and_monthly()

RETURNS TRIGGER AS $$

DECLARE

    v_month_year DATE;

BEGIN

    UPDATE shiroi_users SET xp = xp + NEW.amount WHERE id = NEW.user_id;

    

    v_month_year := date_trunc('month', NEW.created_at)::date;

    INSERT INTO shiroi_monthly_stats (user_id, month_year, amount)

    VALUES (NEW.user_id, v_month_year, NEW.amount)

    ON CONFLICT (user_id, month_year) 

    DO UPDATE SET amount = shiroi_monthly_stats.amount + EXCLUDED.amount;

    

    RETURN NEW;

END;

$$ LANGUAGE plpgsql;



DROP TRIGGER IF EXISTS trg_sync_user_xp ON public.shiroi_xp_logs;

CREATE TRIGGER trg_sync_user_xp AFTER INSERT ON public.shiroi_xp_logs

FOR EACH ROW EXECUTE FUNCTION public.fn_sync_user_xp_and_monthly();



-- [Timestamp] Cập nhật updated_at cho Mangas

CREATE OR REPLACE FUNCTION public.update_updated_at_column()

RETURNS TRIGGER AS $$

BEGIN

    NEW.updated_at = now();

    RETURN NEW;

END;

$$ LANGUAGE 'plpgsql';



DROP TRIGGER IF EXISTS update_mangas_updated_at ON public.mangas;

CREATE TRIGGER update_mangas_updated_at BEFORE UPDATE ON public.mangas 

FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();





-- ==========================================

-- 3. HÀM TRIỆU HỒI ĐẶC BIỆT (RPC) 🚀

-- ==========================================



-- [RPC] Điểm danh hàng ngày
CREATE OR REPLACE FUNCTION public.rpc_perform_check_in(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_check TIMESTAMPTZ;
    v_streak INTEGER;
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
    v_last_check_date DATE;
    v_base_xp INTEGER := 100;
    v_bonus_xp INTEGER := 0;
    v_total_xp INTEGER;
BEGIN
    SELECT last_check_in, COALESCE(check_in_streak, 0)
    INTO v_last_check, v_streak
    FROM public.shiroi_users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Không tìm thấy người dùng.');
    END IF;

    IF v_last_check IS NOT NULL THEN
        v_last_check_date := (v_last_check AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

        IF v_last_check_date = v_today THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Hôm nay bạn đã điểm danh rồi!',
                'streak', v_streak
            );
        END IF;

        IF v_last_check_date = v_today - 1 THEN
            v_streak := v_streak + 1;
        ELSE
            v_streak := 1;
        END IF;
    ELSE
        v_streak := 1;
    END IF;

    -- Thưởng chuỗi: +10 XP cho mỗi ngày liên tiếp trước đó, tối đa +100 XP.
    v_bonus_xp := LEAST(GREATEST(v_streak - 1, 0) * 10, 100);
    v_total_xp := v_base_xp + v_bonus_xp;

    INSERT INTO public.shiroi_xp_logs (user_id, amount, type, reason)
    VALUES (p_user_id, v_total_xp, 'check_in', 'Điểm danh ngày ' || v_today::text);

    UPDATE public.shiroi_users
    SET last_check_in = now(),
        check_in_streak = v_streak
    WHERE id = p_user_id;

    RETURN json_build_object(
        'success', true,
        'xpGain', v_total_xp,
        'baseXp', v_base_xp,
        'bonusXp', v_bonus_xp,
        'streak', v_streak,
        'message', 'Điểm danh thành công! +' || v_total_xp || ' XP'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;



-- [RPC] Bốc quà may mắn (Gacha)

CREATE OR REPLACE FUNCTION public.rpc_perform_lucky_draw(p_user_id UUID)

RETURNS JSON AS $$

DECLARE

    v_last_draw TIMESTAMP WITH TIME ZONE;

    v_start_of_today TIMESTAMP WITH TIME ZONE;

    v_rand FLOAT;

    v_xp_gain INTEGER;

BEGIN

    v_start_of_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

    SELECT last_lucky_draw INTO v_last_draw FROM shiroi_users WHERE id = p_user_id;



    IF v_last_draw IS NOT NULL AND (v_last_draw AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = v_start_of_today::date THEN

        RETURN json_build_object('success', false, 'error', 'Hôm nay vận may đã cạn, hãy quay lại vào ngày mai!');

    END IF;



    v_rand := random() * 100;

    IF v_rand <= 0.5 THEN v_xp_gain := 500;

    ELSIF v_rand <= 3.0 THEN v_xp_gain := 100;

    ELSIF v_rand <= 7.0 THEN v_xp_gain := 50;

    ELSIF v_rand <= 15.0 THEN v_xp_gain := 40;

    ELSIF v_rand <= 30.0 THEN v_xp_gain := 30;

    ELSIF v_rand <= 60.0 THEN v_xp_gain := 20;

    ELSE v_xp_gain := 10;

    END IF;



    INSERT INTO shiroi_xp_logs (user_id, amount, type, reason)

    VALUES (p_user_id, v_xp_gain, 'lucky_draw', 'May mắn hàng ngày');



    UPDATE shiroi_users SET last_lucky_draw = now() WHERE id = p_user_id;



    RETURN json_build_object('success', true, 'xpGain', v_xp_gain, 'message', 'Bốc quà thành công! +' || v_xp_gain || ' XP');

END;

$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;



-- [RPC] Ghi nhật ký XP an toàn (Atomic & Secure)

DROP FUNCTION IF EXISTS public.rpc_record_xp_log(integer, text, text, uuid);

CREATE OR REPLACE FUNCTION public.rpc_record_xp_log(

    p_amount INTEGER,

    p_type TEXT,

    p_reason TEXT,

    p_user_id UUID

)

RETURNS JSON AS $$

DECLARE

    v_already_exists BOOLEAN;

BEGIN

    IF p_type = 'read' THEN

        SELECT EXISTS (

            SELECT 1 FROM public.shiroi_xp_logs 

            WHERE user_id = p_user_id AND type = 'read' AND reason = p_reason

        ) INTO v_already_exists;

        

        IF v_already_exists THEN

            RETURN json_build_object('success', false, 'error', 'Chương này đã được nhận thưởng rồi! 🛡️');

        END IF;

    END IF;



    INSERT INTO public.shiroi_xp_logs (user_id, amount, type, reason)

    VALUES (p_user_id, p_amount, p_type, p_reason);

    

    RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN

    RETURN json_build_object('success', false, 'error', SQLERRM);

END;

$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;



-- [RPC] Đồng bộ Chương đã đọc hàng loạt (Bulk Sync)

CREATE OR REPLACE FUNCTION public.rpc_bulk_sync_read_chapters(

    p_user_id UUID,

    p_username TEXT,

    p_chapter_ids UUID[],

    p_read_at TIMESTAMPTZ DEFAULT now()

)

RETURNS JSON AS $$

DECLARE

    v_synced_count INT := 0;

    v_xp_gain INT := 0;

    v_cid UUID;

    v_already_read BOOLEAN;

BEGIN

    FOREACH v_cid IN ARRAY p_chapter_ids

    LOOP

        SELECT EXISTS (

            SELECT 1 FROM public.shiroi_read_chapters 

            WHERE user_id = p_user_id AND chapter_id = v_cid

        ) INTO v_already_read;



        IF NOT v_already_read THEN

            INSERT INTO public.shiroi_read_chapters (user_id, username, chapter_id, manga_id, read_at)

            SELECT p_user_id, p_username, v_cid, c.manga_id, p_read_at

            FROM public.chapters c WHERE c.id = v_cid;



            INSERT INTO public.shiroi_xp_logs (user_id, amount, type, reason, created_at)

            SELECT p_user_id, 20, 'read', 'Đồng bộ: ' || m.title || ' - Ch: ' || c.chapter_number, p_read_at

            FROM public.chapters c

            JOIN public.mangas m ON c.manga_id = m.id

            WHERE c.id = v_cid;



            v_synced_count := v_synced_count + 1;

            v_xp_gain := v_xp_gain + 20;

        END IF;

    END LOOP;



    RETURN json_build_object(

        'success', true, 

        'synced_count', v_synced_count, 

        'xp_gain', v_xp_gain

    );

EXCEPTION WHEN OTHERS THEN

    RETURN json_build_object('success', false, 'error', SQLERRM);

END;

$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;



-- [RPC] BXH Tháng (Monthly Leaderboard)

CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(month_offset INT DEFAULT 0)

RETURNS TABLE (id UUID, username TEXT, display_name TEXT, avatar_url TEXT, selected_badge TEXT, total_xp BIGINT, monthly_xp BIGINT) 

SECURITY DEFINER 

SET search_path = public

AS $$

DECLARE target_month DATE;

BEGIN

    target_month := date_trunc('month', now() - (month_offset * interval '1 month'))::date;

    RETURN QUERY

    SELECT u.id, u.username, u.display_name, u.avatar_url, u.selected_badge, u.xp::BIGINT, COALESCE(ms.amount, 0)::BIGINT

    FROM shiroi_users u

    LEFT JOIN shiroi_monthly_stats ms ON u.id = ms.user_id AND ms.month_year = target_month

    WHERE (u.role != 'admin' OR u.username = 'atheist1504')

    ORDER BY monthly_xp DESC, total_xp DESC LIMIT 100;

END;

$$ LANGUAGE plpgsql;



-- [RPC] Tổng dung lượng (Storage Stats)

CREATE OR REPLACE FUNCTION public.get_total_storage_kb()

RETURNS float AS $$

DECLARE

    total_manga_size float;

    total_pages_size float;

BEGIN

    SELECT COALESCE(SUM(COALESCE(size_kb, 300)), 0) INTO total_manga_size FROM mangas;

    SELECT COALESCE(SUM(COALESCE(size_kb, 150)), 0) INTO total_pages_size FROM pages;

    RETURN total_manga_size + total_pages_size;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;





-- ==========================================

-- 4. PHÂN QUYỀN THỰC THI (GRANTS) 🔑

-- ==========================================



GRANT EXECUTE ON FUNCTION public.rpc_bulk_sync_read_chapters(UUID, TEXT, UUID[], TIMESTAMPTZ) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_record_xp_log(integer, text, text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_perform_check_in(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_perform_lucky_draw(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_leaderboard(INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_total_storage_kb() TO authenticated, service_role;





-- ==========================================

-- 5. BẢO MẬT (SECURITY & RLS) 🛡️

-- ==========================================



-- Bật RLS cho tất cả các bảng

ALTER TABLE public.mangas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shiroi_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shiroi_xp_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shiroi_notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shiroi_read_chapters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shiroi_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shiroi_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shiroi_report_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shiroi_monthly_stats ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shiroi_mission_claims ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shiroi_follows ENABLE ROW LEVEL SECURITY;



-- Dọn dẹp chính sách cũ để tránh lỗi trùng lặp khi chạy lại

DROP POLICY IF EXISTS "Public Select" ON public.mangas;

DROP POLICY IF EXISTS "Public Select" ON public.chapters;

DROP POLICY IF EXISTS "Public Select" ON public.pages;

DROP POLICY IF EXISTS "Public Select" ON public.comments;

DROP POLICY IF EXISTS "Public Select" ON public.shiroi_users;

DROP POLICY IF EXISTS "Public Select" ON public.shiroi_notifications;
DROP POLICY IF EXISTS "View Own Notifications" ON public.shiroi_notifications;

DROP POLICY IF EXISTS "Public Select" ON public.shiroi_monthly_stats;

DROP POLICY IF EXISTS "Admin Only Write" ON public.mangas;

DROP POLICY IF EXISTS "Admin Only Write" ON public.chapters;

DROP POLICY IF EXISTS "Admin Only Write" ON public.pages;

DROP POLICY IF EXISTS "Admin Only Write" ON public.shiroi_users;

DROP POLICY IF EXISTS "View Own Reports" ON public.shiroi_reports;

DROP POLICY IF EXISTS "View Own Report Messages" ON public.shiroi_report_messages;

DROP POLICY IF EXISTS "View Own Read Chapters" ON public.shiroi_read_chapters;

DROP POLICY IF EXISTS "View Own XP Logs" ON public.shiroi_xp_logs;

DROP POLICY IF EXISTS "View Own History" ON public.shiroi_history;

DROP POLICY IF EXISTS "View Own Mission Claims" ON public.shiroi_mission_claims;

DROP POLICY IF EXISTS "View Own Follows" ON public.shiroi_follows;



-- Cấu hình chính sách RLS mới

CREATE POLICY "Public Select" ON public.mangas FOR SELECT USING (true);

CREATE POLICY "Public Select" ON public.chapters FOR SELECT USING (true);

CREATE POLICY "Public Select" ON public.pages FOR SELECT USING (true);

CREATE POLICY "Public Select" ON public.comments FOR SELECT USING (true);

CREATE POLICY "Public Select" ON public.shiroi_users FOR SELECT USING (true);

CREATE POLICY "View Own Notifications" ON public.shiroi_notifications
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Public Select" ON public.shiroi_monthly_stats FOR SELECT USING (true);



CREATE POLICY "Admin Only Write" ON public.mangas FOR ALL USING (false);

CREATE POLICY "Admin Only Write" ON public.chapters FOR ALL USING (false);

CREATE POLICY "Admin Only Write" ON public.pages FOR ALL USING (false);

CREATE POLICY "Admin Only Write" ON public.shiroi_users FOR ALL USING (false);



-- Quyền riêng tư cho Users (Ẩn mật khẩu và Token mật)

REVOKE SELECT ON public.shiroi_users FROM anon, authenticated;

GRANT SELECT (id, username, display_name, avatar_url, bio, role, xp, level, last_check_in, last_lucky_draw, check_in_streak, selected_badge, unlocked_badges, created_at) ON public.shiroi_users TO anon, authenticated;



-- Hệ thống Báo cáo (Reports)

CREATE POLICY "View Own Reports" ON public.shiroi_reports FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM shiroi_users WHERE id = auth.uid() AND role IN ('admin', 'staff')));

CREATE POLICY "View Own Report Messages" ON public.shiroi_report_messages FOR SELECT USING (EXISTS (SELECT 1 FROM shiroi_reports r WHERE r.id = report_id AND (r.user_id = auth.uid() OR EXISTS (SELECT 1 FROM shiroi_users WHERE id = auth.uid() AND role IN ('admin', 'staff')))));



-- Phân quyền Dữ liệu Người dùng cá nhân

CREATE POLICY "View Own Read Chapters" ON public.shiroi_read_chapters FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "View Own XP Logs" ON public.shiroi_xp_logs FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "View Own History" ON public.shiroi_history FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "View Own Mission Claims" ON public.shiroi_mission_claims FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "View Own Follows" ON public.shiroi_follows FOR SELECT USING (user_id = auth.uid());





-- ==========================================

-- 6. CHỈ MỤC TỐI ƯU (INDEXES) 🚀

-- ==========================================



CREATE INDEX IF NOT EXISTS idx_manga_updated ON public.mangas(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mangas_status ON public.mangas(status);

CREATE INDEX IF NOT EXISTS idx_mangas_genres ON public.mangas USING GIN (genres);

CREATE INDEX IF NOT EXISTS idx_chapters_manga ON public.chapters(manga_id, chapter_number DESC);

CREATE INDEX IF NOT EXISTS idx_pages_chapter ON public.pages(chapter_id, page_number);

CREATE INDEX IF NOT EXISTS idx_users_xp_desc ON public.shiroi_users(xp DESC);

CREATE INDEX IF NOT EXISTS idx_xp_logs_created_at ON public.shiroi_xp_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.shiroi_reports(status);





-- ==========================================

-- 7. CẤU HÌNH REAL-TIME CONFIGURATION ⚡

-- ==========================================



-- Đảm bảo REPLICA IDENTITY FULL hoạt động ổn định

ALTER TABLE public.comments REPLICA IDENTITY FULL;



-- Thêm bảng vào Publication Realtime nếu chưa tồn tại

DO $$

BEGIN

    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN

        -- Thêm từng bảng (bỏ qua nếu bảng đã được thêm trước đó)

        BEGIN

            ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

        EXCEPTION WHEN duplicate_object THEN

            NULL;

        END;

        

        BEGIN

            ALTER PUBLICATION supabase_realtime ADD TABLE public.shiroi_notifications;

        EXCEPTION WHEN duplicate_object THEN

            NULL;

        END;

    END IF;

END $$;



-- Kết quả kiểm tra cuối cùng

SELECT 'Shiroi Master Schema (FINAL CONSOLIDATED): Đã thực thi hoàn tất thành công! 🍀🟢' as status;

COMMIT;
