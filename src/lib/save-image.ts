// 이미지 저장 — 환경별 최적 경로.
// 모바일/웹뷰(WKWebView): Web Share(파일)로 공유 시트 → "사진에 저장"
// 데스크탑: <a download>
// 최후: 새 탭으로 열어 길게 눌러 저장
// 반환: "shared" | "cancelled" | "downloaded" | "opened"
export async function saveImage(url: string | null | undefined, filename: string): Promise<string> {
  if (!url) throw new Error("원본을 불러올 수 없어요");
  const res = await fetch(url);
  if (!res.ok) throw new Error("이미지를 가져오지 못했어요");
  const blob = await res.blob();

  // 1) Web Share with file (모바일/웹뷰 → 사진 앱 저장 가능)
  try {
    const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file] });
      return "shared";
    }
  } catch (e: any) {
    if (e?.name === "AbortError") return "cancelled"; // 사용자가 공유 취소
    // 그 외엔 아래 폴백 진행
  }

  // 2) 데스크탑 브라우저 — 다운로드
  try {
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
    return "downloaded";
  } catch {
    // 3) 최후 — 새 탭
    window.open(url, "_blank");
    return "opened";
  }
}
