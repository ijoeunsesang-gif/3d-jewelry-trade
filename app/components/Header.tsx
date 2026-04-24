"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, sbAuthFetch, sbFetch, decodeJwt } from "@/lib/supabase-fetch";

const GOLD = "#c9a84c";
const GOLD_LIGHT = "#fdf6e3";
const GOLD_TAB = "#D4AF37";
const TAB_INACTIVE = "rgba(255,255,255,0.72)";

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
  const [isLoading, setIsLoading] = useState(false);
  const [notifDropOpen, setNotifDropOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const desktopMyRef = useRef<HTMLDivElement | null>(null);
  const mobileMyRef = useRef<HTMLDivElement | null>(null);
  const notifWrapRef = useRef<HTMLDivElement | null>(null);

  // 라우트 변경 시 MY 드롭다운 닫기
  useEffect(() => {
    setMyOpen(false);
  }, [pathname]);

  useEffect(() => {
    updateCartCount();
    fetchFavoriteCount();
    fetchMessageCount();
    fetchNotificationCount();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await checkUser();
      } else if (event === "SIGNED_OUT") {
        setUserEmail(""); setNickname(""); setAvatarUrl(""); setIsLoading(false);
      }
    });

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) checkUser();
    };
    window.addEventListener("pageshow", onPageShow);

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
      subscription.unsubscribe();
      window.removeEventListener("pageshow", onPageShow);
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

  const checkUser = async () => {
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as any;
      setUserEmail(payload?.email || "kakao_user");
      const userId = payload?.sub as string;
      const { data: profileArr } = await sbFetch("profiles", `?id=eq.${userId}&select=avatar_url,nickname&limit=1`);
      const profile = (profileArr as any[])?.[0] ?? null;
      setAvatarUrl(profile?.avatar_url || "");
      setNickname(profile?.nickname || "");
    } else {
      setUserEmail("");
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
    const token = getAccessToken();
    if (!token) { setFavoriteCount(0); return; }
    const userId = (decodeJwt(token) as any)?.sub as string;
    const lastViewed = localStorage.getItem("favorites_last_viewed");
    let query = `?select=id&user_id=eq.${userId}`;
    if (lastViewed) query += `&created_at=gt.${lastViewed}`;
    const { data } = await sbAuthFetch("favorites", query);
    setFavoriteCount((data as any[])?.length || 0);
  };

  const fetchMessageCount = async () => {
    const token = getAccessToken();
    if (!token) { setMessageCount(0); return; }
    const myId = (decodeJwt(token) as any)?.sub as string;
    const { data: conversations, error: convError } = await sbAuthFetch("conversations", `?select=id&or=(user1_id.eq.${myId},user2_id.eq.${myId})`);
    if (convError) { setMessageCount(0); return; }
    const conversationIds = ((conversations || []) as { id: string }[]).map((item) => item.id);
    if (conversationIds.length === 0) { setMessageCount(0); return; }
    const { data: unread, error: msgError } = await sbAuthFetch("messages", `?select=id&conversation_id=in.(${conversationIds.join(',')})&sender_id=neq.${myId}&is_read=eq.false`);
    if (msgError) { setMessageCount(0); return; }
    setMessageCount((unread as any[])?.length || 0);
  };

  const fetchNotificationCount = async () => {
    const token = getAccessToken();
    if (!token) { setNotificationCount(0); return; }
    const userId = (decodeJwt(token) as any)?.sub as string;
    const { data, error } = await sbAuthFetch("notifications", `?select=id&user_id=eq.${userId}&is_read=eq.false`);
    if (error) { setNotificationCount(0); return; }
    setNotificationCount((data as any[])?.length || 0);
  };

  const fetchNotifPreview = async () => {
    const token = getAccessToken();
    if (!token) return;
    const userId = (decodeJwt(token) as any)?.sub as string;
    setNotifLoading(true);
    try {
      const { data } = await sbAuthFetch(
        "notifications",
        `?user_id=eq.${userId}&select=id,link,is_read,created_at,type,message&order=created_at.desc&limit=5`
      );
      setNotifItems((data as any[]) || []);
    } catch {
      setNotifItems([]);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        }
      });
    } catch (e) {}
    localStorage.clear();
    location.href = '/';
  };

  const isMyPage = ["/profile", "/my-models", "/upload", "/sales"].some((p) => pathname.startsWith(p));

  /* ── 알림 호버 드롭다운 ──────────────────────────────────── */
  const getNotifText = (item: any): string => {
    if (item.message) return item.message;
    switch (item.type) {
      case "follow":   return "새로운 팔로워가 생겼습니다";
      case "message":  return "새 메시지가 도착했습니다";
      case "purchase": return "구매가 완료되었습니다";
      case "comment":  return "새 댓글이 달렸습니다";
      default:         return item.link ? `알림: ${item.link}` : "새로운 알림이 있습니다";
    }
  };

  const NotifDropdown = () => (
    <div style={{
      position: "absolute", top: "100%", right: 0, marginTop: 4,
      width: 320, background: "white", borderRadius: 16,
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      border: "1px solid #e5e7eb", zIndex: 1000,
      padding: "8px 0",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px", borderBottom: "1px solid #f3f4f6",
      }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>알림</span>
        <Link href="/notifications" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>
          전체보기
        </Link>
      </div>

      {/* 콘텐츠 */}
      {notifLoading ? (
        <div style={{ padding: "16px", color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
          불러오는 중...
        </div>
      ) : notifItems.length === 0 ? (
        <div style={{ padding: 20, color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
          새로운 알림이 없습니다
        </div>
      ) : (
        notifItems.map((item) => (
          <a
            key={item.id}
            href={item.link || "/notifications"}
            style={{
              display: "block", padding: "10px 16px",
              textDecoration: "none", color: "inherit",
              background: item.is_read ? "white" : "#fffbeb",
              opacity: item.is_read ? 0.6 : 1,
              borderLeft: item.is_read ? "3px solid transparent" : "3px solid #f59e0b",
              borderBottom: "1px solid #f8fafc",
            }}
          >
            <div style={{
              fontSize: 13, fontWeight: item.is_read ? 400 : 700, color: "#111827",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {getNotifText(item)}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
              {new Date(item.created_at).toLocaleString("ko-KR")}
            </div>
          </a>
        ))
      )}
    </div>
  );

  /* ── MY 드롭다운 (데스크탑·모바일 공용) ──────────────────── */
  const MyDropdown = () => (
    <div style={{
      position: "absolute", right: 0, top: "100%",
      paddingTop: 8, zIndex: 200,
    }}>
      <div style={{
        width: 228, borderRadius: 16, background: "white",
        border: "1px solid #f0ead8",
        boxShadow: "0 8px 40px rgba(15,23,42,0.10)",
        overflow: "hidden",
      }}>
        {/* 프로필 헤더 */}
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

        {/* 섹션 1: 프로필 / 모델 / 업로드 */}
        <MyMenuLink href="/profile"   icon={<IconDropUser   active={pathname.startsWith("/profile")}   />} onClick={() => setMyOpen(false)} active={pathname.startsWith("/profile")}>내 정보</MyMenuLink>
        <MyMenuLink href="/my-models" icon={<IconDropBox    active={pathname.startsWith("/my-models")} />} onClick={() => setMyOpen(false)} active={pathname.startsWith("/my-models")}>내 모델</MyMenuLink>
        <MyMenuLink href="/upload"    icon={<IconDropUpload active={pathname.startsWith("/upload")}    />} onClick={() => setMyOpen(false)} active={pathname.startsWith("/upload")}>업로드</MyMenuLink>

        <div style={{ height: 1, background: "#f0ead8", margin: "4px 0" }} />

        {/* 섹션 2: 다운로드 / 찜 / 장바구니 */}
        <MyMenuLink href="/library"   icon={<IconDropDownload active={pathname.startsWith("/library")}   />} onClick={() => setMyOpen(false)} active={pathname.startsWith("/library")}>내 다운로드</MyMenuLink>
        <MyMenuLink href="/favorites" icon={<IconDropHeart   active={pathname.startsWith("/favorites")} />} onClick={() => setMyOpen(false)} active={pathname.startsWith("/favorites")}>찜</MyMenuLink>
        <MyMenuLink href="/cart"      icon={<IconDropCart    active={pathname.startsWith("/cart")}      />} onClick={() => setMyOpen(false)} active={pathname.startsWith("/cart")}>장바구니</MyMenuLink>

        <div style={{ height: 1, background: "#f0ead8", margin: "4px 0" }} />

        {/* 섹션 3: 문의 / 고객센터 / 도움말 */}
        <MyMenuLink href="/messages"        icon={<IconDropMail       active={pathname.startsWith("/messages")}        />} onClick={() => setMyOpen(false)} active={pathname.startsWith("/messages")}>문의함</MyMenuLink>
        <MyMenuLink href="/commission"      icon={<IconDropClipboard  active={pathname.startsWith("/commission")}      />} onClick={() => setMyOpen(false)} active={pathname.startsWith("/commission")}>모델링 의뢰</MyMenuLink>
        <MyMenuLink href="/customer-service" icon={<IconDropHeadphones active={pathname.startsWith("/customer-service")} />} onClick={() => setMyOpen(false)} active={pathname.startsWith("/customer-service")}>고객센터</MyMenuLink>
        <MyMenuLink href="/help"            icon={<IconDropHelp       active={pathname.startsWith("/help")}            />} onClick={() => setMyOpen(false)} active={pathname.startsWith("/help")}>도움말</MyMenuLink>

        <div style={{ height: 1, background: "#f0ead8", margin: "4px 0" }} />

        {/* 로그아웃 */}
        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: "100%", height: 42, border: "none",
            background: "white", display: "flex", alignItems: "center",
            gap: 8, padding: "0 16px",
            color: "#b45309", fontWeight: 700, fontSize: 13,
            cursor: "pointer", letterSpacing: "-0.01em",
          }}
          className="header-logout-btn"
        >
          <IconDropLogout />
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
              <NavItem href="/commission" label="의뢰" icon={<IconClipboard />} active={pathname.startsWith("/commission")} />
              <NavItem href="/customer-service" label="고객센터" icon={<IconHeadphones />} active={pathname === "/customer-service"} />
              <NavItem href="/help" label="도움말" icon={<IconHelp />} active={pathname === "/help"} />
              <div
                ref={notifWrapRef}
                style={{ position: "relative" }}
                onMouseEnter={() => {
                  setNotifDropOpen(true);
                  if (userEmail && notifItems.length === 0) fetchNotifPreview();
                }}
                onMouseLeave={() => setNotifDropOpen(false)}
              >
                <NavItem href="/notifications" label="알림" icon={<IconBell />} active={pathname === "/notifications"} badge={notificationCount} />
                {notifDropOpen && userEmail && <NotifDropdown />}
              </div>

              <div style={{ width: 1, height: 22, background: "#e8dfc8", margin: "0 10px" }} />

              {isLoading ? (
                <div style={{ width: 72, height: 36, borderRadius: 8, background: "#f3f4f6" }} />
              ) : userEmail ? (
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

              {/* 고객센터 아이콘 */}
              <Link href="/customer-service" style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                width: 44, borderRadius: 10, textDecoration: "none", flexShrink: 0,
                padding: "4px 0",
              }}>
                <IconHeadphones active={pathname === "/customer-service"} size={28} />
                <span style={{ fontSize: 10, color: pathname === "/customer-service" ? GOLD : "#5a5a5a", lineHeight: 1, marginTop: 2 }}>고객센터</span>
              </Link>

              {/* 알림 아이콘 */}
              <Link href="/notifications" style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                width: 44, borderRadius: 10, textDecoration: "none", flexShrink: 0,
                padding: "4px 0",
              }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconBell active={pathname === "/notifications"} size={28} />
                  {notificationCount > 0 && (
                    <span style={{
                      position: "absolute", top: -2, right: -6,
                      minWidth: 16, height: 16, padding: "0 3px",
                      borderRadius: 999, background: GOLD, color: "white",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 800, lineHeight: 1, pointerEvents: "none",
                    }}>
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, color: pathname === "/notifications" ? GOLD : "#5a5a5a", lineHeight: 1, marginTop: 2 }}>알람</span>
              </Link>

              {/* MY 버튼 또는 로그인 */}
              {isLoading ? (
                <div style={{ width: 60, height: 34, borderRadius: 8, background: "#f3f4f6", margin: "0 4px" }} />
              ) : userEmail ? (
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
          icon={<IconHeart active={pathname === "/favorites"} size={28} inactiveColor={TAB_INACTIVE} activeColor={GOLD_TAB} />}
          label="찜"
          badge={favoriteCount}
          active={pathname === "/favorites"}
        />
        <BottomTabItem
          href="/cart"
          icon={<IconCart active={pathname === "/cart"} size={28} inactiveColor={TAB_INACTIVE} activeColor={GOLD_TAB} />}
          label="장바구니"
          badge={cartCount}
          active={pathname === "/cart"}
        />
        <BottomTabItem
          href="/library"
          icon={<IconDownload active={pathname === "/library"} size={28} inactiveColor={TAB_INACTIVE} activeColor={GOLD_TAB} />}
          label="내 다운로드"
          active={pathname === "/library"}
        />
        <BottomTabItem
          href="/messages"
          icon={<IconMail active={pathname === "/messages"} size={28} inactiveColor={TAB_INACTIVE} activeColor={GOLD_TAB} />}
          label="문의함"
          badge={messageCount}
          active={pathname === "/messages"}
        />
        <BottomTabItem
          href="/commission"
          icon={<IconClipboard active={pathname.startsWith("/commission")} size={28} inactiveColor={TAB_INACTIVE} activeColor={GOLD_TAB} />}
          label="의뢰"
          active={pathname.startsWith("/commission")}
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
        flex: "1 1 0%", minWidth: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 3, position: "relative", textDecoration: "none",
        paddingTop: 4, overflow: "hidden",
        borderTop: active ? `3px solid ${GOLD_TAB}` : "3px solid transparent",
      }}
    >
      {icon}
      <span style={{
        fontSize: 11, fontWeight: 800,
        color: active ? GOLD_TAB : TAB_INACTIVE,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {label}
      </span>
      {typeof badge === "number" && badge > 0 && (
        <span style={{
          position: "absolute", top: 4,
          left: "calc(50% + 8px)",
          minWidth: 17, height: 17, padding: "0 3px",
          borderRadius: 999, background: GOLD_TAB, color: "#0f172a",
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
function MyMenuLink({ href, children, onClick, active, icon }: {
  href: string; children: React.ReactNode; onClick?: () => void; active?: boolean; icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, height: 40,
        padding: "0 16px", textDecoration: "none",
        color: active ? GOLD : "#374151",
        fontWeight: active ? 700 : 600, fontSize: 13,
        borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
        background: active ? GOLD_LIGHT : "white",
        letterSpacing: "-0.01em",
      }}
      className="header-dropdown-item"
    >
      {icon && <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>}
      {children}
    </Link>
  );
}

/* ── SVG 아이콘 ────────────────────────────────────────── */
function svgProps(active: boolean, size = 22, inactiveColor = "#5a5a5a", activeColor = GOLD) {
  return {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: active ? activeColor : inactiveColor,
    strokeWidth: active ? 2 : 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function IconHome({ active = false, size = 22, inactiveColor = "#5a5a5a", activeColor = GOLD }: { active?: boolean; size?: number; inactiveColor?: string; activeColor?: string }) {
  return <svg {...svgProps(active, size, inactiveColor, activeColor)}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></svg>;
}
function IconHeart({ active = false, size = 22, inactiveColor = "#5a5a5a", activeColor = GOLD }: { active?: boolean; size?: number; inactiveColor?: string; activeColor?: string }) {
  return <svg {...svgProps(active, size, inactiveColor, activeColor)}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
}
function IconCart({ active = false, size = 22, inactiveColor = "#5a5a5a", activeColor = GOLD }: { active?: boolean; size?: number; inactiveColor?: string; activeColor?: string }) {
  return <svg {...svgProps(active, size, inactiveColor, activeColor)}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
}
function IconDownload({ active = false, size = 22, inactiveColor = "#5a5a5a", activeColor = GOLD }: { active?: boolean; size?: number; inactiveColor?: string; activeColor?: string }) {
  return <svg {...svgProps(active, size, inactiveColor, activeColor)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
}
function IconMail({ active = false, size = 22, inactiveColor = "#5a5a5a", activeColor = GOLD }: { active?: boolean; size?: number; inactiveColor?: string; activeColor?: string }) {
  return <svg {...svgProps(active, size, inactiveColor, activeColor)}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>;
}
function IconBell({ active = false, size = 22, inactiveColor = "#5a5a5a", activeColor = GOLD }: { active?: boolean; size?: number; inactiveColor?: string; activeColor?: string }) {
  return <svg {...svgProps(active, size, inactiveColor, activeColor)}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
}
function IconHeadphones({ active = false, size = 22, inactiveColor = "#5a5a5a", activeColor = GOLD }: { active?: boolean; size?: number; inactiveColor?: string; activeColor?: string }) {
  return <svg {...svgProps(active, size, inactiveColor, activeColor)}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" /><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>;
}
function IconHelp({ active = false, size = 22, inactiveColor = "#5a5a5a", activeColor = GOLD }: { active?: boolean; size?: number; inactiveColor?: string; activeColor?: string }) {
  return <svg {...svgProps(active, size, inactiveColor, activeColor)}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" /></svg>;
}
function IconUser({ active = false }: { active?: boolean }) {
  return <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={active ? GOLD : "#b0a89a"} strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}

/* ── 드롭다운 전용 소형 아이콘 (15×15) ─────────────────── */
function dropSvg(active: boolean) {
  return { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: active ? GOLD : "#9ca3af", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
}
function IconDropUser({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function IconDropBox({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>;
}
function IconDropUpload({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
}
function IconDropDownload({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
}
function IconDropChart({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
}
function IconDropHeart({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
}
function IconDropCart({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
}
function IconDropMail({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>;
}
function IconDropHeadphones({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" /><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>;
}
function IconDropHelp({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" /></svg>;
}
function IconDropLogout() {
  return <svg {...dropSvg(false)} stroke="#b45309"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
}
function IconClipboard({ active = false, size = 22, inactiveColor = "#5a5a5a", activeColor = GOLD }: { active?: boolean; size?: number; inactiveColor?: string; activeColor?: string }) {
  return <svg {...svgProps(active, size, inactiveColor, activeColor)}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="15" y2="16" /></svg>;
}
function IconDropClipboard({ active = false }: { active?: boolean }) {
  return <svg {...dropSvg(active)}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="15" y2="16" /></svg>;
}
