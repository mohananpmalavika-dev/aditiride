import { get, query, run } from '../db/index.js';
import { getPgPool, queryPg, getPg, runPg } from '../db/connection.js';
import { Booking } from '../types/index.js';

export class BookingRepository {
  public static async findById(id: string): Promise<Booking | undefined> {
    if (getPgPool()) {
      return getPg<Booking>('SELECT * FROM bookings WHERE id = $1', [id]);
    }
    return get<Booking>('SELECT * FROM bookings WHERE id = ?', [id]);
  }

  public static async updateStatus(
    bookingId: string,
    status: string,
    additionalFields: Record<string, any> = {}
  ): Promise<void> {
    if (getPgPool()) {
      await runPg('UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
        status,
        bookingId
      ]);
      return;
    }

    run("UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?", [
      status,
      bookingId
    ]);
  }
}
