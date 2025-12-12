from .models import Match, Seat, Reservation, Payment, Team, User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction, DatabaseError, connection
from django.shortcuts import get_object_or_404
from django.utils import timezone
import json

from .models import Match, Seat, Reservation, Payment, Team


def log_request(user_id, match_id, seat_id, success, reason, request):
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO request_log
            (user_id, match_id, seat_id, action, success, fail_reason, ip, user_agent)
            VALUES (%s, %s, %s, 'reserve_attempt', %s, %s, %s, %s)
        """, [
            user_id,
            match_id,
            seat_id,
            1 if success else 0,
            reason,
            request.META.get("REMOTE_ADDR"),
            request.META.get("HTTP_USER_AGENT")
        ])

def match_list(request):
    """
    경기 목록 조회
    GET /api/matches/
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET만 가능합니다."}, status=405)

    matches = Match.objects.select_related("home_team", "away_team").all().order_by("match_date")

    data = []
    for m in matches:
        data.append({
            "match_id": m.match_id,
            "match_date": m.match_date.isoformat(),
            "stadium": m.stadium,
            "total_seats": m.total_seats,
            "home_team": m.home_team.team_name,
            "away_team": m.away_team.team_name,
        })

    return JsonResponse(data, safe=False)


def match_seat_list(request, match_id):
    """
    경기별 좌석 목록 조회
    GET /api/matches/<match_id>/seats/
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET만 가능합니다."}, status=405)

    # 존재하지 않는 경기면 404
    get_object_or_404(Match, pk=match_id)

    seats = Seat.objects.filter(match_id=match_id).order_by("block", "row_no", "seat_number")
    data = []
    for s in seats:
        data.append({
            "seat_id": s.seat_id,
            "block": s.block,
            "row_no": s.row_no,
            "seat_number": s.seat_number,
            "grade": s.grade,
            "price": s.price,
            "is_reserved": bool(s.is_reserved),
        })
    return JsonResponse(data, safe=False)


@csrf_exempt
@transaction.atomic
def create_reservation(request):
    """
    예매 + 결제 생성
    POST /api/reservations/
    body(JSON):
    {
      "user_id": 1,
      "match_id": 3,
      "seat_id": 10,
      "amount": 30000,
      "method": "card"
    }
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST만 가능합니다."}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON 형식이 올바르지 않습니다."}, status=400)

    user_id = data.get("user_id")
    match_id = data.get("match_id")
    seat_id = data.get("seat_id")
    amount = data.get("amount")
    method = data.get("method")

    if not all([user_id, match_id, seat_id, amount, method]):
        return JsonResponse({"error": "user_id, match_id, seat_id, amount, method 모두 필요합니다."}, status=400)

    try:
        # 존재 여부만 미리 확인 (외래키 에러 방지차원)
        # 실제 제약은 DB FK + 트리거가 다시 한 번 체크해 줌
        get_object_or_404(Seat, pk=seat_id)
        get_object_or_404(Match, pk=match_id)

        # 1) 예매 생성 -> 여기서 트리거들이 좌석 중복/1인 4좌석/좌석 상태 변경 처리
        reservation = Reservation.objects.create(
            user_id=user_id,
            match_id=match_id,
            seat_id=seat_id,
            res_date=timezone.now(),
            status="active",
        )

        # 2) 결제 정보 생성
        Payment.objects.create(
            res=reservation,
            amount=amount,
            method=method,
            pay_date=timezone.now(),
        )

    # ✅ 성공 로그
        log_request(user_id, match_id, seat_id, True, None, request)

        return JsonResponse(
            {"message": "예매 성공", "reservation_id": reservation.res_id},
            status=201,
        )

    except DatabaseError as e:
        # ✅ 실패 로그 (트리거/제약조건 에러 포함)
        msg = str(e)

        # (선택) 프론트가 보기 좋게 메시지 정리
        if "이미 예약된 좌석" in msg:
            msg = "이미 예약된 좌석입니다."
        elif "최대 4좌석" in msg:
            msg = "한 경기당 최대 4좌석까지 예매 가능합니다."
        elif "경기가 일치하지" in msg:
            msg = "예약 경기와 좌석의 경기가 일치하지 않습니다."
        else:
            msg = "예매 처리 중 오류가 발생했습니다."

        log_request(user_id, match_id, seat_id, False, msg, request)
        return JsonResponse({"error": msg}, status=400)

    except Exception as e:
        msg = str(e)
        log_request(user_id, match_id, seat_id, False, msg, request)
        return JsonResponse({"error": msg}, status=400)


