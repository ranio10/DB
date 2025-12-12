const API_BASE = "http://localhost:8000";

// 로그인 여부 확인 + 상단 문구 세팅
function ensureLogin() {
  const userId = localStorage.getItem("user_id");
  const userName = localStorage.getItem("user_name");
  const userInfoEl = document.getElementById("user-info");

  if (!userId) {
    if (userInfoEl) {
      userInfoEl.textContent = "로그인이 필요합니다.";
    }
    alert("로그인이 필요합니다. 메인 화면으로 이동합니다.");
    window.location.href = "index.html";
    return false;
  }

  if (userInfoEl) {
    userInfoEl.textContent = `${userName}님 마이페이지`;
  }
  return true;
}

// 내 예매 내역 불러오기
async function loadMyReservations() {
  if (!ensureLogin()) return;

  const userId = localStorage.getItem("user_id");
  const tbody = document.getElementById("my-res-tbody");
  const emptyMsg = document.getElementById("my-res-empty");

  try {
    const res = await fetch(
      `${API_BASE}/api/my/reservations/?user_id=${encodeURIComponent(userId)}`
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("내 예매 내역 응답 오류:", res.status, text);
      alert("예매 내역을 불러오지 못했습니다.");
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

      const matchLabel = `${item.match_date} / ${item.stadium} / ${item.home_team} vs ${item.away_team}`;
      const seatLabel = `${item.block}블록 ${item.row_no}열 ${item.seat_number}번 (${item.grade})`;

      // 🔹 여기서 canCancel 정의!
      const canCancel = item.status === "active";

      tr.innerHTML = `
        <td>${item.res_id}</td>
        <td>${matchLabel}</td>
        <td>${seatLabel}</td>
        <td>${item.price}원</td>
        <td>${item.res_date}</td>
        <td>${item.status}</td>
        <td>${item.method || "-"}</td>
        <td>${item.pay_date || "-"}</td>
        <td>
          ${
            canCancel
              ? `<button class="cancel-btn" data-res-id="${item.res_id}">취소</button>`
              : "-"
          }
        </td>
      `;

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("예매 내역 로딩 중 에러:", err);
    alert("예매 내역을 불러오지 못했습니다.");
  }
}

// 예매 취소 요청
async function cancelReservation(resId) {
  const ok = confirm(`예매 번호 ${resId} 를 정말 취소하시겠습니까?`);
  if (!ok) return;

  try {
    const res = await fetch(
      `${API_BASE}/api/reservations/${resId}/cancel/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("취소 실패:", data);
      alert(data.error || "예매 취소 중 오류가 발생했습니다.");
      return;
    }

    alert("예매가 취소되었습니다.");
    // 다시 로딩해서 상태 갱신
    loadMyReservations();
  } catch (err) {
    console.error("취소 요청 중 에러:", err);
    alert("예매 취소 요청에 실패했습니다.");
  }
}

// 취소 버튼 클릭 이벤트 (이벤트 위임)
document.addEventListener("DOMContentLoaded", () => {
  // 페이지 처음 로딩 시 예매 내역 가져오기
  loadMyReservations();

  const tbody = document.getElementById("my-res-tbody");
  tbody.addEventListener("click", (e) => {
    if (e.target.classList.contains("cancel-btn")) {
      const resId = e.target.dataset.resId;
      cancelReservation(resId);
    }
  });
});
