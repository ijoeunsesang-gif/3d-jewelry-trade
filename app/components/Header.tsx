"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const GOLD = "#c9a84c";
const GOLD_LIGHT = "#fdf6e3";

export default function Header() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [myOpen, setMyOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const desktopMyRef = useRef<HTMLDivElement | null>(null);
  const mobileMyRef = useRef<HTMLDivElement | null>(null);

  // 라우트 변경 시 MY 드롭다운 닫기
  useEffect(() => {
    setMyOpen(false);
  }, [pathname]);

  useEffect(() => {
    initHeader();

    const onStorage = () => updateCartCount();
    const onCartUpdated = () => updateCartCount();
    const onFavoritesUpdated = () => fetchFavoriteCount();
    const onMessagesUpdated = () => fetchMessageCount();
    const onNotificationsUpdated = () => fetchNotificationCount();
    const onCartReset = () => setCartCount(0);
    const onNotificationsReset = () => setNotificationCount(0);

    window.addEventListener("storage", onStorage);
    window.addEventListener("cart-updated", onCartUpdated);
    window.addEventListener("favorites-updated", onFavoritesUpdated);
    window.addEventListener("messages-updated", onMessagesUpdated);
    window.addEventListener("notifications-updated", onNotificationsUpdated);
    window.addEventListener("cart-reset", onCartReset);
    window.addEventListener("notifications-reset", onNotificationsReset);

    const onDocClick = (e: MouseEvent) => {
      const inDesktop = desktopMyRef.current?.contains(e.target as Node);
      const inMobile = mobileMyRef.current?.contains(e.target as Node);
      if (!inDesktop && !inMobile) setMyOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cart-updated", onCartUpdated);
      window.removeEventListener("favorites-updated", onFavoritesUpdated);
      window.removeEventListener("messages-updated", onMessagesUpdated);
      window.removeEventListener("notifications-updated", onNotificationsUpdated);
      window.removeEventListener("cart-reset", onCartReset);
      window.removeEventListener("notifications-reset", onNotificationsReset);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, []);

  const initHeader = async () => {
    await checkUser();
    updateCartCount();
    await fetchFavoriteCount();
    await fetchMessageCount();
    await fetchNotificationCount();
  };

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    setUserEmail(user?.email || "");
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles").select("avatar_url, nickname").eq("id", user.id).maybeSingle();
      setAvatarUrl(profile?.avatar_url || "");
      setNickname(profile?.nickname || "");
    } else {
      setAvatarUrl("");
      setNickname("");
    }
  };

  const updateCartCount = () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("cart");
    if (!raw) { setCartCount(0); return; }
    try {
      const cart = JSON.parse(raw);
      setCartCount(Array.isArray(cart) ? cart.length : 0);
    } catch { setCartCount(0); }
  };

  const fetchFavoriteCount = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setFavoriteCount(0); return; }
    const lastViewed = localStorage.getItem("favorites_last_viewed");
    let query = supabase.from("favorites").select("*", { count: "exact", head: true }).eq("user_id", session.user.id);
    if (lastViewed) query = query.gt("created_at", lastViewed);
    const { count } = await query;
    setFavoriteCount(count || 0);
  };

  const fetchMessageCount = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setMessageCount(0); return; }
    const myId = session.user.id;
    const { data: conversations, error: convError } = await supabase
      .from("conversations").select("id").or(`user1_id.eq.${myId},user2_id.eq.${myId}`);
    if (convError) { setMessageCount(0); return; }
    const conversationIds = (conversations || []).map((item: { id: string }) => item.id);
    if (conversationIds.length === 0) { setMessageCount(0); return; }
    const { count, error: msgError } = await supabase
      .from("messages").select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds).neq("sender_id", myId).eq("is_read", false);
    if (msgError) { setMessageCount(0); return; }
    setMessageCount(count || 0);
  };

  const fetchNotificationCount = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setNotificationCount(0); return; }
    const { count, error } = await supabase
      .from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id).eq("is_read", false);
    if (error) { setNotificationCount(0); return; }
    setNotificationCount(count || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("cart");
    window.dispatchEvent(new Event("cart-updated"));
    window.dispatchEvent(new Event("favorites-updated"));
    window.dispatchEvent(new Event("messages-updated"));
    window.dispatchEvent(new Event("notifications-updated"));
    location.href = "/";
  };

  const isMyPage = ["/profile", "/my-models", "/upload", "/sales"].some((p) => pathname.startsWith(p));

  /* ── MY 드롭다운 (데스크탑·모바일 공용) ──────────────────── */
  const MyDropdown = () => (
    <div style={{
      position: "absolute", right: 0, top: "100%",
      paddingTop: 8, zIndex: 200,
    }}>
      <div style={{
        width: 220, borderRadius: 16, background: "white",
        border: "1px solid #f0ead8",
        boxShadow: "0 8px 40px rgba(15,23,42,0.10)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #f0ead8", display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={avatarUrl || "/default-avatar.png"} alt="me"
            style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: `2px solid ${GOLD}`, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: "#111827", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nickname || "사용자"}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userEmail}
            </div>
          </div>
        </div>

        {[
          { href: "/profile", label: "내 프로필" },
          { href: "/my-models", label: "내 모델" },
          { href: "/upload", label: "업로드" },
          { href: "/sales", label: "판매 통계" },
        ].map(({ href, label }) => (
          <MyMenuLink key={href} href={href} onClick={() => setMyOpen(false)} active={pathname.startsWith(href)}>
            {label}
          </MyMenuLink>
        ))}

        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: "100%", height: 44, border: "none",
            borderTop: "1px solid #f5f1e8", background: "white",
            color: "#b45309", fontWeight: 700, fontSize: 13,
            cursor: "pointer", letterSpacing: "-0.01em",
          }}
          className="header-logout-btn"
        >
          로그아웃
        </button>
      </div>
    </div>
  );

  /* ── MY 버튼 내용 (아바타 + MY 텍스트) ───────────────────── */
  const MyButtonInner = () => (
    <>
      {avatarUrl ? (
        <img
          src={avatarUrl} alt="프로필"
          style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: `2px solid ${isMyPage || myOpen ? GOLD : "#d4c49a"}` }}
        />
      ) : (
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          border: `2px solid ${isMyPage || myOpen ? GOLD : "#d4c49a"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isMyPage || myOpen ? GOLD_LIGHT : "white",
        }}>
          <IconUser active={isMyPage || myOpen} />
        </div>
      )}
      <span style={{ fontSize: 11, fontWeight: 700, color: isMyPage || myOpen ? GOLD : "#9ca3af", letterSpacing: "0.02em" }}>MY</span>
    </>
  );

  return (
    <>
      <header style={{ borderBottom: "1px solid #f0ead8", background: "white", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{
          maxWidth: 1240, margin: "0 auto",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>

          {/* ── Row 1: 로고 + 네비 ───────────────────────────── */}
          <div style={{
            height: 68, padding: "0 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>

            {/* 로고 */}
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
              <img src="/logo/logo.png" alt="3D Jewelry Trade" className="header-logo" style={{ height: 56, width: "auto", objectFit: "contain" }} />
            </Link>

            {/* 데스크탑 네비게이션 */}
            <nav className="header-desktop-nav" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <NavItem href="/" label="홈" icon={<IconHome />} active={pathname === "/"} />
              <NavItem href="/favorites" label="찜" icon={<IconHeart />} active={pathname === "/favorites"} badge={favoriteCount} />
              <NavItem href="/cart" label="장바구니" icon={<IconCart />} active={pathname === "/cart"} badge={cartCount} />
              <NavItem href="/library" label="내 다운로드" icon={<IconDownload />} active={pathname === "/library"} />
              <NavItem href="/messages" label="문의함" icon={<IconMail />} active={pathname === "/messages"} badge={messageCount} />
              <NavItem href="/notifications" label="알림" icon={<IconBell />} active={pathname === "/notifications"} badge={notificationCount} />

              <div style={{ width: 1, height: 22, background: "#e8dfc8", margin: "0 10px" }} />

              {userEmail ? (
                <div
                  ref={desktopMyRef}
                  style={{ position: "relative" }}
                  onMouseEnter={() => setMyOpen(true)}
                  onMouseLeave={() => setMyOpen(false)}
                >
                  <button
                    type="button"
                    style={{
                      display: "inline-flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 3, padding: "6px 10px",
                      background: "none", border: "none", cursor: "pointer", borderRadius: 10,
                    }}
                    className="header-my-btn-new"
                  >
                    <MyButtonInner />
                  </button>
                  {myOpen && <MyDropdown />}
                </div>
              ) : (
                <Link href="/auth" style={{
                  display: "inline-flex", alignItems: "center", height: 36,
                  padding: "0 18px", borderRadius: 8,
                  background: GOLD, color: "white",
                  textDecoration: "none", fontSize: 13, fontWeight: 700,
                  letterSpacing: "0.01em",
                }}>
                  로그인
                </Link>
              )}
            </nav>

            {/* 모바일 Row1 우측: 홈 + 알림 + MY */}
            <div className="header-mobile-my" style={{ display: "none", alignItems: "center", gap: 0 }}>
              {/* 홈 아이콘 */}
              <Link href="/" style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 44, height: 44, borderRadius: 10, textDecoration: "none", flexShrink: 0,
              }}>
                <IconHome active={pathname === "/"} size={28} />
              </Link>

              {/* 알림 아이콘 */}
              <div style={{
                position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                width: 44, height: 44, flexShrink: 0,
              }}>
                <Link href="/notifications" style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 44, height: 44, borderRadius: 10, textDecoration: "none",
                }}>
                  <IconBell active={pathname === "/notifications"} size={28} />
                </Link>
                {notificationCount > 0 && (
                  <span style={{
                    position: "absolute", top: 6, right: 4,
                    minWidth: 16, height: 16, padding: "0 3px",
                    borderRadius: 999, background: GOLD, color: "white",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 800, lineHeight: 1, pointerEvents: "none",
                  }}>
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </div>

              {/* MY 버튼 또는 로그인 */}
              {userEmail ? (
                <div ref={mobileMyRef} style={{
                  position: "relative", display: "flex", alignItems: "center",
                }}>
                  <button
                    type="button"
                    onClick={() => setMyOpen((prev) => !prev)}
                    style={{
                      display: "inline-flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 2, padding: "6px 10px",
                      background: "none", border: "none", cursor: "pointer", borderRadius: 10,
                    }}
                    className="header-my-btn-new"
                  >
                    <MyButtonInner />
                  </button>
                  {myOpen && <MyDropdown />}
                </div>
              ) : (
                <Link href="/auth" style={{
                  display: "inline-flex", alignItems: "center", height: 34,
                  padding: "0 14px", borderRadius: 8,
                  background: GOLD, color: "white",
                  textDecoration: "none", fontSize: 13, fontWeight: 700,
                }}>
                  로그인
                </Link>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* ── 모바일 하단 탭 네비게이션 ─────────────────────────── */}
      <nav className="mobile-bottom-tab-bar">
        <BottomTabItem
          href="/favorites"
          icon={<IconHeart active={pathname === "/favorites"} size={28} />}
          label="찜"
          badge={favoriteCount}
          active={pathname === "/favorites"}
        />
        <BottomTabItem
          href="/cart"
          icon={<IconCart active={pathname === "/cart"} size={28} />}
          label="장바구니"
          badge={cartCount}
          active={pathname === "/cart"}
        />
        <BottomTabItem
          href="/library"
          icon={<IconDownload active={pathname === "/library"} size={28} />}
          label="내 다운로드"
          active={pathname === "/library"}
        />
        <BottomTabItem
          href="/messages"
          icon={<IconMail active={pathname === "/messages"} size={28} />}
          label="문의함"
          badge={messageCount}
          active={pathname === "/messages"}
        />
      </nav>
    </>
  );
}

/* ── 데스크탑 네비 아이템 ─────────────────────────────────── */
function NavItem({ href, label, icon, active, badge }: {
  href: string; label: string; icon: React.ReactNode; active: boolean; badge?: number;
}) {
  return (
    <Link
      href={href}
      style={{
        position: "relative", display: "inline-flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 3,
        padding: "6px 13px", textDecoration: "none",
        borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
        transition: "border-color 0.15s",
      }}
      className={active ? "header-nav-item header-nav-item--active" : "header-nav-item"}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: active ? GOLD : "#4b5563", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {typeof badge === "number" && badge > 0 && (
        <span style={{
          position: "absolute", top: 2, right: 6,
          minWidth: 18, height: 18, padding: "0 4px",
          borderRadius: 999, background: GOLD, color: "white",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, lineHeight: 1,
        }}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

/* ── 하단 탭 바 아이템 ────────────────────────────────────── */
function BottomTabItem({ href, icon, label, active, badge }: {
  href: string; icon: React.ReactNode; label: string; active: boolean; badge?: number;
}) {
  return (
    <Link
      href={href}
      style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 5, position: "relative", textDecoration: "none",
        paddingTop: 4,
        borderTop: active ? `3px solid ${GOLD}` : "3px solid transparent",
      }}
    >
      {icon}
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: active ? GOLD : "#6b7280",
        letterSpacing: "-0.01em",
      }}>
        {label}
      </span>
      {typeof badge === "number" && badge > 0 && (
        <span style={{
          position: "absolute", top: 4,
          left: "calc(50% + 8px)",
          minWidth: 17, height: 17, padding: "0 3px",
          borderRadius: 999, background: GOLD, color: "white",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, lineHeight: 1,
        }}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

/* ── 드롭다운 메뉴 링크 ────────────────────────────────── */
function MyMenuLink({ href, children, onClick, active }: {
  href: string; children: React.ReactNode; onClick?: () => void; active?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", height: 44,
        padding: "0 16px", textDecoration: "none",
        color: active ? GOLD : "#374151",
        fontWeight: active ? 700 : 600, fontSize: 13,
        borderBottom: "1px solid #faf8f3",
        borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
        background: active ? GOLD_LIGHT : "white",
        letterSpacing: "-0.01em",
      }}
      className="header-dropdown-item"
    >
      {children}
    </Link>
  );
}

/* ── SVG 아이콘 ────────────────────────────────────────── */
function svgProps(active: boolean, size = 22) {
  return {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: active ? GOLD : "#5a5a5a",
    strokeWidth: active ? 2 : 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function IconHome({ active = false, size = 22 }: { active?: boolean; size?: number }) {
  return <svg {...svgProps(active, size)}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></svg>;
}
function IconHeart({ active = false, size = 22 }: { active?: boolean; size?: number }) {
  return <svg {...svgProps(active, size)}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
}
function IconCart({ active = false, size = 22 }: { active?: boolean; size?: number }) {
  return <svg {...svgProps(active, size)}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
}
function IconDownload({ active = false, size = 22 }: { active?: boolean; size?: number }) {
  return <svg {...svgProps(active, size)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
}
function IconMail({ active = false, size = 22 }: { active?: boolean; size?: number }) {
  return <svg {...svgProps(active, size)}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>;
}
function IconBell({ active = false, size = 22 }: { active?: boolean; size?: number }) {
  return <svg {...svgProps(active, size)}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
}
function IconUser({ active = false }: { active?: boolean }) {
  return <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={active ? GOLD : "#b0a89a"} strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
