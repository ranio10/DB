from django.db import models

class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    email = models.CharField(max_length=100, unique=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    role = models.CharField(max_length=10)

    class Meta:
        managed = False
        db_table = 'users'


class Team(models.Model):
    team_id = models.AutoField(primary_key=True)
    team_name = models.CharField(max_length=100, unique=True)
    league = models.CharField(max_length=50, null=True, blank=True)
    city = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'teams'


class Match(models.Model):
    match_id = models.AutoField(primary_key=True)
    home_team = models.ForeignKey(
        Team, related_name='home_matches',
        db_column='home_team_id', on_delete=models.DO_NOTHING
    )
    away_team = models.ForeignKey(
        Team, related_name='away_matches',
        db_column='away_team_id', on_delete=models.DO_NOTHING
    )
    match_date = models.DateTimeField()
    stadium = models.CharField(max_length=100)
    total_seats = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'matches'


class Seat(models.Model):
    seat_id = models.AutoField(primary_key=True)
    match = models.ForeignKey(
        Match, db_column='match_id', on_delete=models.DO_NOTHING
    )
    block = models.CharField(max_length=10)
    row_no = models.CharField(max_length=10)
    seat_number = models.CharField(max_length=10)
    grade = models.CharField(max_length=20)
    price = models.IntegerField()
    is_reserved = models.BooleanField()

    class Meta:
        managed = False
        db_table = 'seats'
        unique_together = (('match', 'block', 'row_no', 'seat_number'),)


class Reservation(models.Model):
    res_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        User, db_column='user_id', on_delete=models.DO_NOTHING
    )
    match = models.ForeignKey(
        Match, db_column='match_id', on_delete=models.DO_NOTHING
    )
    seat = models.ForeignKey(
        Seat, db_column='seat_id', on_delete=models.DO_NOTHING
    )
    res_date = models.DateTimeField()
    status = models.CharField(max_length=10)

    class Meta:
        managed = False
        db_table = 'reservations'


class Payment(models.Model):
    pay_id = models.AutoField(primary_key=True)
    res = models.OneToOneField(
        Reservation, db_column='res_id', on_delete=models.DO_NOTHING
    )
    amount = models.IntegerField()
    method = models.CharField(max_length=20)
    pay_date = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'payments'


class CancelLog(models.Model):
    cancel_id = models.AutoField(primary_key=True)
    res = models.ForeignKey(
        Reservation, db_column='res_id', on_delete=models.DO_NOTHING
    )
    user = models.ForeignKey(
        User, db_column='user_id', on_delete=models.DO_NOTHING
    )
    cancel_date = models.DateTimeField()
    reason = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'cancel_log'


class AbuseLog(models.Model):
    abuse_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        User, db_column='user_id', on_delete=models.DO_NOTHING
    )
    match = models.ForeignKey(
        Match, db_column='match_id', on_delete=models.DO_NOTHING
    )
    event_type = models.CharField(max_length=50)
    detected_time = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'abuse_log'


class MatchStats(models.Model):
    match_id = models.IntegerField(primary_key=True)
    match_date = models.DateTimeField()
    stadium = models.CharField(max_length=100)
    total_seats = models.IntegerField()
    seat_count = models.IntegerField()
    reserved_seats = models.IntegerField()
    occupancy_rate = models.FloatField()
    total_sales = models.FloatField()
    reservation_count = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'match_stats'

