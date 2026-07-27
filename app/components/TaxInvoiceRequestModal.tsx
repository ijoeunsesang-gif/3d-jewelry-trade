"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "@/app/lib/toast";
import { supabase } from "@/app/lib/supabase-browser";

type RequestPayload =
  | { type: "purchase"; orderItemId: string }
  | { type: "commission"; commissionId: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  requestBody: RequestPayload;
};

export default function TaxInvoiceRequestModal({ open, onClose, onSuccess, requestBody }: Props) {
  const [businessName, setBusinessName] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [ceoName, setCeoName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("buyer_business_name, buyer_business_number, buyer_ceo_name, buyer_business_address, buyer_tax_email, email")
        .eq("id", user.id)
        .single();
      if (data) {
        setBusinessName(data.buyer_business_name || "");
        setBusinessNumber(data.buyer_business_number || "");
        setCeoName(data.buyer_ceo_name || "");
        setBusinessAddress(data.buyer_business_address || "");
        setEmail(data.buyer_tax_email || data.email || "");
      }
    })();
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!businessName.trim() || !businessNumber.trim() || !ceoName.trim() || !businessAddress.trim() || !email.trim()) {
      showError("모든 항목을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const token = getAccessToken();
      const res = await fetch("/api/tax-invoice/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...requestBody, businessName, businessNumber, ceoName, businessAddress, email }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "요청 실패"); return; }
      showSuccess("세금계산서 발행을 요청했습니다.");
      onSuccess();
      onClose();
    } catch {
      showError("요청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle: React.CSSProperties = { width: "100%", height: 40, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: 4, fontSize: 12, fontWeight: 700, color: "#374151" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 20, padding: 28, maxWidth: 420, width: "100%", display: "flex", flexDirection: "column", gap: 14, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>세금계산서 발행 요청</h3>
        <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
          입력하신 사업자 정보는 다음 요청 시 자동으로 채워집니다.
        </p>

        <div>
          <label style={labelStyle}>상호명</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="회사명 또는 상호" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>사업자등록번호</label>
          <input value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} placeholder="000-00-00000" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>대표자명</label>
          <input value={ceoName} onChange={(e) => setCeoName(e.target.value)} placeholder="홍길동" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>사업장 주소</label>
          <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="사업장 주소" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>계산서 수신 이메일</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tax@example.com" style={fieldStyle} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button type="button" onClick={handleSubmit} disabled={submitting} style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: submitting ? "#d1d5db" : "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer" }}>
            {submitting ? "요청 중..." : "요청하기"}
          </button>
          <button type="button" onClick={onClose} style={{ height: 44, padding: "0 18px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
