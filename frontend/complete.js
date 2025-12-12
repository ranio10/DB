function getParams() {
  return new URLSearchParams(window.location.search);
}

document.addEventListener("DOMContentLoaded", () => {
  const params = getParams();
  const resId = params.get("res_id");
  const matchId = params.get("match_id");
  const seatLabel = params.get("seat_label");
  const price = params.get("price");

  const msgEl = document.getElementById("message");
  msgEl.textContent =
    `예매가 완료되었습니다! (예약번호: ${resId}) ` +
    `경기 ID: ${matchId}, 좌석: ${seatLabel}, 가격: ${price}원`;
});
