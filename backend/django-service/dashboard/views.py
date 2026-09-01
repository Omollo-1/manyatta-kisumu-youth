from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Sum, Count
from django.shortcuts import render

from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from registration.models import MemberRegistration
from payments.models import Payment


def _compute_stats():
    registrations = MemberRegistration.objects.all()
    payments = Payment.objects.all()

    total_collected = payments.filter(status=Payment.Status.SUCCESS).aggregate(
        total=Sum('amount')
    )['total'] or 0

    by_provider = (
        payments.filter(status=Payment.Status.SUCCESS)
        .values('provider')
        .annotate(total=Sum('amount'), count=Count('id'))
        .order_by('-total')
    )

    by_category = (
        registrations.values('membership_category')
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    return {
        'total_members': registrations.count(),
        'active_members': registrations.filter(status=MemberRegistration.Status.ACTIVE).count(),
        'pending_payment': registrations.filter(status=MemberRegistration.Status.PENDING_PAYMENT).count(),
        'total_collected': float(total_collected),
        'pending_payments_count': payments.filter(status=Payment.Status.PENDING).count(),
        'failed_payments_count': payments.filter(status=Payment.Status.FAILED).count(),
        'collected_by_provider': list(by_provider),
        'members_by_category': list(by_category),
        'provider_labels': [row['provider'].upper() for row in by_provider],
        'provider_values': [float(row['total']) for row in by_provider],
        'category_labels': [row['membership_category'].title() for row in by_category],
        'category_values': [row['count'] for row in by_category],
        'recent_members': list(
            registrations.order_by('-created_at')[:8].values(
                'id', 'full_name', 'parish', 'membership_category', 'status', 'membership_number', 'created_at'
            )
        ),
        'recent_payments': list(
            payments.select_related('registration').order_by('-created_at')[:8].values(
                'id', 'registration__full_name', 'provider', 'amount', 'currency', 'status', 'created_at'
            )
        ),
    }


class DashboardStatsAPIView(APIView):
    """
    GET /api/dashboard/stats/
    JSON version of the dashboard, for the committee's own tools or a future
    admin front-end. Requires a logged-in staff user (log in at /admin/ first
    — DRF's session auth reuses that same login).
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(_compute_stats())


@staff_member_required
def dashboard_view(request):
    """
    GET /dashboard/
    A simple server-rendered reporting page for the committee — log in at
    /admin/ first, then visit this page for a friendlier summary than raw
    Django admin list views.
    """
    return render(request, 'dashboard/index.html', {'stats': _compute_stats()})
