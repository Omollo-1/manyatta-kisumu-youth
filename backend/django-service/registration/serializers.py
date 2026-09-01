from rest_framework import serializers
from .models import MemberRegistration


class MemberRegistrationSerializer(serializers.ModelSerializer):
    subscription_amount = serializers.ReadOnlyField()

    class Meta:
        model = MemberRegistration
        fields = [
            'id',
            # Section A: Personal Information
            'full_name', 'national_id', 'date_of_birth', 'gender', 'marital_status',
            'phone', 'email', 'postal_address', 'residence', 'occupation', 'institution',
            # Section B: Church & Youth Details
            'parish', 'is_baptised', 'is_confirmed', 'other_church_roles',
            'date_of_joining', 'membership_category',
            # Section C: Next of Kin
            'next_of_kin_name', 'next_of_kin_relationship', 'next_of_kin_phone', 'next_of_kin_alt_phone',
            # Payment / status
            'subscription_amount', 'status', 'membership_number',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'date_of_joining', 'status', 'membership_number', 'created_at', 'updated_at',
        ]
