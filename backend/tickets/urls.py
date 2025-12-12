from django.urls import path
from . import views

urlpatterns = [
    # 경기 목록
    path("matches/", views.match_list, name="match_list"),
    # 특정 경기 좌석 목록
    path("matches/<int:match_id>/seats/", views.match_seat_list, name="match_seat_list"),
    # 예매 생성
    path("reservations/", views.create_reservation, name="create_reservation"),
    # 예매 취소
    path("reservations/<int:res_id>/cancel/", views.cancel_reservation, name="cancel_reservation"),
    path("my/reservations/", views.my_reservations, name="my_reservations"),

    path("auth/login/", views.login_or_signup, name="login_or_signup"),
    path("admin/login/", views.admin_login, name="admin_login"),
    path("admin/match-stats/", views.admin_match_stats, name="admin_match_stats"),
    path("admin/abuse/", views.admin_abuse_candidates, name="admin_abuse"),
    path("admin/cancel-history/", views.admin_cancel_history, name="admin_cancel_history"),


]