@csrf_exempt
@transaction.atomic
def cancel_reservation(request, res_id):
    """
    예매 취소
    POST /api/reservations/<res_id>/cancel/

    - reservations.status 를 'cancelled' 로 변경
    - DB 트리거(trg_reservation_after_update_cancel)가
      자동으로 cancel_log INSERT + seats.is_reserved = 0 처리
    - 너무 많이 취소한 경우 제한을 걸 수도 있음
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST 메서드만 허용됩니다."}, status=405)

    # 예매 레코드 잠금 (동시성 방지)
    res = get_object_or_404(Reservation.objects.select_for_update(), pk=res_id)

    if res.status == "cancelled":
        return JsonResponse({"error": "이미 취소된 예매입니다."}, status=400)

    user_id = res.user_id
    match_id = res.match_id

    # ✅ 선택 기능: 너무 많이 취소한 사용자 제한
    # 여기서는 "같은 경기에서 3회 이상 취소한 경우" 차단 예시
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM cancel_log c
            JOIN reservations r ON c.res_id = r.res_id
            WHERE c.user_id = %s
              AND r.match_id = %s
            """,
            [user_id, match_id],
        )
        cancel_count = cursor.fetchone()[0]

    if cancel_count >= 3:
        # 너무 많이 취소함 → abuse_log에 기록해도 됨
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO abuse_log (user_id, match_id, event_type)
                VALUES (%s, %s, %s)
                """,
                [user_id, match_id, "too_many_cancels"],
            )
        return JsonResponse(
            {"error": "해당 경기에 대해 취소 한도를 초과했습니다."},
            status=400,
        )

    # 🔁 실제 취소 처리: status만 바꾸면 트리거가 나머지 처리
    res.status = "cancelled"
    res.save()

    return JsonResponse(
        {
            "message": "예매가 취소되었습니다.",
            "res_id": res.res_id,
            "status": res.status,
        }
    )


@csrf_exempt
def login_or_signup(request):
    """
    간단 로그인/회원가입
    POST /api/auth/login/

    body JSON:
    {
      "name": "홍길동",
      "email": "test@example.com",
      "phone": "010-1234-5678"
    }

    - email로 users 테이블에서 조회
    - 없으면 새로 INSERT (회원가입)
    - 있으면 그 유저로 로그인 처리
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST만 가능합니다."}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON 형식이 올바르지 않습니다."}, status=400)

    email = data.get("email")
    name = data.get("name")
    phone = data.get("phone")

    if not email or not name:
        return JsonResponse({"error": "name, email은 필수입니다."}, status=400)

    # 이미 존재하는지 확인
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            "name": name,
            "phone": phone,
            "role": "user",
        },
    )

    if not created:
        # 이미 있던 유저면 이름/전화번호 갱신 정도는 해도 됨 (선택)
        updated = False
        if user.name != name:
            user.name = name
            updated = True
        if phone and user.phone != phone:
            user.phone = phone
            updated = True
        if updated:
            user.save()

    return JsonResponse(
        {
            "user_id": user.user_id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "is_new": created,
        }
    )

@csrf_exempt
def my_reservations(request):
    """
    GET /api/my/reservations/?user_id=1

    로그인한 사용자의 예매 내역 조회
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET만 가능합니다."}, status=405)

    user_id = request.GET.get("user_id")
    if not user_id:
        return JsonResponse({"error": "user_id가 필요합니다."}, status=400)

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "해당 사용자를 찾을 수 없습니다."}, status=404)

    qs = (
        Reservation.objects
        .filter(user=user)
        .select_related("match", "seat")
        .prefetch_related("payment_set")
        .order_by("-res_date")
    )

    results = []
    for r in qs:
        match = r.match
        seat = r.seat
        payment = r.payment_set.first() if hasattr(r, "payment_set") else None

        results.append({
            "res_id": r.res_id,
            "status": r.status,
            "res_date": r.res_date,
            "match": {
                "match_id": match.match_id,
                "match_date": match.match_date,
                "stadium": match.stadium,
            },
            "seat": {
                "seat_id": seat.seat_id,
                "block": seat.block,
                "row_no": seat.row_no,
                "seat_number": seat.seat_number,
                "grade": seat.grade,
                "price": seat.price,
            },
            "payment": {
                "amount": payment.amount if payment else None,
                "method": payment.method if payment else None,
                "pay_date": payment.pay_date if payment else None,
            }
        })

    return JsonResponse(results, safe=False)

from django.db import connection

@csrf_exempt
def admin_match_stats(request):
    """
    GET /api/admin/match-stats/

    match_stats 뷰에서 경기별 점유율, 매출, 예매 건수 조회
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET만 가능합니다."}, status=405)

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                match_id,
                match_date,
                stadium,
                total_seats,
                seat_count,
                reserved_seats,
                occupancy_rate,
                total_sales,
                reservation_count
            FROM match_stats
            ORDER BY match_date ASC;
        """)
        rows = cursor.fetchall()

    cols = [
        "match_id",
        "match_date",
        "stadium",
        "total_seats",
        "seat_count",
        "reserved_seats",
        "occupancy_rate",
        "total_sales",
        "reservation_count",
    ]

    results = [
        dict(zip(cols, row))
        for row in rows
    ]

    return JsonResponse(results, safe=False)

def admin_abuse_candidates(request):
    """
    GET /api/admin/abuse/
    취소 로그 기반 이상 예매(과도한 취소) 후보 목록

    기준:
      - cancel_log 에서 user_id 별 cancel_count >= 3 인 사용자
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET만 가능합니다."}, status=405)

    # DB에서 직접 집계
    with connection.cursor() as cur:
        cur.execute("""
            SELECT
                user_id,
                MIN(res_id) AS res_id,        -- 대표 예매 ID 하나
                COUNT(*) AS cancel_count      -- 총 취소 횟수
            FROM cancel_log
            GROUP BY user_id
            HAVING COUNT(*) >= 3
            ORDER BY cancel_count DESC;
        """)
        rows = cur.fetchall()

    data = []
    for r in rows:
        data.append({
            "user_id": r[0],
            "res_id": r[1],
            "cancel_count": r[2],
        })

    return JsonResponse(data, safe=False)

