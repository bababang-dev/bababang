import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const conn = await pool.getConnection();
  try {
    // 유저 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nickname VARCHAR(50) NOT NULL,
        email VARCHAR(100),
        avatar VARCHAR(10) DEFAULT '👤',
        plan ENUM('free','premium','pro') DEFAULT 'free',
        tokens INT DEFAULT 10,
        language ENUM('ko','zh') DEFAULT 'ko',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    try {
      await conn.query("ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL");
    } catch {
      /* 이미 있음 */
    }
    try {
      await conn.query("ALTER TABLE users MODIFY COLUMN avatar VARCHAR(512)");
    } catch {
      /* 호환 */
    }
    try {
      await conn.query(
        "ALTER TABLE users ADD COLUMN role ENUM('user','admin','master','banned') DEFAULT 'user'"
      );
    } catch {
      /* 이미 있음 */
    }

    // 게시글 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        category VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        tags VARCHAR(500),
        extra_data JSON DEFAULT NULL,
        views INT DEFAULT 0,
        likes INT DEFAULT 0,
        comments_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 댓글 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 북마크 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        target_type ENUM('post','place') NOT NULL,
        target_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE KEY unique_bookmark (user_id, target_type, target_id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // AI 채팅 기록 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        user_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        feedback ENUM('good','bad') DEFAULT NULL,
        feedback_reason VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 가게 신고 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS shop_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        shop_name VARCHAR(100) NOT NULL,
        report_type ENUM('closed','wrong_info','other') NOT NULL,
        detail TEXT,
        status ENUM('pending','resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 유저 추가 가게 정보 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_shops (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        zh_name VARCHAR(100) NOT NULL,
        korean_names VARCHAR(500) NOT NULL,
        category VARCHAR(50),
        district VARCHAR(50),
        description TEXT,
        recommend_menu VARCHAR(500),
        price_range VARCHAR(100),
        tip TEXT,
        korean_available BOOLEAN DEFAULT false,
        rating TINYINT DEFAULT 0,
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 일일 질문 횟수 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS daily_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        usage_date DATE NOT NULL,
        question_count INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE KEY unique_daily (user_id, usage_date)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // posts.images (기존 DB 호환)
    try {
      await conn.query("ALTER TABLE posts ADD COLUMN images TEXT DEFAULT NULL");
    } catch {
      /* 이미 있음 */
    }

    try {
      await conn.query("ALTER TABLE posts ADD COLUMN extra_data JSON DEFAULT NULL");
    } catch {
      /* 이미 있음 */
    }
    try {
      await conn.query("ALTER TABLE posts ADD COLUMN report_count INT DEFAULT 0");
    } catch {
      /* 이미 있음 */
    }

    try {
      await conn.query("ALTER TABLE posts MODIFY COLUMN category VARCHAR(50) NOT NULL");
    } catch {
      /* 호환 */
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS promotions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        category ENUM('restaurant','wholesale','realestate','education','medical','trade','beauty') NOT NULL,
        business_name VARCHAR(100) NOT NULL,
        business_name_zh VARCHAR(100),
        address VARCHAR(200),
        phone VARCHAR(50),
        wechat VARCHAR(50),
        description TEXT,
        images TEXT,
        template_data JSON,
        views INT DEFAULT 0,
        status ENUM('active','inactive','pending') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    try {
      await conn.query(
        "ALTER TABLE promotions ADD COLUMN IF NOT EXISTS tags VARCHAR(500) DEFAULT NULL"
      );
    } catch {
      try {
        await conn.query("ALTER TABLE promotions ADD COLUMN tags VARCHAR(500) DEFAULT NULL");
      } catch {
        /* 이미 있음 */
      }
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT 1,
        activity_type ENUM('view_post','view_place','search','ask_ai','bookmark','click_category') NOT NULL,
        category VARCHAR(50),
        keyword VARCHAR(200),
        target_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_date (user_id, created_at)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        top_categories JSON,
        top_keywords JSON,
        last_location VARCHAR(50),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ad_placements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        business_name VARCHAR(100) NOT NULL,
        business_name_zh VARCHAR(100),
        category VARCHAR(50) NOT NULL,
        description TEXT,
        address VARCHAR(200),
        phone VARCHAR(50),
        wechat VARCHAR(50),
        images TEXT,
        ad_type ENUM('card','banner','feed') DEFAULT 'card',
        start_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        registered_by ENUM('admin','business') DEFAULT 'admin',
        views INT DEFAULT 0,
        clicks INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS token_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount INT NOT NULL,
        type ENUM('earn','spend') NOT NULL,
        reason VARCHAR(100) NOT NULL,
        quality_passed BOOLEAN DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 가게 정보 캐시
    await conn.query(`
      CREATE TABLE IF NOT EXISTS shop_cache (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name_zh VARCHAR(200) NOT NULL,
        name_ko VARCHAR(200),
        address VARCHAR(300),
        phone VARCHAR(50),
        rating DECIMAL(2,1),
        cost VARCHAR(50),
        open_time VARCHAR(100),
        category VARCHAR(50),
        district VARCHAR(50),
        lat VARCHAR(20),
        lng VARCHAR(20),
        photo_urls TEXT,
        source ENUM('amap','baidu','naver','serpapi','user') NOT NULL,
        search_keyword VARCHAR(200),
        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name_zh),
        INDEX idx_keyword (search_keyword),
        INDEX idx_cached (cached_at)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    try {
      await conn.query("ALTER TABLE shop_cache ADD COLUMN trust_score INT DEFAULT 50");
    } catch {
      /* 이미 있음 */
    }

    // 리뷰 캐시
    await conn.query(`
      CREATE TABLE IF NOT EXISTS review_cache (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shop_name VARCHAR(200) NOT NULL,
        review_text TEXT NOT NULL,
        reviewer VARCHAR(100),
        rating DECIMAL(2,1),
        review_date VARCHAR(50),
        source ENUM('dianping','xiaohongshu','naver_blog','naver_cafe','zhihu','weibo','meituan','user') NOT NULL,
        source_url TEXT,
        language ENUM('ko','zh','en') DEFAULT 'zh',
        search_keyword VARCHAR(200),
        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_shop (shop_name),
        INDEX idx_source (source),
        INDEX idx_keyword (search_keyword)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    try {
      await conn.query("ALTER TABLE review_cache ADD COLUMN is_verified BOOLEAN DEFAULT FALSE");
    } catch {
      /* 이미 있음 */
    }
    try {
      await conn.query("ALTER TABLE review_cache ADD COLUMN is_reported BOOLEAN DEFAULT FALSE");
    } catch {
      /* 이미 있음 */
    }
    try {
      await conn.query("ALTER TABLE review_cache ADD COLUMN trust_score INT DEFAULT 50");
    } catch {
      /* 이미 있음 */
    }

    // 검색 캐시
    await conn.query(`
      CREATE TABLE IF NOT EXISTS search_cache (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_hash VARCHAR(64) NOT NULL UNIQUE,
        query_text VARCHAR(500) NOT NULL,
        result_summary TEXT,
        shop_ids TEXT,
        review_ids TEXT,
        total_sources INT DEFAULT 0,
        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_hash (query_hash),
        INDEX idx_cached (cached_at)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content LONGTEXT NOT NULL,
        file_type ENUM('pdf','text','manual') DEFAULT 'manual',
        category VARCHAR(50),
        uploaded_by INT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        FULLTEXT idx_content (content)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 테스트 유저 생성
    await conn.query(`
      INSERT IGNORE INTO users (id, nickname, email, avatar, plan, tokens)
      VALUES (1, '김칭다오', 'kim@bababang.com', '👨‍💼', 'premium', 847)
    `);

    return NextResponse.json({ success: true, message: "모든 테이블 생성 완료" });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("DB 초기화 에러:", e);
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  } finally {
    conn.release();
  }
}
