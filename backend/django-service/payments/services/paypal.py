"""
Minimal PayPal REST API client (Orders v2) — create an order, then capture
it once the member approves payment on PayPal's site.

Docs: https://developer.paypal.com/docs/api/orders/v2/
"""
import requests
from django.conf import settings

BASE_URLS = {
    'sandbox': 'https://api-m.sandbox.paypal.com',
    'production': 'https://api-m.paypal.com',
}


class PayPalError(Exception):
    pass


class PayPalClient:
    def __init__(self):
        self.base_url = BASE_URLS.get(settings.PAYPAL_ENV, BASE_URLS['sandbox'])
        self.client_id = settings.PAYPAL_CLIENT_ID
        self.client_secret = settings.PAYPAL_CLIENT_SECRET

    def get_access_token(self):
        if not self.client_id or not self.client_secret:
            raise PayPalError(
                'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set. '
                'Get sandbox credentials from https://developer.paypal.com'
            )
        resp = requests.post(
            f'{self.base_url}/v1/oauth2/token',
            auth=(self.client_id, self.client_secret),
            data={'grant_type': 'client_credentials'},
            timeout=15,
        )
        if resp.status_code != 200:
            raise PayPalError(f'Failed to get PayPal access token: {resp.status_code} {resp.text}')
        return resp.json()['access_token']

    def create_order(self, amount, currency, reference_id):
        """Amount here should already be converted to a PayPal-supported
        currency (e.g. USD) before calling this — M-Pesa/local fees are in KES."""
        token = self.get_access_token()
        payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'reference_id': reference_id,
                'amount': {'currency_code': currency, 'value': f'{amount:.2f}'},
            }],
        }
        resp = requests.post(
            f'{self.base_url}/v2/checkout/orders',
            json=payload,
            headers={'Authorization': f'Bearer {token}'},
            timeout=15,
        )
        if resp.status_code not in (200, 201):
            raise PayPalError(f'Failed to create PayPal order: {resp.status_code} {resp.text}')
        return resp.json()

    def capture_order(self, order_id):
        token = self.get_access_token()
        resp = requests.post(
            f'{self.base_url}/v2/checkout/orders/{order_id}/capture',
            headers={'Authorization': f'Bearer {token}'},
            timeout=15,
        )
        if resp.status_code not in (200, 201):
            raise PayPalError(f'Failed to capture PayPal order: {resp.status_code} {resp.text}')
        return resp.json()
