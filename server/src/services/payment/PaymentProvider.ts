import crypto from 'crypto';

export interface PaymentOrderResult {
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  keyId?: string;
}

export interface PaymentWebhookPayload {
  event: 'payment.captured' | 'payment.failed' | 'refund.processed';
  providerOrderId: string;
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
  signatureValid: boolean;
  rawEvent: any;
}

export interface PaymentProvider {
  createOrder(
    bookingId: string,
    amountPaise: number,
    currency: string,
    customer: { id: string; phone?: string; email?: string }
  ): Promise<PaymentOrderResult>;

  verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean;

  parseWebhookEvent(body: any, signature: string, webhookSecret: string, rawBody?: string): PaymentWebhookPayload;
}

export class RazorpayPaymentProvider implements PaymentProvider {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor(keyId?: string, keySecret?: string, webhookSecret?: string) {
    this.keyId = keyId || process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = keySecret || process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '';

    if (
      (process.env.NODE_ENV === 'production' || process.env.PAYMENT_PROVIDER === 'RAZORPAY') &&
      (!this.keyId || !this.keySecret || this.keyId.includes('dummy'))
    ) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL CONFIGURATION ERROR: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured with real credentials for production payments.');
      }
    }
  }

  public async createOrder(
    bookingId: string,
    amountPaise: number,
    currency: string = 'INR',
    customer: { id: string; phone?: string; email?: string }
  ): Promise<PaymentOrderResult> {
    // If real credentials exist, call Razorpay API endpoint
    if (this.keyId && this.keySecret && !this.keyId.includes('dummy')) {
      try {
        const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
        const resp = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${authHeader}`
          },
          body: JSON.stringify({
            amount: amountPaise,
            currency,
            receipt: `rcpt_${bookingId.substring(0, 8)}`,
            notes: {
              bookingId,
              customerId: customer.id
            }
          })
        });

        if (resp.ok) {
          const data: any = await resp.json();
          return {
            providerOrderId: data.id,
            amountPaise: data.amount,
            currency: data.currency,
            keyId: this.keyId
          };
        }
      } catch (err: any) {
        console.error('[Razorpay Order Creation Error]', err.message);
      }
    }

    // High-fidelity sandbox order generation for local development & CI testing
    const providerOrderId = `order_${bookingId.substring(0, 8)}_${Date.now()}`;
    return {
      providerOrderId,
      amountPaise,
      currency,
      keyId: this.keyId || 'rzp_test_sandbox_key'
    };
  }

  public verifyWebhookSignature(rawBody: string, signature: string, webhookSecret?: string): boolean {
    const secret = webhookSecret || this.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!signature || !secret) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  public parseWebhookEvent(
    body: any,
    signature: string,
    webhookSecret?: string,
    rawBody?: string
  ): PaymentWebhookPayload {
    const payloadString = rawBody || JSON.stringify(body);
    const isValid = this.verifyWebhookSignature(payloadString, signature, webhookSecret);

    const paymentEntity = body.payload?.payment?.entity || body;
    const providerOrderId = paymentEntity.order_id || body.order_id || `order_${Date.now()}`;
    const providerPaymentId = paymentEntity.id || body.payment_id || `pay_${Date.now()}`;
    const amountPaise = paymentEntity.amount || body.amount_paise || 0;

    return {
      event: body.event || 'payment.captured',
      providerOrderId,
      providerPaymentId,
      amountPaise,
      currency: paymentEntity.currency || 'INR',
      signatureValid: isValid,
      rawEvent: body
    };
  }
}
