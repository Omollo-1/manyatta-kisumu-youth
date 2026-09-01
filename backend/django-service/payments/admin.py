from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'registration', 'provider', 'amount', 'currency',
        'status', 'provider_reference', 'created_at',
    )
    list_filter = ('provider', 'status', 'currency')
    search_fields = (
        'registration__full_name', 'registration__email',
        'phone_number', 'checkout_request_id', 'provider_reference',
    )
    readonly_fields = ('created_at', 'updated_at', 'raw_response')
    ordering = ('-created_at',)
