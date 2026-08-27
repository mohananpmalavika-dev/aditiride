import { get, query, run } from '../db/index.js';
import { getPgPool, queryPg, getPg, runPg } from '../db/connection.js';
import { Payment } from '../types/index.js';
import { PaymentIntentRecord } from '../services/PaymentService.js';

export class PaymentRepository {
  public static async findIntentByIdempotencyKey(key: string): Promise<PaymentIntentRecord | undefined> {
    if (getPgPool()) {
      return getPg<PaymentIntentRecord>('SELECT * FROM payment_intents WHERE idempotency_key = $1', [key]);
    }
    return get<PaymentIntentRecord>('SELECT * FROM payment_intents WHERE idempotency_key = ?', [key]);
  }

  public static async findIntentByProviderOrderId(orderId: string): Promise<PaymentIntentRecord | undefined> {
    if (getPgPool()) {
      return getPg<PaymentIntentRecord>('SELECT * FROM payment_intents WHERE provider_order_id = $1', [orderId]);
    }
    return get<PaymentIntentRecord>('SELECT * FROM payment_intents WHERE provider_order_id = ?', [orderId]);
  }

  public static async createPaymentIntent(intent: {
    id: string;
    booking_id: string;
    user_id: string;
    amount_paise: number;
    currency: string;
    provider: string;
    provider_order_id?: string;
    status: string;
    idempotency_key: string;
  }): Promise<void> {
    if (getPgPool()) {
      await runPg(
        `INSERT INTO payment_intents (id, booking_id, user_id, amount_paise, currency, provider, provider_order_id, status, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          intent.id,
          intent.booking_id,
          intent.user_id,
          intent.amount_paise,
          intent.currency,
          intent.provider,
          intent.provider_order_id || null,
          intent.status,
          intent.idempotency_key
        ]
      );
      return;
    }

    run(
      `INSERT INTO payment_intents (id, booking_id, user_id, amount_paise, currency, provider, provider_order_id, status, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        intent.id,
        intent.booking_id,
        intent.user_id,
        intent.amount_paise,
        intent.currency,
        intent.provider,
        intent.provider_order_id || null,
        intent.status,
        intent.idempotency_key
      ]
    );
  }
}
