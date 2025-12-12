const API_BASE = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("admin-email");
  const btn = document.getElementById("admin-login-btn");

  btn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) {
      alert("이메일을 입력하세요.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "로그인에 실패했습니다.");
        return;
      }

      // 관리자 로그인 성공
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("user_name", data.name);
      localStorage.setItem("user_role", data.role);   // 'admin'
      localStorage.setItem("is_admin", "true");

      localStorage.setItem("admin_id", data.user_id);
      localStorage.setItem("admin_email", data.email);

      alert("관리자로 로그인되었습니다.");
      window.location.href = "admin.html";
    } catch (err) {
      console.error(err);
      alert("로그인 요청 중 오류가 발생했습니다.");
    }
  });
});
