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
    this.keyId = keyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_aditi_dummy';
    this.keySecret = keySecret || process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_dummy';
    this.webhookSecret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_dummy';
  }

  public async createOrder(
    bookingId: string,
    amountPaise: number,
    currency: string = 'INR',
    customer: { id: string; phone?: string; email?: string }
  ): Promise<PaymentOrderResult> {
    const providerOrderId = `order_${bookingId.substring(0, 8)}_${Date.now()}`;
    return {
      providerOrderId,
      amountPaise,
      currency,
      keyId: this.keyId
    };
  }

  public verifyWebhookSignature(rawBody: string, signature: string, webhookSecret?: string): boolean {
    const secret = webhookSecret || this.webhookSecret;
    if (!signature || !secret) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
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
