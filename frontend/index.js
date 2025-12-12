const API_BASE = "http://localhost:8000";

// localStorage 키 (프로젝트에서 쓰는 키들)
function getAccessToken() {
  return localStorage.getItem("access"); // 너가 토큰 쓰면 이게 핵심
}

function getStoredUser() {
  return {
    userId: localStorage.getItem("user_id"),
    userName: localStorage.getItem("user_name"),
    role: localStorage.getItem("user_role"), // 'admin' or 'user'
  };
}

// 서버에서 현재 유저 정보 가져오기 (토큰 기반)
async function fetchUserInfoByToken() {
  const token = getAccessToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/api/users/userinfo/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  return await res.json();
}

// 1) 헤더(UI) 업데이트
async function updateHeaderUI() {
  const userInfo = document.getElementById("user-info");
  const loginLink = document.getElementById("login-link");
  const mypageLink = document.getElementById("mypage-link");
  const adminLink = document.getElementById("admin-link"); // 없어도 됨
  const logoutBtn = document.getElementById("logout-btn");

  if (!userInfo || !loginLink || !mypageLink || !logoutBtn) return;

  // 1) 로컬에 user_id가 있으면 그걸 우선 사용
  let { userId, userName, role } = getStoredUser();

  // 2) 없으면 access 토큰으로 userinfo 조회해서 채움
  if (!userId) {
    const me = await fetchUserInfoByToken();
    if (me) {
      // 서버 응답 필드명은 프로젝트마다 달라서, 흔한 케이스로 대응
      userId = me.user_id ?? me.id ?? me.userId ?? "me";
      userName = me.username ?? me.name ?? me.user_name ?? "사용자";
      role = (me.role ?? me.user_role ?? "user").toLowerCase();

      // 다음부터는 빠르게 UI 갱신되게 저장
      localStorage.setItem("user_id", String(userId));
      localStorage.setItem("user_name", String(userName));
      localStorage.setItem("user_role", String(role));
    }
  }

  // 3) 최종적으로 로그인 여부 판단
  const isLoggedIn = !!userId;

  if (isLoggedIn) {
    const safeName = userName || "사용자";
    const safeRole = (role || "user").toLowerCase();

    userInfo.textContent = `${safeName}님 환영합니다!`;
    loginLink.style.display = "none";
    logoutBtn.style.display = "inline-block";

    // ✅ user면 마이페이지 보여주기
    if (safeRole === "admin") {
      mypageLink.style.display = "none";
      if (adminLink) adminLink.style.display = "inline-block";
    } else {
      mypageLink.style.display = "inline-block";
      if (adminLink) adminLink.style.display = "none";
    }
  } else {
    userInfo.textContent = "";
    loginLink.style.display = "inline-block";
    logoutBtn.style.display = "none";
    mypageLink.style.display = "none";
    if (adminLink) adminLink.style.display = "none";
  }
}

// 2) 경기 목록 불러오기
async function loadMatches() {
  try {
    const res = await fetch(`${API_BASE}/api/matches/`);

    if (!res.ok) {
      const text = await res.text();
      console.error("경기 목록 응답 오류:", res.status, text);
      alert("경기 목록을 불러오지 못했습니다. (서버 응답 오류)");
      return;
    }

    const matches = await res.json();
    const listEl = document.getElementById("match-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!matches.length) {
      listEl.innerHTML = "<li>등록된 경기가 없습니다.</li>";
      return;
    }

    matches.forEach((m) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="seats.html?match_id=${m.match_id}">
          ${m.match_date} — ${m.stadium} — ${m.home_team} vs ${m.away_team}
        </a>
      `;
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error("경기 목록 로딩 중 에러:", err);
    alert("경기 목록을 불러오지 못했습니다.");
  }
}

// 3) 초기화
document.addEventListener("DOMContentLoaded", async () => {
  await updateHeaderUI();
  loadMatches();

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // ✅ 전부 삭제
      localStorage.removeItem("user_id");
      localStorage.removeItem("user_name");
      localStorage.removeItem("user_role");
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");

      alert("로그아웃되었습니다.");
      location.reload();
    });
  }
});

