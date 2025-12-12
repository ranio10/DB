const API_BASE = "http://localhost:8000";

// 0. 관리자 로그인 여부 체크
function ensureAdmin() {
  const adminId = localStorage.getItem("admin_id");
  const adminEmail = localStorage.getItem("admin_email");
  const infoEl = document.getElementById("admin-info");

  if (!adminId) {
    if (infoEl) infoEl.textContent = "관리자 로그인이 필요합니다.";
    alert("관리자 로그인이 필요합니다.");
    window.location.href = "login_admin.html"; // 네가 쓰는 관리자 로그인 페이지 이름으로!
    return false;
  }

  if (infoEl) infoEl.textContent = `관리자 (${adminEmail})`;
  return true;
}

// 1. 경기별 통계 불러오기
async function loadMatchStats() {
  const tbody = document.getElementById("stats-tbody");
  const emptyMsg = document.getElementById("stats-empty");

  try {
    const res = await fetch(`${API_BASE}/api/admin/match-stats/`);
    if (!res.ok) {
      console.error("match-stats 응답 오류:", res.status);
      emptyMsg.style.display = "block";
      return;
    }

    const data = await res.json();
    tbody.innerHTML = "";

    if (!data.length) {
      emptyMsg.style.display = "block";
      return;
    }
    emptyMsg.style.display = "none";

    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.match_id}</td>
        <td>${item.match_date}</td>
        <td>${item.stadium}</td>
        <td>${item.total_seats}</td>
        <td>${item.seat_count}</td>
        <td>${item.reserved_seats}</td>
        <td>${item.occupancy_rate}</td>
        <td>${item.total_sales}</td>
        <td>${item.reservation_count}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("경기 통계 로딩 에러:", err);
    emptyMsg.style.display = "block";
  }
}

// 2. 이상 예매 / 과도한 취소 사용자 목록
async function loadAbuseCandidates() {
  const tbody = document.getElementById("abuse-tbody");
  const emptyMsg = document.getElementById("abuse-empty");

  try {
    const res = await fetch(`${API_BASE}/api/admin/abuse/`);
    if (!res.ok) {
      console.error("abuse 응답 오류:", res.status);
      emptyMsg.style.display = "block";
      return;
    }

    const data = await res.json();
    tbody.innerHTML = "";

    if (!data.length) {
      emptyMsg.style.display = "block";
      return;
    }
    emptyMsg.style.display = "none";

    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.user_id}</td>
        <td>${item.res_id ?? "-"}</td>
        <td>${item.cancel_count}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("이상 예매 로딩 에러:", err);
    emptyMsg.style.display = "block";
  }
}

// 3. 취소 이력 전체 목록
async function loadCancelHistory() {
  const tbody = document.getElementById("cancel-tbody");
  const emptyMsg = document.getElementById("cancel-empty");

  try {
    const res = await fetch(`${API_BASE}/api/admin/cancel-history/`);
    if (!res.ok) {
      console.error("cancel-history 응답 오류:", res.status);
      emptyMsg.style.display = "block";
      return;
    }

    const data = await res.json();
    tbody.innerHTML = "";

    if (!data.length) {
      emptyMsg.style.display = "block";
      return;
    }
    emptyMsg.style.display = "none";

    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.cancel_id}</td>
        <td>${item.res_id}</td>
        <td>${item.user_id}</td>
        <td>${item.cancel_date}</td>
        <td>${item.reason || "-"}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("취소 이력 로딩 에러:", err);
    emptyMsg.style.display = "block";
  }
}

// 페이지 로드 시 실행
document.addEventListener("DOMContentLoaded", () => {
  if (!ensureAdmin()) return;

  loadMatchStats();
  loadAbuseCandidates();
  loadCancelHistory();
});