@csrf_exempt
def admin_login(request):
  """
  POST /api/admin/login/

  body: { "email": "admin@example.com" }

  users 테이블에서 role='admin' 인 계정만 로그인 허용
  """
  if request.method != "POST":
      return JsonResponse({"error": "POST만 가능합니다."}, status=405)

  try:
      data = json.loads(request.body.decode("utf-8"))
  except json.JSONDecodeError:
      return JsonResponse({"error": "JSON 형식이 올바르지 않습니다."}, status=400)

  email = data.get("email")
  if not email:
      return JsonResponse({"error": "email이 필요합니다."}, status=400)

  try:
      user = User.objects.get(email=email, role="admin")
  except User.DoesNotExist:
      return JsonResponse({"error": "관리자 계정을 찾을 수 없습니다."}, status=401)

  # 여기서는 비밀번호 없이 email만으로 '관리자 로그인' 처리 (과제용)
  return JsonResponse(
      {
          "user_id": user.user_id,
          "name": user.name,
          "email": user.email,
          "role": user.role,
      }
  )

@csrf_exempt
def admin_cancel_history(request):
    """
    GET /api/admin/cancel-history/
    전체 취소 이력 조회 (관리자용)

    ※ user_id / match_id 파라미터 없이 전체 로그 반환
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET만 가능합니다."}, status=405)

    with connection.cursor() as cur:
        cur.execute("""
            SELECT
                c.cancel_id,
                c.res_id,
                c.user_id,
                c.cancel_date,
                c.reason
            FROM cancel_log c
            ORDER BY c.cancel_date DESC;
        """)
        rows = cur.fetchall()

    data = []
    for r in rows:
        data.append({
            "cancel_id": r[0],
            "res_id": r[1],
            "user_id": r[2],
            "cancel_date": r[3].strftime("%Y-%m-%d %H:%M:%S"),
            "reason": r[4],
        })

    return JsonResponse(data, safe=False)
@csrf_exempt
def my_reservations(request):
    """
    GET /api/my/reservations/?user_id=1

    특정 사용자의 예매 내역을 경기/좌석/결제 정보와 함께 반환
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET만 가능합니다."}, status=405)

    user_id = request.GET.get("user_id")
    if not user_id:
        return JsonResponse({"error": "user_id가 필요합니다."}, status=400)

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    r.res_id,
                    r.res_date,
                    r.status,
                    m.match_id,
                    m.match_date,
                    m.stadium,
                    ht.team_name AS home_team,
                    at.team_name AS away_team,
                    s.seat_id,
                    s.block,
                    s.row_no,
                    s.seat_number,
                    s.grade,
                    s.price,
                    p.pay_id,
                    p.amount,
                    p.method,
                    p.pay_date
                FROM reservations r
                JOIN matches m ON r.match_id = m.match_id
                JOIN teams   ht ON m.home_team_id = ht.team_id
                JOIN teams   at ON m.away_team_id = at.team_id
                JOIN seats   s  ON r.seat_id = s.seat_id
                LEFT JOIN payments p ON r.res_id = p.res_id
                WHERE r.user_id = %s
                ORDER BY r.res_date DESC
                """,
                [user_id],
            )
            rows = cursor.fetchall()

        cols = [
            "res_id",
            "res_date",
            "status",
            "match_id",
            "match_date",
            "stadium",
            "home_team",
            "away_team",
            "seat_id",
            "block",
            "row_no",
            "seat_number",
            "grade",
            "price",
            "pay_id",
            "amount",
            "method",
            "pay_date",
        ]

        results = [dict(zip(cols, row)) for row in rows]

        return JsonResponse(results, safe=False)

    except Exception as e:
        # 서버 내부 에러 확인용
        print("my_reservations error:", e)
        return JsonResponse({"error": "예매 내역 조회 중 오류가 발생했습니다."}, status=500)

