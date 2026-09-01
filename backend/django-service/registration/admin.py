from django.contrib import admin
from .models import MemberRegistration


@admin.register(MemberRegistration)
class MemberRegistrationAdmin(admin.ModelAdmin):
    list_display = (
        'full_name', 'email', 'phone', 'parish', 'membership_category',
        'status', 'membership_number', 'created_at',
    )
    list_filter = ('status', 'membership_category', 'gender', 'marital_status', 'is_baptised', 'is_confirmed', 'parish')
    search_fields = ('full_name', 'email', 'phone', 'national_id', 'membership_number')
    readonly_fields = ('date_of_joining', 'created_at', 'updated_at', 'subscription_amount')
    ordering = ('-created_at',)

    fieldsets = (
        ('Section A — Personal Information', {
            'fields': (
                'full_name', 'national_id', 'date_of_birth', 'gender', 'marital_status',
                'phone', 'email', 'postal_address', 'residence', 'occupation', 'institution',
            )
        }),
        ('Section B — Church & Youth Details', {
            'fields': (
                'parish', 'is_baptised', 'is_confirmed', 'other_church_roles',
                'date_of_joining', 'membership_category',
            )
        }),
        ('Section C — Next of Kin / Emergency Contact', {
            'fields': (
                'next_of_kin_name', 'next_of_kin_relationship',
                'next_of_kin_phone', 'next_of_kin_alt_phone',
            )
        }),
        ('Membership & Payment', {
            'fields': ('status', 'membership_number', 'subscription_amount', 'created_at', 'updated_at')
        }),
    )
