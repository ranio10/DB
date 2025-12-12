const API_BASE = "http://localhost:8000";

function getMatchId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("match_id");
}

function getUserId() {
  return localStorage.getItem("user_id");
}

function formatPrice(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("ko-KR");
}

function seatLabel(s) {
  return `${s.block}블록 ${s.row_no}열 ${s.seat_number}번`;
}

function statusText(s) {
  return s.is_reserved ? "예약됨" : "예약 가능";
}

function sortSeats(seats, mode) {
  const arr = [...seats];

  if (mode === "price_asc") {
    arr.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  } else if (mode === "price_desc") {
    arr.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  }
  // default는 원래 순서 유지
  return arr;
}

function renderSeats(listEl, seats, matchId) {
  listEl.innerHTML = "";

  seats.forEach((s) => {
    const li = document.createElement("li");
    li.className = "seat-item" + (s.is_reserved ? " reserved" : "");

    const badgeClass = s.is_reserved ? "badge badge--no" : "badge badge--ok";
    const badgeText = statusText(s);

    // 버튼(예약 가능일 때만 활성)
    const actionHtml = s.is_reserved
      ? `<button class="btn btn-outline" disabled>예약 완료</button>`
      : `<button class="btn btn--primary">예매하기</button>`;

    li.innerHTML = `
      <div class="seat-head">
        <div>
          <h3 class="seat-title">${seatLabel(s)}</h3>
          <p class="seat-meta">등급: <strong>${s.grade}</strong></p>
        </div>
        <span class="${badgeClass}">${badgeText}</span>
      </div>

      <div class="seat-price">${formatPrice(s.price)}원</div>

      <div class="seat-actions">
        ${actionHtml}
      </div>
    `;

    if (!s.is_reserved) {
      // 카드 전체 클릭도 가능 + 버튼 클릭도 가능
      li.style.cursor = "pointer";

      li.addEventListener("click", (e) => {
        // 버튼 눌렀을 때도 여기로 오니까 그대로 예약 처리
        handleReserveSeat(matchId, s);
      });

      // 버튼만 별도 UX 주고 싶으면(중복 confirm 방지) 아래처럼:
      const btn = li.querySelector("button");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleReserveSeat(matchId, s);
      });
    }

    listEl.appendChild(li);
  });
}

async function loadSeats() {
  const matchId = getMatchId();
  if (!matchId) {
    alert("match_id가 없습니다!");
    return;
  }

  const titleEl = document.getElementById("match-title");
  if (titleEl) titleEl.textContent = `경기 ID: ${matchId} 좌석 목록`;

  const listEl = document.getElementById("seat-list");
  const sortEl = document.getElementById("sort-select");

  try {
    const res = await fetch(`${API_BASE}/api/matches/${matchId}/seats/`);
    const seats = await res.json();

    // 처음 렌더
    const mode = sortEl ? sortEl.value : "default";
    renderSeats(listEl, sortSeats(seats, mode), matchId);

    // 정렬 바인딩
    if (sortEl) {
      sortEl.addEventListener("change", () => {
        renderSeats(listEl, sortSeats(seats, sortEl.value), matchId);
      });
    }
  } catch (err) {
    console.error(err);
    alert("좌석 목록을 불러오지 못했습니다.");
  }
}

async function handleReserveSeat(matchId, seat) {
  const userId = getUserId();
  if (!userId) {
    if (confirm("로그인이 필요합니다. 로그인 페이지로 이동할까요?")) {
      window.location.href = "login.html";
    }
    return;
  }

  const ok = confirm(
    `${seatLabel(seat)}\n` +
    `${formatPrice(seat.price)}원으로 예매할까요?`
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/reservations/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: parseInt(userId, 10),
        match_id: matchId,
        seat_id: seat.seat_id,
        amount: seat.price,
        method: "card",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "예매 실패");
    }

    const params = new URLSearchParams({
      res_id: data.reservation_id,
      match_id: matchId,
      seat_label: seatLabel(seat),
      price: seat.price,
    });
    window.location.href = `complete.html?${params.toString()}`;
  } catch (err) {
    alert(err.message);
  }
}

document.addEventListener("DOMContentLoaded", loadSeats);
