const API_BASE = "http://localhost:8000";

function ensureAdmin() {
  const role = localStorage.getItem("user_role");
  const isAdmin = localStorage.getItem("is_admin");
  if (role !== "admin" || isAdmin !== "true") {
    alert("관리자만 접근할 수 있습니다.");
    window.location.href = "admin_login.html";
  }
}

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    user_id: params.get("user_id"),
    match_id: params.get("match_id"),
  };
}

async function loadCancelHistory() {
  ensureAdmin();

  const { user_id, match_id } = getQueryParams();
  if (!user_id || !match_id) {
    alert("user_id와 match_id가 필요합니다.");
    window.location.href = "admin.html";
    return;
  }

  const titleEl = document.getElementById("title");
  titleEl.textContent = `사용자 ${user_id}, 경기 ${match_id} 취소 이력`;

  try {
    const res = await fetch(
      `${API_BASE}/api/admin/cancel-history/?user_id=${user_id}&match_id=${match_id}`
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("cancel-history 응답 오류:", res.status, text);
      alert("취소 이력을 불러오지 못했습니다.");
      return;
    }

    const data = await res.json();
    const tbody = document.getElementById("history-tbody");
    const emptyMsg = document.getElementById("empty-msg");
    tbody.innerHTML = "";

    if (!data.length) {
      emptyMsg.style.display = "block";
      return;
    }
    emptyMsg.style.display = "none";

    data.forEach((item) => {
      const tr = document.createElement("tr");

      const seatLabel = `${item.block}블록 ${item.row_no}열 ${item.seat_number}번`;
      const matchLabel = `${item.match_date} @ ${item.stadium}`;

      tr.innerHTML = `
        <td>${item.cancel_id}</td>
        <td>${item.cancel_date}</td>
        <td>${matchLabel}</td>
        <td>${seatLabel} (${item.grade})</td>
        <td>${item.price}원</td>
        <td>${item.res_id}</td>
        <td>${item.res_date}</td>
        <td>${item.status}</td>
        <td>${item.reason || ""}</td>
      `;

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("취소 이력을 불러오는 중 오류가 발생했습니다.");
  }
}

document.addEventListener("DOMContentLoaded", loadCancelHistory);
