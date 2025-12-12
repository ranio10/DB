const API_BASE = "http://localhost:8000";

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!name || !email) {
    alert("이름과 이메일을 입력해주세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, phone }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "로그인 실패");
    }

    const data = await res.json();
    // user_id를 localStorage에 저장
    localStorage.setItem("user_id", data.user_id);
    localStorage.setItem("user_name", data.name);

    const statusEl = document.getElementById("status");
    statusEl.textContent = `${data.name}님 로그인 완료! (user_id=${data.user_id})`;

    // 바로 경기 목록으로 넘기고 싶으면:
    // window.location.href = "index.html";
  } catch (err) {
    alert(err.message);
  }
});
