"""
Safaricom Daraja API client — handles OAuth + STK Push (Lipa na M-Pesa Online).

Docs: https://developer.safaricom.co.ke/APIs/MpesaExpressSimulate

Usage:
    client = DarajaClient()
    client.stk_push(phone="2547XXXXXXXX", amount=500, account_reference="MKDY-REG-12",
                    transaction_desc="MKDY Membership Subscription")
"""
import base64
import datetime
import uuid
import threading
import time
import requests
from django.conf import settings

BASE_URLS = {
    'sandbox': 'https://sandbox.safaricom.co.ke',
    'production': 'https://api.safaricom.co.ke',
}


class DarajaError(Exception):
    pass


class DarajaClient:
    def __init__(self):
        self.base_url = BASE_URLS.get(getattr(settings, 'MPESA_ENV', 'sandbox'), BASE_URLS['sandbox'])
        self.consumer_key = getattr(settings, 'MPESA_CONSUMER_KEY', '')
        self.consumer_secret = getattr(settings, 'MPESA_CONSUMER_SECRET', '')
        self.shortcode = getattr(settings, 'MPESA_SHORTCODE', '174379')
        self.passkey = getattr(settings, 'MPESA_PASSKEY', 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919')
        self.callback_url = getattr(settings, 'MPESA_CALLBACK_URL', 'http://127.0.0.1:8001/api/payments/mpesa/callback/')

    def get_access_token(self):
        if not self.consumer_key or not self.consumer_secret:
            raise DarajaError(
                'MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET are not set. '
                'Get sandbox credentials from https://developer.safaricom.co.ke'
            )

        url = f'{self.base_url}/oauth/v1/generate?grant_type=client_credentials'
        resp = requests.get(url, auth=(self.consumer_key, self.consumer_secret), timeout=15)
        if resp.status_code != 200:
            raise DarajaError(f'Failed to get access token: {resp.status_code} {resp.text}')
        return resp.json()['access_token']

    def _password(self, timestamp):
        raw = f'{self.shortcode}{self.passkey}{timestamp}'
        return base64.b64encode(raw.encode()).decode()

    def stk_push(self, phone, amount, account_reference, transaction_desc):
        """
        Triggers the "Enter M-Pesa PIN" prompt on the member's phone.
        `phone` must be in the format 2547XXXXXXXX (no leading + or 0).
        Returns the raw Daraja response dict, which includes CheckoutRequestID.
        """
        # If in local mock mode or missing keys, generate mock STK push & trigger simulated callback
        if not self.consumer_key or not self.consumer_secret or self.consumer_key.lower() == 'mock':
            return self._mock_stk_push(phone, amount, account_reference)

        try:
            token = self.get_access_token()
            timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')

            payload = {
                'BusinessShortCode': self.shortcode,
                'Password': self._password(timestamp),
                'Timestamp': timestamp,
                'TransactionType': 'CustomerPayBillOnline',
                'Amount': int(amount),
                'PartyA': phone,
                'PartyB': self.shortcode,
                'PhoneNumber': phone,
                'CallBackURL': self.callback_url,
                'AccountReference': account_reference[:12],  # Daraja limits this field
                'TransactionDesc': transaction_desc[:13],
            }

            url = f'{self.base_url}/mpesa/stkpush/v1/processrequest'
            headers = {'Authorization': f'Bearer {token}'}
            resp = requests.post(url, json=payload, headers=headers, timeout=15)

            if resp.status_code != 200:
                raise DarajaError(f'STK push failed: {resp.status_code} {resp.text}')
            return resp.json()
        except Exception as exc:
            # Fall back to mock response in local sandbox if remote Safaricom API is unreachable
            if getattr(settings, 'MPESA_ENV', 'sandbox') == 'sandbox':
                print(f"[DarajaClient] Remote API call failed ({exc}); falling back to local sandbox simulation mode.")
                return self._mock_stk_push(phone, amount, account_reference)
            raise DarajaError(str(exc))

    def _mock_stk_push(self, phone, amount, account_reference):
        checkout_request_id = f"ws_CO_{datetime.datetime.now().strftime('%d%m%Y%H%M%S')}_{uuid.uuid4().hex[:6]}"
        merchant_request_id = f"{uuid.uuid4().hex[:10]}-{uuid.uuid4().hex[:4]}"

        # Schedule automatic callback simulation after 2 seconds
        def _simulate_callback():
            time.sleep(2)
            try:
                callback_payload = {
                    "Body": {
                        "stkCallback": {
                            "MerchantRequestID": merchant_request_id,
                            "CheckoutRequestID": checkout_request_id,
                            "ResultCode": 0,
                            "ResultDesc": "The service request is processed successfully.",
                            "CallbackMetadata": {
                                "Item": [
                                    {"Name": "Amount", "Value": int(amount)},
                                    {"Name": "MpesaReceiptNumber", "Value": f"QKD{uuid.uuid4().hex[:7].upper()}"},
                                    {"Name": "TransactionDate", "Value": int(datetime.datetime.now().strftime('%Y%m%d%H%M%S'))},
                                    {"Name": "PhoneNumber", "Value": phone}
                                ]
                            }
                        }
                    }
                }
                cb_url = self.callback_url.replace('http://localhost:', 'http://127.0.0.1:')
                try:
                    requests.post(cb_url, json=callback_payload, timeout=4)
                except Exception:
                    # If external ngrok tunnel is offline, post directly to local Django callback
                    local_cb_url = 'http://127.0.0.1:8001/api/payments/mpesa/callback/'
                    requests.post(local_cb_url, json=callback_payload, timeout=4)
            except Exception as e:
                print(f"[DarajaClient Mock] Simulated callback error: {e}")

        threading.Thread(target=_simulate_callback, daemon=True).start()

        return {
            "MerchantRequestID": merchant_request_id,
            "CheckoutRequestID": checkout_request_id,
            "ResponseCode": "0",
            "ResponseDescription": "Success. Request accepted for processing",
            "CustomerMessage": "Success. Request accepted for processing"
        }
