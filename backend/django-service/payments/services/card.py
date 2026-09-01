"""
Card payments via Flutterwave (swap for Paystack/Stripe with the same
two-method shape if you'd rather use one of those).

Docs: https://developer.flutterwave.com/docs/collecting-payments/standard

We never touch raw card numbers ourselves — Flutterwave's hosted payment
page (returned as `payment_link` below) collects card details, so PCI
compliance stays on their side, not ours.
"""
import uuid
import requests
from django.conf import settings

BASE_URL = 'https://api.flutterwave.com/v3'


class CardPaymentError(Exception):
    pass


class FlutterwaveClient:
    def __init__(self):
        self.secret_key = settings.FLUTTERWAVE_SECRET_KEY

    def initiate_payment(self, amount, currency, email, full_name, redirect_url, reference=None):
        if not self.secret_key:
            raise CardPaymentError(
                'FLUTTERWAVE_SECRET_KEY is not set. Get sandbox keys from '
                'https://dashboard.flutterwave.com'
            )

        tx_ref = reference or f'mkdy-{uuid.uuid4().hex[:12]}'
        payload = {
            'tx_ref': tx_ref,
            'amount': str(amount),
            'currency': currency,
            'redirect_url': redirect_url,
            'customer': {'email': email, 'name': full_name},
            'customizations': {'title': 'Manyatta Kisumu Diocese Youth — Membership'},
        }
        resp = requests.post(
            f'{BASE_URL}/payments',
            json=payload,
            headers={'Authorization': f'Bearer {self.secret_key}'},
            timeout=15,
        )
        if resp.status_code not in (200, 201):
            raise CardPaymentError(f'Failed to initiate card payment: {resp.status_code} {resp.text}')

        data = resp.json()
        return {
            'tx_ref': tx_ref,
            'payment_link': data.get('data', {}).get('link'),
            'raw': data,
        }

    def verify_payment(self, transaction_id):
        resp = requests.get(
            f'{BASE_URL}/transactions/{transaction_id}/verify',
            headers={'Authorization': f'Bearer {self.secret_key}'},
            timeout=15,
        )
        if resp.status_code != 200:
            raise CardPaymentError(f'Failed to verify card payment: {resp.status_code} {resp.text}')
        return resp.json()
